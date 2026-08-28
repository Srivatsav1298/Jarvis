"""Projects tool — list/lookup tracked projects."""
from typing import Any

from app.ai.tools.registry import Tool
from app.repositories.implementations import ProjectRepository


def build_projects_tool(repo: ProjectRepository) -> Tool:
    """Return a projects Tool bound to the given repository."""

    async def execute(**kwargs: Any) -> dict:
        limit = max(1, min(kwargs.get("limit", 10), 50))
        rows = await repo.list(limit=limit, offset=0)
        return {
            "ok": True,
            "results": [
                {
                    "id": r.id,
                    "name": r.name,
                    "description": r.description,
                    "status": r.status,
                }
                for r in rows
            ],
        }

    return Tool(
        name="projects",
        description="List the user's tracked projects and their statuses.",
        input_schema={
            "type": "object",
            "properties": {"limit": {"type": "integer", "description": "Max results"}},
        },
        output_schema={
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "results": {"type": "array"}},
        },
        handler=execute,
    )