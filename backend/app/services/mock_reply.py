"""Deterministic placeholder assistant reply for streaming."""
import re


def _clean_prompt(prompt: str) -> str:
    """Strip consecutive duplicate words and whitespace from prompt."""
    cleaned = re.sub(r"\b(\w+)(?:[^\w\s]*\s+\1\b)+", r"\1", prompt, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", cleaned).strip()


def mock_reply_content(prompt: str) -> str:
    """Return a canned reply keyed on the prompt intent (no AI yet)."""
    clean_p = _clean_prompt(prompt)
    lowered = clean_p.lower()
    if re.search(r"\b(hi|hello|hey)\b", lowered):
        return "Good morning, Sir. All systems are nominal. How can I help?"
    if re.search(r"\b(status|health|how.*doing)\b", lowered):
        return "All systems nominal, Sir. Core systems and response pipelines are optimal."
    return f"Understood, Sir. Processing “{clean_p[:80]}” — response pipeline pending."