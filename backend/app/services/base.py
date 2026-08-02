"""Base service pattern: holds repositories, keeps services testable."""
from app.repositories.base import Repository


class Service[R: Repository]:
    """Lightweight base for all domain services."""

    def __init__(self, repository: R) -> None:
        self.repository = repository
