
"""API routes for seller onboarding and dashboard."""

from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.database import Database

from ...db.models import UserDocument
from ...db.session import get_database
from ..common.utils import utcnow
from ..catalog import service as catalog_service
from ..catalog.schemas import ProductListResponse, ProductResponse
from ..users.dependencies import get_current_user, require_admin, require_seller
from . import service
from .schemas import (
    AdminSellerUpdateRequest,
    SellerApplicationRequest,
    SellerDashboardResponse,
    SellerDashboardSummary,
    SellerResponse,
)

router = APIRouter(prefix="/sellers", tags=["sellers"])
admin_router = APIRouter(prefix="/admin/sellers", tags=["admin-sellers"], dependencies=[Depends(require_admin)])


def _seller_to_response(doc: dict) -> SellerResponse:
    payload = {
        "_id": doc["_id"],
        "user_id": doc["user_id"],
        "shop_name": doc.get("shop_name", ""),
        "slug": doc.get("slug", ""),
        "description": doc.get("description"),
        "logo_url": doc.get("logo_url"),
        "cover_image_url": doc.get("cover_image_url"),
        "status": doc.get("status", "pending"),
        "verification_notes": doc.get("verification_notes"),
        "social_links": doc.get("social_links", []),
        "documents": doc.get("documents", []),
        "created_at": doc.get("created_at") or utcnow(),
        "updated_at": doc.get("updated_at") or utcnow(),
    }
    return SellerResponse.model_validate(payload)


@router.post("/apply", response_model=SellerResponse, status_code=status.HTTP_201_CREATED)
def apply_seller(
    payload: SellerApplicationRequest,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> SellerResponse:
    seller_doc = service.submit_application(db, current_user, payload.model_dump())
    return _seller_to_response(seller_doc)


@router.get("/me", response_model=SellerResponse)
def get_my_seller_profile(
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> SellerResponse:
    seller_doc = service.get_seller_for_user(db, current_user["_id"])
    if not seller_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bạn chưa đăng ký shop")
    return _seller_to_response(seller_doc)


@router.get("/dashboard/summary", response_model=SellerDashboardResponse)
def seller_dashboard_summary(
    current_user: UserDocument = Depends(require_seller),
    db: Database = Depends(get_database),
) -> SellerDashboardResponse:
    seller_doc = service.get_seller_for_user(db, current_user["_id"])
    if not seller_doc or seller_doc.get("status") != "approved":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Shop chưa được phê duyệt")

    summary = service.get_dashboard_summary(db, seller_doc)
    return SellerDashboardResponse(
        seller=_seller_to_response(seller_doc),
        summary=SellerDashboardSummary(**summary),
    )


def _product_to_response(doc: dict) -> ProductResponse:
    variants_payload = []
    for variant in doc.get("variants", []):
        item = dict(variant)
        if item.get("_id") is not None:
            item["_id"] = str(item["_id"])
        variants_payload.append(item)

    return ProductResponse.model_validate(
        {
            "_id": str(doc["_id"]),
            "seller_id": str(doc["seller_id"]),
            "name": doc.get("name", ""),
            "summary": doc.get("summary"),
            "description_custom": doc.get("description_custom"),
            "seo_title": doc.get("seo_title"),
            "seo_description": doc.get("seo_description"),
            "category_ids": [str(cid) for cid in doc.get("categories", [])],
            "tags": doc.get("tags", []),
            "status": doc.get("status"),
            "unit": doc.get("unit"),
            "min_order_quantity": doc.get("min_order_quantity", 1),
            "base_price": doc.get("base_price"),
            "attributes": doc.get("attributes", {}),
            "variants": variants_payload,
            "thumbnail_url": doc.get("thumbnail_url"),
            "image_urls": doc.get("image_urls", []),
            "media": doc.get("media", []),
            "slug": doc.get("slug"),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
        }
    )


@router.get("/me/products", response_model=ProductListResponse)
def list_my_products(
    status_filter: str = Query(default="all"),
    limit: int = Query(default=20, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    current_user: UserDocument = Depends(require_seller),
    db: Database = Depends(get_database),
) -> ProductListResponse:
    seller_doc = service.get_seller_for_user(db, current_user["_id"])
    if not seller_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="B���n ch��a �`��ng kA� shop")

    effective_status = status_filter if status_filter not in {"", "all"} else None
    products, total = catalog_service.list_products_for_seller(
        db,
        ObjectId(seller_doc["_id"]),
        status_filter=effective_status,
        limit=limit,
        skip=skip,
    )
    return ProductListResponse(
        items=[_product_to_response(product) for product in products],
        total=total,
    )


@admin_router.get("", response_model=list[SellerResponse])
def admin_list_sellers(
    status_filter: str | None = Query(default=None, alias="status"),
    db: Database = Depends(get_database),
) -> list[SellerResponse]:
    sellers = service.admin_list_sellers(db, status_filter)
    return [_seller_to_response(doc) for doc in sellers]


@admin_router.put("/{seller_id}/status", response_model=SellerResponse)
def admin_update_seller_status(
    seller_id: str,
    payload: AdminSellerUpdateRequest,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> SellerResponse:
    try:
        seller_oid = ObjectId(seller_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID không hợp lệ") from exc

    seller_doc = service.admin_update_seller_status(
        db,
        seller_oid,
        payload.status,
        payload.verification_notes,
        current_user,
    )
    return _seller_to_response(seller_doc)
