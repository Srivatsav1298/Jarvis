"""Tests: AI provider layer (Task 1), conversation engine (Task 3), planner
(Task 5), tool framework (Task 6)."""
import asyncio
import json

import pytest

from app.ai.conversation.prompt_builder import PromptBuilder
from app.ai.conversation.token_budget import TokenBudgetManager, estimate_tokens
from app.ai.planner.planner import Planner
from app.ai.providers.base import AIProvider, ChatChunk, ChatCompletion, ChatMessage, ProviderHealth
from app.ai.providers.factory import PROVIDER_NAMES, build_provider, resolve_provider
from app.ai.providers.fallback import FallbackProvider
from app.ai.tools.builtins.calculator import calculator
from app.ai.tools.registry import ToolRegistry, tool
from app.config.settings import Settings


class FakeProvider(AIProvider):
    """In-memory provider for planner tests."""

    name = "fake"
    model = "fake"

    def __init__(self, tool_calls: list[dict] | None = None) -> None:
        self._tool_calls = tool_calls or []
        self._calls = 0

    async def stream(self, messages, **kwargs):
        yield ChatChunk(text="ok", finish_reason="stop")

    async def complete(self, messages, **kwargs):
        self._calls += 1
        if self._calls <= len(self._tool_calls):
            tc = self._tool_calls[self._calls - 1]
            return ChatCompletion(text="", tool_calls=tc)
        return ChatCompletion(text="Done.", finish_reason="stop")

    def capabilities(self):
        from app.ai.providers.base import Capabilities

        return Capabilities(streaming=True, tools=False)

    async def health(self) -> ProviderHealth:
        return ProviderHealth(ok=True, latency_ms=1)


# --- Task 1: providers ---

def _collect(agen):
    return asyncio.run(_drain(agen))


async def _drain(agen):
    out = []
    async for chunk in agen:
        out.append(chunk)
    return out


def test_fallback_stream_emits_tokens_and_finish() -> None:
    provider = FallbackProvider()
    chunks = _collect(provider.stream([ChatMessage(role="user", content="status")]))
    texts = [c.text for c in chunks if c.text]
    assert len(texts) > 0
    assert chunks[-1].finish_reason == "stop"


def test_fallback_complete_assembles() -> None:
    provider = FallbackProvider()
    result = asyncio.run(
        provider.complete([ChatMessage(role="user", content="hi")])
    )
    assert "Good morning" in result.text or "Understood" in result.text


def test_provider_names_are_config_driven() -> None:
    assert "ollama" in PROVIDER_NAMES
    assert "fallback" in PROVIDER_NAMES
    settings = Settings(_env_file=None)
    assert build_provider(settings).name == "ollama"
    fb = build_provider(settings.model_copy(update={"ai_provider": "fallback"}))
    assert fb.name == "fallback"


def test_resolve_auto_routes_to_fallback_when_ollama_down() -> None:
    settings = Settings(
        _env_file=None,
        ai_provider="ollama",
        ai_ollama_base_url="http://127.0.0.1:1",  # unreachable
        ai_auto_fallback=True,
    )
    resolved = asyncio.run(resolve_provider(settings))
    assert resolved.name == "fallback"


def test_invalid_provider_raises() -> None:
    settings = Settings(_env_file=None, ai_provider="nope")
    with pytest.raises(ValueError):
        build_provider(settings)


# --- Task 3: conversation engine ---

def test_token_estimate() -> None:
    assert estimate_tokens("a" * 400) == 100
    assert estimate_tokens("") == 0


def test_token_budget_trims_oldest_first() -> None:
    budget = TokenBudgetManager(budget=200)
    messages = [
        ChatMessage(role="system", content="S" * 400),  # 100 tokens
        ChatMessage(role="user", content="o" * 400),  # 100 tokens
        ChatMessage(role="user", content="n" * 400),  # 100 tokens
    ]
    result = budget.trim(messages, reserve=0)
    # system always kept; oldest non-system dropped first
    assert result.messages[0].role == "system"
    assert result.trimmed == 1
    assert result.messages[-1].content == "n" * 400


def test_prompt_builder_injects_context() -> None:
    builder = PromptBuilder("Be brief.")
    system = builder.build_system_message(
        memories=["user likes python"],
        projects=["Jarvis (active)"],
        preferences=["tone: concise"],
        now="2026-08-05 10:00",
        tools=["calculator"],
    )
    assert system.role == "system"
    assert "Be brief." in system.content
    assert "user likes python" in system.content
    assert "calculator" in system.content


def test_token_budget_cap_output() -> None:
    budget = TokenBudgetManager(budget=6000)
    assert budget.cap_output(None) > 0
    assert budget.cap_output(123) == 123


# --- Task 6: tool framework ---

def test_tool_registry_register_invoke() -> None:
    reg = ToolRegistry()
    reg.register(calculator)
    assert "calculator" in reg
    result = asyncio.run(reg.invoke("calculator", expression="2 + 3"))
    assert result["result"] == 5.0


def test_tool_schemas_openai_format() -> None:
    reg = ToolRegistry()
    reg.register(calculator)
    schemas = reg.schemas()
    assert schemas[0]["type"] == "function"
    assert schemas[0]["function"]["name"] == "calculator"


def test_tool_decorator_auto_registration() -> None:
    @tool("custom_add", "Add two numbers")
    async def _add(a: int, b: int) -> dict:
        return {"sum": a + b}

    reg = ToolRegistry()
    descriptor = _add._tool_descriptor
    reg.register(descriptor)
    result = asyncio.run(reg.invoke("custom_add", a=1, b=2))
    assert result == {"sum": 3}


def test_calculator_rejects_unsafe_expression() -> None:
    result = asyncio.run(calculator.handler(expression="__import__('os')"))
    assert result["ok"] is False


# --- Task 5: planner ---

def test_planner_runs_tool_chain_and_responds() -> None:
    fake = FakeProvider(
        tool_calls=[
            [{"id": "1", "name": "calculator", "arguments": json.dumps({"expression": "2+3"})}]
        ]
    )
    reg = ToolRegistry()
    reg.register(calculator)
    planner = Planner(fake, reg)
    result = asyncio.run(
        planner.run([ChatMessage(role="user", content="what is 2+3?")])
    )
    assert result["steps"] == 1
    assert result["tool_calls"][0]["tool"] == "calculator"
    assert result["tool_calls"][0]["result"]["result"] == 5.0
    assert result["reply"] == "Done."


def test_planner_suggests_tools_without_tool_capability() -> None:
    fake = FakeProvider(tool_calls=[])
    reg = ToolRegistry()
    reg.register(calculator)
    planner = Planner(fake, reg)
    suggested = planner._suggest_tools("please calculate 10 * 2")
    assert "calculator" in suggested
    assert "web_search" not in suggested