"""Reminders tool — create/list/complete reminders."""
from datetime import UTC, datetime
from typing import Any

from app.ai.tools.registry import Tool
from app.repositories.implementations import ReminderRepository


def build_reminders_tool(repo: ReminderRepository) -> Tool:
    """Return a reminders Tool bound to the given repository."""

    async def execute(**kwargs: Any) -> dict:
        action = kwargs.get("action", "list")
        if action == "create":
            title = kwargs.get("title")
            if not title or len(title) > 200:
                return {"ok": False, "error": "title is required (<=200 chars)"}
            due_at = kwargs.get("due_at")
            if isinstance(due_at, str):
                due_at = datetime.fromisoformat(due_at.replace("Z", "+00:00"))
            row = await repo.create(
                {
                    "title": title,
                    "note": kwargs.get("note"),
                    "due_at": due_at,
                    "conversation_id": kwargs.get("conversation_id"),
                }
            )
            return {
                "ok": True,
                "id": row.id,
                "title": row.title,
                "due_at": str(row.due_at) if row.due_at else None,
            }
        if action == "complete":
            rid = kwargs.get("id")
            if not rid:
                return {"ok": False, "error": "id is required"}
            row = await repo.update(rid, {"completed": True})
            return {"ok": row is not None, "id": rid}
        if action == "due":
            rows = await repo.list(limit=max(1, min(kwargs.get("limit", 10), 50)), offset=0)
            now = datetime.now(UTC)
            due = [r for r in rows if not r.completed and r.due_at and r.due_at <= now]
            return {
                "ok": True,
                "results": [
                    {"id": r.id, "title": r.title, "due_at": str(r.due_at)}
                    for r in due
                ],
            }
        rows = await repo.list(limit=max(1, min(kwargs.get("limit", 10), 50)), offset=0)
        return {
            "ok": True,
            "results": [
                {
                    "id": r.id,
                    "title": r.title,
                    "completed": r.completed,
                    "due_at": str(r.due_at) if r.due_at else None,
                }
                for r in rows
            ],
        }

    return Tool(
        name="reminders",
        description="Create, list, and complete reminders for the user.",
        input_schema={
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["list", "create", "complete", "due"]},
                "title": {"type": "string", "description": "Reminder title (for create)"},
                "note": {"type": "string", "description": "Optional note"},
                "due_at": {"type": "string", "description": "ISO 8601 due time"},
                "id": {"type": "string", "description": "Reminder id (for complete)"},
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