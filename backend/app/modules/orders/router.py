"""API routes for order management."""

from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.database import Database

from ...db.models import UserDocument
from ...db.session import get_database
from ..common.utils import utcnow
from ..users.dependencies import get_current_user, require_admin, require_buyer, require_seller
from ..notifications import service as notifications_service
from . import service
from .schemas import (
    CheckoutRequest,
    OrderItemResponse,
    OrderListResponse,
    OrderResponse,
    OrderStatusUpdateRequest,
    OrderTimelineEntryResponse,
)

router = APIRouter(prefix="/orders", tags=["orders"])


def _order_item_to_response(doc: dict) -> OrderItemResponse:
    return OrderItemResponse(
        product_id=str(doc.get("product_id")),
        variant_id=str(doc["variant_id"]) if doc.get("variant_id") else None,
        product_name=doc.get("product_name", ""),
        sku=doc.get("sku"),
        quantity=doc.get("quantity", 0),
        price=float(doc.get("price", 0)),
        total_amount=float(doc.get("total_amount", 0)),
        thumbnail_url=doc.get("thumbnail_url"),
        attributes=doc.get("attributes") or {},
    )


def _timeline_to_response(entry: dict) -> OrderTimelineEntryResponse:
    return OrderTimelineEntryResponse(
        status=entry.get("status", ""),
        note=entry.get("note"),
        created_at=entry.get("created_at") or utcnow(),
    )


def _order_to_response(doc: dict) -> OrderResponse:
    payload = {
        "_id": str(doc.get("_id")),
        "order_code": doc.get("order_code", ""),
        "payment_method": doc.get("payment_method", ""),
        "payment_status": doc.get("payment_status", ""),
        "fulfillment_status": doc.get("fulfillment_status", ""),
        "subtotal_amount": float(doc.get("subtotal_amount", 0)),
        "shipping_fee": float(doc.get("shipping_fee", 0)),
        "discount_amount": float(doc.get("discount_amount", 0)),
        "total_amount": float(doc.get("total_amount", 0)),
        "note": doc.get("note"),
        "address_snapshot": doc.get("address_snapshot") or {},
        "items": [_order_item_to_response(item) for item in doc.get("items", [])],
        "timeline": [_timeline_to_response(entry) for entry in doc.get("timeline", [])],
        "created_at": doc.get("created_at") or utcnow(),
        "updated_at": doc.get("updated_at") or utcnow(),
    }
    return OrderResponse.model_validate(payload)


def _parse_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="order_id is invalid") from exc


@router.post("/checkout", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def checkout_order(
    payload: CheckoutRequest,
    current_user: UserDocument = Depends(require_buyer),
    db: Database = Depends(get_database),
) -> OrderResponse:
    order = service.create_order_from_cart(
        db=db,
        user=current_user,
        address_id_str=payload.address_id,
        payment_method=payload.payment_method,
        note=payload.note,
    )
    return _order_to_response(order)


@router.get("", response_model=OrderListResponse)
def list_orders(
    current_user: UserDocument = Depends(require_buyer),
    db: Database = Depends(get_database),
) -> OrderListResponse:
    orders = service.list_orders(db, current_user["_id"])
    return OrderListResponse(items=[_order_to_response(doc) for doc in orders])


@router.get("/seller", response_model=OrderListResponse)
def list_orders_for_seller(
    limit: int = Query(default=20, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    current_user: UserDocument = Depends(require_seller),
    db: Database = Depends(get_database),
) -> OrderListResponse:
    orders = service.list_orders_for_seller(db, current_user["_id"], limit=limit, skip=skip)
    return OrderListResponse(items=[_order_to_response(doc) for doc in orders])


@router.get("/{order_id}", response_model=OrderResponse)
def get_order_detail(
    order_id: str,
    current_user: UserDocument = Depends(require_buyer),
    db: Database = Depends(get_database),
) -> OrderResponse:
    order = service.get_order(db, current_user["_id"], order_id)
    return _order_to_response(order)


@router.post("/{order_id}/cancel", response_model=OrderResponse)
def cancel_order(
    order_id: str,
    current_user: UserDocument = Depends(require_buyer),
    db: Database = Depends(get_database),
) -> OrderResponse:
    order = service.cancel_order(db, current_user["_id"], order_id)
    return _order_to_response(order)


@router.post("/{order_id}/confirm", response_model=OrderResponse)
def seller_confirm_order(
    order_id: str,
    payload: OrderStatusUpdateRequest,
    current_user: UserDocument = Depends(require_seller),
    db: Database = Depends(get_database),
) -> OrderResponse:
    order_oid = _parse_object_id(order_id)
    order = service.get_order_by_object_id(db, order_oid)
    if order.get("seller_id") != current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to update this order")
    if order.get("fulfillment_status") not in {"pending_confirmation", "processing"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order cannot be confirmed in this status")
    updated = service.update_order_fulfillment_status(
        db,
        order_oid,
        new_status="processing",
        note=payload.note or "Order confirmed by seller",
        actor_id=current_user["_id"],
    )
    notifications_service.create_notification(
        db,
        order["buyer_id"],
        notification_type="order_processing",
        title="Order confirmed",
        message=f"Order {order.get('order_code', '')} has been confirmed by the seller.",
        metadata={"order_id": str(order["_id"]), "status": "processing"},
    )
    return _order_to_response(updated)


@router.post("/{order_id}/ready-to-ship", response_model=OrderResponse)
def seller_ready_to_ship(
    order_id: str,
    payload: OrderStatusUpdateRequest,
    current_user: UserDocument = Depends(require_seller),
    db: Database = Depends(get_database),
) -> OrderResponse:
    order_oid = _parse_object_id(order_id)
    order = service.get_order_by_object_id(db, order_oid)
    if order.get("seller_id") != current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to update this order")
    updated = service.update_order_fulfillment_status(
        db,
        order_oid,
        new_status="shipping",
        note=payload.note or "Order ready for shipment",
        actor_id=current_user["_id"],
    )
    notifications_service.create_notification(
        db,
        order["buyer_id"],
        notification_type="order_shipping",
        title="Order is on the way",
        message=f"Order {order.get('order_code', '')} is being prepared for shipment.",
        metadata={"order_id": str(order["_id"]), "status": "shipping"},
    )
    return _order_to_response(updated)


@router.post("/{order_id}/delivered", response_model=OrderResponse)
def seller_mark_delivered(
    order_id: str,
    payload: OrderStatusUpdateRequest,
    current_user: UserDocument = Depends(require_seller),
    db: Database = Depends(get_database),
) -> OrderResponse:
    order_oid = _parse_object_id(order_id)
    order = service.get_order_by_object_id(db, order_oid)
    if order.get("seller_id") != current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to update this order")
    updated = service.update_order_fulfillment_status(
        db,
        order_oid,
        new_status="delivered",
        note=payload.note or "Order marked as delivered",
        actor_id=current_user["_id"],
    )
    notifications_service.create_notification(
        db,
        order["buyer_id"],
        notification_type="order_delivered",
        title="Order delivered",
        message=f"Order {order.get('order_code', '')} has been marked as delivered.",
        metadata={"order_id": str(order["_id"]), "status": "delivered"},
    )
    return _order_to_response(updated)


@router.post("/{order_id}/refund", response_model=OrderResponse)
def admin_refund_order(
    order_id: str,
    payload: OrderStatusUpdateRequest,
    current_user: UserDocument = Depends(require_admin),
    db: Database = Depends(get_database),
) -> OrderResponse:
    order_oid = _parse_object_id(order_id)
    order = service.get_order_by_object_id(db, order_oid)
    service.update_order_payment_status(
        db,
        order_oid,
        new_status="refunded",
        note=payload.note or "Refund processed by admin",
        actor_id=current_user["_id"],
    )
    updated = service.update_order_fulfillment_status(
        db,
        order_oid,
        new_status="refunded",
        note=payload.note or "Refund processed by admin",
        actor_id=current_user["_id"],
    )
    notifications_service.create_notification(
        db,
        order["buyer_id"],
        notification_type="order_refunded",
        title="Order refunded",
        message=f"Order {order.get('order_code', '')} has been refunded.",
        metadata={"order_id": str(order["_id"]), "status": "refunded"},
    )
    seller_id = order.get("seller_id")
    if seller_id:
        notifications_service.create_notification(
            db,
            seller_id,
            notification_type="order_refunded",
            title="Order refunded",
            message=f"Order {order.get('order_code', '')} refund has been processed.",
            metadata={"order_id": str(order["_id"]), "status": "refunded"},
        )
    return _order_to_response(updated)
