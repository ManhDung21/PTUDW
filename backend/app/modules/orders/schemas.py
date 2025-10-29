
"""Schemas for order creation and retrieval."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class CheckoutRequest(BaseModel):
    address_id: str = Field(..., description="ObjectId của địa chỉ giao hàng")
    payment_method: Literal["cod"] = Field(default="cod")
    note: Optional[str] = Field(default=None, max_length=500)

    @field_validator("address_id")
    @classmethod
    def validate_address_id(cls, value: str) -> str:
        if not value:
            raise ValueError("address_id không hợp lệ")
        return value


class OrderItemResponse(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    product_name: str
    sku: Optional[str] = None
    quantity: int
    price: float
    total_amount: float
    thumbnail_url: Optional[str] = None
    attributes: dict[str, str] = Field(default_factory=dict)


class OrderTimelineEntryResponse(BaseModel):
    status: str
    note: Optional[str] = None
    created_at: datetime


class OrderResponse(BaseModel):
    id: str = Field(alias="_id")
    order_code: str
    payment_method: str
    payment_status: str
    fulfillment_status: str
    subtotal_amount: float
    shipping_fee: float
    discount_amount: float
    total_amount: float
    note: Optional[str] = None
    address_snapshot: dict
    items: list[OrderItemResponse]
    timeline: list[OrderTimelineEntryResponse]
    created_at: datetime
    updated_at: datetime


class OrderListResponse(BaseModel):
    items: list[OrderResponse]

class OrderStatusUpdateRequest(BaseModel):
    note: Optional[str] = Field(default=None, max_length=400)
