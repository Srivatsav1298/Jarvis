"""SessionManager — tracks per-session state for the conversation engine.

A "session" is the runtime state for one conversation: the conversation_id,
recent message turns, and mutable per-turn state. Sessions are ephemeral
(in-memory); persistence stays with the repositories.
"""
import time
from dataclasses import dataclass, field


@dataclass
class Session:
    """Runtime state for one active conversation."""

    conversation_id: str
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    pending_tool_results: list[dict] = field(default_factory=list)

    def touch(self) -> None:
        """Mark the session as active now."""
        self.last_activity = time.time()


class SessionManager:
    """Owns active sessions with a TTL-based sweep."""

    def __init__(self, ttl_seconds: float = 3600.0) -> None:
        self._sessions: dict[str, Session] = {}
        self.ttl_seconds = ttl_seconds

    def get_or_create(self, conversation_id: str) -> Session:
        """Return the session for a conversation, creating it on first use."""
        if conversation_id not in self._sessions:
            self._sessions[conversation_id] = Session(conversation_id)
        return self._sessions[conversation_id]

    def get(self, conversation_id: str) -> Session | None:
        return self._sessions.get(conversation_id)

    def touch(self, conversation_id: str) -> None:
        session = self._sessions.get(conversation_id)
        if session:
            session.touch()

    def end(self, conversation_id: str) -> None:
        """Drop a session (conversation deleted or explicitly ended)."""
        self._sessions.pop(conversation_id, None)

    def sweep(self) -> int:
        """Evict sessions idle past the TTL. Returns count removed."""
        now = time.time()
        stale = [
            cid
            for cid, s in self._sessions.items()
            if now - s.last_activity > self.ttl_seconds
        ]
        for cid in stale:
            del self._sessions[cid]
        return len(stale)

    def active_count(self) -> int:
        return len(self._sessions)