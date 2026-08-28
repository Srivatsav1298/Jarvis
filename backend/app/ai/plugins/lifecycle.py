"""Plugin lifecycle — PluginManager tracks load/start/stop/enable/disable."""
import asyncio
import logging
from typing import Any

from app.ai.plugins.loader import load_plugins
from app.ai.plugins.plugin import Plugin

logger = logging.getLogger(__name__)


class PluginManager:
    """Owns the plugin set and drives its lifecycle."""

    def __init__(self) -> None:
        self._plugins: dict[str, Plugin] = {}
        self._started: set[str] = set()

    # -- registration -------------------------------------------------------

    def register(self, plugin: Plugin) -> Plugin:
        """Register a plugin by name (replaces any existing one)."""
        self._plugins[plugin.name] = plugin
        return plugin

    def load_from_directory(self, directory: str, *, app: Any = None) -> int:
        """Discover and register plugins from a directory; returns count."""
        plugins = load_plugins(directory, app=app)
        for plugin in plugins:
            self.register(plugin)
        return len(plugins)

    def get(self, name: str) -> Plugin | None:
        """Fetch a plugin by name."""
        return self._plugins.get(name)

    def list(self, *, enabled_only: bool = False) -> list[Plugin]:
        """List plugins, optionally filtering to enabled ones."""
        plugins = [p for p in self._plugins.values() if p.enabled or not enabled_only]
        return sorted(plugins, key=lambda p: p.name)

    def remove(self, name: str) -> bool:
        """Remove a plugin; returns False if it never existed."""
        return self._plugins.pop(name, None) is not None

    # -- lifecycle ----------------------------------------------------------

    async def start(self, name: str | None = None) -> None:
        """Run start hooks for a plugin (or all enabled plugins)."""
        targets = [self._plugins[name]] if name else self.list(enabled_only=True)
        for plugin in targets:
            if plugin.name in self._started or plugin.start is None:
                continue
            await _maybe_await(plugin.start())
            self._started.add(plugin.name)
            logger.info(
                "plugin_started",
                extra={"extra_fields": {"plugin": plugin.name, "version": plugin.version}},
            )

    async def stop(self, name: str | None = None) -> None:
        """Run stop hooks for a plugin (or all started plugins)."""
        targets = [self._plugins[name]] if name else [
            p for p in self._plugins.values() if p.name in self._started
        ]
        for plugin in reversed(targets):
            if plugin.stop is None:
                continue
            await _maybe_await(plugin.stop())
            self._started.discard(plugin.name)
            logger.info(
                "plugin_stopped",
                extra={"extra_fields": {"plugin": plugin.name}},
            )

    def set_enabled(self, name: str, enabled: bool) -> bool:
        """Enable or disable a plugin; returns False if it does not exist."""
        plugin = self._plugins.get(name)
        if plugin is None:
            return False
        plugin.enabled = enabled
        return True

    @property
    def started_count(self) -> int:
        """Number of plugins currently started."""
        return len(self._started)


async def _maybe_await(result: Any) -> None:
    """Await a lifecycle hook result if it is a coroutine."""
    if asyncio.iscoroutine(result):
        await result
