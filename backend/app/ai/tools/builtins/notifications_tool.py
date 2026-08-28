"""Notifications tool — create/read notifications via the service + publisher."""
import contextlib
from typing import Any

from app.ai.tools.registry import Tool
from app.repositories.implementations import NotificationRepository
from app.schemas.notification import NotificationCreate


def build_notifications_tool(
    repo: NotificationRepository, publisher=None
) -> Tool:
    """Return a notifications Tool bound to a repository and optional publisher.

    When `publisher` (a NotificationPublisher) is provided, created
    notifications are broadcast over WebSocket immediately.
    """

    async def _create(**kwargs: Any) -> dict:
        title = kwargs.get("title")
        if not title or len(title) > 200:
            return {"ok": False, "error": "title is required (<=200 chars)"}
        payload = NotificationCreate(
            type=kwargs.get("type", "info"),
            severity=kwargs.get("severity", "info"),
            title=title,
            message=kwargs.get("message"),
        )
        row = await repo.create(payload.model_dump(exclude_none=True))
        if publisher is not None:
            with contextlib.suppress(Exception):
                await publisher.publish(row)  # notification persists regardless
        return {"ok": True, "id": row.id, "title": row.title}

    async def _list(**kwargs: Any) -> dict:
        rows = await repo.list(limit=max(1, min(kwargs.get("limit", 10), 50)), offset=0)
        return {
            "ok": True,
            "results": [
                {
                    "id": r.id,
                    "severity": r.severity,
                    "title": r.title,
                    "message": r.message,
                    "read": r.read,
                }
                for r in rows
            ],
        }

    async def execute(**kwargs: Any) -> dict:
        if kwargs.get("action", "list") == "create":
            return await _create(**kwargs)
        return await _list(**kwargs)

    return Tool(
        name="notifications",
        description="Create and list system notifications for the user.",
        input_schema={
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["list", "create"]},
                "title": {"type": "string", "description": "Notification title (for create)"},
                "message": {"type": "string", "description": "Detail message"},
                "severity": {"type": "string", "enum": ["info", "success", "warn", "danger"]},
                "limit": {"type": "integer"},
            },
            "required": ["action"],
        },
        output_schema={
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "results": {"type": "array"}},
        },
        handler=execute,
    )