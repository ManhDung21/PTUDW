"""Pydantic schemas for user and profile operations."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserRegistrationRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: Optional[str] = None
    phone_number: Optional[str] = Field(default=None, pattern=r"^[0-9]{10,11}$")


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class TokenPair(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileResponse(BaseModel):
    id: str
    email: Optional[str] = None
    phone_number: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    avatar_url: Optional[str] = None
    gender: Optional[str] = Field(default=None, pattern=r"^(male|female|other)$")
    date_of_birth: Optional[datetime] = None
    bio: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    gender: Optional[str] = Field(default=None, pattern=r"^(male|female|other)$")
    date_of_birth: Optional[datetime] = None
    bio: Optional[str] = Field(default=None, max_length=400)
    phone_number: Optional[str] = Field(default=None, pattern=r"^[0-9]{10,11}$")


class AddressBase(BaseModel):
    label: Optional[str] = None
    recipient_name: str
    phone_number: str = Field(pattern=r"^[0-9]{10,11}$")
    address_line: str
    ward: Optional[str] = None
    district: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "Vi?t Nam"
    is_default: bool = False


class AddressCreateRequest(AddressBase):
    pass


class AddressUpdateRequest(AddressBase):
    pass


class AddressResponse(AddressBase):
    id: str = Field(alias="_id")
    user_id: str
    created_at: datetime
    updated_at: datetime


class AddressListResponse(BaseModel):
    items: list[AddressResponse]
