
"""API routes for user profile and address management."""

from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pymongo.database import Database

from ...db.models import AddressDocument, UserDocument, UserProfileDocument
from ...db.session import get_database
from ..common.utils import utcnow
from . import service
from .dependencies import get_current_user, users_collection
from .schemas import (
    AddressCreateRequest,
    AddressListResponse,
    AddressResponse,
    AddressUpdateRequest,
    ProfileResponse,
    ProfileUpdateRequest,
    TokenPair,
    UserLoginRequest,
    UserRegistrationRequest,
)

router = APIRouter(prefix="/users", tags=["users"])
auth_router = APIRouter(prefix="/auth", tags=["auth"])


def _profile_to_response(user: UserDocument, profile: UserProfileDocument) -> ProfileResponse:
    created_at = profile.get("created_at") or user.get("created_at") or utcnow()
    updated_at = profile.get("updated_at") or created_at
    return ProfileResponse(
        id=str(user["_id"]),
        email=user.get("email"),
        phone_number=user.get("phone_number"),
        full_name=profile.get("display_name"),
        avatar_url=profile.get("avatar_url"),
        gender=profile.get("gender"),
        date_of_birth=profile.get("date_of_birth"),
        bio=profile.get("bio"),
        created_at=created_at,
        updated_at=updated_at,
    )


def _address_to_response(address: AddressDocument) -> AddressResponse:
    payload = AddressResponse.model_validate(
        {
            "_id": str(address["_id"]),
            "user_id": str(address["user_id"]),
            "label": address.get("label"),
            "recipient_name": address["recipient_name"],
            "phone_number": address["phone_number"],
            "address_line": address["address_line"],
            "ward": address.get("ward"),
            "district": address.get("district"),
            "province": address.get("province"),
            "postal_code": address.get("postal_code"),
            "country": address.get("country", "Việt Nam"),
            "is_default": address.get("is_default", False),
            "created_at": address.get("created_at", utcnow()),
            "updated_at": address.get("updated_at", utcnow()),
        }
    )
    return payload


@router.get("/me", response_model=ProfileResponse)
def get_profile(
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> ProfileResponse:
    profile = service.ensure_profile(db, current_user)
    return _profile_to_response(current_user, profile)


@router.put("/me", response_model=ProfileResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> ProfileResponse:
    update_payload = {
        "display_name": payload.full_name,
        "avatar_url": payload.avatar_url,
        "gender": payload.gender,
        "date_of_birth": payload.date_of_birth,
        "bio": payload.bio,
    }
    if payload.phone_number:
        update_payload["phone_number"] = payload.phone_number
        users_collection(db).update_one(
            {"_id": current_user["_id"]},
            {"$set": {"phone_number": payload.phone_number}},
        )
        current_user["phone_number"] = payload.phone_number
    profile = service.update_profile(db, current_user, update_payload)
    return _profile_to_response(current_user, profile)


@router.get("/me/addresses", response_model=AddressListResponse)
def list_addresses(
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> AddressListResponse:
    items = [
        _address_to_response(address)
        for address in service.list_addresses(db, current_user["_id"])
    ]
    return AddressListResponse(items=items)


@router.post("/me/addresses", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
def create_address(
    payload: AddressCreateRequest,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> AddressResponse:
    doc = service.create_address(db, current_user["_id"], payload.model_dump())
    return _address_to_response(doc)


@router.put("/me/addresses/{address_id}", response_model=AddressResponse)
def update_address(
    address_id: str,
    payload: AddressUpdateRequest,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> AddressResponse:
    try:
        address_oid = ObjectId(address_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID không hợp lệ") from exc
    doc = service.update_address(db, current_user["_id"], address_oid, payload.model_dump())
    return _address_to_response(doc)


@router.delete(
    "/me/addresses/{address_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_address(
    address_id: str,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> Response:
    try:
        address_oid = ObjectId(address_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID không hợp lệ") from exc
    service.delete_address(db, current_user["_id"], address_oid)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/me/addresses/{address_id}/default", response_model=AddressResponse)
def set_default_address(
    address_id: str,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> AddressResponse:
    try:
        address_oid = ObjectId(address_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID không hợp lệ") from exc
    doc = service.set_default_address(db, current_user["_id"], address_oid)
    return _address_to_response(doc)


@auth_router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
def register_user(
    payload: UserRegistrationRequest,
    db: Database = Depends(get_database),
) -> TokenPair:
    user = service.register_user_with_email(
        db=db,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
        phone_number=payload.phone_number,
    )
    token = service.issue_access_token(user)
    return TokenPair(access_token=token)


@auth_router.post("/login", response_model=TokenPair)
def login_user(
    payload: UserLoginRequest,
    db: Database = Depends(get_database),
) -> TokenPair:
    user = service.authenticate_user(db, payload.email, payload.password)
    token = service.issue_access_token(user)
    return TokenPair(access_token=token)
