"""API tests for the DB-backed /intelligence/jobs endpoint."""
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
        skills=["Python"],
        aiSummary="Live role.",
        match=90 + index,
        aiRecommendation="top",
        salary={"min": 900, "max": 1200, "currency": "kr"},
        visaSponsor=False,
        remote="hybrid",
    )


async def test_jobs_empty_seeds_on_demand(client, monkeypatch):
    class FakeScraper:
        async def scrape(self, role=None, max_per_source=6):
            return [_dto(1), _dto(2)]

    monkeypatch.setattr(
        "app.api.v1.routers.intelligence.JobScraper", lambda: FakeScraper()
    )
    resp = await client.get("/api/v1/intelligence/jobs")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    jobs = body["data"]
    assert len(jobs) == 2
    assert {j["company"] for j in jobs} == {"Acme 1", "Acme 2"}
    assert "dedupe_key" not in jobs[0]  # not leaked
    assert "sourceUrl" in jobs[0]
    assert "salary" in jobs[0]


async def test_jobs_fresh_force_rescrape(client, monkeypatch):
    scrapes: list[list[JobDTO]] = [[_dto(1)], [_dto(1), _dto(2)]]
    call_idx = 0

    class FakeScraper:
        async def scrape(self, role=None, max_per_source=6):
            nonlocal call_idx
            jobs = scrapes[min(call_idx, len(scrapes) - 1)]
            call_idx += 1
            return jobs

    monkeypatch.setattr(
        "app.api.v1.routers.intelligence.JobScraper", lambda: FakeScraper()
    )
    await client.get("/api/v1/intelligence/jobs")
    resp = await client.get("/api/v1/intelligence/jobs", params={"fresh": True})
    assert resp.status_code == 200
    jobs = resp.json()["data"]
    assert len(jobs) == 2
    assert {j["company"] for j in jobs} == {"Acme 1", "Acme 2"}


async def test_jobs_respects_limit(client, monkeypatch):
    class FakeScraper:
        async def scrape(self, role=None, max_per_source=6):
            return [_dto(i) for i in range(1, 6)]

    monkeypatch.setattr(
        "app.api.v1.routers.intelligence.JobScraper", lambda: FakeScraper()
    )
    resp = await client.get("/api/v1/intelligence/jobs", params={"limit": 2})
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 2
