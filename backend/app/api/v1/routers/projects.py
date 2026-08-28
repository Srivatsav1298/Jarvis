"""Project endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.envelope import ok
from app.dependencies.database import get_db_session
from app.exceptions import NotFoundError
from app.repositories.implementations import ProjectRepository
from app.schemas.common import ListResponse
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.projects import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
async def list_projects(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Return a page of projects."""
    service = ProjectService(ProjectRepository(session))
    items, total = await service.list(limit=limit, offset=offset)
    reads = [ProjectRead.model_validate(i) for i in items]
    return ok(ListResponse(items=reads, total=total))


@router.post("", status_code=201)
async def create_project(
    payload: ProjectCreate,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Create a project."""
    service = ProjectService(ProjectRepository(session))
    return ok(ProjectRead.model_validate(await service.create(payload)))


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Fetch a single project."""
    service = ProjectService(ProjectRepository(session))
    project = await service.get(project_id)
    if project is None:
        raise NotFoundError("Project not found")
    return ok(ProjectRead.model_validate(project))


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Update a project."""
    service = ProjectService(ProjectRepository(session))
    project = await service.update(project_id, payload)
    if project is None:
        raise NotFoundError("Project not found")
    return ok(ProjectRead.model_validate(project))


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a project."""
    service = ProjectService(ProjectRepository(session))
    if not await service.delete(project_id):
        raise NotFoundError("Project not found")