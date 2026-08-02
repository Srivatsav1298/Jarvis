"""Tests for ConnectionManager (unit) and the /ws endpoint (integration)."""
import asyncio

from app.websocket.manager import ConnectionManager
from app.websocket.protocol import MSG_BROADCAST, MSG_HELLO, envelope


class FakeWebSocket:
    """Minimal stand-in for starlette.WebSocket."""

    def __init__(self) -> None:
        self.accepted = False
        self.sent: list[dict] = []
        self.connected = True

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, data: dict) -> None:
        self.sent.append(data)

    async def receive_json(self) -> dict:
        await asyncio.sleep(3600)

    async def close(self) -> None:
        self.connected = False


async def test_manager_connect_send_broadcast() -> None:
    manager = ConnectionManager()
    ws1 = FakeWebSocket()
    ws2 = FakeWebSocket()
    await manager.connect(ws1)
    await manager.connect(ws2)
    assert manager.active_count == 2
    assert ws1.sent[0]["type"] == MSG_HELLO

    await manager.broadcast(envelope(MSG_BROADCAST, {"msg": "hi"}))
    assert ws1.sent[-1]["type"] == MSG_BROADCAST
    assert ws2.sent[-1]["type"] == MSG_BROADCAST

    await manager.disconnect(ws1)
    assert manager.active_count == 1
