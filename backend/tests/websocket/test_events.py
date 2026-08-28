"""WebSocket protocol: version, envelope shape, and event-name constants."""
from app.websocket import events as events
from app.websocket.protocol import VERSION, envelope

EVENT_CONSTS = [
    "CHAT_START", "CHAT_CHUNK", "CHAT_END", "CHAT_CANCELLED", "CHAT_ERROR",
    "CHAT_CANCEL", "AI_THINKING", "AI_STREAMING", "AI_CONTEXT_LOADED",
    "AI_TOOL_CALL", "SYSTEM_METRICS", "NOTIFICATION_CREATED", "MEMORY_UPDATED",
    "VOICE_START", "VOICE_END",
]


def test_envelope_versioned():
    msg = envelope("system.metrics", {"cpu": 1})
    assert VERSION == 1
    assert msg["version"] == VERSION
    assert msg["type"] == "system.metrics"
    assert msg["payload"] == {"cpu": 1}
    assert envelope("pong")["payload"] == {}


def test_event_constants_defined_and_namespaced():
    for name in EVENT_CONSTS:
        assert hasattr(events, name), f"{name} missing"
        value = getattr(events, name)
        assert isinstance(value, str)
        assert ":" not in value


def test_chat_event_family():
    assert events.CHAT_START == "chat.started"
    assert events.CHAT_CHUNK == "chat.chunk"
    assert events.CHAT_END == "chat.end"
    assert events.SYSTEM_METRICS == "system.metrics"
    assert events.NOTIFICATION_CREATED == "notification.created"
