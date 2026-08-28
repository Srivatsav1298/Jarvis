"""Plugin loader — discovers and imports plugins from a directory.

A plugin is a `*.py` file exposing either:
  * a module-level `PLUGIN` object (a Plugin instance), or
  * a `setup(app)` callable (auto-wrapped into a Plugin named after the file).

Loading is isolated and fail-safe: an import error in one plugin is logged and
skipped so a broken plugin cannot prevent the app from starting.
"""
import importlib.util
import logging
from pathlib import Path
from typing import Any

from app.ai.plugins.plugin import Plugin

logger = logging.getLogger(__name__)


class PluginLoadError(Exception):
    """Raised when a plugin file cannot be imported."""


def discover_plugin_files(directory: str | Path) -> list[Path]:
    """Return the sorted list of `*.py` plugin files in `directory`."""
    root = Path(directory)
    if not root.exists():
        return []
    return sorted(p for p in root.iterdir() if p.suffix == ".py" and not p.name.startswith("_"))


def load_plugin(path: str | Path, *, app: Any = None) -> Plugin | None:
    """Import one plugin file and return its Plugin, or None on failure."""
    plugin_path = Path(path)
    module_name = f"jarvis_plugin_{plugin_path.stem}"

    spec = importlib.util.spec_from_file_location(module_name, plugin_path)
    if spec is None or spec.loader is None:
        raise PluginLoadError(f"cannot build import spec for {plugin_path}")
    module = importlib.util.module_from_spec(spec)

    try:
        spec.loader.exec_module(module)
    except Exception as exc:  # noqa: BLE001 — isolate plugin failures
        raise PluginLoadError(str(exc)) from exc

    if hasattr(module, "PLUGIN"):
        plugin = module.PLUGIN
        if not isinstance(plugin, Plugin):
            raise PluginLoadError("PLUGIN attribute must be a Plugin instance")
        plugin._loaded_module = module
        if app is not None and plugin.setup is not None:
            plugin.setup(app)
        return plugin

    if callable(getattr(module, "setup", None)):
        plugin = Plugin(
            name=plugin_path.stem,
            version=getattr(module, "__version__", "0.0.0"),
            description=getattr(module, "__doc__", "") or "",
            path=str(plugin_path),
            setup=module.setup,
            _loaded_module=module,
        )
        if app is not None:
            plugin.setup(app)
        return plugin

    raise PluginLoadError("plugin exposes neither PLUGIN nor setup(app)")


def load_plugins(directory: str | Path, *, app: Any = None) -> list[Plugin]:
    """Load every plugin in `directory`; malformed ones are skipped."""
    plugins: list[Plugin] = []
    for path in discover_plugin_files(directory):
        try:
            plugin = load_plugin(path, app=app)
        except PluginLoadError as exc:
            logger.warning(
                "plugin_skipped",
                extra={"extra_fields": {"path": str(path), "reason": str(exc)}},
            )
            continue
        if plugin is None:
            continue
        if not plugin.path:
            plugin.path = str(path)
        plugins.append(plugin)
    return plugins
