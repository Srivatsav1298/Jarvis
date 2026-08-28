"""Daily job-market refresh — scrape live boards and persist the snapshot.

The scraper produces ``Job`` dataclasses; this service converts them into
persisted ``Job`` ORM rows and swaps the stored snapshot so the career
section always lists the most recent 7:00 AM refresh.
"""
import time
from dataclasses import dataclass, field

from app.models.job import Job as JobRecord
from app.repositories.implementations import JobRepository
from app.services.jobs import JobScraper, ScrapeReport
from app.utils.logging import get_logger
from app.utils.time import utcnow

logger = get_logger("app.services.job_refresh")


@dataclass
class RefreshReport:
    """End-to-end diagnostics for one job-market refresh."""

    sources_queried: list[str] = field(default_factory=list)
    per_source_count: dict[str, int] = field(default_factory=dict)
    duplicates_removed: int = 0
    scraped_total: int = 0
    persisted: int = 0
    new_jobs: int = 0
    duration_ms: float = 0.0
    scrape: ScrapeReport | None = None


def to_record(job) -> JobRecord:
    """Map a scraper ``Job`` dataclass onto a ``JobRecord`` ORM row."""
    return JobRecord(
        dedupe_key=f"{job.source}:{job.role.lower()}:{job.company.lower()}",
        company=job.company,
        role=job.role,
        location=job.location,
        source=job.source,
        source_url=job.sourceUrl,
        posted_days_ago=job.postedDaysAgo,
        skills=list(job.skills),
        ai_summary=job.aiSummary,
        match=job.match,
        ai_recommendation=job.aiRecommendation,
        salary=dict(job.salary or {}),
        visa_sponsor=bool(job.visaSponsor),
        remote=job.remote or "hybrid",
        fetched_at=utcnow(),
    )


class JobRefreshService:
    """Scrapes and persists the daily job snapshot."""

    def __init__(
        self,
        repository: JobRepository,
        scraper: JobScraper | None = None,
    ) -> None:
        self.repository = repository
        self.scraper = scraper or JobScraper()

    async def refresh(self, *, limit: int = 40) -> RefreshReport:
        """Scrape live boards and swap the persisted snapshot."""
        started = time.perf_counter()
        previous_keys = set(await self.repository.list_dedupe_keys())
        if hasattr(type(self.scraper), "scrape_report"):
            jobs, scrape = await self.scraper.scrape_report(max_per_source=limit)
        else:
            jobs = await self.scraper.scrape(max_per_source=limit)
            scrape = None
        records = [to_record(job) for job in jobs]
        new_keys = {r.dedupe_key for r in records} - previous_keys
        count = await self.repository.replace_all(records)
        report = RefreshReport(
            sources_queried=list(scrape.sources_queried) if scrape else [],
            per_source_count=dict(scrape.per_source_count) if scrape else {},
            duplicates_removed=scrape.duplicates_removed if scrape else 0,
            scraped_total=scrape.total_before_dedup if scrape else len(jobs),
            persisted=count,
            new_jobs=len(new_keys),
            duration_ms=round((time.perf_counter() - started) * 1000, 1),
            scrape=scrape,
        )
        logger.info(
            "job_refresh_complete",
            extra={"extra_fields": report.__dict__},
        )
        return report

    async def recent(self, *, limit: int = 40) -> list[JobRecord]:
        """Return the persisted snapshot (newest refresh first)."""
        return list(await self.repository.list_recent(limit=limit))
