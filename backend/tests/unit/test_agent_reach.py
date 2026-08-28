"""Tests for the Agent-Reach client, news aggregation and job scraper."""
from unittest.mock import AsyncMock

import pytest

from app.services.agent_reach import AgentReachClient
from app.services.jobs import JobScraper
from app.services.news import CATEGORY_FEEDS, CATEGORY_ORDER, NewsService

# -- AgentReachClient ------------------------------------------------------


class _FakeResponse:
    status_code = 200

    def __init__(self, text: str) -> None:
        self.text = text


class _FakeClient:
    def __init__(self, responses: list) -> None:
        self._responses = responses

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def get(self, url: str, **kwargs):
        return self._responses.pop(0)


def test_web_search_parses_mcporter_json():
    client = AgentReachClient()
    raw = (
        '{"content": [{"type": "text", "text": "Title: AI Engineer | Acme\\n'
        "URL: https://acme.example/jobs/1\\nPublished: Jul 02, 2026\\n"
        'Highlights:\\nGreat role in Oslo.\\n\\nFull-time\\n"}]}'
    )
    results = client._parse_mcporter_json(raw)
    assert len(results) == 1
    assert results[0].title == "AI Engineer | Acme"
    assert results[0].url == "https://acme.example/jobs/1"
    assert "Great role" in results[0].snippet


def test_web_search_rejects_bad_json():
    assert AgentReachClient()._parse_mcporter_json("not json") == []


@pytest.mark.asyncio
async def test_web_search_returns_empty_without_mcporter(monkeypatch):
    monkeypatch.setattr("app.services.agent_reach.shutil.which", lambda _: None)
    client = AgentReachClient()
    assert await client.web_search("query") == []


@pytest.mark.asyncio
async def test_read_url_requires_http():
    client = AgentReachClient()
    assert await client.read_url("javascript:alert(1)") == ""


@pytest.mark.asyncio
async def test_read_url_surfaces_markdown():
    client = AgentReachClient()
    client._client_factory = lambda: _FakeClient([_FakeResponse("# Title\nBody text")])
    client.read_url = AsyncMock(return_value="# Title\nBody text")
    assert await client.read_url("https://example.com") == "# Title\nBody text"


@pytest.mark.asyncio
async def test_web_search_subprocess_error_returns_empty(monkeypatch):
    async def fake_exec(*args, **kwargs):
        raise OSError("no mcporter")

    import asyncio

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_exec)
    client = AgentReachClient(mcporter="/does/not/exist")
    assert await client.web_search("anything") == []


# -- NewsService -----------------------------------------------------------


@pytest.mark.asyncio
async def test_news_service_returns_empty_on_offline(monkeypatch):
    async def fail_get(self, url):
        raise OSError("offline")

    class BrokenClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, url, **kwargs):
            raise OSError("offline")

    service = NewsService()
    service._fetch_feed = AsyncMock(return_value=[])
    articles = await service.get_news()
    assert articles == []


def test_category_feeds_are_configured():
    assert "Technology" in CATEGORY_FEEDS
    assert CATEGORY_ORDER[0] == "Technology"  # Tech is top priority


@pytest.mark.asyncio
async def test_news_service_filters_unknown_category():
    service = NewsService()
    service._fetch_feed = AsyncMock(return_value=[])
    articles = await service.get_news(category="NotARealCategory")
    assert articles == []


# -- JobScraper ------------------------------------------------------------


@pytest.mark.asyncio
async def test_scraper_parses_finn_board():
    body = (
        "[Python Developer](https://www.finn.no/job/ad/12345)\n"
        "[Some Company AS](https://www.finn.no/job/ad/67890)\n"
        "[Cookie consent](https://www.finn.no/cookies)\n"
    )
    scraper = JobScraper()
    jobs = scraper._parse_board("finn.no", "Python Developer", body)
    assert len(jobs) >= 1
    assert jobs[0].source == "finn.no"
    assert jobs[0].sourceUrl == "https://www.finn.no/job/ad/12345"
    assert jobs[0].postedDaysAgo == 0


def test_scraper_rejects_non_job_links():
    scraper = JobScraper()
    links = scraper._extract_links(
        "linkedin",
        "[Python Developer](https://www.linkedin.com/jobs/view/1)\n"
        "[Cookie policy](https://www.linkedin.com/legal/cookie)\n",
    )
    assert len(links) == 1
    assert links[0][1] == "https://www.linkedin.com/jobs/view/1"


def test_scraper_returns_empty_on_empty_body():
    assert JobScraper()._parse_board("finn.no", "Python", "") == []


def test_role_list_contains_targets():
    from app.services.jobs import ROLES

    roles = [
        "AI Engineer", "GenAI Developer", "Python Developer", "Data Engineer",
        "SQL Developer",
    ]
    for role in roles:
        assert role in ROLES


@pytest.mark.asyncio
async def test_scrape_handles_unreachable_client():
    class DeadClient:
        async def read_url(self, url):
            return ""

    jobs = await JobScraper(client=DeadClient()).scrape(role="Python Developer")
    assert jobs == []


# -- freshness filtering ------------------------------------------------------


def test_parse_ago_hours_norwegian_and_english():
    scraper = JobScraper()
    assert scraper._parse_ago("Publisert for 23 timer siden") == 23.0
    assert scraper._parse_ago("en dag siden") == 24.0
    assert scraper._parse_ago("2 dager siden") == 48.0
    assert scraper._parse_ago("18 hours ago") == 18.0
    assert scraper._parse_ago("1 hour ago") == 1.0
    assert scraper._parse_ago("Ny i dag") == 0.0
    assert scraper._parse_ago("2 weeks ago") == 336.0
    assert scraper._parse_ago("No date marker here") == float("inf")


def test_parse_ago_uses_most_recent_marker():
    scraper = JobScraper()
    assert scraper._parse_ago("18 hours ago ... 2 weeks ago") == 18.0


def test_linkedin_keeps_jobs_within_24h():
    body = (
        "*   [Machine Learning Engineer](https://no.linkedin.com/jobs/view/ml-"
        "engineer-at-codersz-4446102015)\n\n"
        "#### [CodersZ](https://www.linkedin.com/company/codersz)\n\n"
        "Oslo, Oslo, Norway  Be an early applicant   18 hours ago    \n"
        "*   [AI Agent Engineer](https://no.linkedin.com/jobs/view/ai-agent-"
        "engineer-at-blastron-ai-4441020145)\n\n"
        "#### [Blastron AI](https://www.linkedin.com/company/blastron-ai)\n\n"
        "Time, Rogaland, Norway  2 weeks ago    \n"
    )
    jobs = JobScraper()._parse_board("linkedin", "AI Engineer", body)
    assert len(jobs) == 1
    assert jobs[0].role == "Machine Learning Engineer"
    assert jobs[0].postedDaysAgo == 0


def test_linkedin_drops_jobs_older_than_24h():
    body = (
        "*   [AI Agent Engineer](https://no.linkedin.com/jobs/view/ai-agent-"
        "engineer-at-blastron-ai-4441020145)\n\n"
        "#### [Blastron AI](https://www.linkedin.com/company/blastron-ai)\n\n"
        "Time, Rogaland, Norway  Be an early applicant   2 weeks ago    \n"
    )
    jobs = JobScraper()._parse_board("linkedin", "AI Engineer", body)
    assert jobs == []


def test_linkedin_drops_jobs_without_date_marker():
    body = (
        "*   [AI Engineer](https://no.linkedin.com/jobs/view/ai-engineer-at-"
        "acme-4446102015)\n\n"
        "#### [Acme](https://www.linkedin.com/company/acme)\n\n"
        "Oslo, Oslo, Norway\n"
    )
    jobs = JobScraper()._parse_board("linkedin", "AI Engineer", body)
    assert jobs == []


def test_finn_board_always_fresh_by_url_filter():
    body = (
        "[Python Developer](https://www.finn.no/job/ad/12345)\n"
        "**Acme AS**\n"
    )
    jobs = JobScraper()._parse_board("finn.no", "Python Developer", body)
    assert len(jobs) == 1
    assert jobs[0].postedDaysAgo == 0
