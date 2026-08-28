"""WebSocket message envelope helpers and protocol version."""
from typing import Any

from app.websocket.events import (  # noqa: F401  (re-export for backward compat)
    AI_CONTEXT_LOADED,
    AI_STREAMING,
    AI_THINKING,
    AI_TOOL_CALL,
    CHAT_CANCEL,
    CHAT_CANCELLED,
    CHAT_CHUNK,
    CHAT_END,
    CHAT_ERROR,
    CHAT_START,
    MEMORY_UPDATED,
    MSG_BROADCAST,
    MSG_ERROR,
    MSG_HEARTBEAT,
    MSG_HELLO,
    MSG_PING,
    MSG_PONG,
    MSG_SYSTEM,
    NOTIFICATION_CREATED,
    SYSTEM_METRICS,
    VOICE_AUDIO,
    VOICE_END,
    VOICE_START,
    VOICE_TRANSCRIPT,
)

VERSION = 1


def envelope(type_: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Build a versioned WebSocket message envelope."""
    return {"version": VERSION, "type": type_, "payload": payload or {}}