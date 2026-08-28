"""Ollama adapter — local-first default provider.

Uses Ollama's native `/api/chat` NDJSON streaming endpoint so tool calls and
SSE quirks map cleanly. Falls back gracefully when Ollama is not running.
"""
import json
import time
from typing import Any

import httpx

from app.ai.providers.base import (
    AIProvider,
    Capabilities,
    ChatChunk,
    ChatMessage,
    ProviderHealth,
)


class OllamaProvider(AIProvider):
    """Streaming adapter for a local Ollama server."""

    name = "ollama"

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        timeout: float = 120.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self._client = httpx.AsyncClient(timeout=timeout)

    def capabilities(self) -> Capabilities:
        c = Capabilities()
        c.tools = True
        c.json_mode = True
        c.context_window = 8192
        return c

    async def stream(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
    ):
        body: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {
                    "role": m.role,
                    "content": m.content,
                    **({"name": m.name} if m.name else {}),
                    **({"tool_calls": m.tool_calls} if m.tool_calls else {}),
                    **({"tool_call_id": m.tool_call_id} if m.tool_call_id else {}),
                }
                for m in messages
            ],
            "stream": True,
            "options": {"temperature": temperature},
        }
        if tools:
            body["tools"] = tools
        if max_tokens:
            body["options"]["num_predict"] = max_tokens

        async with self._client.stream(
            "POST", f"{self.base_url}/api/chat", json=body
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    payload = json.loads(line)
                except json.JSONDecodeError:
                    continue
                msg = payload.get("message") or {}
                if msg.get("tool_calls"):
                    for tc in msg["tool_calls"]:
                        fn = tc.get("function") or {}
                        yield ChatChunk(tool_call=fn.get("name"))
                        yield ChatChunk(tool_args=json.dumps(fn.get("arguments") or {}))
                if msg.get("content"):
                    yield ChatChunk(text=msg["content"])
                if payload.get("done"):
                    yield ChatChunk(finish_reason="stop")
                    return

    async def complete(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
    ):
        return await self.assemble(
            self.stream(messages, temperature=temperature, max_tokens=max_tokens, tools=tools)
        )

    async def health(self) -> ProviderHealth:
        started = time.perf_counter()
        try:
            resp = await self._client.get(f"{self.base_url}/api/tags")
            latency_ms = int((time.perf_counter() - started) * 1000)
            if resp.status_code != 200:
                return ProviderHealth(False, latency_ms, detail=f"HTTP {resp.status_code}")
            tags = resp.json().get("models") or []
            models = [t.get("name", "") for t in tags]
            avail = any(
                self.model == m or self.model in m.split(":")[0]
                for m in models
            )
            if not avail:
                return ProviderHealth(
                    False,
                    latency_ms,
                    detail=f"model '{self.model}' not pulled (have: {models[:3] or 'none'})",
                    model=self.model,
                )
            return ProviderHealth(
                True, latency_ms, model=self.model, version=",".join(models[:3])
            )
        except Exception as exc:  # noqa: BLE001
            latency_ms = int((time.perf_counter() - started) * 1000)
            return ProviderHealth(False, latency_ms, detail=f"{type(exc).__name__}: {exc}")


def ollama_adapter(settings) -> OllamaProvider:
    """Adapter factory from settings."""
    return OllamaProvider(
        base_url=settings.ai_ollama_base_url,
        model=settings.ai_model,
        timeout=settings.ai_timeout_seconds,
    )
