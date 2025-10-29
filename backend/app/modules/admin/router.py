
"""Admin routes for managing users and roles."""

from __future__ import annotations

from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ReturnDocument
from pymongo.database import Database

from ...db.session import get_database
from ..common.utils import utcnow
from ..users.dependencies import require_admin, users_collection
from .schemas import AdminUserResponse, UpdateUserRoleRequest

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _user_to_admin_response(doc) -> AdminUserResponse:
    return AdminUserResponse.model_validate(
        {
            "_id": str(doc["_id"]),
            "email": doc.get("email"),
            "phone_number": doc.get("phone_number"),
            "role": doc.get("role", "buyer"),
            "is_active": doc.get("is_active", True),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
        }
    )


@router.get("/users", response_model=list[AdminUserResponse])
def admin_list_users(
    role: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    db: Database = Depends(get_database),
) -> list[AdminUserResponse]:
    query: dict = {}
    if role:
        query["role"] = role.lower()
    if is_active is not None:
        query["is_active"] = is_active
    docs = users_collection(db).find(query).sort("created_at", -1)
    return [_user_to_admin_response(doc) for doc in docs]


@router.put("/users/{user_id}/role", response_model=AdminUserResponse)
def admin_update_user_role(
    user_id: str,
    payload: UpdateUserRoleRequest,
    db: Database = Depends(get_database),
) -> AdminUserResponse:
    try:
        user_oid = ObjectId(user_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID không hợp lệ") from exc

    update_fields = {
        "role": payload.role,
        "updated_at": utcnow(),
    }
    if payload.is_active is not None:
        update_fields["is_active"] = payload.is_active

    doc = users_collection(db).find_one_and_update(
        {"_id": user_oid},
        {"$set": update_fields},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại")
    return _user_to_admin_response(doc)
