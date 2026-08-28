"""Async event bus — publish/subscribe over typed events with WS fan-out.

Handlers are awaited in registration order for a given type. A broadcaster
callable (typically the WebSocket manager) can be attached so every published
event also fans out to connected clients as a versioned envelope.
"""
import asyncio
import logging
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import Any

from app.ai.events.registry import BaseEvent, EventRegistry

Handler = Callable[[BaseEvent], Awaitable[None]]

logger = logging.getLogger(__name__)


class EventBus:
    """In-process async event bus with optional external broadcast."""

    def __init__(self, registry: EventRegistry | None = None) -> None:
        self.registry = registry or EventRegistry()
        self._subscribers: dict[str, list[Handler]] = defaultdict(list)
        self._broadcasters: list[Callable[[dict[str, Any]], Awaitable[None]]] = []
        self._lock = asyncio.Lock()

    # -- subscriptions ------------------------------------------------------

    def subscribe(self, type_: str, handler: Handler) -> Callable[[], None]:
        """Subscribe to an event type; returns an unsubscribe callable.

        A type of "*" subscribes to every published event.
        """
        self._subscribers[type_].append(handler)

        def unsubscribe() -> None:
            handlers = self._subscribers.get(type_)
            if handlers and handler in handlers:
                handlers.remove(handler)

        return unsubscribe

    def attach_broadcaster(
        self, broadcaster: Callable[[dict[str, Any]], Awaitable[None]]
    ) -> None:
        """Attach an external fan-out sink (e.g. WS manager broadcast)."""
        self._broadcasters.append(broadcaster)

    # -- publishing ---------------------------------------------------------

    async def publish(self, event: BaseEvent) -> None:
        """Deliver an event to subscribers and broadcasters.

        Handler failures are logged, never raised, so one bad listener cannot
        take down the pipeline.
        """
        envelope = event.as_dict()
        type_ = event.type

        handlers = [*self._subscribers.get(type_, []), *self._subscribers.get("*", [])]
        for handler in handlers:
            try:
                await handler(event)
            except Exception:  # noqa: BLE001
                logger.exception("event_handler_failed", extra={"extra_fields": {"type": type_}})

        for broadcaster in self._broadcasters:
            try:
                await broadcaster(envelope)
            except Exception:  # noqa: BLE001
                logger.exception("event_broadcast_failed", extra={"extra_fields": {"type": type_}})

    async def publish_async(self, event: BaseEvent) -> None:
        """Fire-and-forget publish (no awaited delivery of subscribers)."""
        loop = asyncio.get_running_loop()
        loop.create_task(self.publish(event))

    # -- convenience --------------------------------------------------------

    @property
    def subscriber_count(self) -> int:
        """Total registered handlers across all types."""
        return sum(len(h) for h in self._subscribers.values())
