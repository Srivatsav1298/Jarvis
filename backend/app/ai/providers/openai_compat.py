"""OpenAI-compatible chat adapter.

Serves every provider exposing the `/v1/chat/completions` SSE contract:
OpenAI, OpenRouter, LM Studio, and any OpenAI-compatible gateway. The only
difference is the base URL + auth header, both configured.
"""
import json
import time
from typing import Any

import httpx

from app.ai.providers._http import chunk_from_delta, parse_sse
from app.ai.providers.base import (
    AIProvider,
    Capabilities,
    ChatChunk,
    ChatMessage,
    ProviderHealth,
)


class OpenAICompatibleProvider(AIProvider):
    """Streaming adapter for the OpenAI Chat Completions wire format."""

    name = "openai"

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str = "",
        model: str,
        timeout: float = 60.0,
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout
        self.extra_headers = extra_headers or {}
        self._client = httpx.AsyncClient(timeout=timeout)

    def capabilities(self) -> Capabilities:
        c = Capabilities()
        c.tools = True
        c.json_mode = True
        return c

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json", **self.extra_headers}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

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
            "temperature": temperature,
        }
        if max_tokens:
            body["max_tokens"] = max_tokens
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"

        async with self._client.stream(
            "POST", f"{self.base_url}/chat/completions", headers=self._headers(), json=body
        ) as resp:
            resp.raise_for_status()
            async for event in parse_sse(resp):
                if event.data == "[DONE]":
                    yield ChatChunk(finish_reason="stop")
                    return
                try:
                    payload = json.loads(event.data)
                except json.JSONDecodeError:
                    continue
                choices = payload.get("choices") or []
                if not choices:
                    continue
                yield chunk_from_delta(choices[0].get("delta"))

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
            resp = await self._client.get(f"{self.base_url}/models", headers=self._headers())
            latency_ms = int((time.perf_counter() - started) * 1000)
            if resp.status_code not in (200, 401):
                return ProviderHealth(False, latency_ms, detail=f"HTTP {resp.status_code}")
            return ProviderHealth(True, latency_ms, model=self.model)
        except Exception as exc:  # noqa: BLE001
            latency_ms = int((time.perf_counter() - started) * 1000)
            return ProviderHealth(False, latency_ms, detail=f"{type(exc).__name__}: {exc}")


def openai_adapter(settings) -> OpenAICompatibleProvider:
    """Adapter factory from settings (handles OpenAI/OpenRouter/LM Studio)."""
    return OpenAICompatibleProvider(
        base_url=settings.ai_base_url,
        api_key=settings.ai_api_key,
        model=settings.ai_model,
        timeout=settings.ai_timeout_seconds,
        extra_headers=settings.ai_extra_headers,
    )
