import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_settings import UserSettings

logger = structlog.get_logger(__name__)


async def get_or_create_settings(db: AsyncSession, user_id: str) -> UserSettings:
    result = await db.execute(
        select(UserSettings).where(UserSettings.id == user_id),
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = UserSettings(id=user_id, onboarding_complete=False)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
        logger.info("settings_created", user_id=user_id)
    return settings
