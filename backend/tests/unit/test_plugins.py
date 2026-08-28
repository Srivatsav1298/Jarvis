"""Tests for the plugins layer (Task 11) — loader + lifecycle."""
from pathlib import Path

import pytest

from app.ai.plugins import Plugin, PluginLoadError, PluginManager, load_plugin, load_plugins


class TestLoader:
    def test_loads_plugin_with_plugn_attribute(self, tmp_path: Path):
        plugin_file = tmp_path / "hello.py"
        plugin_file.write_text(
            "from app.ai.plugins.plugin import Plugin\n"
            "def start(): return 'started'\n"
            "PLUGIN = Plugin(name='hello', version='1.0.0', start=start)\n",
            encoding="utf-8",
        )
        plugin = load_plugin(plugin_file)
        assert plugin.name == "hello"
        assert plugin.version == "1.0.0"

    def test_loads_plugin_with_setup_function(self, tmp_path: Path):
        plugin_file = tmp_path / "shim.py"
        plugin_file.write_text(
            "hooks = []\n"
            "def setup(app):\n"
            "    hooks.append('called')\n",
            encoding="utf-8",
        )
        plugin = load_plugin(plugin_file, app=object())
        assert plugin.name == "shim"
        assert plugin.setup is not None

    def test_invalid_plugin_raises(self, tmp_path: Path):
        plugin_file = tmp_path / "broken.py"
        plugin_file.write_text("raise RuntimeError('boom')\n", encoding="utf-8")
        with pytest.raises(PluginLoadError):
            load_plugin(plugin_file)

    def test_neither_api_raises(self, tmp_path: Path):
        plugin_file = tmp_path / "empty.py"
        plugin_file.write_text("x = 1\n", encoding="utf-8")
        with pytest.raises(PluginLoadError):
            load_plugin(plugin_file)

    def test_load_plugins_skips_broken(self, tmp_path: Path):
        (tmp_path / "good.py").write_text(
            "from app.ai.plugins.plugin import Plugin\n"
            "PLUGIN = Plugin(name='good')\n",
            encoding="utf-8",
        )
        (tmp_path / "bad.py").write_text("raise RuntimeError('nope')\n", encoding="utf-8")
        plugins = load_plugins(tmp_path)
        assert [p.name for p in plugins] == ["good"]

    def test_underscore_files_ignored(self, tmp_path: Path):
        (tmp_path / "_private.py").write_text(
            "from app.ai.plugins.plugin import Plugin\n"
            "PLUGIN = Plugin(name='priv')\n",
            encoding="utf-8",
        )
        assert load_plugins(tmp_path) == []


class TestPluginManager:
    @pytest.mark.asyncio
    async def test_start_and_stop_lifecycle(self):
        events = []

        async def on_start():
            events.append("started")

        async def on_stop():
            events.append("stopped")

        manager = PluginManager()
        manager.register(
            Plugin(name="timer", version="1.0.0", start=on_start, stop=on_stop)
        )
        await manager.start()
        assert events == ["started"]
        assert manager.started_count == 1
        await manager.stop()
        assert events == ["started", "stopped"]
        assert manager.started_count == 0

    @pytest.mark.asyncio
    async def test_start_skips_disabled(self):
        manager = PluginManager()
        manager.register(
            Plugin(name="off", start=lambda: None, enabled=False)
        )
        await manager.start()
        assert manager.started_count == 0

    def test_load_from_directory(self, tmp_path: Path):
        (tmp_path / "one.py").write_text(
            "from app.ai.plugins.plugin import Plugin\n"
            "PLUGIN = Plugin(name='one')\n",
            encoding="utf-8",
        )
        (tmp_path / "two.py").write_text(
            "from app.ai.plugins.plugin import Plugin\n"
            "PLUGIN = Plugin(name='two')\n",
            encoding="utf-8",
        )
        manager = PluginManager()
        count = manager.load_from_directory(str(tmp_path))
        assert count == 2
        assert {p.name for p in manager.list()} == {"one", "two"}

    def test_enable_disable(self):
        manager = PluginManager()
        manager.register(Plugin(name="p"))
        assert manager.set_enabled("p", False) is True
        assert manager.list(enabled_only=True) == []
        assert manager.set_enabled("missing", True) is False
