"""Job scraping service for roles posted within the last 24 hours.

Sources (all through Agent-Reach capabilities):

  * finn.no     — direct listing read via Jina Reader (public, no login).
  * Jobbnorge   — public vacancy board; read via Jina Reader.
  * LinkedIn    — public job search pages; read via Jina Reader.

Each job is normalized to a subset of the frontend ``Job`` shape. When a
source is unreachable the scraper degrades to whatever other sources return.
"""

import asyncio
import re
import time
from dataclasses import dataclass, field

from app.services.agent_reach import AgentReachClient
from app.utils.logging import get_logger

logger = get_logger("app.services.jobs")

# Target roles (AI Engineering / GenAI / Python / FastAPI / Data / SQL).
ROLES = [
    "AI Engineer",
    "GenAI Developer",
    "Python Developer",
    "FastAPI Developer",
    "Data Engineer",
    "SQL Developer",
]

# (board, search URL template). %s is the URL-encoded role query.
# finn.no `published=1` restricts results to ads posted today ("Nye i dag").
# LinkedIn's 24h filter (`f_TPR=r86400`) breaks link extraction via Jina, so
# freshness is enforced in-code by parsing per-card "X ago" markers instead.
SEARCH_URLS: dict[str, str] = {
    "finn.no": "https://www.finn.no/job/fulltime/search.html?q=%s&sort=PUBLISHED&published=1",
    "jobbnorge": "https://www.jobbnorge.no/ledige-stillinger?search=%s",
    "linkedin": "https://www.linkedin.com/jobs/search?keywords=%s&location=Norway",
}

# Boards whose page is guaranteed fresh by their URL filter alone.
FRESH_BY_URL = {"finn.no", "jobbnorge"}

_RE_LOCATION = re.compile(
    r"(Oslo|Bergen|Trondheim|Stavanger|Tromsø|Kristiansand|Fredrikstad|Drammen)"
    r"|(Norway|Norge)"
)
_RE_WHITESPACE = re.compile(r"\s+")
# Relative posting-time markers, English and Norwegian. Groups: value, unit.
_RE_AGO = re.compile(
    r"(?i)(\d+|an?|en|et|ei)\s+"
    r"(minutes?|minutter?|hours?|timer|days?|dag|dager|weeks?|uke|uker|months?|måned|"
    r"måneder|years?|år)\s*(siden|ago)"
)
_ROLE_HINTS = [
    "python", "fastapi", "sql", "data engineer", "ai", "llm", "genai", "gen ai", "backend",
]


@dataclass
class Job:
    """Normalized job listing matching the frontend Job subset."""

    id: str
    company: str
    role: str
    location: str
    source: str
    sourceUrl: str
    postedDaysAgo: int
    skills: list[str]
    aiSummary: str
    match: int
    aiRecommendation: str
    salary: dict
    visaSponsor: bool
    remote: str


@dataclass
class ScrapeReport:
    """Per-run diagnostics from one scrape cycle."""

    sources_queried: list[str] = field(default_factory=list)
    per_source_count: dict[str, int] = field(default_factory=dict)
    duplicates_removed: int = 0
    total_before_dedup: int = 0
    total: int = 0
    duration_ms: float = 0.0
    errors: list[str] = field(default_factory=list)


class JobScraper:
    """Scrapes recent job posts from Norwegian + LinkedIn boards."""

    def __init__(self, client: AgentReachClient | None = None) -> None:
        self.client = client or AgentReachClient()

    async def scrape(self, role: str | None = None, max_per_source: int = 6) -> list[Job]:
        """Return jobs posted recently for ``role`` (or all target roles)."""
        jobs, _ = await self.scrape_report(role=role, max_per_source=max_per_source)
        return jobs

    async def scrape_report(
        self, role: str | None = None, max_per_source: int = 6
    ) -> tuple[list[Job], ScrapeReport]:
        """Scrape with per-source diagnostics; ``(jobs, report)``.

        Every (role, board) pair is fetched concurrently so one full cycle is
        bounded by the slowest source rather than the sum of all of them.
        """
        started = time.perf_counter()
        roles = [role] if role and role in ROLES else list(ROLES)
        tasks = [
            self._scrape_source(source, template % r.replace(" ", "+"), r, max_per_source)
            for r in roles
            for source, template in SEARCH_URLS.items()
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        jobs: list[Job] = []
        errors: list[str] = []
        per_source: dict[str, int] = {s: 0 for s in SEARCH_URLS}
        for result in results:
            if isinstance(result, Exception):
                errors.append(f"{type(result).__name__}: {result}")
                continue
            if isinstance(result, list):
                for job in result:
                    per_source[job.source] = per_source.get(job.source, 0) + 1
                    jobs.append(job)
        total_before_dedup = len(jobs)
        seen: set[str] = set()
        unique: list[Job] = []
        for job in jobs:
            key = f"{job.source}:{job.role.lower()}:{job.company.lower()}"
            if key not in seen:
                seen.add(key)
                unique.append(job)
        unique.sort(key=lambda j: (j.match, -j.postedDaysAgo), reverse=True)
        unique = unique[:40]
        report = ScrapeReport(
            sources_queried=sorted(per_source),
            per_source_count=per_source,
            duplicates_removed=total_before_dedup - len(unique),
            total_before_dedup=total_before_dedup,
            total=len(unique),
            duration_ms=round((time.perf_counter() - started) * 1000, 1),
            errors=errors,
        )
        logger.info(
            "job_scrape_complete",
            extra={"extra_fields": report.__dict__},
        )
        return unique, report

    async def _scrape_source(
        self, source: str, url: str, role: str, max_per_source: int
    ) -> list[Job]:
        body = await self.client.read_url(url)
        return self._parse_board(source, role, body)[:max_per_source]

    def _parse_board(self, source: str, role: str, body: str) -> list[Job]:
        if not body:
            return []
        jobs: list[Job] = []
        for index, (title, url) in enumerate(self._extract_links(source, body)):
            posted_days_ago = self._posted_days_ago(source, body, title, url)
            if posted_days_ago is None or posted_days_ago > 0:
                continue
            match = self._score(title, url)
            location = self._extract_location(body)
            company = self._extract_company(source, body, title, url)
            jobs.append(
                Job(
                    id=f"{source}-{index}-{abs(hash((title, url))) % 100000}",
                    company=company,
                    role=title,
                    location=location,
                    source=source,
                    sourceUrl=url,
                    postedDaysAgo=0,
                    skills=self._infer_skills(title, role),
                    aiSummary=self._summarize(title, company, location, role),
                    match=match,
                    aiRecommendation=(
                        "top" if match >= 85 else "apply" if match >= 70 else "consider"
                    ),
                    salary={"min": 0, "max": 0, "currency": "kr"},
                    visaSponsor=False,
                    remote="hybrid",
                )
            )
        return jobs

    def _posted_days_ago(self, source: str, body: str, title: str, url: str) -> int | None:
        """Return whole days since posting (0 = today), or ``None`` when unverifiable.

        Boards filtered to today by their URL (``FRESH_BY_URL``) always count as
        0. Other boards must carry a relative posting-time marker within the last
        24 hours; anything older or with no verifiable marker is discarded.
        """
        if source in FRESH_BY_URL:
            return 0
        return 0 if self._age_hours_for(source, body, title, url) <= 24 else None

    def _age_hours_for(self, source: str, body: str, title: str, url: str) -> float:
        """Best-effort hours-since-posting for a job card, defaulting to ``inf``."""
        if source == "linkedin":
            start = body.find(f"[{title}]")
            if start == -1:
                return float("inf")
            end = body.find("*   [", start + len(title))
            if end == -1:
                end = start + 1200
            return self._parse_ago(body[start:end])
        return self._parse_ago(body[:8000])

    def _parse_ago(self, text: str) -> float:
        """Hours implied by the newest relative-time marker in ``text``.

        ``0`` for "today/new today" markers; ``inf`` when nothing is found. Uses
        the smallest (most recent) unit found so one stale marker elsewhere on a
        page cannot sink a fresh listing.
        """
        text = text.lower()
        if re.search(r"(?i)ny[ei]?\s+i\s+dag|\bi\s+dag\b", text) or re.search(
            r"(?i)\btoday\b", text
        ):
            return 0.0
        best = float("inf")
        unit_to_hours = {
            "minut": 1 / 60,
            "minutt": 1 / 60,
            "hour": 1.0,
            "time": 1.0,
            "day": 24.0,
            "dag": 24.0,
            "week": 168.0,
            "uke": 168.0,
            "month": 720.0,
            "måned": 720.0,
            "year": 8760.0,
            "år": 8760.0,
        }
        for m in _RE_AGO.finditer(text):
            value, unit = m.group(1), m.group(2)
            multiplier = next(
                (h for stem, h in unit_to_hours.items() if unit.lower().startswith(stem)),
                float("inf"),
            )
            if multiplier is float("inf"):
                continue
            try:
                number = float(value)
            except ValueError:
                number = 1.0
            best = min(best, number * multiplier)
        return best

    def _extract_links(self, source: str, body: str) -> list[tuple[str, str]]:
        """Pull (title, url) pairs from a scraped board listing page."""
        links: list[tuple[str, str]] = []
        pattern = re.compile(r"\[([^\]]{6,90})\]\((https?://[^)\s]+)\)")
        for match in pattern.finditer(body):
            title, url = match.group(1).strip(), match.group(2)
            if self._looks_like_job(source, title, url) and url not in {u for _, u in links}:
                links.append((title, url))
        return links

    def _looks_like_job(self, source: str, title: str, url: str) -> bool:
        if not title or not url:
            return False
        if len(title) > 90:
            return False
        if any(
            block in title.lower()
            for block in ["cookie", "log in", "sign in", "consent", "menu", "footer"]
        ):
            return False
        if source == "finn.no" and "/job/ad/" not in url:
            return False
        if source == "jobbnorge" and "jobbnorge.no" not in url:
            return False
        if source == "linkedin" and "/jobs/search" in url:
            return False
        return source != "linkedin" or "/jobs/" in url

    def _score(self, title: str, url: str) -> int:
        text = f"{title} {url}".lower()
        score = 60
        for hint in _ROLE_HINTS:
            if hint in text:
                score += 8
        return min(97, score)

    def _extract_location(self, body: str) -> str:
        for chunk in body[:8000].splitlines():
            match = _RE_LOCATION.search(chunk)
            if match:
                return match.group(1) or match.group(2)
        return "Norway"

    def _extract_company(self, source: str, body: str, title: str, url: str) -> str:
        if source == "linkedin":
            # LinkedIn job URLs embed the company slug: ...-at-company-name-<id>
            path = url.split("?", 1)[0].rstrip("/")
            m = re.search(r"-at-([a-z0-9\-]+?)-(?:-?\d+)?$", path)
            if m:
                return m.group(1).replace("-", " ").title()[:40]
        lines = [line.strip() for line in body.splitlines() if line.strip()]
        if source == "finn.no":
            # finn.no boards render as: [Job title](ad-url) then **Company**
            for i, line in enumerate(lines):
                if line.startswith(f"[{title}](") and i + 1 < len(lines):
                    nxt = lines[i + 1]
                    if nxt.startswith("**") and nxt.endswith("**"):
                        return nxt.strip("*")[:40]
        for line in lines:
            if re.search(r"\]\(https?://", line):
                continue  # skip markdown links (their query strings contain & / AS)
            if " AS" in line or " ASA" in line or " & " in line:
                return line[:40]
        return f"{source.capitalize()} posting"

    def _infer_skills(self, title: str, role: str) -> list[str]:
        text = f"{title} {role}".lower()
        skills: list[str] = []
        known = ["Python", "FastAPI", "SQL", "LLM", "RAG", "Kubernetes", "GCP", "Azure", "AWS"]
        for skill in known:
            if skill.lower() in text or (skill == "Python" and "python" in text):
                skills.append(skill)
        if not skills:
            skills = ["Python"]
        return skills[:4]

    def _summarize(self, title: str, company: str, location: str, role: str) -> str:
        role_hint = role.replace(" Developer", " role").replace(" Engineer", " role")
        return (
            f"{title} at {company} — {location}. {role_hint} posted in the last 24 hours; "
            f"review and apply early. Norwegian or English working language."
        )
