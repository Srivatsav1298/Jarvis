"""AIMetrics — in-process counters and timers for AI operations.

Complements the host-level MetricsProvider (CPU/RAM) with AI-specific signals:
provider calls, tokens, tool executions, planner steps, errors, and latency.
Thread-safe via asyncio lock; `snapshot()` returns a flat, serializable dict.
"""
import asyncio
import time
from collections import defaultdict
from typing import Any


class AIMetrics:
    """Counters + latency histogram for the AI pipeline."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._counters: dict[str, int] = defaultdict(int)
        self._latencies: dict[str, list[float]] = defaultdict(list)

    # -- counters -----------------------------------------------------------

    async def increment(self, name: str, *, by: int = 1) -> None:
        """Increment a named counter."""
        async with self._lock:
            self._counters[name] += by

    # -- timers -------------------------------------------------------------

    async def time(self, name: str, started_at: float | None = None) -> None:
        """Record a latency sample for `name` (seconds, ms stored)."""
        started_at = started_at if started_at is not None else time.monotonic()
        async with self._lock:
            self._latencies[name].append((time.monotonic() - started_at) * 1000.0)

    # -- context manager convenience ----------------------------------------

    def measure(self, name: str):
        """Async-context timer; records ms on exit."""
        return _Measure(self, name)

    # -- reporting ----------------------------------------------------------

    async def snapshot(self) -> dict[str, Any]:
        """Return counters plus p50/p95/max/avg latency summaries."""
        async with self._lock:
            counters = dict(self._counters)
            latencies = {
                name: _summarize(samples)
                for name, samples in self._latencies.items()
                if samples
            }
        return {"counters": counters, "latencies": latencies}

    async def reset(self) -> None:
        """Clear all counters and latency samples."""
        async with self._lock:
            self._counters.clear()
            self._latencies.clear()


class _Measure:
    """Async context manager recording a latency sample on exit."""

    def __init__(self, metrics: AIMetrics, name: str) -> None:
        self._metrics = metrics
        self._name = name
        self._started = time.monotonic()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_exc) -> None:
        await self._metrics.time(self._name, self._started)


def _summarize(samples: list[float]) -> dict[str, float]:
    ordered = sorted(samples)
    n = len(ordered)
    p50 = ordered[n // 2] if n else 0.0
    p95 = ordered[int(n * 0.95) - 1] if n else 0.0
    return {
        "count": n,
        "avg_ms": round(sum(ordered) / n, 3) if n else 0.0,
        "p50_ms": round(p50, 3),
        "p95_ms": round(p95, 3),
        "max_ms": round(ordered[-1], 3) if n else 0.0,
    }
