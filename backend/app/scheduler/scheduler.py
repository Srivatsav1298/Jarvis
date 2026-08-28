"""Minimal asyncio periodic-task scheduler with graceful shutdown."""
import asyncio
import contextlib
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from app.utils.logging import get_logger

Callback = Callable[[], Awaitable[None]]


@dataclass
class ScheduledTask:
    """A named periodic callback, its interval, and initial delay."""

    name: str
    callback: Callback
    interval_seconds: float
    initial_delay_seconds: float = 0.0


class Scheduler:
    """Runs registered async callbacks on fixed intervals until stopped."""

    def __init__(self) -> None:
        self._registry: list[ScheduledTask] = []
        self._runners: dict[str, asyncio.Task] = {}
        self._logger = get_logger("scheduler")

    def register(self, name: str, callback: Callback, interval_seconds: float) -> None:
        """Register a periodic callback (safe before start())."""
        self._registry.append(ScheduledTask(name, callback, interval_seconds))

    def register_daily(
        self,
        name: str,
        callback: Callback,
        *,
        hour: int,
        minute: int = 0,
        timezone: str = "Europe/Oslo",
    ) -> None:
        """Register a callback that fires daily at ``hour:minute`` local.

        The first fire is scheduled for the next occurrence of the target
        time (in ``timezone``), then it repeats every 24 hours.
        """
        tz = ZoneInfo(timezone)
        now = datetime.now(UTC)
        local_now = now.astimezone(tz)
        target = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if target <= local_now:
            target += timedelta(days=1)
        delay = (target - local_now).total_seconds()
        self._registry.append(
            ScheduledTask(
                name,
                callback,
                interval_seconds=24 * 60 * 60,
                initial_delay_seconds=delay,
            )
        )

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
        """Execute one callback on its schedule, skipping if it overruns."""
        if task.initial_delay_seconds > 0:
            await asyncio.sleep(task.initial_delay_seconds)
        while True:
            started = datetime.now(UTC)
            failed = False
            self._logger.info(
                "scheduler_task_start",
                extra={"extra_fields": {"task": task.name}},
            )
            try:
                await task.callback()
            except Exception as exc:  # noqa: BLE001
                failed = True
                self._logger.error(
                    "scheduler_task_failed",
                    extra={"extra_fields": {"task": task.name, "error": str(exc)}},
                )
            elapsed = (datetime.now(UTC) - started).total_seconds()
            self._logger.info(
                "scheduler_task_end",
                extra={
                    "extra_fields": {
                        "task": task.name,
                        "duration_ms": round(elapsed * 1000, 1),
                        "error": failed,
                    }
                },
            )
            await asyncio.sleep(max(0.0, task.interval_seconds - elapsed))
