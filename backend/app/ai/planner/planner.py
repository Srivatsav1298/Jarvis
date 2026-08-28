"""Planner — decides when tools are needed, chains calls, retries, responds.

The planner is a deterministic + model-assisted loop:
  1. Determine intent: does the user message require tools?
  2. If yes, ask the model to emit tool calls (or use keyword heuristics).
  3. Execute each tool, feed results back, let the model synthesize.
  4. Retry transient tool failures; always produce a final response.

Emits planner.* events through an optional broadcaster so the frontend can
render the reasoning/plan live.
"""
import contextlib
import json
import time
from dataclasses import dataclass, field

from app.ai.providers.base import AIProvider, ChatChunk, ChatMessage
from app.ai.tools.registry import ToolRegistry

_TOOL_HINT_KEYWORDS = {
    "weather": ("weather", "temperature", "forecast", "raining", "sunny"),
    "datetime": ("what time", "what day", "today's date", "current date", "what's the date"),
    "calculator": ("calculate", "what is ", "how much is", "+", "-", "*", "/"),
    "web_search": ("search", "latest", "news", "who is", "what happened", "google"),
}


@dataclass
class PlannerEvent:
    """One planner lifecycle event forwarded to the WS broadcaster."""

    kind: str  # 'start' | 'tool_call' | 'tool_result' | 'retry' | 'end'
    detail: dict = field(default_factory=dict)


class Planner:
    """Orchestrates the tool-use loop for a single turn."""

    def __init__(
        self,
        provider: AIProvider,
        registry: ToolRegistry,
        *,
        max_steps: int = 3,
        max_retries: int = 2,
        broadcaster=None,
    ) -> None:
        self.provider = provider
        self.registry = registry
        self.max_steps = max_steps
        self.max_retries = max_retries
        self.broadcaster = broadcaster

    async def _emit(self, kind: str, detail: dict | None = None) -> None:
        if self.broadcaster is None:
            return
        with contextlib.suppress(Exception):
            await self.broadcaster("planner.event", {"kind": kind, **(detail or {})})

    def _suggest_tools(self, text: str) -> list[str]:
        """Keyword-based tool suggestion when the model can't do tool calls."""
        lowered = text.lower()
        found = []
        for name, keywords in _TOOL_HINT_KEYWORDS.items():
            if any(kw in lowered for kw in keywords):
                found.append(name)
        return found

    async def run(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> dict:
        """Execute a full plan for a turn and return the final reply + trace."""
        started = time.perf_counter()
        await self._emit("start", {"steps": 0})
        tool_schemas = self.registry.schemas()
        cap_fn = getattr(self.provider, "capabilities", None)
        capabilities = cap_fn() if callable(cap_fn) else None
        has_tool_capability = bool(tool_schemas) and bool(
            getattr(capabilities, "tools", False)
        )

        trace: list[dict] = []
        current_messages = list(messages)

        # Step 1: let the model decide tool calls (stream first).
        completion = await self.provider.complete(
            current_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            tools=tool_schemas if has_tool_capability else None,
        )

        steps = 0
        while completion.tool_calls and steps < self.max_steps:
            steps += 1
            await self._emit("tool_call", {"count": len(completion.tool_calls), "step": steps})
            assistant_turn = ChatMessage(
                role="assistant", content=completion.text or ""
            )
            current_messages.append(assistant_turn)

            tool_results = []
            for call in completion.tool_calls:
                name = call.get("name") or ""
                raw_args = call.get("arguments") or "{}"
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else (raw_args or {})
                    if not isinstance(args, dict):
                        args = {}
                except json.JSONDecodeError:
                    args = {}
                result = await self._execute_with_retry(name, args)
                tool_results.append(
                    {"name": name, "arguments": args, "result": result}
                )
                trace.append(
                    {"step": steps, "tool": name, "args": args, "result": result}
                )
                await self._emit("tool_result", {"tool": name, "result": result})

            for tr in tool_results:
                current_messages.append(
                    ChatMessage(
                        role="tool",
                        name=tr["name"],
                        content=json.dumps(tr["result"]),
                    )
                )

            completion = await self.provider.complete(
                current_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                tools=tool_schemas if has_tool_capability else None,
            )

        # Step 2 (no tool-calling capability): use keyword hints, then let the
        # model synthesize with the tool results inline.
        if not has_tool_capability and not completion.tool_calls:
            user_text = next(
                (m.content for m in reversed(messages) if m.role == "user"), ""
            )
            suggestions = self._suggest_tools(user_text)
            executed = False
            for name in suggestions:
                tool = self.registry.get(name)
                if tool is None or getattr(tool, "handler", None) is None:
                    continue
                args = self._default_args(name, user_text)
                result = await self._execute_with_retry(name, args)
                trace.append({"step": 1, "tool": name, "args": args, "result": result})
                current_messages.append(
                    ChatMessage(
                        role="tool", name=name, content=json.dumps(result)
                    )
                )
                await self._emit("tool_result", {"tool": name, "result": result})
                executed = True
            if executed:
                steps = 1
                completion = await self.provider.complete(
                    current_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    tools=None,
                )

        latency_ms = int((time.perf_counter() - started) * 1000)
        await self._emit("end", {"steps": steps, "latency_ms": latency_ms})
        return {
            "reply": completion.text or "",
            "tool_calls": trace,
            "steps": steps,
            "latency_ms": latency_ms,
            "finish_reason": completion.finish_reason,
        }

    def _default_args(self, name: str, user_text: str) -> dict:
        """Best-effort argument extraction for keyword-triggered tools."""
        if name == "calculator":
            expr = user_text
            for marker in ("calculate ", "what is ", "how much is "):
                if marker in expr:
                    expr = expr.split(marker, 1)[1]
                    break
            expr = expr.strip().strip("?.")
            return {"expression": expr}
        if name == "web_search":
            return {"query": user_text[:200]}
        if name == "weather":
            return {"location": user_text[-60:]}
        return {}

    async def _execute_with_retry(self, name: str, args: dict) -> dict:
        tool = self.registry.get(name)
        if tool is None:
            return {"ok": False, "error": f"unknown tool: {name}"}
        for attempt in range(self.max_retries + 1):
            try:
                return await self.registry.invoke(name, **args)
            except KeyError as exc:
                return {"ok": False, "error": str(exc)}
            except Exception as exc:  # noqa: BLE001
                if attempt >= self.max_retries:
                    return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
                await self._emit("retry", {"tool": name, "attempt": attempt + 1})

    async def stream_plan(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ):
        """Stream the final reply tokens after running the tool loop."""
        result = await self.run(messages, temperature=temperature, max_tokens=max_tokens)
        reply = result["reply"]
        for token in reply.split(" "):
            yield ChatChunk(text=token)
        yield ChatChunk(finish_reason=result.get("finish_reason") or "stop")