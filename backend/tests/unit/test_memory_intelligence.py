"""Tests for the Memory Intelligence layer (Task 4).

Covers deterministic local embeddings, ranked recall, and consolidation
(dedupe / promote / demote) against an in-memory repository.
"""
from datetime import UTC, datetime, timedelta

import pytest

from app.ai.memory.intelligence import (
    MemoryIntelligence,
    cosine_similarity,
    embed_text,
    keyword_score,
)


class _Entry:
    def __init__(self, id, content, importance=0.5, created_at=None, data=None, embedding=None):
        self.id = id
        self.content = content
        self.importance = importance
        self.created_at = created_at
        self.data = data or {}
        self.embedding = embedding


class _FakeRepo:
    def __init__(self, entries):
        self._entries = list(entries)
        self._next_id = 1000

    async def list(self, *, limit, offset):
        return self._entries[:limit]

    async def get(self, entry_id):
        return next((e for e in self._entries if e.id == entry_id), None)

    async def update(self, entry_id, data):
        entry = next((e for e in self._entries if e.id == entry_id), None)
        if entry is None:
            return None
        for key, value in data.items():
            setattr(entry, key, value)
        return entry

    async def delete(self, entry_id):
        before = len(self._entries)
        self._entries = [e for e in self._entries if e.id != entry_id]
        return len(self._entries) < before

    async def count(self):
        return len(self._entries)


def _entry(id, content, importance=0.5, age_days=0, data=None):
    created = datetime.now(UTC) - timedelta(days=age_days)
    return _Entry(id, content, importance=importance, created_at=created, data=data)


class TestEmbedding:
    def test_embed_is_deterministic(self):
        a = embed_text("remember to buy milk")
        b = embed_text("remember to buy milk")
        assert a == b
        assert len(a) == 64

    def test_embed_is_normalized(self):
        vec = embed_text("any content")
        magnitude = sum(v * v for v in vec) ** 0.5
        assert magnitude == pytest.approx(1.0, abs=1e-4)

    def test_embed_is_local(self):
        vec = embed_text("fully offline deterministic vector")
        assert all(isinstance(v, float) for v in vec)
        assert not any(v for v in vec if v is None)

    def test_cosine_similarity_bounds(self):
        a = embed_text("hello world")
        assert cosine_similarity(a, a) > 0.99
        assert cosine_similarity(a, None) == 0.0
        assert cosine_similarity(None, None) == 0.0


class TestKeywordScore:
    def test_matching_tokens_score_high(self):
        assert keyword_score(["project", "deadline"], "The project deadline is Friday") > 0.9

    def test_no_overlap_scores_zero(self):
        assert keyword_score(["zebra", "quantum"], "The project deadline is Friday") == 0.0

    def test_empty_query_scores_zero(self):
        assert keyword_score([], "anything") == 0.0


class TestRankedRecall:
    @pytest.mark.asyncio
    async def test_relevant_memory_ranks_first(self):
        repo = _FakeRepo([
            _entry("1", "Alice loves hiking in the mountains"),
            _entry("2", "The deploy pipeline runs on Fridays"),
            _entry("3", "meeting notes about the coffee machine"),
        ])
        intelligence = MemoryIntelligence(repo)
        results = await intelligence.recall("hiking mountains", limit=2)
        assert results[0].entry.id == "1"
        assert results[0].score > 0

    @pytest.mark.asyncio
    async def test_importance_breaks_ties(self):
        repo = _FakeRepo([
            _entry("hot", "deploy pipeline Friday", importance=0.9),
            _entry("cold", "deploy pipeline Friday", importance=0.1),
        ])
        intelligence = MemoryIntelligence(repo)
        results = await intelligence.recall("deploy pipeline", limit=2)
        assert results[0].entry.id == "hot"

    @pytest.mark.asyncio
    async def test_recency_boosts_recent_entries(self):
        repo = _FakeRepo([
            _entry("old", "server room temperature is high", age_days=120),
            _entry("new", "server room temperature is high", age_days=1),
        ])
        intelligence = MemoryIntelligence(repo)
        results = await intelligence.recall("server room temperature", limit=2)
        assert results[0].entry.id == "new"

    @pytest.mark.asyncio
    async def test_recall_limit_is_respected(self):
        repo = _FakeRepo([
            _entry(str(i), f"unrelated fact number {i}") for i in range(20)
        ])
        intelligence = MemoryIntelligence(repo)
        results = await intelligence.recall("unrelated fact", limit=3)
        assert len(results) == 3


class TestConsolidation:
    @pytest.mark.asyncio
    async def test_merges_near_duplicates(self):
        repo = _FakeRepo([
            _entry("a", "Remember to buy milk and eggs"),
            _entry("b", "Remember to buy milk and eggs"),
            _entry("c", "The sky is blue"),
        ])
        intelligence = MemoryIntelligence(repo)
        report = await intelligence.consolidate()
        assert report.merged == 1
        assert [e.id for e in repo._entries] == ["a", "c"]

    @pytest.mark.asyncio
    async def test_promotes_hot_memories(self):
        repo = _FakeRepo([
            _entry("hot", "deploy every Friday", importance=0.3, data={"recall_count": 8}),
            _entry("plain", "deploy every Monday", importance=0.3),
        ])
        intelligence = MemoryIntelligence(repo)
        report = await intelligence.consolidate()
        assert report.promoted == 1
        hot = next(e for e in repo._entries if e.id == "hot")
        assert hot.importance > 0.3

    @pytest.mark.asyncio
    async def test_demotes_stale_low_value(self):
        repo = _FakeRepo([
            _entry("stale", "old parking spot number", importance=0.1, age_days=200),
            _entry("keep", "parking spot is important", importance=0.9, age_days=200),
        ])
        intelligence = MemoryIntelligence(repo)
        report = await intelligence.consolidate()
        assert report.demoted == 1
        stale = next(e for e in repo._entries if e.id == "stale")
        assert stale.importance < 0.1

    @pytest.mark.asyncio
    async def test_does_not_demote_hot_stale_memories(self):
        repo = _FakeRepo([
            _entry(
                "hot-stale",
                "legacy auth endpoint behavior",
                importance=0.05,
                age_days=200,
                data={"recall_count": 3},
            ),
        ])
        intelligence = MemoryIntelligence(repo)
        report = await intelligence.consolidate()
        assert report.demoted == 0
