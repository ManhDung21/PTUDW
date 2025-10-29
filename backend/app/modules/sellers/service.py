
"""Domain services for seller onboarding, verification, and dashboard."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.collection import Collection
from pymongo.database import Database

from ...db.models import OrderDocument, SellerDocument
from ..common.utils import utcnow
from ..users.dependencies import users_collection


def sellers_collection(db: Database) -> Collection:
    return db.get_collection("sellers")


SLUG_REGEX = re.compile(r"[^a-z0-9]+")


def _generate_slug(base: str, db: Database, exclude_id: Optional[ObjectId] = None) -> str:
    slug = SLUG_REGEX.sub("-", base.lower()).strip("-")
    slug = slug or "shop"
    candidate = slug
    index = 1
    while True:
        query: dict = {"slug": candidate}
        if exclude_id:
            query["_id"] = {"$ne": exclude_id}
        if not sellers_collection(db).find_one(query):
            return candidate
        index += 1
        candidate = f"{slug}-{index}"


def _serialize_seller(doc: SellerDocument) -> dict:
    payload = dict(doc)
    payload["_id"] = str(payload["_id"])
    payload["user_id"] = str(payload["user_id"])
    payload["social_links"] = payload.get("social_links", [])
    payload["documents"] = payload.get("documents", [])
    return payload


def submit_application(
    db: Database,
    user: dict,
    payload: dict,
) -> dict:
    now = utcnow()
    coll = sellers_collection(db)
    existing = coll.find_one({"user_id": user["_id"]})

    shop_name = payload["shop_name"].strip()
    slug = _generate_slug(shop_name, db, exclude_id=existing["_id"] if existing else None)

    update_fields: SellerDocument = {
        "user_id": user["_id"],
        "shop_name": shop_name,
        "slug": slug,
        "description": payload.get("description"),
        "logo_url": str(payload.get("logo_url")) if payload.get("logo_url") else None,
        "cover_image_url": str(payload.get("cover_image_url")) if payload.get("cover_image_url") else None,
        "social_links": [str(link) for link in payload.get("social_links", [])],
        "documents": [str(link) for link in payload.get("documents", [])],
        "updated_at": now,
    }

    if existing:
        status_value = existing.get("status", "pending")
        if status_value in {"rejected", "pending"}:
            update_fields["status"] = "pending"
            update_fields["verification_notes"] = None
        coll.update_one({"_id": existing["_id"]}, {"$set": update_fields})
        seller = coll.find_one({"_id": existing["_id"]})
    else:
        update_fields["status"] = "pending"
        update_fields["verification_notes"] = None
        update_fields["created_at"] = now
        result = coll.insert_one(update_fields)
        seller = coll.find_one({"_id": result.inserted_id})

    if not seller:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không tạo được hồ sơ người bán")
    return _serialize_seller(seller)


def get_seller_for_user(db: Database, user_id: ObjectId) -> Optional[dict]:
    seller = sellers_collection(db).find_one({"user_id": user_id})
    if not seller:
        return None
    return _serialize_seller(seller)


def get_seller_by_id(db: Database, seller_id: ObjectId) -> dict:
    seller = sellers_collection(db).find_one({"_id": seller_id})
    if not seller:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người bán")
    return _serialize_seller(seller)


def admin_list_sellers(db: Database, status_filter: Optional[str] = None) -> list[dict]:
    query: dict = {}
    if status_filter:
        query["status"] = status_filter
    sellers = sellers_collection(db).find(query).sort("created_at", -1)
    return [_serialize_seller(doc) for doc in sellers]


def admin_update_seller_status(
    db: Database,
    seller_id: ObjectId,
    status_value: str,
    verification_notes: Optional[str],
    admin_user: dict,
) -> dict:
    seller = sellers_collection(db).find_one({"_id": seller_id})
    if not seller:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người bán")

    update = {
        "status": status_value,
        "verification_notes": verification_notes,
        "updated_at": utcnow(),
    }
    sellers_collection(db).update_one({"_id": seller_id}, {"$set": update})

    seller = sellers_collection(db).find_one({"_id": seller_id})
    if not seller:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không cập nhật được người bán")

    if status_value == "approved":
        users_collection(db).update_one(
            {"_id": seller["user_id"]},
            {
                "$set": {
                    "role": "seller",
                    "is_active": True,
                    "updated_at": utcnow(),
                }
            },
        )
    return _serialize_seller(seller)


def _calculate_revenue(orders: list[OrderDocument]) -> tuple[float, float]:
    total_revenue = 0.0
    revenue_this_month = 0.0
    now = utcnow()
    month_start = datetime(year=now.year, month=now.month, day=1, tzinfo=timezone.utc)

    for order in orders:
        total_amount = float(order.get("total_amount", 0))
        if order.get("payment_status") in {"paid", "cod_collected"}:
            total_revenue += total_amount
            created_at = order.get("created_at") or now
            if created_at >= month_start:
                revenue_this_month += total_amount
    return round(total_revenue, 2), round(revenue_this_month, 2)


def get_dashboard_summary(
    db: Database,
    seller: dict,
) -> dict:
    seller_id = ObjectId(seller["_id"])
    orders = list(db.get_collection("orders").find({"seller_id": seller_id}))

    total_orders = len(orders)
    pending_orders = sum(1 for order in orders if order.get("fulfillment_status") == "pending_confirmation")
    processing_orders = sum(
        1 for order in orders if order.get("fulfillment_status") in {"processing", "shipping"}
    )
    cancelled_orders = sum(1 for order in orders if order.get("fulfillment_status") == "cancelled")
    completed_orders = sum(1 for order in orders if order.get("fulfillment_status") in {"delivered", "completed"})

    orders_today = 0
    now = utcnow()
    today_start = datetime(year=now.year, month=now.month, day=now.day, tzinfo=timezone.utc)
    for order in orders:
        created_at = order.get("created_at") or now
        if created_at >= today_start:
            orders_today += 1

    total_revenue, revenue_this_month = _calculate_revenue(orders)

    low_stock_items = 0
    product_cursor = db.get_collection("products").find({"seller_id": seller_id})
    for product in product_cursor:
        for variant in product.get("variants", []):
            stock_quantity = int(variant.get("stock_quantity", 0))
            threshold = int(variant.get("low_stock_threshold", 5))
            if stock_quantity <= threshold:
                low_stock_items += 1

    summary = {
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "processing_orders": processing_orders,
        "cancelled_orders": cancelled_orders,
        "completed_orders": completed_orders,
        "revenue_total": total_revenue,
        "revenue_this_month": revenue_this_month,
        "orders_today": orders_today,
        "low_stock_items": low_stock_items,
    }
    return summary
