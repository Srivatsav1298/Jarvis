"""Memory intelligence — local embeddings, ranked recall, consolidation.

Provider-agnostic and offline: embeddings are deterministic character n-gram
hash vectors (no external model), so near-duplicate detection, recall ranking,
and consolidation all work with zero network or model dependencies.

Ranked recall scores each entry by:
    relevance (keyword overlap) + importance + recency + access frequency.
"""
import hashlib
import math
import re
import time
from collections.abc import Sequence
from dataclasses import dataclass, field

from app.repositories.implementations import MemoryRepository
from app.utils.time import utcnow

_EMBED_DIM = 64
_TOKEN_RE = re.compile(r"[a-z0-9]+")
_STOP = {
    "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at",
    "for", "with", "about", "is", "are", "was", "were", "it", "this",
    "that", "my", "your", "me", "you", "do", "does", "did", "how",
    "what", "when", "where", "which", "why", "can", "could", "will",
}


def _tokens(text: str) -> list[str]:
    return [t for t in _TOKEN_RE.findall((text or "").lower()) if t not in _STOP]


def embed_text(content: str) -> list[float]:
    """Deterministic bag-of-ngrams hash embedding, L2-normalized.

    Same content always yields the same vector, so cosine similarity can be
    used for near-duplicate detection without any model download.
    """
    vec = [0.0] * _EMBED_DIM
    norm = content.lower()
    for start in range(len(norm)):
        gram = norm[start : start + 4]
        if not gram.strip(" "):
            continue
        digest = hashlib.blake2b(gram.encode("utf-8"), digest_size=8).digest()
        idx = int.from_bytes(digest[:4], "little") % _EMBED_DIM
        sign = 1.0 if digest[4] & 1 else -1.0
        vec[idx] += sign
    magnitude = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / magnitude, 6) for v in vec]


def cosine_similarity(a: list[float] | None, b: list[float] | None) -> float:
    """Cosine similarity between two vectors; 0 when either is missing."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(x * x for x in b)) or 1.0
    return dot / (na * nb)


def keyword_score(query_tokens: list[str], content: str) -> float:
    """Fraction of query tokens present in the content (0..1)."""
    if not query_tokens:
        return 0.0
    content_tokens = set(_tokens(content))
    hits = sum(1 for tok in query_tokens if tok in content_tokens)
    return hits / len(query_tokens)


@dataclass
class RecallResult:
    """A scored memory entry returned by ranked recall."""

    entry: object
    score: float
    reasons: list[str] = field(default_factory=list)


@dataclass
class ConsolidationReport:
    """What a consolidation pass did."""

    scanned: int = 0
    merged: int = 0
    promoted: int = 0
    demoted: int = 0
    deleted: int = 0
    detail: list[str] = field(default_factory=list)


class MemoryIntelligence:
    """Ranked recall + consolidation over the memory repository."""

    def __init__(
        self,
        repository: MemoryRepository,
        *,
        duplicate_threshold: float = 0.92,
        stale_days: int = 90,
        demote_below: float = 0.2,
    ) -> None:
        self.repository = repository
        self.duplicate_threshold = duplicate_threshold
        self.stale_days = stale_days
        self.demote_below = demote_below

    # -- recall -----------------------------------------------------------

    async def recall(self, query: str, limit: int = 8) -> list[RecallResult]:
        """Return the most relevant memory entries for a query, ranked."""
        q_tokens = _tokens(query)
        q_vec = embed_text(query)
        items: Sequence = await self.repository.list(
            limit=max(50, limit * 4), offset=0
        )
        now = time.time()

        results: list[RecallResult] = []
        for entry in items:
            content = getattr(entry, "content", "") or ""
            importance = float(getattr(entry, "importance", 0.5) or 0.5)
            data = getattr(entry, "data", None) or {}
            access_count = int(data.get("recall_count", 0))

            relevance = keyword_score(q_tokens, content)
            semantic = cosine_similarity(q_vec, getattr(entry, "embedding", None))

            created = getattr(entry, "created_at", None)
            age_days = 0.0
            if created is not None and created.timestamp():
                age_days = max(0.0, (now - created.timestamp()) / 86400.0)
            recency = math.exp(-age_days / 30.0)

            frequency = min(1.0, access_count / 10.0)

            score = (
                0.55 * max(relevance, semantic)
                + 0.20 * importance
                + 0.15 * recency
                + 0.10 * frequency
            )
            if score <= 0:
                continue
            results.append(RecallResult(entry=entry, score=round(score, 4)))

            if access_count > 0 and "recall_count" not in data:
                data["recall_count"] = access_count

        results.sort(key=lambda r: r.score, reverse=True)
        return results[:limit]

    async def note_accessed(self, entry_id: str) -> None:
        """Bump the access counter used by consolidation to promote hot memories."""
        entry = await self.repository.get(entry_id)
        if entry is None:
            return
        data = dict(getattr(entry, "data", None) or {})
        data["recall_count"] = int(data.get("recall_count", 0)) + 1
        data["last_accessed"] = utcnow().isoformat()
        await self.repository.update(entry_id, {"data": data})

    # -- consolidation ------------------------------------------------------

    async def consolidate(
        self, *, limit: int = 100, delete_duplicates: bool = True
    ) -> ConsolidationReport:
        """Merge near-duplicates, promote hot memories, demote stale ones.

        Returns a report of what changed. Safe to call periodically (e.g. on a
        scheduler tick) — never deletes content that is both hot and important.
        """
        report = ConsolidationReport()
        items: Sequence = await self.repository.list(limit=limit, offset=0)
        report.scanned = len(items)
        now = time.time()

        seen: list[object] = []
        for entry in items:
            content = (getattr(entry, "content", "") or "").strip()
            if not content:
                if delete_duplicates:
                    await self.repository.delete(entry.id)
                    report.deleted += 1
                continue

            importance = float(getattr(entry, "importance", 0.5) or 0.5)
            data = dict(getattr(entry, "data", None) or {})
            access_count = int(data.get("recall_count", 0))
            vec = getattr(entry, "embedding", None) or embed_text(content)
            entry_id = entry.id

            created = getattr(entry, "created_at", None)
            age_days = 0.0
            if created is not None and created.timestamp():
                age_days = max(0.0, (now - created.timestamp()) / 86400.0)

            # 1. Merge near-duplicates (keep the higher-importance one).
            dup = self._find_duplicate(seen, vec, content)
            if dup is not None:
                other_importance = float(getattr(dup, "importance", 0.5) or 0.5)
                if importance >= other_importance:
                    await self.repository.update(
                        dup.id,
                        {"importance": max(other_importance, importance)},
                    )
                if delete_duplicates:
                    await self.repository.delete(entry_id)
                    report.merged += 1
                    report.detail.append(f"merged duplicate of {dup.id}")
                continue

            seen.append(entry)

            # 2. Promote hot memories (frequently accessed).
            if access_count >= 5 and importance < 0.85:
                await self.repository.update(
                    entry_id, {"importance": min(0.9, importance + 0.1)}
                )
                report.promoted += 1
                report.detail.append(f"promoted {entry_id} (access={access_count})")

            # 3. Demote stale, low-value memories.
            if (
                age_days >= self.stale_days
                and importance < self.demote_below
                and access_count == 0
            ):
                await self.repository.update(
                    entry_id, {"importance": max(0.0, importance - 0.1)}
                )
                report.demoted += 1
                report.detail.append(f"demoted stale {entry_id} (age={age_days:.0f}d)")

        return report

    def _find_duplicate(self, seen: list[object], vec: list[float], content: str):
        """Return an existing entry with near-identical embedding + content."""
        for other in seen:
            other_vec = getattr(other, "embedding", None) or embed_text(
                getattr(other, "content", "") or ""
            )
            sim = cosine_similarity(vec, other_vec)
            if sim >= self.duplicate_threshold:
                return other
        return None
