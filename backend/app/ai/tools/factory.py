"""ToolRegistry factory — wires the 8 built-in tools, session-bound."""
from typing import Any

from app.ai.tools.builtins.calculator import calculator
from app.ai.tools.builtins.datetime_tool import datetime_t
from app.ai.tools.builtins.memory_tool import build_memory_tool
from app.ai.tools.builtins.notifications_tool import build_notifications_tool
from app.ai.tools.builtins.projects_tool import build_projects_tool
from app.ai.tools.builtins.reminders_tool import build_reminders_tool
from app.ai.tools.builtins.weather import weather
from app.ai.tools.builtins.web_search import web_search
from app.ai.tools.registry import ToolRegistry
from app.repositories.implementations import (
    MemoryRepository,
    NotificationRepository,
    ProjectRepository,
    ReminderRepository,
)


def build_tool_registry(session, publisher=None, *, include_network: bool = True) -> ToolRegistry:
    """Build the default registry for one request/session.

    Pure tools are shared; repository-backed tools are bound to `session`.
    Network tools can be excluded in offline-only deployments.
    """
    registry = ToolRegistry()
    registry.register(calculator)
    registry.register(datetime_t)
    registry.register(build_memory_tool(MemoryRepository(session)))
    registry.register(build_projects_tool(ProjectRepository(session)))
    registry.register(build_reminders_tool(ReminderRepository(session)))
    registry.register(
        build_notifications_tool(NotificationRepository(session), publisher=publisher)
    )
    if include_network:
        registry.register(web_search)
        registry.register(weather)
    return registry


def describe_registry(registry: ToolRegistry) -> dict[str, Any]:
    """Human + machine-readable view of a registry (for the /tools endpoint)."""
    return {
        "count": len(list(registry._tools)),
        "tools": registry.list(),
    }