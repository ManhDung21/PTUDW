"""Business logic for cart and favorite management."""

from __future__ import annotations

from typing import Optional, Tuple

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.collection import Collection
from pymongo.database import Database

from ...db.models import (
    CartDocument,
    CartItemDocument,
    FavoriteDocument,
    ProductDocument,
    ProductVariantDocument,
)
from ..catalog import service as catalog_service
from ..common.utils import utcnow


def carts_collection(db: Database) -> Collection:
    return db.get_collection("carts")


def favorites_collection(db: Database) -> Collection:
    return db.get_collection("favorites")


def _parse_object_id(value: Optional[str], label: str) -> Optional[ObjectId]:
    if value is None:
        return None
    try:
        return ObjectId(value)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label} không hợp lệ") from exc


def _variant_display_name(variant: Optional[ProductVariantDocument]) -> Optional[str]:
    if not variant:
        return None
    attributes = variant.get("attributes") or {}
    if not attributes:
        return variant.get("sku")
    return ", ".join(f"{key}: {value}" for key, value in attributes.items())


def _cart_thumbnail(product: ProductDocument) -> Optional[str]:
    if product.get("thumbnail_url"):
        return product["thumbnail_url"]
    images = product.get("image_urls") or []
    return images[0] if images else None


def _ensure_cart(db: Database, user_id: ObjectId) -> CartDocument:
    cart = carts_collection(db).find_one({"user_id": user_id})
    if cart:
        return cart

    doc: CartDocument = {
        "user_id": user_id,
        "items": [],
        "updated_at": utcnow(),
    }
    result = carts_collection(db).insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def _find_item_index(cart: CartDocument, product_id: ObjectId, variant_id: Optional[ObjectId]) -> int:
    for idx, item in enumerate(cart.get("items", [])):
        if item.get("product_id") == product_id and item.get("variant_id") == variant_id:
            return idx
    return -1


def get_cart(db: Database, user_id: ObjectId) -> CartDocument:
    return _ensure_cart(db, user_id)


def add_item(
    db: Database,
    user_id: ObjectId,
    product_id_str: str,
    variant_id_str: Optional[str],
    quantity: int,
) -> CartDocument:
    product_id = _parse_object_id(product_id_str, "product_id")
    variant_id = _parse_object_id(variant_id_str, "variant_id")
    assert product_id is not None  # for type checker

    cart = _ensure_cart(db, user_id)
    product, variant = catalog_service.get_product_with_variant(db, product_id, variant_id)

    price = float(variant["price"]) if variant else float(product.get("base_price", 0))
    compare_at_price = float(variant["compare_at_price"]) if variant and variant.get("compare_at_price") else None

    stock_quantity = variant.get("stock_quantity") if variant else None
    if stock_quantity is not None and quantity > stock_quantity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Số lượng vượt quá tồn kho")

    now = utcnow()
    items = cart.get("items", [])
    idx = _find_item_index(cart, product_id, variant_id)

    if idx >= 0:
        existing = items[idx]
        new_quantity = existing.get("quantity", 0) + quantity
        if stock_quantity is not None and new_quantity > stock_quantity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Số lượng vượt quá tồn kho")
        existing.update(
            {
                "quantity": new_quantity,
                "price": price,
                "compare_at_price": compare_at_price,
                "product_name": product["name"],
                "variant_name": _variant_display_name(variant),
                "thumbnail_url": _cart_thumbnail(product),
                "attributes": variant.get("attributes", {}) if variant else {},
                "updated_at": now,
            }
        )
        items[idx] = existing
    else:
        item: CartItemDocument = {
            "item_id": ObjectId(),
            "product_id": product["_id"],
            "variant_id": variant["_id"] if variant else None,
            "product_name": product["name"],
            "variant_name": _variant_display_name(variant),
            "thumbnail_url": _cart_thumbnail(product),
            "attributes": variant.get("attributes", {}) if variant else {},
            "quantity": quantity,
            "price": price,
            "compare_at_price": compare_at_price,
            "created_at": now,
            "updated_at": now,
        }
        items.append(item)

    cart["items"] = items
    cart["updated_at"] = now
    carts_collection(db).update_one(
        {"_id": cart["_id"]},
        {"$set": {"items": items, "updated_at": now}},
        upsert=False,
    )
    return cart


def update_item_quantity(
    db: Database,
    user_id: ObjectId,
    item_id_str: str,
    quantity: int,
) -> CartDocument:
    if quantity <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Số lượng phải lớn hơn 0")

    item_id = _parse_object_id(item_id_str, "item_id")
    if item_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="item_id không hợp lệ")

    cart = _ensure_cart(db, user_id)
    items = cart.get("items", [])
    for item in items:
        if item.get("item_id") == item_id:
            # Validate stock if variant available
            variant_id = item.get("variant_id")
            product_id = item.get("product_id")
            product, variant = catalog_service.get_product_with_variant(db, product_id, variant_id)
            stock_quantity = variant.get("stock_quantity") if variant else None
            if stock_quantity is not None and quantity > stock_quantity:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Số lượng vượt quá tồn kho")

            item["quantity"] = quantity
            item["price"] = float(variant["price"]) if variant else float(product.get("base_price", 0))
            item["compare_at_price"] = (
                float(variant["compare_at_price"]) if variant and variant.get("compare_at_price") else None
            )
            item["product_name"] = product["name"]
            item["variant_name"] = _variant_display_name(variant)
            item["thumbnail_url"] = _cart_thumbnail(product)
            item["attributes"] = variant.get("attributes", {}) if variant else {}
            item["updated_at"] = utcnow()
            break
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sản phẩm trong giỏ hàng")

    cart["items"] = items
    cart["updated_at"] = utcnow()
    carts_collection(db).update_one(
        {"_id": cart["_id"]},
        {"$set": {"items": items, "updated_at": cart["updated_at"]}},
    )
    return cart


def remove_item(db: Database, user_id: ObjectId, item_id_str: str) -> CartDocument:
    item_id = _parse_object_id(item_id_str, "item_id")
    if item_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="item_id không hợp lệ")

    cart = _ensure_cart(db, user_id)
    original_length = len(cart.get("items", []))
    items = [item for item in cart.get("items", []) if item.get("item_id") != item_id]
    if len(items) == original_length:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sản phẩm trong giỏ hàng")

    now = utcnow()
    cart["items"] = items
    cart["updated_at"] = now
    carts_collection(db).update_one(
        {"_id": cart["_id"]},
        {"$set": {"items": items, "updated_at": now}},
    )
    return cart


def clear_cart(db: Database, user_id: ObjectId) -> CartDocument:
    cart = _ensure_cart(db, user_id)
    now = utcnow()
    carts_collection(db).update_one(
        {"_id": cart["_id"]},
        {"$set": {"items": [], "updated_at": now}},
    )
    cart["items"] = []
    cart["updated_at"] = now
    return cart


def calculate_cart_totals(cart: CartDocument) -> Tuple[float, int]:
    subtotal = 0.0
    total_items = 0
    for item in cart.get("items", []):
        quantity = item.get("quantity", 0)
        subtotal += float(item.get("price", 0)) * quantity
        total_items += quantity
    return round(subtotal, 2), total_items


def list_favorites(db: Database, user_id: ObjectId) -> list[FavoriteDocument]:
    return list(
        favorites_collection(db)
        .find({"user_id": user_id})
        .sort("created_at", -1)
    )


def add_favorite(db: Database, user_id: ObjectId, product_id_str: str) -> FavoriteDocument:
    product_id = _parse_object_id(product_id_str, "product_id")
    assert product_id is not None

    product, _ = catalog_service.get_product_with_variant(db, product_id)
    now = utcnow()
    update = {
        "$set": {
            "product_name": product["name"],
            "thumbnail_url": _cart_thumbnail(product),
        },
        "$setOnInsert": {
            "user_id": user_id,
            "product_id": product["_id"],
            "created_at": now,
        },
    }
    favorites_collection(db).update_one(
        {"user_id": user_id, "product_id": product["_id"]},
        update,
        upsert=True,
    )
    favorite = favorites_collection(db).find_one({"user_id": user_id, "product_id": product["_id"]})
    assert favorite is not None
    return favorite


def remove_favorite(db: Database, user_id: ObjectId, product_id_str: str) -> None:
    product_id = _parse_object_id(product_id_str, "product_id")
    if product_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="product_id không hợp lệ")
    favorites_collection(db).delete_one({"user_id": user_id, "product_id": product_id})
