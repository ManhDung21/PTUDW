"""Chat services for managing threads and messages."""

from __future__ import annotations

from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.collection import Collection
from pymongo.database import Database

from ...db.models import ChatMessageDocument, ChatThreadDocument
from ..common.utils import utcnow
from ..notifications import service as notifications_service
from ..orders import service as orders_service


def threads_collection(db: Database) -> Collection:
    return db.get_collection("chat_threads")


def messages_collection(db: Database) -> Collection:
    return db.get_collection("chat_messages")


def _parse_object_id(value: str, label: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label} is invalid") from exc


def get_or_create_thread_for_order(db: Database, order_id: ObjectId) -> ChatThreadDocument:
    thread = threads_collection(db).find_one({"order_id": order_id})
    if thread:
        return thread

    order = orders_service.get_order_by_object_id(db, order_id)
    now = utcnow()
    thread_doc: ChatThreadDocument = {
        "order_id": order_id,
        "buyer_id": order["buyer_id"],
        "seller_id": order["seller_id"],
        "last_message_at": now,
        "last_message_preview": "",
        "created_at": now,
        "updated_at": now,
    }
    result = threads_collection(db).insert_one(thread_doc)
    thread_doc["_id"] = result.inserted_id  # type: ignore[index]
    return thread_doc


def list_threads_for_user(db: Database, user: dict) -> list[ChatThreadDocument]:
    role = (user.get("role") or "buyer").lower()
    query: dict = {}
    if role == "buyer":
        query["buyer_id"] = user["_id"]
    elif role == "seller":
        query["seller_id"] = user["_id"]
    threads = (
        threads_collection(db)
        .find(query)
        .sort("updated_at", -1)
    )
    return list(threads)


def ensure_user_access_to_thread(db: Database, thread_id: ObjectId, user: dict) -> ChatThreadDocument:
    thread = threads_collection(db).find_one({"_id": thread_id})
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    role = (user.get("role") or "buyer").lower()
    if role == "buyer" and thread.get("buyer_id") != user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if role == "seller" and thread.get("seller_id") != user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return thread


def list_messages(db: Database, thread_id: ObjectId, limit: int = 50) -> list[ChatMessageDocument]:
    messages = (
        messages_collection(db)
        .find({"thread_id": thread_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    return list(messages)


def add_message(
    db: Database,
    thread: ChatThreadDocument,
    sender_id: ObjectId,
    message_type: str,
    content: str,
    attachments: Optional[list[str]] = None,
) -> ChatMessageDocument:
    now = utcnow()
    message: ChatMessageDocument = {
        "thread_id": thread["_id"],
        "order_id": thread["order_id"],
        "sender_id": sender_id,
        "message_type": message_type,
        "content": content,
        "attachments": attachments or [],
        "is_read": False,
        "created_at": now,
    }
    result = messages_collection(db).insert_one(message)
    message["_id"] = result.inserted_id  # type: ignore[index]

    preview = content if message_type == "text" else f"[{message_type}]"
    threads_collection(db).update_one(
        {"_id": thread["_id"]},
        {
            "$set": {
                "last_message_preview": preview[:200],
                "last_message_at": now,
                "updated_at": now,
            }
        },
    )

    recipient_id = thread["seller_id"] if sender_id == thread["buyer_id"] else thread["buyer_id"]
    if recipient_id != sender_id:
        notifications_service.create_notification(
            db,
            recipient_id,
            notification_type="chat_message",
            title="New chat message",
            message=preview[:120],
            metadata={
                "thread_id": str(thread["_id"]),
                "order_id": str(thread["order_id"]),
            },
        )

    return message


def create_thread_for_order(db: Database, order_id_str: str, user: dict) -> ChatThreadDocument:
    order_id = _parse_object_id(order_id_str, "order_id")
    order = orders_service.get_order_by_object_id(db, order_id)
    role = (user.get("role") or "buyer").lower()
    if role == "buyer" and order.get("buyer_id") != user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if role == "seller" and order.get("seller_id") != user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return get_or_create_thread_for_order(db, order_id)
