import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.resume import Resume
from app.models.user_settings import UserSettings

logger = structlog.get_logger(__name__)


async def get_or_create_settings(db: AsyncSession, user_id: str) -> UserSettings:
    result = await db.execute(
        select(UserSettings).where(UserSettings.id == user_id),
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        resume_count_q = select(func.count(Resume.id)).where(Resume.user_id == user_id)
        resume_count_result = await db.execute(resume_count_q)
        resume_count = resume_count_result.scalar() or 0

        settings = UserSettings(
            id=user_id,
            onboarding_complete=resume_count > 0,
        )
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
        logger.info(
            "settings_created",
            user_id=user_id,
            onboarding_complete=resume_count > 0,
        )
    return settings
