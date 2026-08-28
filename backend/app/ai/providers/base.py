"""AI provider abstractions: stream contract, capability metadata, health."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Capabilities:
    """What a provider can do. Feature-detectable, not hardcoded."""

    streaming: bool = True
    tools: bool = False
    vision: bool = False
    json_mode: bool = True
    context_window: int = 8192
    max_output_tokens: int = 2048
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderHealth:
    """Liveness + reachability result for a provider."""

    ok: bool
    latency_ms: int
    detail: str = ""
    model: str = ""
    version: str = ""


@dataclass
class ChatMessage:
    """One message in the model conversation."""

    role: str  # 'system' | 'user' | 'assistant' | 'tool'
    content: str
    name: str | None = None
    tool_calls: list[dict[str, Any]] | None = None
    tool_call_id: str | None = None


@dataclass
class ChatChunk:
    """A streaming token delta from the provider."""

    text: str = ""
    tool_call: str | None = None
    tool_args: str | None = None
    finish_reason: str | None = None


@dataclass
class ChatCompletion:
    """Fully assembled streamed completion."""

    text: str = ""
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    finish_reason: str | None = None
    usage: dict[str, int] = field(default_factory=dict)


class AIProvider(ABC):
    """Provider-agnostic contract every adapter must implement.

    Adapters are selected by configuration only (`app.ai.provider`). No business
    logic ever references a concrete provider.
    """

    name: str = ""
    supports_streaming: bool = True

    @abstractmethod
    def stream(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> Any:
        """Return an async generator of ChatChunk deltas. The last chunk carries a
        ChatChunk.finish_reason when the stream ends normally. Adjacent tool-call
        fragments (name then args) must be emitted as separate chunks."""

    @abstractmethod
    async def complete(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> ChatCompletion:
        """Non-streaming convenience — assemble stream() into a completion."""

    @abstractmethod
    async def health(self) -> ProviderHealth:
        """Feature/liveness probe used by the health endpoint and auto-router."""

    async def assemble(self, stream) -> "ChatCompletion":
        """Assemble an async chunk generator into a ChatCompletion."""
        text_parts: list[str] = []
        tool_calls: list[dict[str, Any]] = []
        finish: str | None = None
        current: dict[str, Any] | None = None
        async for chunk in stream:
            if chunk.text:
                text_parts.append(chunk.text)
            if chunk.tool_call is not None:
                current = {"id": None, "name": chunk.tool_call, "arguments": ""}
                tool_calls.append(current)
            if current is not None and chunk.tool_args is not None:
                current["arguments"] += chunk.tool_args
            if chunk.finish_reason:
                finish = chunk.finish_reason
        return ChatCompletion(
            text="".join(text_parts),
            tool_calls=tool_calls,
            finish_reason=finish,
        )
