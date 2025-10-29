
"""Schemas for admin operations."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class AdminUserResponse(BaseModel):
    id: str = Field(alias="_id")
    email: Optional[str] = None
    phone_number: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UpdateUserRoleRequest(BaseModel):
    role: Literal["buyer", "seller", "admin"]
    is_active: Optional[bool] = None
