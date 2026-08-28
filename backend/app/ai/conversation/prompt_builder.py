"""PromptBuilder — assembles the system prompt from config + injected context."""
from __future__ import annotations

from typing import Any

from app.ai.providers.base import ChatMessage


class PromptBuilder:
    """Builds a context-aware system prompt.

    Injected context (memories, projects, preferences, now) is placed in a
    clearly delimited "context block" so the model can use it without it
    polluting the actual instructions.
    """

    def __init__(self, base_prompt: str = "") -> None:
        self.base_prompt = base_prompt

    @staticmethod
    def _block(title: str, items: list[Any]) -> str:
        if not items:
            return ""
        lines = [f"[{title}]"]
        for item in items:
            lines.append(f"- {item}")
        return "\n".join(lines)

    def build_system_message(
        self,
        *,
        memories: list[str] | None = None,
        projects: list[str] | None = None,
        preferences: list[str] | None = None,
        now: str | None = None,
        tools: list[str] | None = None,
    ) -> ChatMessage:
        """Return a system ChatMessage combining instructions + injected context."""
        parts: list[str] = [self.base_prompt or ""]

        ctx: list[str] = []
        if now:
            ctx.append(self._block("CURRENT TIME", [now]))
        if memories:
            ctx.append(self._block("MEMORY (what you know about the user)", memories))
        if projects:
            ctx.append(self._block("ACTIVE PROJECTS", projects))
        if preferences:
            ctx.append(self._block("USER PREFERENCES", preferences))
        if ctx:
            parts.append(
                "--- Context below is provided for grounding. Use it when relevant, "
                "but do not mention the brackets in your reply. ---\n"
                + "\n\n".join(p for p in ctx if p)
            )
        if tools:
            parts.append(
                "You have access to tools: " + ", ".join(tools) + ". "
                "Use them when a task requires up-to-date or computed information."
            )

        return ChatMessage(role="system", content="\n\n".join(p for p in parts if p))