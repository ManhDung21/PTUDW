"""API routes for shipping operations."""

from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pymongo.database import Database

from ...db.models import UserDocument
from ...db.session import get_database
from ..orders import service as orders_service
from ..users.dependencies import get_current_user, require_admin, require_seller
from . import service as shipping_service
from .schemas import (
    ShippingCreateRequest,
    ShippingResponse,
    ShippingStatusUpdateRequest,
    ShippingWebhookPayload,
)

router = APIRouter(prefix="/shipping", tags=["shipping"])
admin_router = APIRouter(
    prefix="/admin/shipping",
    tags=["admin-shipping"],
    dependencies=[Depends(require_admin)],
)


def _parse_object_id(value: str, label: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label} is invalid") from exc


def _shipment_to_response(doc: dict) -> ShippingResponse:
    payload = {
        "_id": str(doc.get("_id")),
        "order_id": str(doc.get("order_id")),
        "provider": doc.get("provider", ""),
        "tracking_number": doc.get("tracking_number", ""),
        "status": doc.get("status", ""),
        "status_history": doc.get("status_history", []),
        "estimated_delivery": doc.get("estimated_delivery"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "payload": doc.get("payload", {}),
    }
    return ShippingResponse.model_validate(payload)


@router.post("/orders/{order_id}", response_model=ShippingResponse, status_code=status.HTTP_201_CREATED)
def create_shipment(
    order_id: str,
    payload: ShippingCreateRequest,
    current_user: UserDocument = Depends(require_seller),
    db: Database = Depends(get_database),
) -> ShippingResponse:
    order_oid = _parse_object_id(order_id, "order_id")
    order = orders_service.get_order_by_object_id(db, order_oid)
    if order.get("seller_id") != current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to create shipment for this order")

    shipment = shipping_service.create_shipment(
        db=db,
        order=order,
        provider=payload.provider,
        service_code=payload.service_code,
        weight_grams=payload.weight_grams,
        note=payload.note,
        actor_id=current_user["_id"],
    )
    return _shipment_to_response(shipment)


@router.get("/orders/{order_id}", response_model=ShippingResponse)
def get_shipment_for_order(
    order_id: str,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> ShippingResponse:
    order_oid = _parse_object_id(order_id, "order_id")
    order = orders_service.get_order_by_object_id(db, order_oid)
    role = (current_user.get("role") or "buyer").lower()
    if role == "buyer" and order.get("buyer_id") != current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if role == "seller" and order.get("seller_id") != current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    shipment = shipping_service.get_shipment_by_order(db, order_oid)
    if not shipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found for order")
    return _shipment_to_response(shipment)


@router.patch("/orders/{order_id}", response_model=ShippingResponse)
def update_shipment_status_manual(
    order_id: str,
    payload: ShippingStatusUpdateRequest,
    current_user: UserDocument = Depends(require_seller),
    db: Database = Depends(get_database),
) -> ShippingResponse:
    order_oid = _parse_object_id(order_id, "order_id")
    order = orders_service.get_order_by_object_id(db, order_oid)
    if order.get("seller_id") != current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to update this order")

    shipment = shipping_service.get_shipment_by_order(db, order_oid)
    if not shipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found for order")

    updated = shipping_service.update_shipment_status(
        db=db,
        tracking_number=shipment["tracking_number"],
        status_value=payload.status,
        note=payload.note,
        estimated_delivery=payload.estimated_delivery,
        raw_payload=None,
    )
    return _shipment_to_response(updated)


@router.post("/webhook/{provider}")
async def shipping_webhook(
    provider: str,
    request: Request,
    db: Database = Depends(get_database),
) -> ShippingResponse:
    raw_payload = await request.json()
    webhook_payload = ShippingWebhookPayload(
        provider=provider,
        tracking_number=raw_payload.get("tracking_number") or raw_payload.get("trackingNumber"),
        status=raw_payload.get("status"),
        note=raw_payload.get("note"),
        estimated_delivery=raw_payload.get("estimated_delivery"),
        raw_payload=raw_payload,
    ).model_dump()
    updated = shipping_service.handle_webhook_update(db, provider, webhook_payload)
    return _shipment_to_response(updated)


@admin_router.get("/orders/{order_id}", response_model=ShippingResponse)
def admin_get_shipment(order_id: str, db: Database = Depends(get_database)) -> ShippingResponse:
    order_oid = _parse_object_id(order_id, "order_id")
    shipment = shipping_service.get_shipment_by_order(db, order_oid)
    if not shipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found for order")
    return _shipment_to_response(shipment)