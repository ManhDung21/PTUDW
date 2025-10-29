
"""Schemas for cart and favorite operations."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class CartItemAddRequest(BaseModel):
    product_id: str = Field(..., description="Mongo ObjectId of product")
    variant_id: Optional[str] = Field(default=None, description="Mongo ObjectId of product variant")
    quantity: int = Field(..., gt=0, le=999)

    @field_validator("product_id")
    @classmethod
    def validate_product_id(cls, value: str) -> str:
        if not value:
            raise ValueError("product_id cannot be empty")
        return value


class CartItemUpdateRequest(BaseModel):
    quantity: int = Field(..., gt=0, le=999)


class CartItemResponse(BaseModel):
    item_id: str
    product_id: str
    variant_id: Optional[str]
    product_name: str
    variant_name: Optional[str] = None
    thumbnail_url: Optional[str] = None
    attributes: dict[str, str] = Field(default_factory=dict)
    quantity: int
    price: float
    compare_at_price: Optional[float] = None
    total_price: float
    updated_at: datetime


class CartResponse(BaseModel):
    items: list[CartItemResponse]
    subtotal: float
    total_items: int
    updated_at: datetime


class FavoriteCreateRequest(BaseModel):
    product_id: str

    @field_validator("product_id")
    @classmethod
    def validate_product_id(cls, value: str) -> str:
        if not value:
            raise ValueError("product_id cannot be empty")
        return value


class FavoriteResponse(BaseModel):
    id: str = Field(alias="_id")
    product_id: str
    product_name: str
    thumbnail_url: Optional[str] = None
    created_at: datetime


class FavoriteListResponse(BaseModel):
    items: list[FavoriteResponse]


class _ObjectIdValidatorMixin:
    @field_validator("product_id")
    @classmethod
    def validate_product_id(cls, value: str) -> str:
        if not value:
            raise ValueError("product_id cannot be empty")
        return value
