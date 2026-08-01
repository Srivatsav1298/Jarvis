"""ToolRegistry — register, list and invoke callable tools (no AI yet)."""
from collections.abc import Callable
from typing import Any

Handler = Callable[..., Any]


class ToolRegistry:
    """A small registry of named tools usable by future AI agents."""

    def __init__(self) -> None:
        self._tools: dict[str, tuple[str, Handler]] = {}

    def register(self, name: str, description: str, handler: Handler) -> None:
        """Register a tool by name with a human-readable description."""
        self._tools[name] = (description, handler)

    def list(self) -> list[dict[str, str]]:
        """Return metadata for every registered tool."""
        return [
            {"name": name, "description": description}
            for name, (description, _) in sorted(self._tools.items())
        ]

    def invoke(self, name: str, **kwargs: Any) -> Any:
        """Invoke a registered tool by name; raise KeyError when unknown."""
        if name not in self._tools:
            raise KeyError(f"Unknown tool: {name}")
        return self._tools[name][1](**kwargs)


def build_default_registry() -> ToolRegistry:
    """Return a registry preloaded with the built-in ping tool."""
    registry = ToolRegistry()

    def ping() -> dict[str, bool]:
        """Simple liveness tool used to validate the registry."""
        return {"pong": True}

    registry.register("ping", "Return pong to confirm the tool registry works.", ping)
    return registry
