import json

from app.ai.providers.base import (
    AIProvider,
    Capabilities,
    ChatChunk,
    ChatCompletion,
    ProviderHealth,
)
from app.ai.tools.registry import Tool, ToolRegistry
from app.ai.tools.runner import complete_with_tools
from app.config.settings import Settings


class _ToolCallingProvider(AIProvider):
    name = "test-local"

    def __init__(self):
        self.calls = 0

    def capabilities(self):
        return Capabilities(tools=True)

    async def stream(self, messages, **kwargs):
        yield ChatChunk(text="unused")

    async def complete(self, messages, **kwargs):
        self.calls += 1
        if self.calls == 1:
            return ChatCompletion(
                tool_calls=[
                    {"name": "echo", "arguments": json.dumps({"value": "British"})}
                ]
            )
        assert messages[-1].role == "tool"
        assert "British" in messages[-1].content
        return ChatCompletion(text="The tool worked.")

    async def health(self):
        return ProviderHealth(ok=True, latency_ms=0)


async def test_complete_with_tools_executes_and_returns_final_answer():
    async def echo(value):
        return {"ok": True, "value": value}

    registry = ToolRegistry().register(
        Tool(
            name="echo",
            description="Echo a value",
            input_schema={"type": "object", "properties": {"value": {"type": "string"}}},
            handler=echo,
        )
    )
    provider = _ToolCallingProvider()

    result = await complete_with_tools(
        provider,
        [],
        registry,
        Settings(_env_file=None, ai_tool_call_limit=2),
    )

    assert result.text == "The tool worked."
    assert provider.calls == 2
