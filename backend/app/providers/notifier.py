"""NotificationPublisher sink abstraction and a WebSocket implementation."""
from abc import ABC, abstractmethod
from typing import Any

from app.websocket.events import NOTIFICATION_CREATED
from app.websocket.protocol import envelope


class NotificationPublisher(ABC):
    """Delivers a published notification to one or more sinks."""

    @abstractmethod
    async def publish(self, read: Any) -> None: ...


class WebSocketNotifier(NotificationPublisher):
    """Broadcasts a notification envelope to every connected client."""

    def __init__(self, manager) -> None:
        self._manager = manager

    async def publish(self, read: Any) -> None:
        await self._manager.broadcast(
            envelope(NOTIFICATION_CREATED, read.model_dump(mode="json"))
        )