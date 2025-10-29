"""Socket.IO namespace handling buyer ↔ seller chat."""

from __future__ import annotations

from typing import Any, Dict

from bson import ObjectId
import socketio

from ..db.session import get_database
from ..modules.chat import service as chat_service
from ..modules.chat.utils import message_response_from_doc, thread_response_from_doc
from ..modules.users.dependencies import find_user_by_identifier
from ..services import auth
from .manager import emit_to_thread, thread_room


def _session_user(session: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "_id": ObjectId(session["user_id"]),
        "role": session.get("role", "buyer"),
    }


def _error_message(exc: Exception) -> str:
    detail = getattr(exc, "detail", None)
    if isinstance(detail, str):
        return detail
    return str(exc)


class ChatNamespace(socketio.AsyncNamespace):
    """Namespace that manages chat rooms and messaging."""

    name = "/ws/chat"

    async def on_connect(self, sid: str, environ: Dict[str, Any], auth_payload: Dict[str, Any] | None) -> None:
        token = None
        if isinstance(auth_payload, dict):
            token = auth_payload.get("token")

        if not token:
            raise ConnectionRefusedError("auth_required")

        identifier = auth.decode_access_token(token)
        if not identifier:
            raise ConnectionRefusedError("auth_invalid")

        db = get_database()
        user = find_user_by_identifier(db, identifier)
        if not user:
            raise ConnectionRefusedError("user_not_found")

        await self.save_session(
            sid,
            {
                "user_id": str(user["_id"]),
                "role": (user.get("role") or "buyer").lower(),
            },
        )

    async def on_disconnect(self, sid: str) -> None:
        return

    async def on_chat_list(self, sid: str) -> None:
        session = await self.get_session(sid)
        user = _session_user(session)
        db = get_database()
        threads = chat_service.list_threads_for_user(db, user)
        payload = [thread_response_from_doc(doc).model_dump(mode="json") for doc in threads]
        await self.emit("chat:threads", {"items": payload}, to=sid)

    async def on_chat_join(self, sid: str, data: Dict[str, Any]) -> None:
        session = await self.get_session(sid)
        thread_id = data.get("thread_id")
        if not thread_id:
            await self.emit("chat:error", {"message": "thread_id is required"}, to=sid)
            return

        db = get_database()
        user = _session_user(session)

        try:
            thread = chat_service.ensure_user_access_to_thread(db, ObjectId(thread_id), user)
        except Exception as exc:  # noqa: BLE001
            await self.emit("chat:error", {"message": _error_message(exc)}, to=sid)
            return

        await self.enter_room(sid, thread_room(thread_id))
        messages = chat_service.list_messages(db, thread["_id"], limit=50)
        response = {
            "thread": thread_response_from_doc(thread).model_dump(mode="json"),
            "messages": [message_response_from_doc(msg).model_dump(mode="json") for msg in reversed(messages)],
        }
        await self.emit("chat:joined", response, to=sid)

    async def on_chat_leave(self, sid: str, data: Dict[str, Any]) -> None:
        thread_id = data.get("thread_id")
        if not thread_id:
            return
        await self.leave_room(sid, thread_room(thread_id))

    async def on_chat_send(self, sid: str, data: Dict[str, Any]) -> None:
        session = await self.get_session(sid)
        thread_id = data.get("thread_id")
        content = (data.get("content") or "").strip()
        message_type = data.get("message_type", "text")

        if not thread_id or not content:
            await self.emit("chat:error", {"message": "Missing thread_id or content"}, to=sid)
            return

        db = get_database()
        user = _session_user(session)

        try:
            thread = chat_service.ensure_user_access_to_thread(db, ObjectId(thread_id), user)
        except Exception as exc:  # noqa: BLE001
            await self.emit("chat:error", {"message": _error_message(exc)}, to=sid)
            return

        message = chat_service.add_message(
            db=db,
            thread=thread,
            sender_id=user["_id"],
            message_type=message_type,
            content=content,
            attachments=[],
        )
        payload = message_response_from_doc(message).model_dump(mode="json")
        await emit_to_thread("chat:message", thread_id, payload)
