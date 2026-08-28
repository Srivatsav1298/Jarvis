"""Tests for the events layer (Task 9) — registry + async event bus."""
import pytest

from app.ai.events import (
    BaseEvent,
    ChatEnd,
    ChatStarted,
    EventBus,
    EventRegistry,
    PlannerStep,
    build_default_registry,
)


class TestEventRegistry:
    def test_default_registry_has_known_types(self):
        registry = build_default_registry()
        for type_ in ("chat.started", "chat.chunk", "chat.end", "ai.thinking",
                      "planner.step", "voice.started", "memory.consolidated"):
            assert type_ in registry.types

    def test_register_and_get(self):
        registry = EventRegistry()
        registry.register(ChatStarted)
        assert registry.get("chat.started") is ChatStarted
        assert registry.get("unregistered") is BaseEvent

    def test_create_returns_typed_event(self):
        registry = build_default_registry()
        event = registry.create("chat.started", payload={"conversation_id": "abc"})
        assert isinstance(event, ChatStarted)
        assert event.payload["conversation_id"] == "abc"

    def test_unknown_type_falls_back_to_generic(self):
        registry = EventRegistry()
        event = registry.create("totally.unknown", payload={"x": 1})
        assert isinstance(event, BaseEvent)

    def test_serialization_shape(self):
        registry = build_default_registry()
        event = registry.create("planner.step", payload={"step": 1}, source="planner")
        data = event.as_dict()
        assert data["type"] == "planner.step"
        assert data["source"] == "planner"
        assert data["payload"] == {"step": 1}
        assert data["at"]


class TestEventBus:
    @pytest.mark.asyncio
    async def test_delivers_to_subscriber(self):
        bus = EventBus(build_default_registry())
        received = []
        bus.subscribe("chat.started", lambda e: _capture(received, e))
        await bus.publish(ChatStarted(payload={"conversation_id": "c1"}))
        assert len(received) == 1
        assert received[0].payload["conversation_id"] == "c1"

    @pytest.mark.asyncio
    async def test_wildcard_subscriber_gets_everything(self):
        bus = EventBus(build_default_registry())
        received = []
        bus.subscribe("*", lambda e: _capture(received, e))
        await bus.publish(ChatStarted())
        await bus.publish(PlannerStep(payload={"step": 1}))
        assert len(received) == 2

    @pytest.mark.asyncio
    async def test_unsubscribe_stops_delivery(self):
        bus = EventBus(build_default_registry())
        received = []
        unsub = bus.subscribe("chat.end", lambda e: _capture(received, e))
        await bus.publish(ChatEnd())
        unsub()
        await bus.publish(ChatEnd())
        assert len(received) == 1

    @pytest.mark.asyncio
    async def test_failing_handler_does_not_block_others(self):
        bus = EventBus(build_default_registry())

        async def boom(_event):
            raise RuntimeError("handler exploded")

        received = []
        bus.subscribe("chat.started", boom)
        bus.subscribe("chat.started", lambda e: _capture(received, e))
        await bus.publish(ChatStarted())
        assert len(received) == 1

    @pytest.mark.asyncio
    async def test_broadcaster_fan_out(self):
        bus = EventBus(build_default_registry())
        broadcast = []

        async def broadcaster(envelope):
            broadcast.append(envelope)

        bus.attach_broadcaster(broadcaster)
        await bus.publish(ChatStarted(payload={"conversation_id": "c1"}))
        assert len(broadcast) == 1
        assert broadcast[0]["type"] == "chat.started"


async def _capture(received, event):
    received.append(event)
