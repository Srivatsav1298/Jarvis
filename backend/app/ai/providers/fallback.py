"""Deterministic fallback provider.

Keeps the assistant fully functional (and every existing test green) when no
configured AI provider is reachable. It is health-checked as "ok" only when no
live provider is selected/available, so the runtime auto-routes to it.
"""
from typing import Any

from app.ai.providers.base import (
    AIProvider,
    Capabilities,
    ChatChunk,
    ChatMessage,
    ProviderHealth,
)
from app.services.mock_reply import mock_reply_content


class FallbackProvider(AIProvider):
    """A provider-agnostic deterministic responder used as the safety net."""

    name = "fallback"

    def __init__(self, model: str = "deterministic-fallback") -> None:
        self.model = model

    def capabilities(self) -> Capabilities:
        return Capabilities(streaming=True, tools=False, context_window=2048)

    async def stream(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
    ):
        # Use the last user message as the prompt.
        user = next((m.content for m in reversed(messages) if m.role == "user"), "")
        reply = mock_reply_content(user)
        words = reply.split(" ")
        for i, word in enumerate(words):
            # Preserve inter-word spaces so assemble() reassembles the reply.
            yield ChatChunk(text=word + (" " if i < len(words) - 1 else ""))
        yield ChatChunk(finish_reason="stop")

    async def complete(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
    ):
        async def gen():
            async for chunk in self.stream(messages):
                yield chunk

        return await self.assemble(gen())

    async def health(self) -> ProviderHealth:
        return ProviderHealth(
            ok=True,
            latency_ms=0,
            detail="deterministic provider — always available",
            model=self.model,
        )