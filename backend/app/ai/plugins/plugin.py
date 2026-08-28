"""Plugin model — a versioned, lifecycle-managed extension unit.

A plugin is a Python module exposing a `PLUGIN` attribute (a Plugin instance)
or a `setup()` callable. It declares its name, version, and optional async
`start` / `stop` lifecycle hooks plus a `setup(app)` entrypoint that can
register tools, skills, or subscribe to the event bus.
"""
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Plugin:
    """A loadable extension with lifecycle hooks."""

    name: str
    version: str = "0.0.0"
    description: str = ""
    path: str = ""
    enabled: bool = True
    setup: Callable[[Any], None] | None = None
    start: Callable[[], Any] | None = None  # may be async
    stop: Callable[[], Any] | None = None  # may be async
    metadata: dict[str, Any] = field(default_factory=dict)
    _loaded_module: Any = field(default=None, repr=False)

    def describe(self) -> dict[str, Any]:
        """Transport-friendly plugin summary."""
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "path": self.path,
            "enabled": self.enabled,
        }
