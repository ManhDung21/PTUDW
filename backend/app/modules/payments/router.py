"""API router for payment initiation and webhooks."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse, PlainTextResponse
from pymongo.database import Database

from ...db.models import UserDocument
from ...db.session import get_database
from ..users.dependencies import get_current_user, require_buyer
from . import service
from .schemas import (
    MoMoPaymentResponse,
    PaymentInitiateRequest,
    PaymentStatusResponse,
    VnPayPaymentResponse,
)

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/initiate", response_model=MoMoPaymentResponse | VnPayPaymentResponse, status_code=status.HTTP_201_CREATED)
def initiate_payment(
    payload: PaymentInitiateRequest,
    request: Request,
    current_user: UserDocument = Depends(require_buyer),
    db: Database = Depends(get_database),
):
    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "127.0.0.1")
    result = service.initiate_payment(
        db=db,
        user=current_user,
        order_id_str=payload.order_id,
        provider=payload.provider.lower(),
        redirect_url=payload.redirect_url,
        client_ip=client_ip,
    )
    if payload.provider.lower() == "momo":
        return MoMoPaymentResponse(**result)
    return VnPayPaymentResponse(**result)


@router.post("/momo/webhook")
async def momo_webhook(
    request: Request,
    db: Database = Depends(get_database),
):
    payload = await request.json()
    result = service.handle_momo_webhook(db, payload)
    return JSONResponse(content=result)


@router.get("/vnpay/webhook")
def vnpay_webhook_get(
    request: Request,
    db: Database = Depends(get_database),
):
    params = dict(request.query_params)
    response_text = service.handle_vnpay_webhook(db, params)
    return PlainTextResponse(content=response_text)


@router.post("/vnpay/webhook")
async def vnpay_webhook_post(
    request: Request,
    db: Database = Depends(get_database),
):
    form = dict(await request.form())
    response_text = service.handle_vnpay_webhook(db, form)
    return PlainTextResponse(content=response_text)


@router.get("/{payment_id}", response_model=PaymentStatusResponse)
def get_payment_status(
    payment_id: str,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> PaymentStatusResponse:
    payment = service.get_payment_status(db, payment_id)
    return PaymentStatusResponse(
        order_id=payment["order_id"],
        payment_id=payment_id,
        provider=payment["provider"],
        status=payment["status"],
        transaction_id=payment.get("transaction_id"),
        amount=payment["amount"],
        updated_at=payment["updated_at"],
    )
