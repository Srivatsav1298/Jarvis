"""Memory endpoints — placeholder CRUD for assistant memory."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db_session
from app.exceptions import NotFoundError
from app.memory.manager import MemoryManager
from app.repositories.implementations import MemoryRepository
from app.schemas.common import ListResponse
from app.schemas.memory import MemoryEntryCreate, MemoryEntryRead, MemoryEntryUpdate

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("/entries", response_model=ListResponse[MemoryEntryRead])
async def list_memory_entries(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
) -> ListResponse[MemoryEntryRead]:
    """Return a page of memory entries."""
    manager = MemoryManager(MemoryRepository(session))
    items, total = await manager.list(limit=limit, offset=offset)
    return ListResponse(items=items, total=total)


@router.post("/entries", response_model=MemoryEntryRead, status_code=201)
async def create_memory_entry(
    payload: MemoryEntryCreate,
    session: AsyncSession = Depends(get_db_session),
):
    """Create a memory entry."""
    manager = MemoryManager(MemoryRepository(session))
    return await manager.create(payload)


@router.get("/entries/{entry_id}", response_model=MemoryEntryRead)
async def get_memory_entry(
    entry_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    """Fetch a single memory entry."""
    manager = MemoryManager(MemoryRepository(session))
    entry = await manager.get(entry_id)
    if entry is None:
        raise NotFoundError("Memory entry not found")
    return entry


@router.patch("/entries/{entry_id}", response_model=MemoryEntryRead)
async def update_memory_entry(
    entry_id: str,
    payload: MemoryEntryUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    """Update a memory entry."""
    manager = MemoryManager(MemoryRepository(session))
    entry = await manager.update(entry_id, payload)
    if entry is None:
        raise NotFoundError("Memory entry not found")
    return entry


@router.delete("/entries/{entry_id}", status_code=204)
async def delete_memory_entry(
    entry_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a memory entry."""
    manager = MemoryManager(MemoryRepository(session))
    deleted = await manager.delete(entry_id)
    if not deleted:
        raise NotFoundError("Memory entry not found")
