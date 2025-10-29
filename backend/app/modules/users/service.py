
"""Domain services for user, profile, and address management."""

from __future__ import annotations

from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo import ReturnDocument
from pymongo.collection import Collection
from pymongo.database import Database

from ...db.models import AddressDocument, UserDocument, UserProfileDocument
from ...services import auth
from ..common.utils import is_phone_number, normalize_email, utcnow
from .dependencies import find_user_by_identifier, token_subject, users_collection


def profiles_collection(db: Database) -> Collection:
    return db.get_collection("user_profiles")


def addresses_collection(db: Database) -> Collection:
    return db.get_collection("addresses")


def get_profile(db: Database, user_id: ObjectId) -> Optional[UserProfileDocument]:
    return profiles_collection(db).find_one({"user_id": user_id})


def ensure_profile(db: Database, user: UserDocument) -> UserProfileDocument:
    coll = profiles_collection(db)
    existing = coll.find_one({"user_id": user["_id"]})
    if existing:
        return existing

    profile: UserProfileDocument = {
        "user_id": user["_id"],
        "display_name": user.get("email") or user.get("phone_number"),
        "avatar_url": None,
        "gender": None,
        "date_of_birth": None,
        "bio": None,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    coll.insert_one(profile)
    return profile


def update_profile(
    db: Database,
    user: UserDocument,
    payload: dict,
) -> UserProfileDocument:
    coll = profiles_collection(db)
    now = utcnow()
    update_fields = {k: v for k, v in payload.items() if v is not None}
    update_fields["updated_at"] = now
    result = coll.find_one_and_update(
        {"user_id": user["_id"]},
        {"$set": update_fields, "$setOnInsert": {"created_at": now, "user_id": user["_id"]}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return result


def list_addresses(db: Database, user_id: ObjectId) -> list[AddressDocument]:
    cursor = addresses_collection(db).find({"user_id": user_id}).sort(
        [("is_default", -1), ("updated_at", -1)]
    )
    return list(cursor)


def get_address_by_id(db: Database, user_id: ObjectId, address_id: ObjectId) -> AddressDocument:
    address = addresses_collection(db).find_one({"_id": address_id, "user_id": user_id})
    if not address:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Địa chỉ không tồn tại")
    return address


def create_address(
    db: Database,
    user_id: ObjectId,
    data: dict,
) -> AddressDocument:
    coll = addresses_collection(db)
    now = utcnow()
    address: AddressDocument = {
        "user_id": user_id,
        "label": data.get("label"),
        "recipient_name": data["recipient_name"],
        "phone_number": data["phone_number"],
        "address_line": data["address_line"],
        "ward": data.get("ward"),
        "district": data.get("district"),
        "province": data.get("province"),
        "postal_code": data.get("postal_code"),
        "country": data.get("country", "Việt Nam"),
        "is_default": data.get("is_default", False),
        "created_at": now,
        "updated_at": now,
    }
    result = coll.insert_one(address)
    address["_id"] = result.inserted_id
    if address["is_default"]:
        coll.update_many(
            {"user_id": user_id, "_id": {"$ne": address["_id"]}},
            {"$set": {"is_default": False}},
        )
    return address


def update_address(
    db: Database,
    user_id: ObjectId,
    address_id: ObjectId,
    data: dict,
) -> AddressDocument:
    coll = addresses_collection(db)
    payload = {k: v for k, v in data.items() if v is not None}
    payload["updated_at"] = utcnow()
    result = coll.find_one_and_update(
        {"_id": address_id, "user_id": user_id},
        {"$set": payload},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Địa chỉ không tồn tại")

    if payload.get("is_default"):
        coll.update_many(
            {"user_id": user_id, "_id": {"$ne": address_id}},
            {"$set": {"is_default": False}},
        )
    return result


def delete_address(db: Database, user_id: ObjectId, address_id: ObjectId) -> None:
    coll = addresses_collection(db)
    result = coll.delete_one({"_id": address_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Địa chỉ không tồn tại")


def set_default_address(db: Database, user_id: ObjectId, address_id: ObjectId) -> AddressDocument:
    coll = addresses_collection(db)
    updated = coll.find_one_and_update(
        {"_id": address_id, "user_id": user_id},
        {"$set": {"is_default": True, "updated_at": utcnow()}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Địa chỉ không tồn tại")

    coll.update_many(
        {"user_id": user_id, "_id": {"$ne": address_id}},
        {"$set": {"is_default": False}},
    )
    return updated


def register_user_with_email(
    db: Database,
    email: str,
    password: str,
    full_name: str | None = None,
    phone_number: str | None = None,
    role: str = "buyer",
) -> UserDocument:
    coll = users_collection(db)
    normalized_email = normalize_email(email)
    if not normalized_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email không hợp lệ")
    if coll.find_one({"email": normalized_email}):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email đã tồn tại")
    if phone_number:
        if not is_phone_number(phone_number):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Số điện thoại không hợp lệ")
        if coll.find_one({"phone_number": phone_number}):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Số điện thoại đã tồn tại")

    now = utcnow()
    user: UserDocument = {
        "email": normalized_email,
        "phone_number": phone_number,
        "hashed_password": auth.hash_password(password),
        "role": role,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    result = coll.insert_one(user)
    user["_id"] = result.inserted_id

    profile_data = {
        "display_name": full_name or normalized_email,
    }
    update_profile(db, user, profile_data)
    return user


def authenticate_user(
    db: Database,
    identifier: str,
    password: str,
) -> UserDocument:
    user = find_user_by_identifier(db, identifier)
    if not user or not auth.verify_password(password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Thông tin đăng nhập không chính xác")
    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản bị khóa")
    return user


def issue_access_token(user: UserDocument) -> str:
    return auth.create_access_token(token_subject(user))
