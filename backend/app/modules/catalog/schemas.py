
"""Schemas for product catalog operations."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class CategoryBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: Optional[str] = None
    parent_id: Optional[str] = None
    is_active: bool = True


class CategoryCreateRequest(CategoryBase):
    pass


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    parent_id: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryResponse(CategoryBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime


class ProductMedia(BaseModel):
    url: str
    kind: str = Field(default="image")
    is_cover: bool = False


class ProductVariant(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    sku: str
    attributes: dict[str, str] = Field(default_factory=dict)
    price: float = Field(gt=0)
    compare_at_price: Optional[float] = None
    stock_quantity: int = Field(ge=0)
    low_stock_threshold: int = Field(default=5, ge=0)
    weight_grams: Optional[int] = Field(default=None, ge=0)


class ProductBase(BaseModel):
    name: str
    summary: Optional[str] = None
    description_custom: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    category_ids: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    status: str = Field(default="draft", pattern=r"^(draft|active|inactive|archived)$")
    unit: Optional[str] = None
    min_order_quantity: int = Field(default=1, ge=1)
    base_price: float = Field(gt=0)
    attributes: dict[str, str] = Field(default_factory=dict)
    variants: list[ProductVariant] = Field(default_factory=list)
    thumbnail_url: Optional[str] = None
    image_urls: list[str] = Field(default_factory=list)
    media: list[ProductMedia] = Field(default_factory=list)


class ProductCreateRequest(ProductBase):
    pass


class ProductUpdateRequest(BaseModel):
    name: Optional[str] = None
    summary: Optional[str] = None
    description_custom: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    category_ids: Optional[list[str]] = None
    tags: Optional[list[str]] = None
    status: Optional[str] = Field(default=None, pattern=r"^(draft|active|inactive|archived)$")
    unit: Optional[str] = None
    min_order_quantity: Optional[int] = Field(default=None, ge=1)
    base_price: Optional[float] = Field(default=None, gt=0)
    attributes: Optional[dict[str, str]] = None
    variants: Optional[list[ProductVariant]] = None
    media: Optional[list[ProductMedia]] = None


class ProductResponse(ProductBase):
    id: str = Field(alias="_id")
    seller_id: str
    slug: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class InventoryAdjustRequest(BaseModel):
    variant_id: str = Field(..., description="ObjectId của biến thể")
    delta: int = Field(..., description="Số lượng tăng/giảm", gt=-10000, lt=10000)
    reason: str = Field(..., min_length=3, max_length=200)
    note: Optional[str] = Field(default=None, max_length=500)

    @field_validator("delta")
    @classmethod
    def delta_not_zero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("delta phải khác 0")
        return value


class InventoryLogResponse(BaseModel):
    id: str = Field(alias="_id")
    product_id: str
    variant_id: Optional[str] = None
    delta: int
    reason: str
    note: Optional[str] = None
    created_at: datetime
    created_by: str


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int
