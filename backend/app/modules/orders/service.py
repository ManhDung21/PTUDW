
"""Domain services for order management."""

from __future__ import annotations

from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo import ReturnDocument
from pymongo.collection import Collection
from pymongo.database import Database

from ..notifications import service as notifications_service
from ..cart import service as cart_service
from ..catalog import service as catalog_service
from ..common.utils import utcnow
from ..users import service as user_service


def orders_collection(db: Database) -> Collection:
    return db.get_collection("orders")


def _generate_order_code() -> str:
    timestamp = utcnow().strftime("%Y%m%d%H%M%S%f")
    return f"ORD-{timestamp}"


def _ensure_single_seller(current: Optional[ObjectId], new_seller: Optional[ObjectId]) -> ObjectId:
    if new_seller is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sản phẩm thiếu thông tin người bán")
    if current is None:
        return new_seller
    if current != new_seller:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Giỏ hàng chứa sản phẩm từ nhiều người bán. Vui lòng tách đơn hàng.",
        )
    return current


def _build_order_items(
    db: Database,
    cart: CartDocument,
) -> tuple[list[OrderItemDocument], ObjectId, float]:
    items: list[OrderItemDocument] = []
    seller_id: Optional[ObjectId] = None
    subtotal = 0.0

    for item in cart.get("items", []):
        product_id = item.get("product_id")
        if not product_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Giỏ hàng không hợp lệ")
        variant_id = item.get("variant_id")
        product, variant = catalog_service.get_product_with_variant(db, product_id, variant_id)

        seller_id = _ensure_single_seller(seller_id, product.get("seller_id"))

        quantity = int(item.get("quantity", 0))
        price = float(item.get("price") or (variant["price"] if variant else product.get("base_price", 0)))
        total_amount = price * quantity
        subtotal += total_amount

        order_item: OrderItemDocument = {
            "product_id": product["_id"],
            "variant_id": variant["_id"] if variant else None,
            "product_name": product["name"],
            "sku": variant.get("sku") if variant else None,
            "quantity": quantity,
            "price": price,
            "total_amount": round(total_amount, 2),
            "thumbnail_url": item.get("thumbnail_url") or product.get("thumbnail_url"),
            "attributes": item.get("attributes") or (variant.get("attributes", {}) if variant else {}),
        }
        items.append(order_item)

    if seller_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không xác định được người bán")

    return items, seller_id, round(subtotal, 2)


def create_order_from_cart(
    db: Database,
    user: dict,
    address_id_str: str,
    payment_method: str,
    note: Optional[str] = None,
) -> OrderDocument:
    try:
        address_id = ObjectId(address_id_str)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="address_id không hợp lệ") from exc

    cart = cart_service.get_cart(db, user["_id"])
    if not cart.get("items"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Giỏ hàng đang trống")

    address_doc = user_service.get_address_by_id(db, user["_id"], address_id)

    items, seller_id, subtotal = _build_order_items(db, cart)
    shipping_fee = 0.0
    discount_amount = 0.0
    total_amount = round(subtotal + shipping_fee - discount_amount, 2)

    now = utcnow()
    order_doc: OrderDocument = {
        "buyer_id": user["_id"],
        "seller_id": seller_id,
        "order_code": _generate_order_code(),
        "address_snapshot": {
            key: address_doc.get(key)
            for key in [
                "recipient_name",
                "phone_number",
                "address_line",
                "ward",
                "district",
                "province",
                "postal_code",
                "country",
            ]
        },
        "payment_method": payment_method,
        "payment_status": "pending",
        "fulfillment_status": "pending_confirmation",
        "subtotal_amount": subtotal,
        "shipping_fee": shipping_fee,
        "discount_amount": discount_amount,
        "total_amount": total_amount,
        "items": items,
        "timeline": [
            {
                "status": "created",
                "note": "Đơn hàng đã được tạo",
                "created_at": now,
                "actor_id": user["_id"],
            }
        ],
        "tracking_number": None,
        "created_at": now,
        "updated_at": now,
        "note": note,
    }

    result = orders_collection(db).insert_one(order_doc)
    order_doc["_id"] = result.inserted_id

    cart_service.clear_cart(db, user["_id"])

    notifications_service.create_notification(
        db,
        user["_id"],
        notification_type="order_created",
        title="Order created",
        message=f"Order {order_doc['order_code']} has been created.",
        metadata={"order_id": str(order_doc["_id"]), "order_code": order_doc["order_code"]},
    )
    seller_id = order_doc.get("seller_id")
    if seller_id:
        notifications_service.create_notification(
            db,
            seller_id,
            notification_type="order_new",
            title="New order received",
            message=f"New order {order_doc['order_code']} is awaiting confirmation.",
            metadata={"order_id": str(order_doc["_id"]), "order_code": order_doc["order_code"]},
        )

    return order_doc


def list_orders(db: Database, user_id: ObjectId) -> list[OrderDocument]:
    return list(
        orders_collection(db)
        .find({"buyer_id": user_id})
        .sort("created_at", -1)
    )


def get_order(db: Database, user_id: ObjectId, order_id_str: str) -> OrderDocument:
    try:
        order_id = ObjectId(order_id_str)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="order_id không hợp lệ") from exc

    order = orders_collection(db).find_one({"_id": order_id, "buyer_id": user_id})
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy đơn hàng")
    return order


def cancel_order(
    db: Database,
    user_id: ObjectId,
    order_id_str: str,
    reason: Optional[str] = None,
) -> OrderDocument:
    order = get_order(db, user_id, order_id_str)

    if order.get("fulfillment_status") not in {"pending_confirmation", "processing"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Đơn hàng không thể hủy ở trạng thái hiện tại")

    now = utcnow()
    updated_order = orders_collection(db).find_one_and_update(
        {"_id": order["_id"], "buyer_id": user_id},
        {
            "$set": {
                "fulfillment_status": "cancelled",
                "payment_status": "cancelled",
                "updated_at": now,
            },
            "$push": {
                "timeline": {
                    "status": "cancelled",
                    "note": reason or "Khách hàng đã hủy đơn",
                    "created_at": now,
                    "actor_id": user_id,
                }
            },
        },
        return_document=ReturnDocument.AFTER,
    )
    if not updated_order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy đơn hàng")
    return updated_order


def get_order_by_object_id(db: Database, order_id: ObjectId) -> OrderDocument:
    order = orders_collection(db).find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy đơn hàng")
    return order


def update_order_payment_status(
    db: Database,
    order_id: ObjectId,
    new_status: str,
    note: Optional[str],
    actor_id: Optional[ObjectId],
    transaction_id: Optional[str] = None,
) -> OrderDocument:
    now = utcnow()
    timeline_entry = {
        "status": f"payment_{new_status}",
        "note": note,
        "created_at": now,
        "actor_id": actor_id,
    }
    update_fields: dict = {
        "$set": {
            "payment_status": new_status,
            "updated_at": now,
        },
        "$push": {
            "timeline": timeline_entry,
        },
    }
    if transaction_id:
        update_fields["$set"]["transaction_id"] = transaction_id

    updated_order = orders_collection(db).find_one_and_update(
        {"_id": order_id},
        update_fields,
        return_document=ReturnDocument.AFTER,
    )
    if not updated_order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy đơn hàng")
    return updated_order


def update_order_fulfillment_status(
    db: Database,
    order_id: ObjectId,
    new_status: str,
    note: Optional[str],
    actor_id: Optional[ObjectId],
    extra_updates: Optional[dict] = None,
) -> OrderDocument:
    now = utcnow()
    update_fields: dict = {
        "$set": {
            "fulfillment_status": new_status,
            "updated_at": now,
        },
        "$push": {
            "timeline": {
                "status": f"fulfillment_{new_status}",
                "note": note,
                "created_at": now,
                "actor_id": actor_id,
            }
        },
    }
    if extra_updates:
        update_fields["$set"].update(extra_updates)

    updated_order = orders_collection(db).find_one_and_update(
        {"_id": order_id},
        update_fields,
        return_document=ReturnDocument.AFTER,
    )
    if not updated_order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy đơn hàng")
    return updated_order


def list_orders_for_seller(
    db: Database,
    seller_id: ObjectId,
    limit: int = 20,
    skip: int = 0,
) -> list[OrderDocument]:
    cursor = (
        orders_collection(db)
        .find({"seller_id": seller_id})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return list(cursor)


