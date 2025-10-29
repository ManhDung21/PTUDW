
"""Payment integration helpers for MoMo and VNPay sandbox flows."""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import timedelta
from typing import Any, Dict, Optional
from uuid import uuid4
from urllib.parse import quote_plus, urlencode

import httpx
from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.collection import Collection
from pymongo.database import Database

from ...config import get_settings
from ...db.models import PaymentDocument
from ..common.utils import utcnow
from ..notifications import service as notifications_service
from ..orders import service as orders_service


def payments_collection(db: Database) -> Collection:
    return db.get_collection("payments")


def _parse_object_id(value: str, label: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label} không hợp lệ") from exc


def _upsert_payment_record(
    db: Database,
    order: dict,
    provider: str,
    amount: float,
    currency: str,
    request_id: Optional[str],
    payment_url: Optional[str],
    payload: dict[str, Any],
) -> dict:
    now = utcnow()
    payments_collection(db).update_many(
        {"order_id": order["_id"], "provider": provider, "status": "pending"},
        {"$set": {"status": "expired", "updated_at": now}},
    )

    payment_doc: PaymentDocument = {
        "order_id": order["_id"],
        "order_code": order.get("order_code", ""),
        "provider": provider,
        "amount": amount,
        "currency": currency,
        "transaction_id": None,
        "request_id": request_id,
        "payment_url": payment_url,
        "status": "pending",
        "raw_payload": payload,
        "created_at": now,
        "updated_at": now,
    }
    result = payments_collection(db).insert_one(payment_doc)
    payment_doc["_id"] = result.inserted_id  # type: ignore[index]
    return payment_doc


def initiate_momo_payment(
    db: Database,
    order: dict,
    redirect_url: Optional[str],
) -> dict:
    settings = get_settings()
    if not all([settings.momo_partner_code, settings.momo_access_key, settings.momo_secret_key]):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="MoMo chưa được cấu hình")

    request_id = uuid4().hex
    order_id = order.get("order_code")
    amount = int(order.get("total_amount", 0))
    redirect = redirect_url or settings.momo_redirect_url or ""
    ipn_url = settings.momo_ipn_url or ""
    extra_data = ""
    order_info = f"Payment for order {order_id}"
    request_type = "captureWallet"

    raw_signature = (
        f"accessKey={settings.momo_access_key}"
        f"&amount={amount}"
        f"&extraData={extra_data}"
        f"&ipnUrl={ipn_url}"
        f"&orderId={order_id}"
        f"&orderInfo={order_info}"
        f"&partnerCode={settings.momo_partner_code}"
        f"&redirectUrl={redirect}"
        f"&requestId={request_id}"
        f"&requestType={request_type}"
    )
    signature = hmac.new(
        settings.momo_secret_key.encode("utf-8"),
        raw_signature.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    payload = {
        "partnerCode": settings.momo_partner_code,
        "partnerName": "MoMo",
        "storeId": "PTUD2",
        "requestId": request_id,
        "amount": amount,
        "orderId": order_id,
        "orderInfo": order_info,
        "redirectUrl": redirect,
        "ipnUrl": ipn_url,
        "lang": "vi",
        "extraData": extra_data,
        "requestType": request_type,
        "signature": signature,
        "orderExpireTime": 600,
    }

    pay_url = None
    deeplink = None
    qr_code_url = None
    try:
        if settings.momo_endpoint:
            response = httpx.post(settings.momo_endpoint, json=payload, timeout=15.0)
            if response.status_code == 200:
                resp_json = response.json()
                pay_url = resp_json.get("payUrl")
                deeplink = resp_json.get("deeplink")
                qr_code_url = resp_json.get("qrCodeUrl")
            else:
                # keep payload for client to retry manually
                resp_json = response.text
                payload["sdk_result"] = resp_json
    except Exception as exc:  # noqa: BLE001
        payload["sdk_error"] = str(exc)

    payment_doc = _upsert_payment_record(
        db=db,
        order=order,
        provider="momo",
        amount=float(amount),
        currency="VND",
        request_id=request_id,
        payment_url=pay_url,
        payload=payload,
    )

    return {
        "payment_id": str(payment_doc["_id"]),
        "partner_code": settings.momo_partner_code,
        "request_id": request_id,
        "order_id": order_id,
        "amount": amount,
        "pay_url": pay_url,
        "deeplink": deeplink,
        "qr_code_url": qr_code_url,
        "payload": payload,
    }


def _create_vnpay_signature(data: Dict[str, Any], secret_key: str) -> str:
    sorted_keys = sorted(data.keys())
    sign_data = "&".join(f"{key}={data[key]}" for key in sorted_keys if data[key] is not None)
    return hmac.new(secret_key.encode("utf-8"), sign_data.encode("utf-8"), hashlib.sha512).hexdigest()


def initiate_vnpay_payment(
    db: Database,
    order: dict,
    redirect_url: Optional[str],
    client_ip: str = "127.0.0.1",
) -> dict:
    settings = get_settings()
    if not all([settings.vnpay_tmn_code, settings.vnpay_hash_secret]):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="VNPay chưa được cấu hình")

    amount = float(order.get("total_amount", 0))
    vnp_amount = int(amount * 100)
    order_id = order.get("order_code")
    create_date = utcnow().strftime("%Y%m%d%H%M%S")
    txn_ref = uuid4().hex[:12]

    expire_date = (utcnow() + timedelta(minutes=15)).strftime("%Y%m%d%H%M%S")
    params = {
        "vnp_Version": "2.1.0",
        "vnp_Command": "pay",
        "vnp_TmnCode": settings.vnpay_tmn_code,
        "vnp_Amount": vnp_amount,
        "vnp_CurrCode": "VND",
        "vnp_TxnRef": txn_ref,
        "vnp_OrderInfo": f"Payment for order {order_id}",
        "vnp_OrderType": "billpayment",
        "vnp_Locale": "vn",
        "vnp_ReturnUrl": redirect_url or settings.vnpay_return_url or "",
        "vnp_IpAddr": client_ip,
        "vnp_CreateDate": create_date,
        "vnp_ExpireDate": expire_date,
        "vnp_Bill_Email": "",
        "vnp_Bill_FirstName": "",
        "vnp_Bill_LastName": "",
    }

    params = {k: v for k, v in params.items() if v is not None}
    params["vnp_SecureHash"] = _create_vnpay_signature(params, settings.vnpay_hash_secret)

    sorted_items = sorted(params.items())
    query_string = "&".join(f"{k}={quote_plus(str(v))}" for k, v in sorted_items)
    pay_url = f"{settings.vnpay_base_url}?{query_string}"

    payment_doc = _upsert_payment_record(
        db=db,
        order=order,
        provider="vnpay",
        amount=amount,
        currency="VND",
        request_id=txn_ref,
        payment_url=pay_url,
        payload=params,
    )

    return {
        "payment_id": str(payment_doc["_id"]),
        "order_id": order_id,
        "amount": amount,
        "pay_url": pay_url,
    }


def initiate_payment(
    db: Database,
    user: dict,
    order_id_str: str,
    provider: str,
    redirect_url: Optional[str],
    client_ip: str = "127.0.0.1",
) -> dict:
    order_id = _parse_object_id(order_id_str, "order_id")
    order = orders_service.get_order_by_object_id(db, order_id)
    if order.get("buyer_id") != user["_id"] and (user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to pay for this order")
    if order.get("payment_status") in {"paid", "cod_collected"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Đơn hàng đã thanh toán")

    if provider == "momo":
        return initiate_momo_payment(db, order, redirect_url)
    if provider == "vnpay":
        return initiate_vnpay_payment(db, order, redirect_url, client_ip)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider is not supported")


def _update_payment_record_status(
    db: Database,
    payment_doc: dict,
    status_value: str,
    transaction_id: Optional[str],
    raw_payload: dict,
) -> None:
    payments_collection(db).update_one(
        {"_id": payment_doc["_id"]},
        {
            "$set": {
                "status": status_value,
                "transaction_id": transaction_id,
                "raw_payload": raw_payload,
                "updated_at": utcnow(),
            }
        },
    )


def handle_momo_webhook(db: Database, payload: dict[str, Any]) -> dict:
    settings = get_settings()
    if not settings.momo_secret_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="MoMo is not configured")

    required_fields = {"orderId", "requestId", "amount", "resultCode", "signature"}
    if not required_fields.issubset(set(payload.keys())):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing MoMo parameters")

    access_key = settings.momo_access_key or ""
    raw_signature = "&".join(
        f"{key}={payload.get(key, '')}"
        for key in [
            "accessKey",
            "amount",
            "extraData",
            "message",
            "orderId",
            "orderInfo",
            "orderType",
            "partnerCode",
            "payType",
            "requestId",
            "responseTime",
            "resultCode",
            "transId",
        ]
    ).replace("accessKey=", f"accessKey={access_key}")

    generated_signature = hmac.new(
        (settings.momo_ipn_secret or settings.momo_secret_key).encode("utf-8"),
        raw_signature.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if generated_signature != payload.get("signature"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid MoMo signature")

    payment_doc = payments_collection(db).find_one(
        {
            "order_code": payload.get("orderId"),
            "provider": "momo",
            "request_id": payload.get("requestId"),
        }
    )
    if not payment_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found")

    order = orders_service.get_order_by_object_id(db, payment_doc["order_id"])
    amount = float(payload.get("amount", 0))
    if abs(amount - float(order.get("total_amount", 0))) > 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount mismatch")

    if payload.get("resultCode") == 0:
        _update_payment_record_status(db, payment_doc, "paid", payload.get("transId"), payload)
        orders_service.update_order_payment_status(
            db=db,
            order_id=payment_doc["order_id"],
            new_status="paid",
            note="MoMo payment succeeded",
            actor_id=None,
            transaction_id=payload.get("transId"),
        )
        notifications_service.create_notification(
            db,
            order["buyer_id"],
            notification_type="payment_paid",
            title="Payment successful",
            message=f"Order {order.get('order_code', '')} has been paid via MoMo.",
            metadata={"order_id": str(order["_id"]), "provider": "momo"},
        )
        seller_id = order.get("seller_id")
        if seller_id:
            notifications_service.create_notification(
                db,
                seller_id,
                notification_type="payment_paid",
                title="Order paid",
                message=f"Order {order.get('order_code', '')} has been paid by the buyer.",
                metadata={"order_id": str(order["_id"]), "provider": "momo"},
            )
    else:
        _update_payment_record_status(db, payment_doc, "failed", payload.get("transId"), payload)
        orders_service.update_order_payment_status(
            db=db,
            order_id=payment_doc["order_id"],
            new_status="failed",
            note=f"MoMo payment failed: {payload.get('message')}",
            actor_id=None,
        )
        notifications_service.create_notification(
            db,
            order["buyer_id"],
            notification_type="payment_failed",
            title="Payment failed",
            message=f"Payment for order {order.get('order_code', '')} was not successful.",
            metadata={"order_id": str(order["_id"]), "provider": "momo", "message": payload.get('message')},
        )

    return {"resultCode": 0, "message": "success"}
def _verify_vnpay_signature(params: dict[str, str], secret_key: str) -> bool:
    received_hash = params.pop("vnp_SecureHash", None)
    params.pop("vnp_SecureHashType", None)
    sorted_params = sorted(params.items())
    sign_data = "&".join(f"{key}={value}" for key, value in sorted_params)
    calculated_hash = hmac.new(secret_key.encode("utf-8"), sign_data.encode("utf-8"), hashlib.sha512).hexdigest()
    return calculated_hash.lower() == (received_hash or "").lower()


def handle_vnpay_webhook(db: Database, query_params: dict[str, str]) -> str:
    settings = get_settings()
    if not settings.vnpay_hash_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="VNPay is not configured")

    params = dict(query_params)
    if not _verify_vnpay_signature(params.copy(), settings.vnpay_hash_secret):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid VNPay signature")

    order_code = params.get("vnp_OrderInfo", "").split()[-1] if params.get("vnp_OrderInfo") else None
    txn_ref = params.get("vnp_TxnRef")
    amount = float(params.get("vnp_Amount", "0")) / 100
    response_code = params.get("vnp_ResponseCode")

    payment_doc = payments_collection(db).find_one(
        {"order_code": order_code, "provider": "vnpay", "request_id": txn_ref}
    )
    if not payment_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found")

    order = orders_service.get_order_by_object_id(db, payment_doc["order_id"])
    if abs(amount - float(order.get("total_amount", 0))) > 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount mismatch")

    if response_code == "00":
        _update_payment_record_status(db, payment_doc, "paid", params.get("vnp_TransactionNo"), params)
        orders_service.update_order_payment_status(
            db=db,
            order_id=payment_doc["order_id"],
            new_status="paid",
            note="VNPay payment succeeded",
            actor_id=None,
            transaction_id=params.get("vnp_TransactionNo"),
        )
        notifications_service.create_notification(
            db,
            order["buyer_id"],
            notification_type="payment_paid",
            title="Payment successful",
            message=f"Order {order.get('order_code', '')} has been paid via VNPay.",
            metadata={"order_id": str(order["_id"]), "provider": "vnpay"},
        )
        seller_id = order.get("seller_id")
        if seller_id:
            notifications_service.create_notification(
                db,
                seller_id,
                notification_type="payment_paid",
                title="Order paid",
                message=f"Order {order.get('order_code', '')} has been paid by the buyer.",
                metadata={"order_id": str(order["_id"]), "provider": "vnpay"},
            )
        return "00"

    _update_payment_record_status(db, payment_doc, "failed", params.get("vnp_TransactionNo"), params)
    orders_service.update_order_payment_status(
        db=db,
        order_id=payment_doc["order_id"],
        new_status="failed",
        note=f"VNPay payment failed: {response_code}",
        actor_id=None,
    )
    notifications_service.create_notification(
        db,
        order["buyer_id"],
        notification_type="payment_failed",
        title="Payment failed",
        message=f"Payment for order {order.get('order_code', '')} was not successful.",
        metadata={"order_id": str(order["_id"]), "provider": "vnpay", "code": response_code},
    )
    return "01"
def get_payment_status(db: Database, payment_id_str: str) -> dict:
    payment_id = _parse_object_id(payment_id_str, "payment_id")
    payment_doc = payments_collection(db).find_one({"_id": payment_id})
    if not payment_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy giao dịch")

    return {
        "payment_id": str(payment_doc["_id"]),
        "order_id": str(payment_doc["order_id"]),
        "provider": payment_doc.get("provider"),
        "status": payment_doc.get("status"),
        "transaction_id": payment_doc.get("transaction_id"),
        "amount": payment_doc.get("amount"),
        "updated_at": payment_doc.get("updated_at"),
    }
