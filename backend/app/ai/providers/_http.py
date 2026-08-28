"""Shared HTTP/SSE plumbing for remote AI providers."""
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.ai.providers.base import ChatChunk


class SSELine:
    """One parsed SSE event from a provider stream."""

    __slots__ = ("data", "event")

    def __init__(self, data: str, event: str = "message") -> None:
        self.data = data
        self.event = event


async def parse_sse(
    response: httpx.Response, on_error: bool = False
) -> AsyncIterator[SSELine]:
    """Yield SSE events from an httpx streaming response, line by line.

    Handles `data:` lines inside `[DONE]`-terminated and chunked streams.
    `on_error` toggles whether a non-subscribed event name should still yield.
    """
    data_buf: list[str] = []
    event_name = "message"
    async for raw in response.aiter_lines():
        line = raw.strip()
        if not line:
            if data_buf:
                yield SSELine("\n".join(data_buf), event_name)
                data_buf = []
                event_name = "message"
            continue
        if line.startswith(":"):
            continue
        if line.startswith("event:"):
            event_name = line[len("event:") :].strip()
            continue
        if line.startswith("data:"):
            data_buf.append(line[len("data:") :].strip())
    if data_buf:
        yield SSELine("\n".join(data_buf), event_name)


def make_openai_messages(
    messages: list, tools: list[dict[str, Any]] | None = None
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Normalize our ChatMessage list + tool defs into an OpenAI wire payload."""
    payload: list[dict[str, Any]] = []
    for m in messages:
        entry: dict[str, Any] = {"role": m.role, "content": m.content}
        if m.name:
            entry["name"] = m.name
        payload.append(entry)
    body: dict[str, Any] = {"messages": payload}
    if tools:
        body["tools"] = tools
    return payload, body


def chunk_from_delta(delta: dict[str, Any] | None) -> ChatChunk:
    """Map an OpenAI-style `delta` object to a ChatChunk."""
    if not delta:
        return ChatChunk()
    text = delta.get("content") or ""
    finish = delta.get("finish_reason")
    ata = delta.get("tool_calls") or []
    tool_call: str | None = None
    tool_args: str | None = None
    for tc in ata:
        fn = (tc.get("function") or {})
        if fn.get("name"):
            tool_call = fn["name"]
        if fn.get("arguments"):
            tool_args = fn["arguments"]
    return ChatChunk(text=text, tool_call=tool_call, tool_args=tool_args, finish_reason=finish)