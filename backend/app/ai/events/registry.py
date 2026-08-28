"""Typed event registry — maps event type strings to their payload schemas.

Central source of truth for every event the assistant can emit (chat, voice,
planner, memory, system). A payload class is the schema for that type; the
registry validates/coerces payloads on publish and documents the contract.
"""
from dataclasses import dataclass, field
from typing import Any

from app.utils.time import utcnow


@dataclass
class BaseEvent:
    """Base class for typed events."""

    type: str = "event"
    payload: dict[str, Any] = field(default_factory=dict)
    source: str = ""
    at: str = field(default_factory=lambda: utcnow().isoformat())

    def as_dict(self) -> dict[str, Any]:
        """Serialize to a transport-safe dict."""
        return {
            "type": self.type,
            "source": self.source,
            "at": self.at,
            "payload": dict(self.payload),
        }


# --- concrete event types -------------------------------------------------

@dataclass
class ChatStarted(BaseEvent):
    type: str = "chat.started"


@dataclass
class ChatChunk(BaseEvent):
    type: str = "chat.chunk"


@dataclass
class ChatEnd(BaseEvent):
    type: str = "chat.end"


@dataclass
class ChatCancelled(BaseEvent):
    type: str = "chat.cancelled"


@dataclass
class ChatError(BaseEvent):
    type: str = "chat.error"


@dataclass
class AiThinking(BaseEvent):
    type: str = "ai.thinking"


@dataclass
class PlannerStep(BaseEvent):
    type: str = "planner.step"


@dataclass
class PlannerToolCall(BaseEvent):
    type: str = "planner.tool_call"


@dataclass
class PlannerEnd(BaseEvent):
    type: str = "planner.end"


@dataclass
class VoiceStarted(BaseEvent):
    type: str = "voice.started"


@dataclass
class VoiceTranscript(BaseEvent):
    type: str = "voice.transcript"


@dataclass
class VoiceEnd(BaseEvent):
    type: str = "voice.finished"


@dataclass
class MemoryUpdated(BaseEvent):
    type: str = "memory.updated"


@dataclass
class MemoryConsolidated(BaseEvent):
    type: str = "memory.consolidated"


@dataclass
class SystemMetrics(BaseEvent):
    type: str = "system.metrics"


@dataclass
class SystemEvent(BaseEvent):
    type: str = "system"


class EventRegistry:
    """Registry of event types → payload classes."""

    def __init__(self) -> None:
        self._events: dict[str, type[BaseEvent]] = {}

    def register(self, event_cls: type[BaseEvent]) -> type[BaseEvent]:
        """Register an event class keyed by its `type` attribute."""
        self._events[event_cls.type] = event_cls
        return event_cls

    def get(self, type_: str) -> type[BaseEvent]:
        """Return the event class for a type, or the generic BaseEvent."""
        return self._events.get(type_, BaseEvent)

    def create(
        self,
        type_: str,
        *,
        payload: dict[str, Any] | None = None,
        source: str = "",
    ) -> BaseEvent:
        """Instantiate a typed event for `type_` with the given payload."""
        cls = self.get(type_)
        return cls(payload=dict(payload or {}), source=source)

    @property
    def types(self) -> list[str]:
        """All registered event type strings."""
        return sorted(self._events.keys())


def build_default_registry() -> EventRegistry:
    """Return a registry pre-loaded with every known event type."""
    registry = EventRegistry()
    for cls in (
        ChatStarted,
        ChatChunk,
        ChatEnd,
        ChatCancelled,
        ChatError,
        AiThinking,
        PlannerStep,
        PlannerToolCall,
        PlannerEnd,
        VoiceStarted,
        VoiceTranscript,
        VoiceEnd,
        MemoryUpdated,
        MemoryConsolidated,
        SystemMetrics,
        SystemEvent,
    ):
        registry.register(cls)
    return registry
