"""Tests for the structured JSON logger."""
import json
import logging

from app.utils.logging import JsonFormatter, configure_logging


def test_json_formatter_emits_parseable_line() -> None:
    record = logging.LogRecord("test", logging.INFO, __file__, 1, "hello", None, None)
    record.extra_fields = {"method": "GET"}  # type: ignore[attr-defined]
    line = JsonFormatter().format(record)
    payload = json.loads(line)
    assert payload["level"] == "INFO"
    assert payload["message"] == "hello"
    assert payload["method"] == "GET"


def test_configure_logging_sets_level() -> None:
    configure_logging("WARNING", "json")
    assert logging.getLogger().level == logging.WARNING
