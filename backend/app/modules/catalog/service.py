
"""Catalog domain services handling categories, tags, and products."""

from __future__ import annotations

import re
from typing import Any, Optional

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo import ReturnDocument
from pymongo.collection import Collection
from pymongo.database import Database

from ...db.models import (
    CategoryDocument,
    ProductDocument,
    ProductVariantDocument,
    UserDocument,
)
from ..common.utils import utcnow

SLUG_PATTERN = re.compile(r"[^a-z0-9-]+")


def categories_collection(db: Database) -> Collection:
    return db.get_collection("categories")


def products_collection(db: Database) -> Collection:
    return db.get_collection("products")


def inventory_logs_collection(db: Database) -> Collection:
    return db.get_collection("inventory_logs")


def get_product_with_variant(
    db: Database,
    product_id: ObjectId,
    variant_id: Optional[ObjectId] = None,
) -> tuple[ProductDocument, Optional[ProductVariantDocument]]:
    product = products_collection(db).find_one({"_id": product_id})
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sản phẩm không tồn tại")
    if product.get("status") not in {"active", "draft"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sản phẩm không khả dụng")

    if variant_id is None:
        return product, None

    variants = product.get("variants") or []
    for variant in variants:
        if variant.get("_id") == variant_id:
            return product, variant

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Biến thể không tồn tại")


def _generate_slug(name: str, existing: Collection) -> str:
    base = SLUG_PATTERN.sub("-", name.lower().strip())
    base = re.sub("-{2,}", "-", base).strip("-")
    if not base:
        base = "item"
    slug = base
    idx = 1
    while existing.find_one({"slug": slug}):
        idx += 1
        slug = f"{base}-{idx}"
    return slug


def create_category(db: Database, payload: dict[str, Any]) -> CategoryDocument:
    coll = categories_collection(db)
    slug = payload.get("slug") or _generate_slug(payload["name"], coll)
    now = utcnow()
    doc: CategoryDocument = {
        "name": payload["name"],
        "slug": slug,
        "parent_id": ObjectId(payload["parent_id"]) if payload.get("parent_id") else None,
        "is_active": payload.get("is_active", True),
        "created_at": now,
        "updated_at": now,
    }
    result = coll.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def update_category(db: Database, category_id: ObjectId, payload: dict[str, Any]) -> CategoryDocument:
    coll = categories_collection(db)
    update_fields = {}
    if "name" in payload and payload["name"]:
        update_fields["name"] = payload["name"]
    if "slug" in payload and payload["slug"]:
        update_fields["slug"] = payload["slug"]
    if "parent_id" in payload:
        update_fields["parent_id"] = (
            ObjectId(payload["parent_id"]) if payload["parent_id"] else None
        )
    if "is_active" in payload and payload["is_active"] is not None:
        update_fields["is_active"] = payload["is_active"]
    update_fields["updated_at"] = utcnow()
    doc = coll.find_one_and_update(
        {"_id": category_id},
        {"$set": update_fields},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Danh mục không tồn tại")
    return doc


def list_categories(db: Database, only_active: bool = True) -> list[CategoryDocument]:
    query = {}
    if only_active:
        query["is_active"] = True
    coll = categories_collection(db)
    return list(
        coll.find(query).sort(
            [
                ("parent_id", 1),
                ("name", 1),
            ]
        )
    )


def _build_variant_payload(variant: dict[str, Any]) -> ProductVariantDocument:
    now = utcnow()
    variant_doc: ProductVariantDocument = {
        "_id": ObjectId(variant["_id"]) if variant.get("_id") else ObjectId(),
        "sku": variant["sku"],
        "attributes": variant.get("attributes", {}),
        "price": float(variant["price"]),
        "compare_at_price": float(variant["compare_at_price"]) if variant.get("compare_at_price") else None,
        "stock_quantity": int(variant.get("stock_quantity", 0)),
        "low_stock_threshold": int(variant.get("low_stock_threshold", 5)),
        "weight_grams": variant.get("weight_grams"),
        "barcode": variant.get("barcode"),
        "created_at": variant.get("created_at", now),
        "updated_at": now,
    }
    return variant_doc


def create_product(
    db: Database,
    seller: UserDocument,
    payload: dict[str, Any],
) -> ProductDocument:
    coll = products_collection(db)
    slug = payload.get("slug") or _generate_slug(payload["name"], coll)
    now = utcnow()
    variants = [_build_variant_payload(v) for v in payload.get("variants", [])]

    doc: ProductDocument = {
        "seller_id": seller["_id"],
        "name": payload["name"],
        "slug": slug,
        "summary": payload.get("summary"),
        "description_ai_id": None,
        "description_custom": payload.get("description_custom"),
        "seo_title": payload.get("seo_title"),
        "seo_description": payload.get("seo_description"),
        "categories": [ObjectId(cid) for cid in payload.get("category_ids", [])],
        "tags": payload.get("tags", []),
        "status": payload.get("status", "draft"),
        "thumbnail_url": payload.get("thumbnail_url"),
        "image_urls": payload.get("image_urls", []),
        "variants": variants,
        "attributes": payload.get("attributes", {}),
        "base_price": float(payload["base_price"]),
        "unit": payload.get("unit"),
        "min_order_quantity": payload.get("min_order_quantity", 1),
        "media": payload.get("media", []),
        "created_at": now,
        "updated_at": now,
    }
    result = coll.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def update_product(
    db: Database,
    product_id: ObjectId,
    payload: dict[str, Any],
) -> ProductDocument:
    coll = products_collection(db)
    update_fields: dict[str, Any] = {}
    for key in [
        "name",
        "summary",
        "description_custom",
        "seo_title",
        "seo_description",
        "thumbnail_url",
        "image_urls",
        "status",
        "unit",
        "min_order_quantity",
        "media",
    ]:
        if key in payload and payload[key] is not None:
            update_fields[key] = payload[key]

    if "category_ids" in payload and payload["category_ids"] is not None:
        update_fields["categories"] = [ObjectId(cid) for cid in payload["category_ids"]]
    if "tags" in payload and payload["tags"] is not None:
        update_fields["tags"] = payload["tags"]
    if "base_price" in payload and payload["base_price"] is not None:
        update_fields["base_price"] = float(payload["base_price"])
    if "attributes" in payload and payload["attributes"] is not None:
        update_fields["attributes"] = payload["attributes"]
    if "variants" in payload and payload["variants"] is not None:
        update_fields["variants"] = [_build_variant_payload(v) for v in payload["variants"]]
    if "slug" in payload and payload["slug"]:
        update_fields["slug"] = payload["slug"]

    update_fields["updated_at"] = utcnow()
    doc = coll.find_one_and_update(
        {"_id": product_id},
        {"$set": update_fields},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sản phẩm không tồn tại")
    return doc


def get_product_by_id(db: Database, product_id: ObjectId) -> Optional[ProductDocument]:
    return products_collection(db).find_one({"_id": product_id})


def search_products(
    db: Database,
    keyword: Optional[str] = None,
    category_ids: Optional[list[str]] = None,
    tags: Optional[list[str]] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    status_filter: str = "active",
    limit: int = 20,
    skip: int = 0,
) -> tuple[list[ProductDocument], int]:
    coll = products_collection(db)
    query: dict[str, Any] = {}
    if status_filter:
        query["status"] = status_filter
    if keyword:
        query["$text"] = {"$search": keyword}
    if category_ids:
        query["categories"] = {"$in": [ObjectId(cid) for cid in category_ids]}
    if tags:
        query["tags"] = {"$all": tags}
    price_filters: dict[str, Any] = {}
    if price_min is not None:
        price_filters["$gte"] = float(price_min)
    if price_max is not None:
        price_filters["$lte"] = float(price_max)
    if price_filters:
        query["base_price"] = price_filters

    total = coll.count_documents(query)
    cursor = (
        coll.find(query)
        .skip(skip)
        .limit(limit)
        .sort([("updated_at", -1)])
    )
    return list(cursor), total


def list_products_for_seller(
    db: Database,
    seller_id: ObjectId,
    status_filter: Optional[str] = None,
    limit: int = 20,
    skip: int = 0,
) -> tuple[list[ProductDocument], int]:
    coll = products_collection(db)
    query: dict[str, Any] = {"seller_id": seller_id}
    if status_filter and status_filter not in {"all", ""}:
        query["status"] = status_filter

    total = coll.count_documents(query)
    cursor = (
        coll.find(query)
        .skip(skip)
        .limit(limit)
        .sort([("updated_at", -1)])
    )
    return list(cursor), total


def _parse_object_id(value: str, label: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label} không hợp lệ") from exc


def adjust_inventory(
    db: Database,
    seller_id: ObjectId,
    product_id_str: str,
    variant_id_str: str,
    delta: int,
    reason: str,
    note: Optional[str],
    actor_id: ObjectId,
) -> ProductDocument:
    product_id = _parse_object_id(product_id_str, "product_id")
    variant_id = _parse_object_id(variant_id_str, "variant_id")

    product = products_collection(db).find_one({"_id": product_id})
    if not product or product.get("seller_id") != seller_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sản phẩm")

    variants = product.get("variants", [])
    updated = False
    now = utcnow()

    for idx, variant in enumerate(variants):
        if variant.get("_id") == variant_id:
            current_stock = int(variant.get("stock_quantity", 0))
            new_stock = current_stock + delta
            if new_stock < 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Số lượng tồn kho không đủ")
            variant["stock_quantity"] = new_stock
            variant["updated_at"] = now
            variants[idx] = variant
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy biến thể")

    products_collection(db).update_one(
        {"_id": product_id, "seller_id": seller_id},
        {"$set": {"variants": variants, "updated_at": now}},
    )

    log_doc = {
        "product_id": product_id,
        "variant_id": variant_id,
        "delta": delta,
        "reason": reason,
        "note": note,
        "created_at": now,
        "created_by": actor_id,
    }
    inventory_logs_collection(db).insert_one(log_doc)

    updated_product = products_collection(db).find_one({"_id": product_id})
    assert updated_product is not None
    return updated_product


def list_inventory_logs(
    db: Database,
    seller_id: ObjectId,
    product_id_str: str,
    limit: int = 50,
) -> list[dict]:
    product_id = _parse_object_id(product_id_str, "product_id")
    product = products_collection(db).find_one({"_id": product_id, "seller_id": seller_id})
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sản phẩm")

    logs = (
        inventory_logs_collection(db)
        .find({"product_id": product_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    results = []
    for log in logs:
        log["_id"] = str(log["_id"])
        log["product_id"] = str(log["product_id"])
        if log.get("variant_id"):
            log["variant_id"] = str(log["variant_id"])
        log["created_by"] = str(log.get("created_by"))
        results.append(log)
    return results
