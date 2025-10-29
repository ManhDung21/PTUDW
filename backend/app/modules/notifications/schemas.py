"""Schemas for notifications."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    type: str
    title: str
    message: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    is_read: bool
    created_at: Optional[datetime] = None
    read_at: Optional[datetime] = None


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int


class NotificationMarkReadRequest(BaseModel):
    read: bool = Field(default=True)


class NotificationPreferenceResponse(BaseModel):
    event_type: str
    channel: str
    enabled: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class NotificationPreferenceListResponse(BaseModel):
    items: list[NotificationPreferenceResponse]


class NotificationPreferenceUpdateRequest(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=120)
    channel: str = Field(default="in_app")
    enabled: bool = Field(default=True)
