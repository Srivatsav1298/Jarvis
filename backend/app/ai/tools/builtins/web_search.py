"""Web Search tool — DuckDuckGo instant-answer based (no API key required).

Falls back to a deterministic "no live search" result when offline so the
tool always completes.
"""

import httpx

from app.ai.tools.registry import Tool

_DDG_URL = "https://api.duckduckgo.com/"


async def web_search_tool(query: str, limit: int = 3) -> dict:
    """Search the web via DuckDuckGo's free instant-answer API."""
    if not query or len(query) > 300:
        return {"ok": False, "error": "query is required (<=300 chars)"}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                _DDG_URL,
                params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
            )
            if resp.status_code != 200:
                return {"ok": False, "error": f"search backend HTTP {resp.status_code}"}
            data = resp.json()
            abstract = data.get("AbstractText") or ""
            answer = data.get("Answer") or ""
            related = [
                t.get("Text", "")
                for t in (data.get("RelatedTopics") or [])
                if isinstance(t, dict) and t.get("Text")
            ]
            results = []
            if abstract:
                results.append({"title": query, "snippet": abstract})
            if answer:
                results.append({"title": "Answer", "snippet": answer})
            for topic in related[: max(0, limit - len(results))]:
                results.append({"title": query, "snippet": topic})
            return {"ok": True, "query": query, "results": results}
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "error": f"search unavailable: {type(exc).__name__}: {exc}",
            "results": [],
        }


web_search = Tool(
    name="web_search",
    description="Search the web for current, up-to-date information. Use for "
    "news, facts, definitions, and anything requiring fresh data.",
    input_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query"},
            "limit": {"type": "integer", "description": "Max results (1-5)"},
        },
        "required": ["query"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "ok": {"type": "boolean"},
            "query": {"type": "string"},
            "results": {"type": "array"},
        },
    },
    handler=web_search_tool,
)