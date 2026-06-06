"""Shared FastAPI dependencies for route injection."""

from collections.abc import AsyncGenerator

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.db.redis import get_redis as _get_redis
from app.db.session import get_db as _get_db

__all__ = ["get_current_user", "get_db", "get_redis"]



async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Database session dependency."""
    async for session in _get_db():
        yield session


def get_redis() -> Redis | None:
    """Redis client dependency. Returns None if Redis unavailable."""
    return _get_redis()
