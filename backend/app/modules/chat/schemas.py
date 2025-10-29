"""Pydantic schemas for chat threads and messages."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ChatThreadCreateRequest(BaseModel):
    order_id: str


class ChatMessageCreateRequest(BaseModel):
    message_type: str = Field(default="text", pattern="^(text|image|system)$")
    content: str = Field(..., min_length=1, max_length=4000)


class ChatThreadResponse(BaseModel):
    id: str = Field(alias="_id")
    order_id: str
    buyer_id: str
    seller_id: str
    last_message_preview: Optional[str] = None
    last_message_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ChatMessageResponse(BaseModel):
    id: str = Field(alias="_id")
    thread_id: str
    order_id: str
    sender_id: str
    message_type: str
    content: str
    attachments: list[str]
    is_read: bool
    created_at: datetime


class ChatThreadListResponse(BaseModel):
    items: list[ChatThreadResponse]


class ChatMessageListResponse(BaseModel):
    items: list[ChatMessageResponse]
