
"""API router for catalog (categories, products)."""

from __future__ import annotations

from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.database import Database

from ...db.models import UserDocument
from ...db.session import get_database
from ..users.dependencies import (
    get_current_user_optional,
    require_admin,
    require_seller,
)
from . import service
from .schemas import (
    CategoryCreateRequest,
    CategoryResponse,
    CategoryUpdateRequest,
    InventoryAdjustRequest,
    InventoryLogResponse,
    ProductCreateRequest,
    ProductListResponse,
    ProductResponse,
    ProductUpdateRequest,
)

router = APIRouter(prefix="/catalog", tags=["catalog"])


def _category_to_response(doc) -> CategoryResponse:
    return CategoryResponse.model_validate(
        {
            "_id": str(doc["_id"]),
            "name": doc["name"],
            "slug": doc.get("slug"),
            "parent_id": str(doc["parent_id"]) if doc.get("parent_id") else None,
            "is_active": doc.get("is_active", True),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
        }
    )


def _product_to_response(doc) -> ProductResponse:
    variants_payload = []
    for variant in doc.get("variants", []):
        variant_item = dict(variant)
        if variant_item.get("_id") is not None:
            variant_item["_id"] = str(variant_item["_id"])
        variants_payload.append(variant_item)

    return ProductResponse.model_validate(
        {
            "_id": str(doc["_id"]),
            "seller_id": str(doc["seller_id"]),
            "name": doc["name"],
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


@router.get("/categories", response_model=list[CategoryResponse])
def list_categories(
    current_user: Optional[UserDocument] = Depends(get_current_user_optional),
    db: Database = Depends(get_database),
) -> list[CategoryResponse]:
    docs = service.list_categories(db, only_active=False if current_user and current_user.get("role") == "admin" else True)
    return [_category_to_response(doc) for doc in docs]


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_category(
    payload: CategoryCreateRequest,
    db: Database = Depends(get_database),
) -> CategoryResponse:
    doc = service.create_category(db, payload.model_dump())
    return _category_to_response(doc)


@router.put("/categories/{category_id}", response_model=CategoryResponse, dependencies=[Depends(require_admin)])
def update_category(
    category_id: str,
    payload: CategoryUpdateRequest,
    db: Database = Depends(get_database),
) -> CategoryResponse:
    try:
        category_oid = ObjectId(category_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID không hợp lệ") from exc
    doc = service.update_category(db, category_oid, payload.model_dump(exclude_none=True))
    return _category_to_response(doc)


@router.get("/products", response_model=ProductListResponse)
def search_products(
    keyword: Optional[str] = Query(default=None, min_length=2),
    category_ids: Optional[list[str]] = Query(default=None),
    tags: Optional[list[str]] = Query(default=None),
    price_min: Optional[float] = Query(default=None, ge=0),
    price_max: Optional[float] = Query(default=None, ge=0),
    status_filter: str = Query(default="active"),
    limit: int = Query(default=20, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    db: Database = Depends(get_database),
) -> ProductListResponse:
    docs, total = service.search_products(
        db,
        keyword=keyword,
        category_ids=category_ids,
        tags=tags,
        price_min=price_min,
        price_max=price_max,
        status_filter=status_filter,
        limit=limit,
        skip=skip,
    )
    return ProductListResponse(
        items=[_product_to_response(doc) for doc in docs],
        total=total,
    )


@router.get("/products/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: str,
    db: Database = Depends(get_database),
) -> ProductResponse:
    try:
        product_oid = ObjectId(product_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID không hợp lệ") from exc
    doc = service.get_product_by_id(db, product_oid)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sản phẩm không tồn tại")
    return _product_to_response(doc)


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreateRequest,
    current_user: UserDocument = Depends(require_seller),
    db: Database = Depends(get_database),
) -> ProductResponse:
    doc = service.create_product(db, current_user, payload.model_dump())
    return _product_to_response(doc)


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: str,
    payload: ProductUpdateRequest,
    current_user: UserDocument = Depends(require_seller),
    db: Database = Depends(get_database),
) -> ProductResponse:
    try:
        product_oid = ObjectId(product_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID không hợp lệ") from exc

    doc = service.get_product_by_id(db, product_oid)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sản phẩm không tồn tại")
    if doc["seller_id"] != current_user["_id"] and (current_user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền chỉnh sửa sản phẩm này")

    updated = service.update_product(db, product_oid, payload.model_dump(exclude_none=True))
    return _product_to_response(updated)


def _inventory_log_to_response(log: dict) -> InventoryLogResponse:
    return InventoryLogResponse.model_validate(
        {
            "_id": log.get("_id"),
            "product_id": log.get("product_id"),
            "variant_id": log.get("variant_id"),
            "delta": log.get("delta", 0),
            "reason": log.get("reason", ""),
            "note": log.get("note"),
            "created_at": log.get("created_at"),
            "created_by": log.get("created_by"),
        }
    )


@router.post("/products/{product_id}/inventory/adjust", response_model=ProductResponse)
def adjust_inventory(
    product_id: str,
    payload: InventoryAdjustRequest,
    current_user: UserDocument = Depends(require_seller),
    db: Database = Depends(get_database),
) -> ProductResponse:
    product = service.adjust_inventory(
        db=db,
        seller_id=current_user["_id"],
        product_id_str=product_id,
        variant_id_str=payload.variant_id,
        delta=payload.delta,
        reason=payload.reason,
        note=payload.note,
        actor_id=current_user["_id"],
    )
    return _product_to_response(product)


@router.get("/products/{product_id}/inventory/logs", response_model=list[InventoryLogResponse])
def list_inventory_logs(
    product_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: UserDocument = Depends(require_seller),
    db: Database = Depends(get_database),
) -> list[InventoryLogResponse]:
    logs = service.list_inventory_logs(db, current_user["_id"], product_id, limit)
    return [_inventory_log_to_response(log) for log in logs]
