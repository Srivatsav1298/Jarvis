"""AsyncCache — small TTL + max-size in-process cache for async producers.

Used to memoize expensive, cacheable work (tool results, provider completions,
embeddings) without introducing an external cache dependency. Sliding TTL keeps
entries fresh; LRU eviction bounds memory.
"""
import asyncio
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")


class CacheMiss(Exception):
    """Raised by `get` when a key is absent or expired."""


class AsyncCache[T]:
    """Thread-safe async cache with TTL and bounded size."""

    def __init__(self, *, maxsize: int = 256, ttl_seconds: float = 60.0) -> None:
        if maxsize < 1:
            raise ValueError("maxsize must be >= 1")
        self.maxsize = maxsize
        self.ttl_seconds = ttl_seconds
        self._store: OrderedDict[str, tuple[float, T]] = OrderedDict()
        self._lock = asyncio.Lock()
        self.hits = 0
        self.misses = 0

    async def get(self, key: str) -> T:
        """Return the cached value or raise CacheMiss."""
        async with self._lock:
            item = self._store.get(key)
            if item is None:
                self.misses += 1
                raise CacheMiss(key)
            expires_at, value = item
            if expires_at < time.monotonic():
                del self._store[key]
                self.misses += 1
                raise CacheMiss(key)
            # refresh LRU position
            del self._store[key]
            self._store[key] = item
            self.hits += 1
            return value

    async def set(self, key: str, value: T, *, ttl_seconds: float | None = None) -> None:
        """Store a value, evicting the LRU entry when at capacity."""
        ttl = self.ttl_seconds if ttl_seconds is None else ttl_seconds
        async with self._lock:
            if key in self._store:
                del self._store[key]
            self._store[key] = (time.monotonic() + ttl, value)
            while len(self._store) > self.maxsize:
                self._store.popitem(last=False)

    async def get_or_compute(
        self,
        key: str,
        producer: Callable[[], Awaitable[T]],
        *,
        ttl_seconds: float | None = None,
    ) -> T:
        """Return the cached value or compute, store, and return it."""
        try:
            return await self.get(key)
        except CacheMiss:
            value = await producer()
            await self.set(key, value, ttl_seconds=ttl_seconds)
            return value

    async def delete(self, key: str) -> bool:
        """Remove a key; returns True if it existed."""
        async with self._lock:
            return self._store.pop(key, None) is not None

    async def clear(self) -> None:
        """Drop all entries."""
        async with self._lock:
            self._store.clear()

    @property
    def size(self) -> int:
        """Current number of cached entries."""
        return len(self._store)

    @property
    def stats(self) -> dict[str, int]:
        """Hit/miss counters and current size."""
        return {"hits": self.hits, "misses": self.misses, "size": self.size}
