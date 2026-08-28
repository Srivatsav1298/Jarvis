"""Tests for the 8 built-in tools + tool registry factory (Task 6/15 coverage)."""
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.ai.tools import factory as tools_factory
from app.ai.tools.builtins.datetime_tool import datetime_t, datetime_tool
from app.ai.tools.builtins.memory_tool import build_memory_tool
from app.ai.tools.builtins.notifications_tool import build_notifications_tool
from app.ai.tools.builtins.projects_tool import build_projects_tool
from app.ai.tools.builtins.reminders_tool import build_reminders_tool
from app.ai.tools.builtins.weather import weather, weather_tool
from app.ai.tools.builtins.web_search import web_search, web_search_tool
from app.ai.tools.registry import ToolRegistry


class _FakeRow:
    def __init__(self, **kwargs: Any) -> None:
        for key, value in kwargs.items():
            setattr(self, key, value)


class FakeMemoryRepository:
    def __init__(self, rows: list[_FakeRow] | None = None) -> None:
        self.rows = rows or []
        self._next_id = 1

    async def create(self, data: dict) -> _FakeRow:
        row = _FakeRow(id=str(self._next_id), **data)
        self._next_id += 1
        self.rows.append(row)
        return row

    async def list(self, *, limit: int, offset: int) -> Sequence[_FakeRow]:
        return self.rows[offset : offset + limit]

    async def list_by_kind(self, *, kind: str, limit: int, offset: int) -> Sequence[_FakeRow]:
        return [r for r in self.rows if r.kind == kind][offset : offset + limit]


class FakeProjectRepository:
    def __init__(self) -> None:
        self.rows = [
            _FakeRow(id="1", name="Jarvis", description="Assistant", status="active"),
            _FakeRow(id="2", name="Other", description=None, status="paused"),
        ]

    async def list(self, *, limit: int, offset: int) -> Sequence[_FakeRow]:
        return self.rows[offset : offset + limit]


class FakeReminderRepository:
    def __init__(self) -> None:
        self.rows: list[_FakeRow] = []
        self._next_id = 1

    async def create(self, data: dict) -> _FakeRow:
        row = _FakeRow(id=str(self._next_id), completed=False, **data)
        self._next_id += 1
        self.rows.append(row)
        return row

    async def list(self, *, limit: int, offset: int) -> Sequence[_FakeRow]:
        return self.rows[offset : offset + limit]

    async def update(self, rid: str, data: dict) -> _FakeRow | None:
        for row in self.rows:
            if row.id == rid:
                for key, value in data.items():
                    setattr(row, key, value)
                return row
        return None


class FakeNotificationRepository:
    def __init__(self) -> None:
        self.rows: list[_FakeRow] = []
        self._next_id = 1

    async def create(self, data: dict) -> _FakeRow:
        row = _FakeRow(id=str(self._next_id), read=False, **data)
        self._next_id += 1
        self.rows.append(row)
        return row

    async def list(self, *, limit: int, offset: int) -> Sequence[_FakeRow]:
        return self.rows[offset : offset + limit]


class TestDatetimeTool:
    @pytest.mark.asyncio
    async def test_datetime_tool(self):
        result = await datetime_tool()
        assert result["ok"] is True
        assert result["utc"] == result["iso"]
        assert result["date"]
        assert datetime.fromisoformat(result["utc"]).tzinfo == UTC

    def test_datetime_descriptor(self):
        assert datetime_t.name == "datetime"
        assert callable(datetime_t.handler)


class TestMemoryTool:
    @pytest.mark.asyncio
    async def test_write_search_list(self):
        tool = build_memory_tool(FakeMemoryRepository())
        written = await tool.handler(action="write", content="hello world", kind="note")
        assert written["ok"] is True
        assert written["content"] == "hello world"

        found = await tool.handler(action="search", query="hello")
        assert found["ok"] is True
        assert len(found["results"]) == 1

        listed = await tool.handler(action="list", kind="note")
        assert listed["ok"] is True
        assert len(listed["results"]) == 1

    @pytest.mark.asyncio
    async def test_write_rejects_empty_content(self):
        tool = build_memory_tool(FakeMemoryRepository())
        result = await tool.handler(action="write", content="")
        assert result["ok"] is False

    @pytest.mark.asyncio
    async def test_list_filters_kind(self):
        repo = FakeMemoryRepository()
        tool = build_memory_tool(repo)
        await tool.handler(action="write", content="note thing", kind="note")
        await tool.handler(action="write", content="task thing", kind="task")
        notes = await tool.handler(action="list", kind="note")
        assert all(r["kind"] == "note" for r in notes["results"])
        assert len(notes["results"]) == 1


class TestProjectsTool:
    @pytest.mark.asyncio
    async def test_list_projects(self):
        tool = build_projects_tool(FakeProjectRepository())
        result = await tool.handler()
        assert result["ok"] is True
        assert len(result["results"]) == 2
        assert result["results"][0]["name"] == "Jarvis"


class TestRemindersTool:
    @pytest.mark.asyncio
    async def test_create_list_complete_due(self):
        repo = FakeReminderRepository()
        tool = build_reminders_tool(repo)
        due_at = (datetime.now(UTC) - timedelta(minutes=5)).isoformat()
        created = await tool.handler(
            action="create", title="ship it", due_at=due_at, note="now"
        )
        assert created["ok"] is True

        listed = await tool.handler(action="list")
        assert len(listed["results"]) == 1
        assert listed["results"][0]["completed"] is False

        due = await tool.handler(action="due")
        assert len(due["results"]) == 1

        completed = await tool.handler(action="complete", id=created["id"])
        assert completed["ok"] is True
        assert repo.rows[0].completed is True

        due_after = await tool.handler(action="due")
        assert len(due_after["results"]) == 0

    @pytest.mark.asyncio
    async def test_create_requires_title(self):
        tool = build_reminders_tool(FakeReminderRepository())
        result = await tool.handler(action="create")
        assert result["ok"] is False

    @pytest.mark.asyncio
    async def test_complete_unknown_id(self):
        tool = build_reminders_tool(FakeReminderRepository())
        result = await tool.handler(action="complete", id="nope")
        assert result["ok"] is False


class TestNotificationsTool:
    @pytest.mark.asyncio
    async def test_create_and_list(self):
        repo = FakeNotificationRepository()
        tool = build_notifications_tool(repo)
        created = await tool.handler(
            action="create", title="hello", message="body", severity="warn"
        )
        assert created["ok"] is True
        assert created["title"] == "hello"

        listed = await tool.handler(action="list")
        assert len(listed["results"]) == 1
        assert listed["results"][0]["severity"] == "warn"

    @pytest.mark.asyncio
    async def test_create_publishes_but_persists_on_failure(self):
        repo = FakeNotificationRepository()
        failing = AsyncMock()
        failing.publish.side_effect = RuntimeError("ws down")
        tool = build_notifications_tool(repo, publisher=failing)
        created = await tool.handler(action="create", title="still saved")
        assert created["ok"] is True
        assert len(repo.rows) == 1

    @pytest.mark.asyncio
    async def test_create_requires_title(self):
        tool = build_notifications_tool(FakeNotificationRepository())
        result = await tool.handler(action="create")
        assert result["ok"] is False


class TestWebSearchTool:
    @pytest.mark.asyncio
    async def test_requires_query(self):
        result = await web_search_tool("")
        assert result["ok"] is False

    @pytest.mark.asyncio
    async def test_offline_falls_back_gracefully(self, monkeypatch):
        import httpx

        class BoomTransport(httpx.AsyncBaseTransport):
            async def handle_async_request(self, request):
                raise httpx.ConnectError("no network")

        monkeypatch.setattr(
            httpx,
            "AsyncClient",
            lambda *a, **k: httpx.AsyncClient(*a, transport=BoomTransport(), **k),
        )
        result = await web_search_tool("anything")
        assert result["ok"] is False
        assert "unavailable" in result["error"]

    @pytest.mark.asyncio
    async def test_descriptor(self):
        assert web_search.name == "web_search"
        assert web_search.input_schema.get("required") == ["query"]


class TestWeatherTool:
    @pytest.mark.asyncio
    async def test_requires_location_or_coords(self):
        result = await weather_tool()
        assert result["ok"] is False

    @pytest.mark.asyncio
    async def test_offline_falls_back_gracefully(self, monkeypatch):
        import httpx

        class BoomTransport(httpx.AsyncBaseTransport):
            async def handle_async_request(self, request):
                raise httpx.ConnectError("no network")

        monkeypatch.setattr(
            httpx,
            "AsyncClient",
            lambda *a, **k: httpx.AsyncClient(*a, transport=BoomTransport(), **k),
        )
        result = await weather_tool(lat=37.77, lon=-122.42)
        assert result["ok"] is False
        assert "unavailable" in result["error"]

    def test_descriptor(self):
        assert weather.name == "weather"
        assert callable(weather.handler)


class TestToolRegistryFactory:
    def test_build_full_registry(self):
        registry = tools_factory.build_tool_registry(
            object(), include_network=True
        )
        assert isinstance(registry, ToolRegistry)
        names = {t["name"] for t in registry.list()}
        assert names == {
            "calculator",
            "datetime",
            "memory",
            "projects",
            "reminders",
            "notifications",
            "web_search",
            "weather",
        }

    def test_build_without_network(self):
        registry = tools_factory.build_tool_registry(
            object(), include_network=False
        )
        names = {t["name"] for t in registry.list()}
        assert "weather" not in names
        assert "web_search" not in names
        assert "calculator" in names

    def test_describe_registry(self):
        registry = tools_factory.build_tool_registry(object(), include_network=False)
        view = tools_factory.describe_registry(registry)
        assert view["count"] == 6
        assert len(view["tools"]) == 6
