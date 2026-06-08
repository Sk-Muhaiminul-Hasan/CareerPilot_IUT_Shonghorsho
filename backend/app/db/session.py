"""Async SQLAlchemy engine and session factory."""

import urllib.parse
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config.settings import get_settings

_settings = get_settings()

engine = create_async_engine(
    _settings.database_url,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={"ssl": "require", "prepared_statement_cache_size": 0},
)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

AsyncSessionLocal = async_session_factory


def clean_sync_database_url(raw_url: str) -> str:
    """Safely convert a database URL to a sync-friendly format, stripping unsupported options."""
    cleaned = raw_url.replace("+asyncpg", "+psycopg2").replace("+aiosqlite", "")
    # In some langchain contexts, we want standard psycopg2 syntax
    if cleaned.startswith("postgresql://"):
        cleaned = cleaned.replace("postgresql://", "postgresql+psycopg2://")
    parsed = urllib.parse.urlparse(cleaned)
    query_params = urllib.parse.parse_qs(parsed.query)
    query_params.pop("prepared_statement_cache_size", None)
    new_query = urllib.parse.urlencode(query_params, doseq=True)
    parsed = parsed._replace(query=new_query)
    return urllib.parse.urlunparse(parsed)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session with automatic cleanup.

    Usage as a FastAPI dependency:
        async def my_route(db: AsyncSession = Depends(get_db)): ...
    """
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
