"""Tests for the persisted job snapshot and its daily refresh path."""
from unittest.mock import AsyncMock

import pytest

from app.models.job import Job as JobRecord
from app.repositories.implementations import JobRepository
from app.scheduler.scheduler import Scheduler
from app.services.job_refresh import JobRefreshService, to_record
from app.services.jobs import Job as JobDTO


def _dto(index: int) -> JobDTO:
    return JobDTO(
        id=f"j{index}",
        company=f"Acme {index}",
        role="AI Engineer",
        location="Oslo, Norway",
        source="finn.no",
        sourceUrl=f"https://www.finn.no/job/ad/{index}",
        postedDaysAgo=0,
        skills=["Python", "LLM"],
        aiSummary="Live role at Acme.",
        match=90 + index,
        aiRecommendation="top",
        salary={"min": 900, "max": 1200, "currency": "kr"},
        visaSponsor=False,
        remote="hybrid",
    )


def test_to_record_maps_dto_fields():
    record = to_record(_dto(1))
    assert isinstance(record, JobRecord)
    assert record.company == "Acme 1"
    assert record.dedupe_key == "finn.no:ai engineer:acme 1"
    assert record.match == 91
    assert record.skills == ["Python", "LLM"]


@pytest.mark.asyncio
async def test_refresh_persists_and_replaces_snapshot():
    repo = JobRepository.__new__(JobRepository)
    stored: list[JobRecord] = []

    async def fake_replace_all(jobs) -> int:
        stored[:] = list(jobs)
        return len(jobs)

    async def fake_recent(*, limit) -> list[JobRecord]:
        return stored[:limit]

    async def fake_list_dedupe_keys() -> set[str]:
        return {r.dedupe_key for r in stored}

    repo.replace_all = AsyncMock(side_effect=fake_replace_all)
    repo.list_recent = AsyncMock(side_effect=fake_recent)
    repo.list_dedupe_keys = AsyncMock(side_effect=fake_list_dedupe_keys)

    service = JobRefreshService(repo)
    service.scraper = AsyncMock()
    service.scraper.scrape = AsyncMock(return_value=[_dto(1), _dto(2)])

    report = await service.refresh()
    assert report.persisted == 2
    assert report.new_jobs == 2
    recent = await service.recent()
    assert len(recent) == 2
    assert service.scraper.scrape.await_count == 1


@pytest.mark.asyncio
async def test_refresh_reports_new_vs_previous_snapshot():
    repo = JobRepository.__new__(JobRepository)
    stored: list[JobRecord] = []

    async def fake_replace_all(jobs) -> int:
        stored[:] = list(jobs)
        return len(jobs)

    async def fake_list_dedupe_keys() -> set[str]:
        return {r.dedupe_key for r in stored}

    repo.replace_all = AsyncMock(side_effect=fake_replace_all)
    repo.list_dedupe_keys = AsyncMock(side_effect=fake_list_dedupe_keys)

    service = JobRefreshService(repo)
    service.scraper = AsyncMock()

    first = [_dto(1), _dto(2)]
    second = [_dto(2), _dto(3)]
    service.scraper.scrape = AsyncMock(
        side_effect=[first, second]
    )

    report1 = await service.refresh()
    assert report1.persisted == 2
    assert report1.new_jobs == 2

    report2 = await service.refresh()
    assert report2.persisted == 2
    assert report2.new_jobs == 1  # only _dto(3) is new


@pytest.mark.asyncio
async def test_daily_scheduler_registers_24h_cadence():
    scheduler = Scheduler()
    calls: list[str] = []

    async def job() -> None:
        calls.append("job")

    scheduler.register_daily("job_refresh", job, hour=7, minute=0)
    task = scheduler._registry[0]
    assert task.name == "job_refresh"
    assert task.interval_seconds == 24 * 60 * 60
    assert task.initial_delay_seconds > 0

    class _StopLoop(Exception):
        pass

    sleep_calls = 0

    async def fake_sleep(_seconds: float) -> None:
        nonlocal sleep_calls
        sleep_calls += 1
        if sleep_calls >= 2:
            raise _StopLoop

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.scheduler.scheduler.asyncio.sleep", fake_sleep)
        with pytest.raises(_StopLoop):
            await scheduler._run(task)

    assert calls == ["job"]
