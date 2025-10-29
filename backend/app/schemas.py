"""Pydantic models for request and response payloads."""

from typing import Optional

from pydantic import BaseModel, Field


class GenerateTextRequest(BaseModel):
    product_info: str = Field(..., min_length=3)
    style: str = Field(default="Tiếp thị")


class DescriptionResponse(BaseModel):
    description: str
    history_id: str
    timestamp: str
    style: str
    source: str
    image_url: Optional[str]


class HistoryItem(BaseModel):
    id: str
    timestamp: str
    source: str
    style: str
    summary: str
    full_description: str
    image_url: Optional[str]


class UserCreate(BaseModel):
    identifier: str  # Email hoặc số điện thoại
    password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: Optional[str] = None
    phone_number: Optional[str] = None
    created_at: str


class ForgotPasswordRequest(BaseModel):
    identifier: str


class ResetPasswordRequest(BaseModel):
    identifier: str
    token: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=6)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=6)
    new_password: str = Field(min_length=6)


class MessageResponse(BaseModel):
    message: str
