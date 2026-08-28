"""Tests for the performance layer (Task 13) — cache + concurrency limiter."""
import asyncio

import pytest

from app.ai.performance import AsyncCache, AsyncLimiter, CacheMiss


class TestAsyncCache:
    @pytest.mark.asyncio
    async def test_miss_then_hit(self):
        cache = AsyncCache()
        with pytest.raises(CacheMiss):
            await cache.get("k")
        await cache.set("k", "v")
        assert await cache.get("k") == "v"
        assert cache.stats["hits"] == 1
        assert cache.stats["misses"] == 1

    @pytest.mark.asyncio
    async def test_get_or_compute_caches(self):
        cache = AsyncCache()
        calls = []

        async def producer():
            calls.append(1)
            return "computed"

        first = await cache.get_or_compute("k", producer)
        second = await cache.get_or_compute("k", producer)
        assert first == second == "computed"
        assert len(calls) == 1

    @pytest.mark.asyncio
    async def test_ttl_expiry(self):
        cache = AsyncCache(ttl_seconds=0.05)
        await cache.set("k", "v")
        assert await cache.get("k") == "v"
        await asyncio.sleep(0.08)
        with pytest.raises(CacheMiss):
            await cache.get("k")

    @pytest.mark.asyncio
    async def test_per_call_ttl_override(self):
        cache = AsyncCache(ttl_seconds=0.05)
        await cache.set("k", "v", ttl_seconds=60)
        await asyncio.sleep(0.08)
        assert await cache.get("k") == "v"

    @pytest.mark.asyncio
    async def test_maxsize_evicts_lru(self):
        cache = AsyncCache(maxsize=2)
        await cache.set("a", 1)
        await cache.set("b", 2)
        await cache.get("a")  # refresh a -> b becomes LRU
        await cache.set("c", 3)
        assert cache.size == 2
        with pytest.raises(CacheMiss):
            await cache.get("b")
        assert await cache.get("a") == 1
        assert await cache.get("c") == 3

    @pytest.mark.asyncio
    async def test_delete_and_clear(self):
        cache = AsyncCache()
        await cache.set("k", "v")
        assert await cache.delete("k") is True
        assert await cache.delete("k") is False
        await cache.set("a", 1)
        await cache.clear()
        assert cache.size == 0

    def test_invalid_maxsize(self):
        with pytest.raises(ValueError):
            AsyncCache(maxsize=0)


class TestAsyncLimiter:
    @pytest.mark.asyncio
    async def test_limits_concurrency(self):
        limiter = AsyncLimiter(max_concurrency=2)
        active = 0
        peak = 0

        async def worker(i):
            nonlocal active, peak
            active += 1
            peak = max(peak, active)
            await asyncio.sleep(0.02)
            active -= 1
            return i

        results = await asyncio.gather(*(limiter.run(lambda i=i: worker(i)) for i in range(6)))
        assert results == [0, 1, 2, 3, 4, 5]
        assert peak <= 2

    @pytest.mark.asyncio
    async def test_available_slots(self):
        limiter = AsyncLimiter(max_concurrency=3)
        assert limiter.available == 3
        await limiter.acquire()
        assert limiter.available == 2
        limiter.release()
        assert limiter.available == 3

    @pytest.mark.asyncio
    async def test_rate_limit(self):
        limiter = AsyncLimiter(max_concurrency=10, rate_per_second=20)
        start = asyncio.get_event_loop().time()
        for _ in range(5):
            await limiter.run(lambda: _noop())
        elapsed = asyncio.get_event_loop().time() - start
        # 5 calls at 20/s should take at least ~0.2s
        assert elapsed >= 0.18


async def _noop():
    return None
