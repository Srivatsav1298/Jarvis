"""Date & Time tool — current date/time, timezone-aware."""
from datetime import UTC, datetime
from typing import Any

from app.ai.tools.registry import Tool


async def datetime_tool(**kwargs: Any) -> dict:
    """Return the current UTC/local date and time."""
    utc = datetime.now(UTC)
    return {
        "ok": True,
        "utc": utc.isoformat(),
        "iso": utc.isoformat(),
        "weekday": utc.strftime("%A"),
        "date": utc.strftime("%Y-%m-%d"),
        "time": utc.strftime("%H:%M:%S"),
    }


datetime_t = Tool(
    name="datetime",
    description="Get the current date and time. Use for any question about "
    "what day/time it is, dates, or scheduling context.",
    input_schema={"type": "object", "properties": {}},
    output_schema={
        "type": "object",
        "properties": {
            "ok": {"type": "boolean"},
            "utc": {"type": "string"},
            "weekday": {"type": "string"},
            "date": {"type": "string"},
            "time": {"type": "string"},
        },
    },
    handler=datetime_tool,
)