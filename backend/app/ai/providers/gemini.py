"""Google Gemini adapter (REST `streamGenerateContent` SSE via rest endpoint)."""
import json
import time
from typing import Any

import httpx

from app.ai.providers._http import parse_sse
from app.ai.providers.base import (
    AIProvider,
    Capabilities,
    ChatChunk,
    ChatMessage,
    ProviderHealth,
)


class GeminiProvider(AIProvider):
    """Streaming adapter for Google's Gemini generative models."""

    name = "gemini"

    def __init__(
        self,
        *,
        model: str,
        api_key: str,
        base_url: str = "https://generativelanguage.googleapis.com",
        timeout: float = 60.0,
    ) -> None:
        self.model = model
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client = httpx.AsyncClient(timeout=timeout)

    def capabilities(self) -> Capabilities:
        return Capabilities(tools=True, json_mode=True, context_window=8192)

    def _body(self, messages: list[ChatMessage], temperature: float) -> dict[str, Any]:
        contents: list[dict[str, Any]] = []
        system_instruction = None
        for m in messages:
            if m.role == "system":
                system_instruction = m.content
                continue
            role = "model" if m.role == "assistant" else ("user" if m.role == "user" else "user")
            contents.append({"role": role, "parts": [{"text": m.content}]})
        body: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {"temperature": temperature},
        }
        if system_instruction:
            body["systemInstruction"] = {"parts": [{"text": system_instruction}]}
        return body

    async def stream(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
    ):
        url = (
            f"{self.base_url}/v1beta/models/{self.model}:streamGenerateContent"
            f"?alt=sse&key={self.api_key}"
        )
        body = self._body(messages, temperature)
        if max_tokens:
            body["generationConfig"]["maxOutputTokens"] = max_tokens
        if tools:
            body["tools"] = [{"functionDeclarations": tools}]

        async with self._client.stream("POST", url, json=body) as resp:
            resp.raise_for_status()
            async for event in parse_sse(resp):
                try:
                    payload = json.loads(event.data)
                except json.JSONDecodeError:
                    continue
                parts = (
                    (payload.get("candidates") or [{}])[0].get("content", {}).get("parts") or []
                )
                for part in parts:
                    if "text" in part and part["text"]:
                        yield ChatChunk(text=part["text"])
                    fc = part.get("functionCall")
                    if fc:
                        yield ChatChunk(tool_call=fc.get("name"))
                        yield ChatChunk(tool_args=json.dumps(fc.get("args") or {}))
            yield ChatChunk(finish_reason="stop")

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
            resp = await self._client.get(
                f"{self.base_url}/v1beta/models/{self.model}?key={self.api_key}"
            )
            latency_ms = int((time.perf_counter() - started) * 1000)
            if resp.status_code != 200:
                return ProviderHealth(False, latency_ms, detail=f"HTTP {resp.status_code}")
            return ProviderHealth(True, latency_ms, model=self.model)
        except Exception as exc:  # noqa: BLE001
            latency_ms = int((time.perf_counter() - started) * 1000)
            return ProviderHealth(False, latency_ms, detail=f"{type(exc).__name__}: {exc}")


def gemini_adapter(settings) -> GeminiProvider:
    """Adapter factory from settings."""
    return GeminiProvider(
        model=settings.ai_model,
        api_key=settings.ai_api_key,
        base_url=settings.ai_gemini_base_url,
        timeout=settings.ai_timeout_seconds,
    )