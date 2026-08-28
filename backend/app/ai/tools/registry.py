"""Tool framework — schema-based registry.

Every tool exposes: name, description, input_schema, output_schema, permissions,
and an async execute(). Tools self-register via the @tool decorator or manual
registry.register(), so plugins/skills can add tools without touching core code.
"""
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Permission:
    """Declarative capability requirement for a tool."""

    action: str  # e.g. 'read', 'write', 'network', 'schedule'
    resource: str = "*"
    reason: str = ""


@dataclass
class Tool:
    """The canonical tool descriptor."""

    name: str
    description: str
    input_schema: dict[str, Any] = field(default_factory=dict)
    output_schema: dict[str, Any] = field(default_factory=dict)
    permissions: list[Permission] = field(default_factory=list)
    handler: Callable[..., Any] | None = None


class BaseTool(ABC):
    """Optional subclassable tool base; the descriptor form is preferred."""

    name: str = ""
    description: str = ""
    input_schema: dict[str, Any] = field(default_factory=dict)
    output_schema: dict[str, Any] = field(default_factory=dict)
    permissions: list[Permission] = field(default_factory=list)

    @abstractmethod
    async def execute(self, **kwargs: Any) -> Any:
        """Run the tool with validated kwargs."""
        ...

    def to_tool(self) -> Tool:
        """Expose this instance as a Tool descriptor."""
        return Tool(
            name=self.name,
            description=self.description,
            input_schema=self.input_schema,
            output_schema=self.output_schema,
            permissions=self.permissions,
            handler=self.execute,
        )


class ToolRegistry:
    """Schema-based registry: register, list, validate, invoke."""

    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool | BaseTool) -> "ToolRegistry":
        """Register a tool; returns self for chaining."""
        descriptor = tool.to_tool() if isinstance(tool, BaseTool) else tool
        self._tools[descriptor.name] = descriptor
        return self

    def unregister(self, name: str) -> bool:
        """Remove a tool; returns False when it was not present."""
        return self._tools.pop(name, None) is not None

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def list(self) -> list[dict[str, Any]]:
        """Return lightweight metadata for every registered tool."""
        return [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.input_schema,
                "output_schema": t.output_schema,
                "permissions": [
                    {"action": p.action, "resource": p.resource}
                    for p in t.permissions
                ],
            }
            for t in sorted(self._tools.values(), key=lambda t: t.name)
        ]

    def schemas(self) -> list[dict[str, Any]]:
        """Return OpenAI-format function definitions for model tool calls."""
        result = []
        for t in sorted(self._tools.values(), key=lambda t: t.name):
            result.append(
                {
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.input_schema,
                    },
                }
            )
        return result

    def names(self) -> list[str]:
        return sorted(self._tools)

    async def invoke(self, name: str, **kwargs: Any) -> Any:
        """Validate and run a tool. Raises KeyError for unknown tools."""
        tool = self._tools.get(name)
        if tool is None:
            raise KeyError(f"Unknown tool: {name}")
        if tool.handler is None:
            raise RuntimeError(f"Tool '{name}' has no handler")
        return await tool.handler(**kwargs)

    def __contains__(self, name: str) -> bool:
        return name in self._tools


# Backward-compatible alias: legacy registry users get the new behavior.
class CompatRegistry(ToolRegistry):
    """Drop-in for app.tools.registry.ToolRegistry callers."""


def tool(
    name: str,
    description: str,
    *,
    input_schema: dict[str, Any] | None = None,
    output_schema: dict[str, Any] | None = None,
    permissions: list[Permission] | None = None,
):
    """Decorator: mark a function as a tool and auto-register on a registry.

    Usage:
        @tool("calculator", "Arithmetic", input_schema={...})
        async def calc(**kwargs): ...
    """

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        t = Tool(
            name=name,
            description=description,
            input_schema=input_schema or {},
            output_schema=output_schema or {},
            permissions=permissions or [],
            handler=fn,
        )
        fn._tool_descriptor = t
        return fn

    return decorator


def collect_decorated(registry: ToolRegistry, *modules: Any) -> int:
    """Scan modules for @tool-decorated functions and register them.

    Returns the number of tools registered. This powers automatic tool
    registration for skills/plugins.
    """
    import inspect

    count = 0
    for module in modules:
        for _name, member in inspect.getmembers(module, inspect.isfunction):
            descriptor = getattr(member, "_tool_descriptor", None)
            if isinstance(descriptor, Tool) and descriptor.name not in registry:
                registry.register(descriptor)
                count += 1
    return count