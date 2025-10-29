"""API routes for chat threads and messages."""

from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.database import Database

from ...db.models import UserDocument
from ...db.session import get_database
from ..users.dependencies import get_current_user, require_buyer, require_seller
from . import service
from .schemas import (
    ChatMessageCreateRequest,
    ChatMessageListResponse,
    ChatMessageResponse,
    ChatThreadCreateRequest,
    ChatThreadListResponse,
    ChatThreadResponse,
)
from .utils import message_response_from_doc, thread_response_from_doc

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/threads", response_model=ChatThreadResponse, status_code=status.HTTP_201_CREATED)
def create_thread(
    payload: ChatThreadCreateRequest,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> ChatThreadResponse:
    role = (current_user.get("role") or "buyer").lower()
    if role not in {"buyer", "seller"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    thread = service.create_thread_for_order(db, payload.order_id, current_user)
    return thread_response_from_doc(thread)


@router.get("/threads", response_model=ChatThreadListResponse)
def list_threads(
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> ChatThreadListResponse:
    threads = service.list_threads_for_user(db, current_user)
    return ChatThreadListResponse(items=[thread_response_from_doc(doc) for doc in threads])


@router.get("/threads/{thread_id}/messages", response_model=ChatMessageListResponse)
def list_messages(
    thread_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> ChatMessageListResponse:
    try:
        thread_oid = ObjectId(thread_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="thread_id is invalid") from exc
    thread = service.ensure_user_access_to_thread(db, thread_oid, current_user)
    messages = service.list_messages(db, thread["_id"], limit=limit)
    messages = list(reversed(messages))
    return ChatMessageListResponse(items=[message_response_from_doc(doc) for doc in messages])


@router.post("/threads/{thread_id}/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    thread_id: str,
    payload: ChatMessageCreateRequest,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> ChatMessageResponse:
    try:
        thread_oid = ObjectId(thread_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="thread_id is invalid") from exc
    thread = service.ensure_user_access_to_thread(db, thread_oid, current_user)
    message = service.add_message(
        db=db,
        thread=thread,
        sender_id=current_user["_id"],
        message_type=payload.message_type,
        content=payload.content,
        attachments=[],
    )
    return message_response_from_doc(message)
