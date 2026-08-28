"""RuntimeConfig — in-process runtime overrides over Pydantic settings.

The base `Settings` object is loaded once at startup (env/file driven). This
layer lets operators change AI behavior at runtime without a restart:

    config = RuntimeConfig(settings)
    config.set("conversation_max_messages", 60)   # validated against schema
    config.get("ai_model")

Only keys declared on the Settings model are accepted, and values are coerced
to the declared field type, so a typo or bad type is rejected instead of
silently poisoning the pipeline.
"""
from typing import Any

from pydantic import TypeAdapter, ValidationError

from app.ai.events.bus import EventBus
from app.ai.events.registry import SystemEvent
from app.config.settings import Settings


class UnknownSettingError(KeyError):
    """Raised when a runtime key does not exist on the Settings schema."""


class InvalidSettingValueError(ValueError):
    """Raised when a value does not match the declared setting type."""


class RuntimeConfig:
    """Typed runtime overrides layered over an immutable base Settings."""

    def __init__(
        self, settings: Settings, *, event_bus: EventBus | None = None
    ) -> None:
        self.settings = settings
        self.event_bus = event_bus
        self._overrides: dict[str, Any] = {}
        self._adapters = self._build_adapters()

    # -- read ---------------------------------------------------------------

    def get(self, key: str, default: Any = None) -> Any:
        """Return the effective value (override wins over base settings)."""
        self._ensure_known(key)
        if key in self._overrides:
            return self._overrides[key]
        return getattr(self.settings, key, default)

    def all(self) -> dict[str, Any]:
        """Return the effective value for every known setting."""
        result = {}
        for key in self.settings.model_fields:
            result[key] = self.get(key)
        return result

    def overrides(self) -> dict[str, Any]:
        """Return only the keys that differ from the base settings."""
        return dict(self._overrides)

    # -- write --------------------------------------------------------------

    def set(self, key: str, value: Any) -> Any:
        """Set a runtime override; coerces and validates against the schema.

        Raises UnknownSettingError or InvalidSettingValueError on bad input.
        """
        adapter = self._adapter_for(key)
        try:
            coerced = adapter.validate_python(value)
        except ValidationError as exc:
            raise InvalidSettingValueError(
                f"{key}: {value!r} does not match type {adapter} — {exc}"
            ) from exc
        self._overrides[key] = coerced
        self._emit_changed(key, coerced)
        return coerced

    def unset(self, key: str) -> bool:
        """Remove a runtime override, restoring the base value."""
        self._ensure_known(key)
        removed = self._overrides.pop(key, None) is not None
        if removed:
            self._emit_changed(key, getattr(self.settings, key, None))
        return removed

    def reset(self) -> None:
        """Clear every runtime override."""
        self._overrides.clear()

    # -- internals ----------------------------------------------------------

    def _adapter_for(self, key: str) -> TypeAdapter:
        self._ensure_known(key)
        return self._adapters[key]

    def _ensure_known(self, key: str) -> None:
        if key not in self.settings.model_fields:
            raise UnknownSettingError(f"no such setting: {key}")

    def _build_adapters(self) -> dict[str, TypeAdapter]:
        adapters = {}
        for key, field in self.settings.model_fields.items():
            annotation = field.annotation
            if annotation is not None:
                adapters[key] = TypeAdapter(annotation)
        return adapters

    def _emit_changed(self, key: str, value: Any) -> None:
        if self.event_bus is None:
            return
        import asyncio
        from contextlib import suppress

        event = SystemEvent(
            payload={"setting": key, "value": value, "source": "runtime"}
        )
        with suppress(RuntimeError):  # no running loop (e.g. sync test)
            asyncio.get_running_loop().create_task(self.event_bus.publish(event))


def build_runtime_config(
    settings: Settings, *, event_bus: EventBus | None = None
) -> RuntimeConfig:
    """Convenience factory for a RuntimeConfig bound to app settings."""
    return RuntimeConfig(settings, event_bus=event_bus)
