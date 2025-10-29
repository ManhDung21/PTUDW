"""Socket.IO server helpers."""

from __future__ import annotations

from typing import Any, Optional

import socketio

_server: Optional[socketio.AsyncServer] = None


def set_socket_server(server: socketio.AsyncServer) -> None:
    global _server
    _server = server


def get_socket_server() -> Optional[socketio.AsyncServer]:
    return _server


def thread_room(thread_id: str) -> str:
    return f"thread:{thread_id}"


async def emit_to_thread(event: str, thread_id: str, payload: Any) -> None:
    server = get_socket_server()
    if server is None:
        return
    await server.emit(event, payload, room=thread_room(thread_id))

