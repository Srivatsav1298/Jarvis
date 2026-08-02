"""Project service — CRUD over tracked projects."""
from typing import Any

from app.repositories.implementations import ProjectRepository
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectService:
    """Manages projects tracked by the assistant."""

    def __init__(self, repository: ProjectRepository) -> None:
        self.repository = repository

    async def list(self, *, limit: int, offset: int) -> tuple[list[Any], int]:
        items = await self.repository.list(limit=limit, offset=offset)
        total = await self.repository.count()
        return list(items), total

    async def create(self, payload: ProjectCreate) -> Any:
        return await self.repository.create(payload.model_dump(exclude_none=True))

    async def get(self, project_id: str) -> Any:
        return await self.repository.get(project_id)

    async def update(self, project_id: str, payload: ProjectUpdate) -> Any:
        return await self.repository.update(project_id, payload.model_dump(exclude_none=True))

    async def delete(self, project_id: str) -> bool:
        return await self.repository.delete(project_id)
