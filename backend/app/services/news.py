"""News aggregation service powered by Agent-Reach's RSS capability.

Pulls headline feeds per category using ``feedparser`` (installed by
Agent-Reach). Categories are prioritized so Tech is returned first; worldwide,
sports, finance, trending and latest round out the feed. Every fetch degrades
to an empty list when the network or a feed is unreachable.
"""

import hashlib
import re
from dataclasses import dataclass

import feedparser
import httpx

from app.utils.logging import get_logger

logger = get_logger("app.services.news")

_DEFAULT_TIMEOUT = 15.0

# Category -> prioritized RSS/Atom feed URLs. Tech is first and globally
# scoped (worldwide sources), matching the "Tech top priority, around the
# world" requirement.
CATEGORY_FEEDS: dict[str, list[str]] = {
    "Technology": [
        "https://techcrunch.com/feed/",
        "https://feeds.arstechnica.com/arstechnica/index",
        "https://www.theverge.com/rss/index.xml",
        "https://hnrss.org/frontpage",
    ],
    "World": [
        "https://feeds.bbci.co.uk/news/world/rss.xml",
        "https://www.aljazeera.com/xml/rss/all.xml",
        "https://feeds.npr.org/1001/rss.xml",
    ],
    "Sports": [
        "https://feeds.bbci.co.uk/sport/rss.xml",
        "https://www.espn.com/espn/rss/news",
    ],
    "Finance": [
        "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC,%5EIXIC,%5EDJI",
        "https://www.cnbc.com/id/100003114/device/rss/rss.html",
        "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    ],
    "Trending": [
        "https://hnrss.org/frontpage",
        "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
    ],
    "Latest": [
        "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
        "https://feeds.bbci.co.uk/news/rss.xml",
    ],
}

# Order in which categories are returned when none is requested.
CATEGORY_ORDER = ["Technology", "World", "Sports", "Finance", "Trending", "Latest"]

_RE_CLEAN = re.compile(r"\s+")


@dataclass
class Article:
    """Normalized news item matching the frontend Article shape."""

    id: str
    category: str
    title: str
    summary: str
    source: str
    sourceUrl: str
    time: str
    relevance: int
    tags: list[str]


def _slug(url: str) -> str:
    """Deterministic short id from a feed item URL."""
    return hashlib.md5(url.encode("utf-8")).hexdigest()[:10]


def _relative_time(published_parsed: object) -> str:
    """Render a feed published struct_time as a short relative age."""
    import datetime as dt

    if not published_parsed:
        return "recent"
    try:
        parsed = dt.datetime(*published_parsed[:6], tzinfo=dt.UTC)
        age = dt.datetime.now(dt.UTC) - parsed
        mins = int(age.total_seconds() // 60)
        if mins < 60:
            return f"{mins}m ago"
        hours = int(mins // 60)
        if hours < 24:
            return f"{hours}h ago"
        return f"{int(hours // 24)}d ago"
    except (ValueError, TypeError, OverflowError):
        return "recent"


def _tags(entry: object) -> list[str]:
    tags: list[str] = []
    for tag in getattr(entry, "tags", None) or []:
        term = (getattr(tag, "term", "") or "").strip()
        if term:
            tags.append(term.split("/")[-1][:24])
    if not tags:
        category = getattr(entry, "category", "")
        if category:
            tags.append(category.split("/")[-1][:24])
    return tags[:4]


def _entry_to_article(entry: object, category: str, index: int, feed_title: str) -> Article:
    title = (getattr(entry, "title", "") or "").strip() or "Untitled"
    summary = (getattr(entry, "summary", "") or "").strip()
    summary = _RE_CLEAN.sub(" ", summary)[:260]
    link = getattr(entry, "link", "") or ""
    published_parsed = getattr(entry, "published_parsed", None) or getattr(
        entry, "updated_parsed", None
    )
    relevance = max(60, 96 - index * 2)
    if category == "Technology":
        relevance = min(99, relevance + 3)  # Tech prioritized
    return Article(
        id=f"{category.lower()[:3]}-{_slug(link or title)}",
        category=category,
        title=title,
        summary=summary,
        source=(feed_title or category)[:40],
        sourceUrl=link,
        time=_relative_time(published_parsed),
        relevance=relevance,
        tags=_tags(entry),
    )


class NewsService:
    """Fetches and normalizes headlines from prioritized RSS feeds."""

    def __init__(
        self, client: httpx.AsyncClient | None = None, timeout: float = _DEFAULT_TIMEOUT
    ) -> None:
        self._client = client
        self._timeout = timeout

    async def get_news(self, category: str | None = None, limit: int = 40) -> list[Article]:
        """Return articles for ``category`` (or all categories, Tech first)."""
        requested = [category] if category and category in CATEGORY_FEEDS else list(CATEGORY_ORDER)
        per_feed = max(
            2, min(8, limit // max(1, len(requested) * len(CATEGORY_FEEDS[requested[0]])))
        )
        articles: list[Article] = []
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self._timeout, follow_redirects=True)
        try:
            for cat in requested:
                for url in CATEGORY_FEEDS[cat]:
                    entries = await self._fetch_feed(client, url)
                    for index, entry in enumerate(entries[:per_feed]):
                        feed = getattr(entry, "feed", None)
                        feed_title = (feed.title if feed else "") or ""
                        articles.append(_entry_to_article(entry, cat, index, feed_title))
        finally:
            if owns_client:
                await client.aclose()
        articles.sort(key=lambda a: a.relevance, reverse=True)
        return articles[:limit]

    async def _fetch_feed(self, client: httpx.AsyncClient, url: str) -> list[object]:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                return []
            parsed = feedparser.parse(resp.content)
            return list(parsed.entries)[:12]
        except Exception as exc:  # noqa: BLE001
            logger.warning("news_feed_error", extra={"url": url, "error": type(exc).__name__})
            return []
