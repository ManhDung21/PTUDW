
"""Authentication and user-related dependencies reusable across routers."""

from __future__ import annotations

from typing import Iterable, Optional

from fastapi import Depends, HTTPException, status
from pymongo.collection import Collection
from pymongo.database import Database

from ...config import get_settings
from ...db.models import UserDocument
from ...db.session import get_database
from ...services import auth
from ..common.utils import is_email, is_phone_number, normalize_email

settings = get_settings()


def users_collection(db: Database) -> Collection:
    return db.get_collection("users")


def find_user_by_identifier(db: Database, identifier: str) -> Optional[UserDocument]:
    users = users_collection(db)
    if is_email(identifier):
        return users.find_one({"email": normalize_email(identifier)})
    if is_phone_number(identifier):
        return users.find_one({"phone_number": identifier})
    return None


def token_subject(user: UserDocument) -> str:
    return (
        user.get("email")
        or user.get("phone_number")
        or str(user.get("_id"))
    )


def get_current_user(
    token: Optional[str] = Depends(auth.optional_oauth2_scheme),
    db: Database = Depends(get_database),
) -> UserDocument:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yêu cầu đăng nhập",
        )

    identifier = auth.decode_access_token(token)
    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ",
        )

    user = find_user_by_identifier(db, identifier)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Không tìm thấy người dùng",
        )
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị khóa",
        )
    return user


def get_current_user_optional(
    token: Optional[str] = Depends(auth.optional_oauth2_scheme),
    db: Database = Depends(get_database),
) -> Optional[UserDocument]:
    if not token:
        return None
    identifier = auth.decode_access_token(token)
    if not identifier:
        return None
    return find_user_by_identifier(db, identifier)


def require_roles(
    roles: Iterable[str],
    current_user: UserDocument = Depends(get_current_user),
) -> UserDocument:
    allowed = set(role.lower() for role in roles)
    role = (current_user.get("role") or "buyer").lower()
    if role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Không có quyền truy cập",
        )
    return current_user


def require_admin(current_user: UserDocument = Depends(get_current_user)) -> UserDocument:
    if (current_user.get("role") or "").lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ admin mới được phép truy cập",
        )
    return current_user


def require_seller(current_user: UserDocument = Depends(get_current_user)) -> UserDocument:
    return require_roles(["seller", "admin"], current_user)


def require_buyer(current_user: UserDocument = Depends(get_current_user)) -> UserDocument:
    return require_roles(["buyer"], current_user)
