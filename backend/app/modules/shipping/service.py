"""Shipping service for creating and tracking shipments."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.collection import Collection
from pymongo.database import Database

from ...db.models import ShipmentDocument
from ..common.utils import utcnow
from ..notifications import service as notifications_service
from ..orders import service as orders_service

ALLOWED_CREATE_STATUSES = {"pending_confirmation", "processing"}


def shipments_collection(db: Database) -> Collection:
    return db.get_collection("shipments")


def create_shipment(
    db: Database,
    order: dict,
    provider: str,
    service_code: Optional[str],
    weight_grams: Optional[int],
    note: Optional[str],
    actor_id: ObjectId,
) -> ShipmentDocument:
    if order.get("fulfillment_status") not in ALLOWED_CREATE_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order cannot create shipment in the current status")

    existing = shipments_collection(db).find_one({"order_id": order["_id"]})
    if existing:
        return existing

    tracking_number = f"{provider.upper()}-{uuid4().hex[:10]}"
    now = utcnow()
    shipment: ShipmentDocument = {
        "order_id": order["_id"],
        "provider": provider,
        "tracking_number": tracking_number,
        "status": "label_created",
        "status_history": [
            {
                "status": "label_created",
                "note": note or "Shipment label created",
                "created_at": now,
                "actor_id": actor_id,
            }
        ],
        "estimated_delivery": None,
        "created_at": now,
        "updated_at": now,
        "payload": {
            "service_code": service_code,
            "weight_grams": weight_grams,
        },
    }
    result = shipments_collection(db).insert_one(shipment)
    shipment["_id"] = result.inserted_id  # type: ignore[index]

    orders_service.update_order_fulfillment_status(
        db,
        order["_id"],
        new_status="processing",
        note="Shipment label created",
        actor_id=actor_id,
        extra_updates={
            "tracking_number": tracking_number,
            "shipping_provider": provider,
        },
    )
    notifications_service.create_notification(
        db,
        order["buyer_id"],
        notification_type="shipment_created",
        title="Shipment created",
        message=f"Order {order.get('order_code', '')} now has a shipment (tracking {tracking_number}).",
        metadata={"order_id": str(order["_id"]), "tracking_number": tracking_number, "provider": provider},
    )
    return shipment


def get_shipment_by_order(db: Database, order_id: ObjectId) -> Optional[ShipmentDocument]:
    return shipments_collection(db).find_one({"order_id": order_id})


def _parse_estimated_delivery(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(value)
    except Exception:  # noqa: BLE001
        return None


def update_shipment_status(
    db: Database,
    tracking_number: str,
    status_value: str,
    note: Optional[str],
    estimated_delivery=None,
    raw_payload: Optional[dict] = None,
) -> ShipmentDocument:
    shipment = shipments_collection(db).find_one({"tracking_number": tracking_number})
    if not shipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")

    now = utcnow()
    history_entry = {
        "status": status_value,
        "note": note,
        "created_at": now,
        "actor_id": None,
    }
    update_doc = {
        "$set": {
            "status": status_value,
            "updated_at": now,
        },
        "$push": {
            "status_history": history_entry,
        },
    }
    parsed_estimated = _parse_estimated_delivery(estimated_delivery)
    if parsed_estimated is not None:
        update_doc["$set"]["estimated_delivery"] = parsed_estimated
    if raw_payload is not None:
        update_doc["$set"]["payload"] = raw_payload

    updated = shipments_collection(db).find_one_and_update(
        {"_id": shipment["_id"]},
        update_doc,
        return_document=True,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update shipment")

    order_id = shipment["order_id"]

    status_mapping = {
        "in_transit": "shipping",
        "delivered": "delivered",
        "completed": "completed",
        "cancelled": "cancelled",
        "returned": "returned",
    }
    order_status = status_mapping.get(status_value)
    if order_status:
        orders_service.update_order_fulfillment_status(
            db,
            order_id,
            new_status=order_status,
            note=note or f"Shipment status: {status_value}",
            actor_id=None,
        )

    order_doc = orders_service.get_order_by_object_id(db, order_id)
    titles = {
        "in_transit": ("Shipment in transit", "Shipment is on the way."),
        "shipping": ("Shipment in transit", "Shipment is on the way."),
        "delivered": ("Shipment delivered", "Shipment has been delivered."),
        "completed": ("Order completed", "Order has been completed."),
        "cancelled": ("Shipment cancelled", "Shipment has been cancelled."),
        "returned": ("Shipment returned", "Shipment has been returned."),
    }
    title, default_message = titles.get(status_value, ("Shipment update", "Shipment status has changed."))
    notifications_service.create_notification(
        db,
        order_doc["buyer_id"],
        notification_type="shipment_update",
        title=title,
        message=note or default_message,
        metadata={
            "order_id": str(order_doc["_id"]),
            "tracking_number": tracking_number,
            "status": status_value,
        },
    )
    seller_id = order_doc.get("seller_id")
    if seller_id and status_value in {"cancelled", "returned"}:
        notifications_service.create_notification(
            db,
            seller_id,
            notification_type="shipment_update",
            title=title,
            message=note or default_message,
            metadata={
                "order_id": str(order_doc["_id"]),
                "tracking_number": tracking_number,
                "status": status_value,
            },
        )

    return updated  # type: ignore[return-value]


def handle_webhook_update(
    db: Database,
    provider: str,
    payload: dict,
) -> ShipmentDocument:
    tracking_number = payload.get("tracking_number") or payload.get("trackingNumber")
    status_value = payload.get("status")
    if not tracking_number or not status_value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing shipment information")

    note = payload.get("note")
    estimated_delivery = payload.get("estimated_delivery")
    return update_shipment_status(
        db=db,
        tracking_number=tracking_number,
        status_value=status_value,
        note=note or f"Webhook {provider}",
        estimated_delivery=estimated_delivery,
        raw_payload=payload,
    )
