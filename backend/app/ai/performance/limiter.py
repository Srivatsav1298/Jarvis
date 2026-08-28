"""AsyncLimiter — concurrency cap for resource-bound work.

Serializes producers (provider calls, tool executions) behind a bounded
semaphore so a burst of concurrent requests cannot flood an upstream service.
Optionally rate-limits to N calls per sliding window when `rate_per_second`
is provided.
"""
import asyncio
import time


class AsyncLimiter:
    """Bounded concurrency (and optional rate) limiter."""

    def __init__(
        self, *, max_concurrency: int = 4, rate_per_second: float | None = None
    ) -> None:
        if max_concurrency < 1:
            raise ValueError("max_concurrency must be >= 1")
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._rate_per_second = rate_per_second
        self._window: list[float] = []
        self._lock = asyncio.Lock()

    async def run(self, coro_factory):
        """Execute `coro_factory()` under the concurrency/rate limits."""
        await self.acquire()
        try:
            return await coro_factory()
        finally:
            self.release()

    async def acquire(self) -> None:
        """Block until a concurrency slot (and rate token) is free."""
        await self._semaphore.acquire()
        if self._rate_per_second is not None:
            await self._wait_for_rate_slot()

    async def _wait_for_rate_slot(self) -> None:
        """Wait until the next rate token is available (strict spacing)."""
        while True:
            async with self._lock:
                now = time.monotonic()
                if not self._window:
                    self._window.append(now)
                    return
                slot = max(self._window[-1] + 1.0 / self._rate_per_second, now)
                if now >= slot - 1e-9:
                    self._window.append(now)
                    return
                wait_for = slot - now
            await asyncio.sleep(wait_for)

    def release(self) -> None:
        """Release a concurrency slot."""
        self._semaphore.release()

    @property
    def available(self) -> int:
        """Number of currently available concurrency slots."""
        return self._semaphore._value  # noqa: SLF001 — read-only status peek
