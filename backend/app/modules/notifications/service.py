"""Notification services for in-app alerts."""

from __future__ import annotations

from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.collection import Collection
from pymongo.database import Database

from ...db.models import NotificationDocument, NotificationPreferenceDocument
from ..common.utils import utcnow

DEFAULT_CHANNEL = "in_app"
DEFAULT_EVENT_ALL = "__all__"


def notifications_collection(db: Database) -> Collection:
    return db.get_collection("notifications")


def preferences_collection(db: Database) -> Collection:
    return db.get_collection("notification_preferences")


def _parse_object_id(value: str, label: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label} is invalid") from exc


def _should_send_notification(
    db: Database,
    user_id: ObjectId,
    event_type: str,
    channel: str,
) -> bool:
    pref = preferences_collection(db).find_one(
        {"user_id": user_id, "event_type": event_type, "channel": channel}
    )
    if pref is None:
        pref = preferences_collection(db).find_one(
            {"user_id": user_id, "event_type": DEFAULT_EVENT_ALL, "channel": channel}
        )
    if pref is None:
        return True
    return bool(pref.get("enabled", True))


def create_notification(
    db: Database,
    user_id: ObjectId,
    notification_type: str,
    title: str,
    message: str,
    metadata: Optional[dict] = None,
    channel: str = DEFAULT_CHANNEL,
) -> Optional[NotificationDocument]:
    if not _should_send_notification(db, user_id, notification_type, channel):
        return None

    now = utcnow()
    doc: NotificationDocument = {
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "metadata": metadata or {},
        "is_read": False,
        "created_at": now,
        "read_at": None,
    }
    result = notifications_collection(db).insert_one(doc)
    doc["_id"] = result.inserted_id  # type: ignore[index]
    return doc


def list_notifications(
    db: Database,
    user_id: ObjectId,
    unread_only: bool = False,
    limit: int = 50,
) -> list[NotificationDocument]:
    query = {"user_id": user_id}
    if unread_only:
        query["is_read"] = False
    notifications = (
        notifications_collection(db)
        .find(query)
        .sort("created_at", -1)
        .limit(limit)
    )
    return list(notifications)


def get_unread_count(db: Database, user_id: ObjectId) -> int:
    return notifications_collection(db).count_documents({"user_id": user_id, "is_read": False})


def mark_notification_read(db: Database, notification_id: str, user_id: ObjectId, read: bool = True) -> None:
    notif_id = _parse_object_id(notification_id, "notification_id")
    update = {
        "$set": {
            "is_read": read,
            "read_at": utcnow() if read else None,
        }
    }
    result = notifications_collection(db).update_one({"_id": notif_id, "user_id": user_id}, update)
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")


def mark_all_read(db: Database, user_id: ObjectId) -> int:
    result = notifications_collection(db).update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True, "read_at": utcnow()}},
    )
    return result.modified_count


def list_preferences(db: Database, user_id: ObjectId) -> list[NotificationPreferenceDocument]:
    prefs = preferences_collection(db).find({"user_id": user_id})
    return list(prefs)


def upsert_preference(
    db: Database,
    user_id: ObjectId,
    event_type: str,
    channel: str,
    enabled: bool,
) -> NotificationPreferenceDocument:
    now = utcnow()
    filter_doc = {"user_id": user_id, "event_type": event_type, "channel": channel}
    preferences_collection(db).update_one(
        filter_doc,
        {
            "$set": {
                "enabled": enabled,
                "updated_at": now,
            },
            "$setOnInsert": {
                "created_at": now,
            },
        },
        upsert=True,
    )
    pref = preferences_collection(db).find_one(filter_doc)
    assert pref is not None
    return pref  # type: ignore[return-value]
