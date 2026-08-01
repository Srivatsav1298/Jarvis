"""Tests for the asyncio periodic scheduler."""
import asyncio

from app.scheduler.scheduler import Scheduler


async def test_scheduler_runs_and_stops() -> None:
    runs = []
    scheduler = Scheduler()

    async def tick() -> None:
        runs.append(1)

    scheduler.register("tick", tick, interval_seconds=0.01)
    await scheduler.start()
    await asyncio.sleep(0.05)
    await scheduler.stop()
    assert len(runs) >= 3


async def test_scheduler_keeps_running_on_callback_error() -> None:
    runs = []
    attempts = 0

    async def flaky() -> None:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("boom")
        runs.append(1)

    scheduler = Scheduler()
    scheduler.register("flaky", flaky, interval_seconds=0.01)
    await scheduler.start()
    await asyncio.sleep(0.04)
    await scheduler.stop()
    assert len(runs) >= 1
