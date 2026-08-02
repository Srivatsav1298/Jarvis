"""Minimal asyncio periodic-task scheduler with graceful shutdown."""
import asyncio
import contextlib
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from app.utils.logging import get_logger

Callback = Callable[[], Awaitable[None]]


@dataclass
class ScheduledTask:
    """A named periodic callback and its interval."""

    name: str
    callback: Callback
    interval_seconds: float


class Scheduler:
    """Runs registered async callbacks on fixed intervals until stopped."""

    def __init__(self) -> None:
        self._registry: list[ScheduledTask] = []
        self._runners: dict[str, asyncio.Task] = {}
        self._logger = get_logger("scheduler")

    def register(self, name: str, callback: Callback, interval_seconds: float) -> None:
        """Register a periodic callback (safe before start())."""
        self._registry.append(ScheduledTask(name, callback, interval_seconds))

    async def start(self) -> None:
        """Spawn a runner task for every registered callback."""
        for task in self._registry:
            self._runners[task.name] = asyncio.create_task(
                self._run(task), name=f"scheduler:{task.name}"
            )
        self._logger.info(
            "scheduler_started",
            extra={"extra_fields": {"tasks": list(self._runners)}},
        )

    async def stop(self) -> None:
        """Cancel all runner tasks and await their completion."""
        for name in list(self._runners):
            self._runners[name].cancel()
        for name in list(self._runners):
            with contextlib.suppress(asyncio.CancelledError):
                await self._runners[name]
        self._runners.clear()
        self._logger.info("scheduler_stopped")

    async def _run(self, task: ScheduledTask) -> None:
        """Execute one callback repeatedly, skipping if it overruns."""
        while True:
            started = datetime.now(UTC)
            try:
                await task.callback()
            except Exception as exc:  # noqa: BLE001
                self._logger.error(
                    "scheduler_task_failed",
                    extra={"extra_fields": {"task": task.name, "error": str(exc)}},
                )
            elapsed = (datetime.now(UTC) - started).total_seconds()
            await asyncio.sleep(max(0.0, task.interval_seconds - elapsed))
