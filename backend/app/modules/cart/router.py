
"""API routes for cart and favorites."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from pymongo.database import Database

from ...db.models import UserDocument
from ...db.session import get_database
from ..common.utils import utcnow
from ..users.dependencies import require_buyer
from . import service
from .schemas import (
    CartItemAddRequest,
    CartItemResponse,
    CartItemUpdateRequest,
    CartResponse,
    FavoriteCreateRequest,
    FavoriteListResponse,
    FavoriteResponse,
)

router = APIRouter(prefix="/cart", tags=["cart"])
favorites_router = APIRouter(prefix="/favorites", tags=["favorites"])


def _cart_item_to_response(item: dict) -> CartItemResponse:
    total_price = float(item.get("price", 0)) * int(item.get("quantity", 0))
    return CartItemResponse(
        item_id=str(item.get("item_id")),
        product_id=str(item.get("product_id")),
        variant_id=str(item["variant_id"]) if item.get("variant_id") else None,
        product_name=item.get("product_name", ""),
        variant_name=item.get("variant_name"),
        thumbnail_url=item.get("thumbnail_url"),
        attributes=item.get("attributes") or {},
        quantity=item.get("quantity", 0),
        price=float(item.get("price", 0)),
        compare_at_price=float(item["compare_at_price"]) if item.get("compare_at_price") else None,
        total_price=round(total_price, 2),
        updated_at=item.get("updated_at") or utcnow(),
    )


def _cart_to_response(cart: dict) -> CartResponse:
    subtotal, total_items = service.calculate_cart_totals(cart)
    items = [_cart_item_to_response(item) for item in cart.get("items", [])]
    return CartResponse(
        items=items,
        subtotal=subtotal,
        total_items=total_items,
        updated_at=cart.get("updated_at") or utcnow(),
    )


@router.get("", response_model=CartResponse)
def get_cart(
    current_user: UserDocument = Depends(require_buyer),
    db: Database = Depends(get_database),
) -> CartResponse:
    cart = service.get_cart(db, current_user["_id"])
    return _cart_to_response(cart)


@router.post("/items", response_model=CartResponse, status_code=status.HTTP_201_CREATED)
def add_cart_item(
    payload: CartItemAddRequest,
    current_user: UserDocument = Depends(require_buyer),
    db: Database = Depends(get_database),
) -> CartResponse:
    cart = service.add_item(
        db=db,
        user_id=current_user["_id"],
        product_id_str=payload.product_id,
        variant_id_str=payload.variant_id,
        quantity=payload.quantity,
    )
    return _cart_to_response(cart)


@router.patch("/items/{item_id}", response_model=CartResponse)
def update_cart_item(
    item_id: str,
    payload: CartItemUpdateRequest,
    current_user: UserDocument = Depends(require_buyer),
    db: Database = Depends(get_database),
) -> CartResponse:
    cart = service.update_item_quantity(
        db=db,
        user_id=current_user["_id"],
        item_id_str=item_id,
        quantity=payload.quantity,
    )
    return _cart_to_response(cart)


@router.delete("/items/{item_id}", response_model=CartResponse)
def remove_cart_item(
    item_id: str,
    current_user: UserDocument = Depends(require_buyer),
    db: Database = Depends(get_database),
) -> CartResponse:
    cart = service.remove_item(db=db, user_id=current_user["_id"], item_id_str=item_id)
    return _cart_to_response(cart)


@router.delete("", response_model=CartResponse)
def clear_cart(
    current_user: UserDocument = Depends(require_buyer),
    db: Database = Depends(get_database),
) -> CartResponse:
    cart = service.clear_cart(db=db, user_id=current_user["_id"])
    return _cart_to_response(cart)


def _favorite_to_response(doc: dict) -> FavoriteResponse:
    payload = {
        "_id": str(doc.get("_id")),
        "product_id": str(doc.get("product_id")),
        "product_name": doc.get("product_name", ""),
        "thumbnail_url": doc.get("thumbnail_url"),
        "created_at": doc.get("created_at") or utcnow(),
    }
    return FavoriteResponse.model_validate(payload)


@favorites_router.get("", response_model=FavoriteListResponse)
def list_favorites(
    current_user: UserDocument = Depends(require_buyer),
    db: Database = Depends(get_database),
) -> FavoriteListResponse:
    favorites = service.list_favorites(db, current_user["_id"])
    return FavoriteListResponse(items=[_favorite_to_response(fav) for fav in favorites])


@favorites_router.post("", response_model=FavoriteResponse, status_code=status.HTTP_201_CREATED)
def add_favorite(
    payload: FavoriteCreateRequest,
    current_user: UserDocument = Depends(require_buyer),
    db: Database = Depends(get_database),
) -> FavoriteResponse:
    favorite = service.add_favorite(db, current_user["_id"], payload.product_id)
    return _favorite_to_response(favorite)


@favorites_router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def remove_favorite(
    product_id: str,
    current_user: UserDocument = Depends(require_buyer),
    db: Database = Depends(get_database),
) -> Response:
    service.remove_favorite(db, current_user["_id"], product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
