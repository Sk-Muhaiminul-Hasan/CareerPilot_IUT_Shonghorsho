"""Onboarding tracking API routes."""

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.resume import Resume
from app.schemas.settings import SettingsResponse
from app.services.settings_helper import get_or_create_settings

logger = structlog.get_logger(__name__)
router = APIRouter()


class OnboardingStatusResponse(BaseModel):
    """Current user onboarding status."""

    onboarding_complete: bool = False
    has_general_ai: bool = False
    has_extraction_ai: bool = False
    has_resume: bool = False


@router.get(
    "/status",
    response_model=OnboardingStatusResponse,
    summary="Get onboarding status",
)
async def get_onboarding_status(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> OnboardingStatusResponse:
    """Return whether the user has completed onboarding, configured AI, or uploaded a resume."""
    settings = await get_or_create_settings(db, user_id)

    resume_count_q = select(func.count(Resume.id)).where(Resume.user_id == user_id)
    result = await db.execute(resume_count_q)
    resume_count = result.scalar() or 0

    onboarding_complete = bool(settings.onboarding_complete)
    has_general_ai = bool(settings.general_api_key)
    has_extraction_ai = bool(settings.extraction_api_key)
    has_resume = resume_count > 0

    return OnboardingStatusResponse(
        onboarding_complete=onboarding_complete,
        has_general_ai=has_general_ai,
        has_extraction_ai=has_extraction_ai,
        has_resume=has_resume,
    )


@router.post(
    "/complete",
    response_model=SettingsResponse,
    summary="Mark onboarding as complete",
)
async def complete_onboarding(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> SettingsResponse:
    """Mark the user's onboarding as complete and return current settings."""
    settings = await get_or_create_settings(db, user_id)
    settings.onboarding_complete = True
    await db.commit()
    await db.refresh(settings)
    logger.info("onboarding_complete", user_id=user_id)
    return SettingsResponse.model_validate(settings)
