"""WebSocket message envelope helpers and type constants."""
from typing import Any

MSG_HELLO = "hello"
MSG_PING = "ping"
MSG_PONG = "pong"
MSG_HEARTBEAT = "heartbeat"
MSG_BROADCAST = "broadcast"
MSG_ERROR = "error"
MSG_SYSTEM = "system"


def envelope(type_: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Build a standard message envelope for the WebSocket protocol."""
    return {"type": type_, "payload": payload or {}}
