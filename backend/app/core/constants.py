"""Central constants shared across the application."""
from enum import StrEnum


class AppEnvironment(StrEnum):
    """Valid runtime environments."""

    DEVELOPMENT = "development"
    PRODUCTION = "production"
    TESTING = "testing"


HEARTBEAT_INTERVAL_SECONDS = 30.0
REMINDER_SWEEP_INTERVAL_SECONDS = 60.0
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200
