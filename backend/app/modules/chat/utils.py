"""Helpers for serialising chat documents."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from bson import ObjectId

from .schemas import ChatMessageResponse, ChatThreadResponse


def _to_str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, ObjectId):
        return str(value)
    return str(value)


def thread_response_from_doc(doc: Dict[str, Any]) -> ChatThreadResponse:
    payload = {
        "_id": _to_str(doc.get("_id")),
        "order_id": _to_str(doc.get("order_id")),
        "buyer_id": _to_str(doc.get("buyer_id")),
        "seller_id": _to_str(doc.get("seller_id")),
        "last_message_preview": doc.get("last_message_preview"),
        "last_message_at": doc.get("last_message_at") if isinstance(doc.get("last_message_at"), datetime) else None,
        "created_at": doc.get("created_at") if isinstance(doc.get("created_at"), datetime) else None,
        "updated_at": doc.get("updated_at") if isinstance(doc.get("updated_at"), datetime) else None,
    }
    return ChatThreadResponse.model_validate(payload)


def message_response_from_doc(doc: Dict[str, Any]) -> ChatMessageResponse:
    payload = {
        "_id": _to_str(doc.get("_id")),
        "thread_id": _to_str(doc.get("thread_id")),
        "order_id": _to_str(doc.get("order_id")),
        "sender_id": _to_str(doc.get("sender_id")),
        "message_type": doc.get("message_type", "text"),
        "content": doc.get("content", ""),
        "attachments": doc.get("attachments", []) or [],
        "is_read": bool(doc.get("is_read", False)),
        "created_at": doc.get("created_at") if isinstance(doc.get("created_at"), datetime) else None,
    }
    return ChatMessageResponse.model_validate(payload)

