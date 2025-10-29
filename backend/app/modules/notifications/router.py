"""API routes for notifications."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pymongo.database import Database

from ...db.models import UserDocument
from ...db.session import get_database
from ..users.dependencies import get_current_user
from . import service
from .schemas import (
    NotificationListResponse,
    NotificationMarkReadRequest,
    NotificationPreferenceListResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdateRequest,
    NotificationResponse,
)

ALLOWED_CHANNELS = ["in_app", "email", "push"]
DEFAULT_EVENTS = ["order_created", "order_processing", "order_shipping", "order_delivered", "order_refunded", "payment_paid", "payment_failed", "shipment_created", "shipment_update", "chat_message"]

router = APIRouter(prefix="/notifications", tags=["notifications"])

def _preference_to_response(doc: dict) -> NotificationPreferenceResponse:
    payload = {
        "event_type": doc.get("event_type", ""),
        "channel": doc.get("channel", "in_app"),
        "enabled": bool(doc.get("enabled", True)),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }
    return NotificationPreferenceResponse.model_validate(payload)


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> NotificationListResponse:
    docs = service.list_notifications(db, current_user["_id"], unread_only=unread_only, limit=limit)
    unread_count = service.get_unread_count(db, current_user["_id"])
    return NotificationListResponse(
        items=[_notification_to_response(doc) for doc in docs],
        unread_count=unread_count,
    )


@router.post(
    "/{notification_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def mark_notification_read(
    notification_id: str,
    payload: NotificationMarkReadRequest,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> Response:
    service.mark_notification_read(db, notification_id, current_user["_id"], read=payload.read)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def mark_all_notifications_read(
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> Response:
    service.mark_all_read(db, current_user["_id"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/preferences", response_model=NotificationPreferenceListResponse)
def get_preferences(
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> NotificationPreferenceListResponse:
    stored = service.list_preferences(db, current_user["_id"])
    pref_map = { (pref.get("event_type"), pref.get("channel", "in_app")): pref for pref in stored }

    items: list[dict] = []
    for event in DEFAULT_EVENTS:
        key = (event, "in_app")
        pref = pref_map.get(key)
        if pref is None:
            pref = {
                "event_type": event,
                "channel": "in_app",
                "enabled": True,
                "created_at": None,
                "updated_at": None,
            }
        items.append(pref)

    for key, pref in pref_map.items():
        if key[0] not in DEFAULT_EVENTS or key[1] != "in_app":
            items.append(pref)

    return NotificationPreferenceListResponse(items=[_preference_to_response(pref) for pref in items])


@router.put("/preferences", response_model=NotificationPreferenceResponse)
def update_preference(
    payload: NotificationPreferenceUpdateRequest,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> NotificationPreferenceResponse:
    if payload.channel not in ALLOWED_CHANNELS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Channel is not supported")
    pref = service.upsert_preference(
        db,
        current_user["_id"],
        event_type=payload.event_type,
        channel=payload.channel,
        enabled=payload.enabled,
    )
    return _preference_to_response(pref)


