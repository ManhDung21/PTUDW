
"""Pydantic schemas for payment initiation and webhook handling."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class PaymentInitiateRequest(BaseModel):
    order_id: str
    provider: str = Field(pattern="^(momo|vnpay)$")
    redirect_url: Optional[str] = None


class MoMoPaymentResponse(BaseModel):
    payment_id: str
    partner_code: str
    request_id: str
    order_id: str
    amount: float
    pay_url: Optional[str] = None
    deeplink: Optional[str] = None
    qr_code_url: Optional[str] = None
    payload: dict[str, Any]


class VnPayPaymentResponse(BaseModel):
    payment_id: str
    order_id: str
    amount: float
    pay_url: str


class PaymentStatusResponse(BaseModel):
    order_id: str
    payment_id: str
    provider: str
    status: str
    transaction_id: Optional[str] = None
    amount: float
    updated_at: datetime
