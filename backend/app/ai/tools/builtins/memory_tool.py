"""Memory tool — read/write/search the assistant's long-term memory.

Built per-session via `build_memory_tool(repository)` so the handler closes
over its DB session and receives only model-supplied kwargs.
"""
from typing import Any

from app.ai.tools.registry import Tool
from app.repositories.implementations import MemoryRepository


async def _write(
    repo: MemoryRepository, content: str, kind: str = "note", importance: float = 0.5
) -> dict:
    if not content or len(content) > 4000:
        return {"ok": False, "error": "Content must be 1-4000 chars"}
    row = await repo.create({"kind": kind, "content": content, "importance": importance})
    return {"ok": True, "id": row.id, "kind": row.kind, "content": row.content}


async def _search(repo: MemoryRepository, query: str, limit: int = 5) -> dict:
    rows = await repo.list(limit=max(1, min(limit, 20)), offset=0)
    results = [
        {"id": r.id, "kind": r.kind, "content": r.content, "importance": r.importance}
        for r in rows
        if query.lower() in (r.content or "").lower()
    ]
    return {"ok": True, "results": results}


async def _list(repo: MemoryRepository, kind: str | None = None, limit: int = 10) -> dict:
    if kind:
        rows = await repo.list_by_kind(kind=kind, limit=max(1, min(limit, 50)), offset=0)
    else:
        rows = await repo.list(limit=max(1, min(limit, 50)), offset=0)
    return {
        "ok": True,
        "results": [
            {"id": r.id, "kind": r.kind, "content": r.content, "importance": r.importance}
            for r in rows
        ],
    }


def build_memory_tool(repo: MemoryRepository) -> Tool:
    """Return a memory Tool bound to the given repository."""

    async def execute(**kwargs: Any) -> dict:
        action = kwargs.get("action", "search")
        if action == "write":
            return await _write(
                repo,
                kwargs.get("content", ""),
                kwargs.get("kind", "note"),
                kwargs.get("importance", 0.5),
            )
        if action == "list":
            return await _list(repo, kwargs.get("kind"), kwargs.get("limit", 10))
        return await _search(repo, kwargs.get("query", ""), kwargs.get("limit", 5))

    return Tool(
        name="memory",
        description="Read from and write to the assistant's long-term memory. "
        "Use to store facts about the user or retrieve previously stored facts.",
        input_schema={
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["search", "write", "list"],
                    "description": "What to do with memory",
                },
                "query": {"type": "string", "description": "Search text (for search)"},
                "content": {"type": "string", "description": "Fact to remember (for write)"},
                "kind": {"type": "string", "description": "Memory kind"},
                "importance": {"type": "number", "description": "0..1 (for write)"},
                "limit": {"type": "integer", "description": "Max results"},
            },
            "required": ["action"],
        },
        output_schema={
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "results": {"type": "array"}},
        },
        handler=execute,
    )