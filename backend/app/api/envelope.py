"""Uniform REST response envelope helpers."""
from typing import Any


def ok(data: Any) -> dict[str, Any]:
    """Wrap a successful payload in the standard success envelope."""
    return {"success": True, "data": data}