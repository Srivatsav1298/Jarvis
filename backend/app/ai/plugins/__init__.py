"""Plugins package — loader + lifecycle manager."""
from app.ai.plugins.lifecycle import PluginManager
from app.ai.plugins.loader import PluginLoadError, load_plugin, load_plugins
from app.ai.plugins.plugin import Plugin

__all__ = [
    "Plugin",
    "PluginLoadError",
    "PluginManager",
    "load_plugin",
    "load_plugins",
]
