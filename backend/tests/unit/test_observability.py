"""Tests for the observability layer (Task 14) — AI metrics + tracer."""
import asyncio

import pytest

from app.ai.observability import AIMetrics, Tracer
from app.ai.observability.factory import build_observability
from app.config.settings import Settings


class TestAIMetrics:
    @pytest.mark.asyncio
    async def test_counters_accumulate(self):
        metrics = AIMetrics()
        await metrics.increment("provider.calls")
        await metrics.increment("provider.calls", by=2)
        snapshot = await metrics.snapshot()
        assert snapshot["counters"]["provider.calls"] == 3

    @pytest.mark.asyncio
    async def test_time_with_explicit_start(self):
        metrics = AIMetrics()
        import time as _time

        started = _time.monotonic()
        await asyncio.sleep(0.001)
        await metrics.time("explicit", started_at=started)
        lat = (await metrics.snapshot())["latencies"]["explicit"]
        assert lat["count"] == 1
        assert lat["avg_ms"] >= 0.5

    @pytest.mark.asyncio
    async def test_measure_context_records_ms(self):
        metrics = AIMetrics()
        async with metrics.measure("chat.complete"):
            await asyncio.sleep(0.001)
        snapshot = await metrics.snapshot()
        lat = snapshot["latencies"]["chat.complete"]
        assert lat["count"] == 1
        assert lat["avg_ms"] >= 0.5

    @pytest.mark.asyncio
    async def test_snapshot_summarizes_many_samples(self):
        metrics = AIMetrics()
        for _ in range(10):
            async with metrics.measure("tool.run"):
                await asyncio.sleep(0.0005)
        snapshot = await metrics.snapshot()
        lat = snapshot["latencies"]["tool.run"]
        assert lat["count"] == 10
        assert 0 <= lat["p50_ms"] <= lat["p95_ms"] <= lat["max_ms"]

    @pytest.mark.asyncio
    async def test_reset_clears(self):
        metrics = AIMetrics()
        await metrics.increment("x")
        await metrics.reset()
        assert (await metrics.snapshot())["counters"] == {}


class TestTracer:
    def test_start_returns_finished_span(self):
        tracer = Tracer()
        span = tracer.start("plan")
        span.finish()
        assert span.duration_ms is not None
        assert len(tracer.export()) == 1

    def test_span_context_manager(self):
        tracer = Tracer()
        with tracer.span("chat.complete", provider="fallback"):
            pass
        exported = tracer.export()
        assert len(exported) == 1
        assert exported[0]["name"] == "chat.complete"
        assert exported[0]["attributes"]["provider"] == "fallback"

    def test_span_captures_error(self):
        tracer = Tracer()
        with pytest.raises(RuntimeError), tracer.span("fail"):
            raise RuntimeError("boom")
        assert tracer.export()[0]["error"]

    def test_disabled_tracer_noops(self):
        tracer = Tracer(enabled=False)
        with tracer.span("x"):
            pass
        assert tracer.export() == []

    def test_trace_id_is_unique(self):
        tracer = Tracer()
        a = tracer.start("a")
        b = tracer.start("b")
        assert a.trace_id != b.trace_id


class TestFactory:
    def test_build_observability(self):
        settings = Settings(_env_file=None, debug=True, otel_traces_enabled=True)
        obs = build_observability(settings)
        assert isinstance(obs["metrics"], AIMetrics)
        assert isinstance(obs["tracer"], Tracer)
        assert obs["tracer"].enabled is True
        assert obs["tracer"].emit_logs is True
