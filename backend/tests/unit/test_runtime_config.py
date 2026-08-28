"""Tests for runtime-configurable settings (Task 12)."""
import pytest

from app.ai.config import (
    InvalidSettingValueError,
    RuntimeConfig,
    UnknownSettingError,
    build_runtime_config,
)
from app.config.settings import Settings


@pytest.fixture
def settings():
    return Settings(
        _env_file=None,
        ai_model="llama3.2",
        conversation_max_messages=40,
        voice_enabled=False,
    )


@pytest.fixture
def config(settings):
    return build_runtime_config(settings)


class TestRuntimeConfig:
    def test_returns_base_value_when_no_override(self, config):
        assert config.get("ai_model") == "llama3.2"
        assert config.get("conversation_max_messages") == 40

    def test_override_wins_over_base(self, config):
        config.set("conversation_max_messages", 60)
        assert config.get("conversation_max_messages") == 60

    def test_unknown_key_raises(self, config):
        with pytest.raises(UnknownSettingError):
            config.get("not_a_setting")

    def test_bad_type_is_rejected(self, config):
        with pytest.raises(InvalidSettingValueError):
            config.set("conversation_max_messages", "not-an-int")

    def test_value_is_coerced(self, config):
        config.set("conversation_max_messages", "50")
        value = config.get("conversation_max_messages")
        assert value == 50 and isinstance(value, int)

    def test_unset_restores_base(self, config):
        config.set("ai_model", "gpt-4o")
        assert config.get("ai_model") == "gpt-4o"
        assert config.unset("ai_model") is True
        assert config.get("ai_model") == "llama3.2"
        assert config.unset("ai_model") is False

    def test_reset_clears_all(self, config):
        config.set("ai_model", "gpt-4o")
        config.set("conversation_max_messages", 100)
        config.reset()
        assert config.overrides() == {}
        assert config.get("ai_model") == "llama3.2"

    def test_all_returns_effective_values(self, config):
        config.set("voice_enabled", True)
        values = config.all()
        assert values["voice_enabled"] is True
        assert values["ai_model"] == "llama3.2"
        assert "ai_provider" in values

    def test_overrides_only_differing_keys(self, config):
        config.set("ai_model", "x")
        assert config.overrides() == {"ai_model": "x"}


class TestRuntimeConfigEvents:
    @pytest.mark.asyncio
    async def test_set_emits_change_event(self, settings):
        from app.ai.events import EventBus, build_default_registry

        bus = EventBus(build_default_registry())
        received = []
        bus.subscribe("system", lambda e: received.append(e))
        config = RuntimeConfig(settings, event_bus=bus)
        config.set("ai_model", "gpt-4o")
        await _drain(received)
        assert received, "expected a system event after set"
        assert received[0].payload["setting"] == "ai_model"
        assert received[0].payload["value"] == "gpt-4o"


async def _drain(received):
    # let the fire-and-forget task deliver
    await asyncio.sleep(0.01)


import asyncio  # noqa: E402
