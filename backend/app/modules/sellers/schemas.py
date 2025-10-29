
"""Pydantic schemas for seller onboarding and dashboard."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, HttpUrl, field_validator

SellerStatus = Literal["pending", "approved", "rejected", "suspended"]


class SellerApplicationRequest(BaseModel):
    shop_name: str = Field(..., min_length=3, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    logo_url: Optional[HttpUrl] = None
    cover_image_url: Optional[HttpUrl] = None
    social_links: list[HttpUrl] = Field(default_factory=list, max_items=10)
    documents: list[HttpUrl] = Field(default_factory=list, max_items=10)

    @field_validator("social_links", "documents")
    @classmethod
    def unique_urls(cls, links: list[HttpUrl]) -> list[HttpUrl]:
        seen: set[str] = set()
        unique: list[HttpUrl] = []
        for link in links:
            url = str(link)
            if url not in seen:
                seen.add(url)
                unique.append(link)
        return unique


class SellerResponse(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    shop_name: str
    slug: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    status: SellerStatus
    verification_notes: Optional[str] = None
    social_links: list[str] = Field(default_factory=list)
    documents: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class SellerDashboardSummary(BaseModel):
    total_orders: int
    pending_orders: int
    processing_orders: int
    cancelled_orders: int
    completed_orders: int
    revenue_total: float
    revenue_this_month: float
    orders_today: int
    low_stock_items: int


class SellerDashboardResponse(BaseModel):
    seller: SellerResponse
    summary: SellerDashboardSummary


class AdminSellerUpdateRequest(BaseModel):
    status: SellerStatus
    verification_notes: Optional[str] = Field(default=None, max_length=2000)
