"""Generic repository interface and its SQLAlchemy implementation."""
from abc import ABC, abstractmethod
from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.base import Base


class Repository[T: Base](ABC):
    """Interface for data access for a single aggregate."""

    @abstractmethod
    async def get(self, entity_id: str) -> T | None: ...

    @abstractmethod
    async def list(self, *, limit: int, offset: int) -> Sequence[T]: ...

    @abstractmethod
    async def count(self) -> int: ...

    @abstractmethod
    async def create(self, data: dict[str, Any]) -> T: ...

    @abstractmethod
    async def update(self, entity_id: str, data: dict[str, Any]) -> T | None: ...

    @abstractmethod
    async def delete(self, entity_id: str) -> bool: ...


class SQLAlchemyRepository[T](Repository[T]):
    """Default repository implementation backed by an async session."""

    model: type[T]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, entity_id: str) -> T | None:
        return await self.session.get(self.model, entity_id)

    async def list(self, *, limit: int, offset: int) -> Sequence[T]:
        result = await self.session.execute(
            select(self.model)
            .order_by(self.model.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    async def count(self) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(self.model)
        )
        return int(result.scalar_one())

    async def create(self, data: dict[str, Any]) -> T:
        instance = self.model(**data)
        self.session.add(instance)
        await self.session.commit()
        await self.session.refresh(instance)
        return instance

    async def update(self, entity_id: str, data: dict[str, Any]) -> T | None:
        instance = await self.get(entity_id)
        if instance is None:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(instance, key, value)
        await self.session.commit()
        await self.session.refresh(instance)
        return instance

    async def delete(self, entity_id: str) -> bool:
        instance = await self.get(entity_id)
        if instance is None:
            return False
        await self.session.delete(instance)
        await self.session.commit()
        return True
