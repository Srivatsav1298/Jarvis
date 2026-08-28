"""Skill model — a reusable, self-describing capability.

A skill is a named capability with a description, optional trigger keywords, a
list of required tools, and (optionally) an implementation callable. Skills can
be discovered from the filesystem (see discovery.py) or registered directly.
"""
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Skill:
    """A reusable capability the assistant can invoke."""

    name: str
    description: str = ""
    keywords: list[str] = field(default_factory=list)
    requires_tools: list[str] = field(default_factory=list)
    source: str = "builtin"
    enabled: bool = True
    impl: Callable[..., Any] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def matches(self, text: str) -> bool:
        """True when any trigger keyword appears in `text`."""
        lowered = (text or "").lower()
        return any(kw in lowered for kw in self.keywords)

    def describe(self) -> dict[str, Any]:
        """Transport-friendly summary used by API responses."""
        return {
            "name": self.name,
            "description": self.description,
            "keywords": list(self.keywords),
            "requires_tools": list(self.requires_tools),
            "source": self.source,
            "enabled": self.enabled,
        }
