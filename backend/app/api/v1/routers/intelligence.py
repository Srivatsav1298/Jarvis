"""Intelligence endpoints: news feeds, live weather and recent job posts.

News is aggregated through Agent-Reach's RSS capability with Tech as the
priority category. Weather is fetched live from Open-Meteo (no API key).
Jobs are served from the persisted daily 07:00 Oslo refresh (seeded on
startup so the store is never empty); pass ``fresh=true`` to force a live
re-scrape against finn.no, Jobbnorge and LinkedIn. All sources degrade to
empty payloads when offline.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.envelope import ok
from app.dependencies.database import get_db_session
from app.repositories.implementations import JobRepository
from app.services.job_refresh import JobRefreshService
from app.services.jobs import JobScraper
from app.services.news import CATEGORY_ORDER, NewsService
from app.services.weather import WeatherService

router = APIRouter(tags=["intelligence"])


def _record_to_payload(record) -> dict:
    """Map a persisted Job ORM row onto the frontend Job payload shape."""
    return {
        "id": record.id,
        "company": record.company,
        "role": record.role,
        "location": record.location,
        "source": record.source,
        "sourceUrl": record.source_url,
        "postedDaysAgo": record.posted_days_ago,
        "fetchedAt": record.fetched_at.isoformat() if record.fetched_at else None,
        "skills": record.skills or [],
        "aiSummary": record.ai_summary,
        "match": record.match,
        "aiRecommendation": record.ai_recommendation,
        "salary": record.salary or {"min": 0, "max": 0, "currency": "kr"},
        "visaSponsor": record.visa_sponsor,
        "remote": record.remote,
    }


@router.get("/intelligence/news")
async def intelligence_news(
    category: str | None = Query(default=None, description="News category, or all (Tech first)"),
    limit: int = Query(default=40, ge=1, le=100),
) -> dict:
    """Return aggregated news headlines, prioritized by category."""
    if category and category not in CATEGORY_ORDER:
        category = None
    service = NewsService()
    articles = await service.get_news(category=category, limit=limit)
    return ok([a.__dict__ for a in articles])


@router.get("/intelligence/weather")
async def intelligence_weather() -> dict:
    """Return live weather for Oslo, Norway (Open-Meteo, no API key)."""
    weather = await WeatherService().get_current()
    return ok(weather.__dict__)


@router.get("/intelligence/jobs")
async def intelligence_jobs(
    role: str | None = Query(default=None, description="Target role, or all roles"),
    limit: int = Query(default=40, ge=1, le=100),
    fresh: bool = Query(default=False, description="Force a live re-scrape"),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Return the persisted daily job snapshot (or live-scrape with fresh=true).

    The 07:00 Oslo scheduler refreshes the snapshot and the store is seeded
    on startup, so reads are served straight from the DB. On a cold boot
    before the seed lands the store is seeded on-demand.
    """
    service = JobRefreshService(JobRepository(session), scraper=JobScraper())
    if fresh:
        await service.refresh(limit=limit)
    records = await service.recent(limit=limit)
    if not records:
        await service.refresh(limit=limit)
        records = await service.recent(limit=limit)
    return ok([_record_to_payload(r) for r in records])
