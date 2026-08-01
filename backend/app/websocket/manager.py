"""ConnectionManager: connect/disconnect/send/broadcast/heartbeat for /ws."""
import asyncio
from typing import Any

from fastapi import WebSocket

from app.utils.logging import get_logger
from app.websocket.protocol import MSG_HELLO, MSG_PING, MSG_PONG, envelope


class ConnectionManager:
    """Tracks live clients and provides send/broadcast primitives."""

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._logger = get_logger("websocket")

    @property
    def active_count(self) -> int:
        """Number of currently connected clients."""
        return len(self._connections)

    async def connect(self, websocket: WebSocket) -> None:
        """Accept a connection, register it, and greet the client."""
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)
        await self.send(websocket, envelope(MSG_HELLO, {"active": self.active_count}))
        self._logger.info(
            "websocket_connected",
            extra={"extra_fields": {"active": self.active_count}},
        )

    async def disconnect(self, websocket: WebSocket) -> None:
        """Unregister a client from the connection pool."""
        async with self._lock:
            self._connections.discard(websocket)
        self._logger.info(
            "websocket_disconnected",
            extra={"extra_fields": {"active": self.active_count}},
        )

    async def send(self, websocket: WebSocket, data: dict[str, Any]) -> None:
        """Send a JSON envelope to one client, dropping it on failure."""
        try:
            await websocket.send_json(data)
        except Exception:  # noqa: BLE001
            await self.disconnect(websocket)

    async def broadcast(self, data: dict[str, Any]) -> None:
        """Send a JSON envelope to every connected client."""
        for client in list(self._connections):
            await self.send(client, data)

    async def handle(self, websocket: WebSocket) -> None:
        """Run the receive loop: respond to pings, ignore the rest."""
        await self.connect(websocket)
        try:
            while True:
                raw = await websocket.receive_json()
                if raw.get("type") == MSG_PING:
                    await self.send(
                        websocket, envelope(MSG_PONG, {"ts": raw.get("ts")})
                    )
        except Exception:  # noqa: BLE001
            pass
        finally:
            await self.disconnect(websocket)
