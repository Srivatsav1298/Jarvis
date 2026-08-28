"""Bounded provider/tool orchestration for local-first chat."""
import asyncio
import json
from typing import Any

from app.ai.providers.base import AIProvider, ChatCompletion, ChatMessage
from app.ai.tools.registry import ToolRegistry
from app.config.settings import Settings


async def complete_with_tools(
    provider: AIProvider,
    messages: list[ChatMessage],
    registry: ToolRegistry,
    settings: Settings,
) -> ChatCompletion:
    """Complete a turn, executing only registered tools within strict bounds."""
    capabilities = getattr(provider, "capabilities", lambda: None)()
    tools = registry.schemas() if capabilities is not None and capabilities.tools else []
    conversation = list(messages)

    for round_index in range(max(0, settings.ai_tool_call_limit) + 1):
        completion = await asyncio.wait_for(
            provider.complete(
                conversation,
                temperature=settings.ai_temperature,
                max_tokens=settings.ai_max_tokens,
                tools=tools,
            ),
            timeout=settings.ai_timeout_seconds,
        )
        if not completion.tool_calls:
            return completion
        if round_index >= settings.ai_tool_call_limit:
            return ChatCompletion(
                text=completion.text
                or "I could not complete that request within the assistant's tool limit.",
                finish_reason="tool_limit",
            )

        normalized_calls: list[dict[str, Any]] = []
        for index, call in enumerate(completion.tool_calls):
            name = str(call.get("name") or "")
            call_id = str(call.get("id") or f"tool_{round_index}_{index}")
            arguments = call.get("arguments", {})
            if isinstance(arguments, str):
                try:
                    arguments = json.loads(arguments or "{}")
                except json.JSONDecodeError:
                    arguments = {}
            if not isinstance(arguments, dict):
                arguments = {}
            normalized_calls.append(
                {
                    "id": call_id,
                    "type": "function",
                    "function": {
                        "name": name,
                        "arguments": json.dumps(arguments),
                    },
                }
            )

        conversation.append(
            ChatMessage(
                role="assistant",
                content=completion.text,
                tool_calls=normalized_calls,
            )
        )
        for call in normalized_calls:
            function = call["function"]
            name = function["name"]
            try:
                arguments = json.loads(function["arguments"])
                if name not in registry:
                    raise KeyError(f"Unknown tool: {name}")
                result = await asyncio.wait_for(
                    registry.invoke(name, **arguments),
                    timeout=settings.ai_tool_timeout_seconds,
                )
            except Exception as exc:  # noqa: BLE001 — return failure to the model
                result = {"ok": False, "error": f"Tool failed: {type(exc).__name__}: {exc}"}
            conversation.append(
                ChatMessage(
                    role="tool",
                    name=name,
                    tool_call_id=call["id"],
                    content=json.dumps(result, default=str),
                )
            )

    return ChatCompletion(text="I could not complete that request.", finish_reason="tool_limit")
