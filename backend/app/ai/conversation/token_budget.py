"""Token budget management.

Provider-agnostic token estimation (chars/4 heuristic, no model dependency) with
a configurable ceiling. Keeps the assembled context inside the model's context
window while preserving the most recent conversation turns.
"""
from dataclasses import dataclass

from app.ai.providers.base import ChatMessage


def estimate_tokens(text: str) -> int:
    """Rough token count (≈ 4 chars/token for Latin-script text)."""
    if not text:
        return 0
    return max(1, (len(text) + 3) // 4)


@dataclass
class TokenBudget:
    """A trimmed, budget-compliant context."""

    messages: list[ChatMessage]
    estimated_tokens: int
    budget: int
    trimmed: int = 0


class TokenBudgetManager:
    """Enforces a token ceiling on the assembled message list."""

    def __init__(self, budget: int = 6000) -> None:
        self.budget = budget

    def set_budget(self, budget: int) -> None:
        """Raise or lower the ceiling at runtime."""
        if budget > 0:
            self.budget = budget

    def fits(self, messages: list[ChatMessage]) -> bool:
        """True when the list already fits the budget."""
        return sum(estimate_tokens(m.content) for m in messages) <= self.budget

    def trim(
        self,
        messages: list[ChatMessage],
        *,
        keep_system: bool = True,
        reserve: int = 512,
    ) -> TokenBudget:
        """Trim oldest non-system messages until the list fits the budget.

        The system prompt is always preserved. Oldest turns are dropped first,
        newest last, so recent context survives trimming.
        """
        system = [m for m in messages if m.role == "system"] if keep_system else []
        rest = [m for m in messages if m.role != "system"]

        effective = self.budget - reserve - sum(estimate_tokens(m.content) for m in system)
        trimmed = 0
        while rest and sum(estimate_tokens(m.content) for m in rest) > effective:
            rest.pop(0)
            trimmed += 1

        final = system + rest
        return TokenBudget(
            messages=final,
            estimated_tokens=sum(estimate_tokens(m.content) for m in final),
            budget=self.budget,
            trimmed=trimmed,
        )

    def cap_output(self, max_tokens: int | None) -> int | None:
        """Derive a safe output cap from the budget when none is given."""
        if max_tokens is not None:
            return max_tokens
        return max(256, int(self.budget * 0.3))