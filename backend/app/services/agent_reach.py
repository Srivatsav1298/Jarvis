"""Client for Agent-Reach capabilities (Jina Reader + Exa search via mcporter).

Agent-Reach is a capability layer that installs and health-checks upstream
tools. This service shells out to two of them:

  * Jina Reader  — ``https://r.jina.ai/<url>`` renders any web page as clean
    Markdown (zero-config, no key).
  * Exa search   — semantic web search routed through ``mcporter`` so no API
    key has to be stored in this repository.

Both degrade gracefully to deterministic empty results when the upstream
tool or network is unavailable, matching the project's offline-fallback
convention.
"""

import asyncio
import json
import shutil
import subprocess
from dataclasses import dataclass

import httpx

from app.utils.logging import get_logger

logger = get_logger("app.services.agent_reach")

_JINA_READER_URL = "https://r.jina.ai/"
_DEFAULT_TIMEOUT = 20.0


@dataclass
class SearchResult:
    """A single web-search hit normalized across backends."""

    title: str
    url: str
    snippet: str
    published: str | None = None


class AgentReachClient:
    """Thin async wrapper around Agent-Reach's installed upstream tools."""

    def __init__(
        self,
        mcporter: str | None = None,
        jina_base_url: str = _JINA_READER_URL,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self._mcporter = mcporter or shutil.which("mcporter")
        self._jina_base_url = jina_base_url.rstrip("/") + "/"
        self._timeout = timeout

    # -- Web page reading (Jina Reader) -----------------------------------

    async def read_url(self, url: str, max_chars: int = 6000) -> str:
        """Render ``url`` as clean Markdown text via Jina Reader."""
        if not url or not url.startswith(("http://", "https://")):
            return ""
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(f"{self._jina_base_url}{url}")
                if resp.status_code != 200:
                    logger.warning("jina_read_http", extra={"url": url, "status": resp.status_code})
                    return ""
                return resp.text[:max_chars]
        except Exception as exc:  # noqa: BLE001
            logger.warning("jina_read_error", extra={"url": url, "error": type(exc).__name__})
            return ""

    # -- Semantic web search (Exa via mcporter) ---------------------------

    async def web_search(self, query: str, num_results: int = 5) -> list[SearchResult]:
        """Search the web semantically through Exa (routed by mcporter)."""
        if not query:
            return []
        if not self._mcporter:
            logger.warning("mcporter_missing")
            return []
        try:
            proc = await asyncio.create_subprocess_exec(
                self._mcporter,
                "call",
                "exa.web_search_exa",
                f"query={query}",
                f"numResults={num_results}",
                "--output",
                "json",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=self._timeout + 10)
            if proc.returncode != 0:
                logger.warning("mcporter_exit", extra={"code": proc.returncode})
                return []
            return self._parse_mcporter_json(stdout.decode("utf-8", errors="replace"))
        except (TimeoutError, subprocess.SubprocessError, OSError) as exc:
            logger.warning("mcporter_error", extra={"error": type(exc).__name__})
            return []

    def _parse_mcporter_json(self, raw: str) -> list[SearchResult]:
        """Parse ``mcporter --output json`` into normalized SearchResults."""
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("mcporter_json_parse_error")
            return []
        text = ""
        for block in payload.get("content", []):
            if block.get("type") == "text":
                text = block.get("text", "")
                break
        if not text:
            return []
        results: list[SearchResult] = []
        for chunk in text.split("\n\n---\n\n"):
            title = url = published = None
            snippet_lines: list[str] = []
            for line in chunk.splitlines():
                if line.startswith("Title: "):
                    title = line[7:].strip()
                elif line.startswith("URL: "):
                    url = line[5:].strip()
                elif line.startswith("Published: "):
                    published = line[11:].strip()
                elif line.startswith("Highlights:"):
                    continue
                elif title and url and line.strip():
                    snippet_lines.append(line.strip())
            if title and url:
                results.append(
                    SearchResult(
                        title=title,
                        url=url,
                        snippet=" ".join(snippet_lines)[:400],
                        published=published,
                    )
                )
        return results
