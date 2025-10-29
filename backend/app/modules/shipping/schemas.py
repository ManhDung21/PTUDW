
"""Schemas for shipping operations and webhooks."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class ShippingCreateRequest(BaseModel):
    provider: str = Field(default="mock", description="Tên đơn vị vận chuyển (mock, ghn, ghtk, etc.)")
    service_code: Optional[str] = Field(default=None, description="Mã dịch vụ vận chuyển")
    weight_grams: Optional[int] = Field(default=None, ge=0, description="Trọng lượng (gram)")
    note: Optional[str] = Field(default=None, max_length=255)


class ShippingStatusUpdateRequest(BaseModel):
    status: str
    note: Optional[str] = None
    estimated_delivery: Optional[datetime] = None


class ShippingResponse(BaseModel):
    id: str = Field(alias="_id")
    order_id: str
    provider: str
    tracking_number: str
    status: str
    status_history: list[dict]
    estimated_delivery: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    payload: dict[str, Any] = Field(default_factory=dict)


class ShippingWebhookPayload(BaseModel):
    provider: str
    tracking_number: str
    status: str
    note: Optional[str] = None
    estimated_delivery: Optional[datetime] = None
    raw_payload: dict[str, Any] = Field(default_factory=dict)
