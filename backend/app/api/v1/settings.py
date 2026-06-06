"""User settings API routes with database persistence."""

import os
import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config.settings import get_settings as get_app_settings
from app.models.user_settings import UserSettings
from app.schemas.settings import LLMProviderStatus, SettingsResponse, SettingsUpdate

logger = structlog.get_logger(__name__)
router = APIRouter()


async def _get_or_create_settings(db: AsyncSession) -> UserSettings:
    """Return the singleton UserSettings row, creating it if absent."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.id == "singleton")
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = UserSettings(id="singleton")
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
        logger.info("settings_created_defaults")
    return settings


@router.get(
    "/",
    response_model=SettingsResponse,
    summary="Get current settings",
)
async def get_settings(
    db: AsyncSession = Depends(get_db),
) -> SettingsResponse:
    """Get the current user settings from the database."""
    settings = await _get_or_create_settings(db)
    return SettingsResponse.model_validate(settings)


@router.put(
    "/",
    response_model=SettingsResponse,
    summary="Update settings",
)
async def update_settings(
    update: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
) -> SettingsResponse:
    """Update user settings. Only provided fields are changed."""
    settings = await _get_or_create_settings(db)

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    await db.commit()
    await db.refresh(settings)

    logger.info("settings_updated", changed_fields=list(update_data.keys()))
    return SettingsResponse.model_validate(settings)


@router.get(
    "/llm-providers",
    response_model=list[LLMProviderStatus],
    summary="List LLM provider statuses",
)
async def list_llm_providers() -> list[LLMProviderStatus]:
    """List configured LLM providers and their real configuration status."""
    settings = get_app_settings()
    llm = settings.llm

    openai_key = (
        llm.openai_api_key.get_secret_value()
        or os.getenv("OPENAI_API_KEY", "")
    )

    providers_config = [
        ("openai", openai_key, "gpt-4o"),
        ("groq", llm.groq_api_key.get_secret_value(), "llama-3.1-70b-versatile"),
        ("gemini", llm.gemini_api_key.get_secret_value(), "gemini-pro"),
        ("openrouter", llm.openrouter_api_key.get_secret_value(), llm.default_model),
        ("github", llm.github_token.get_secret_value(), "gpt-4o"),
    ]

    return [
        LLMProviderStatus(
            provider=name,
            configured=bool(key),
            model=model,
            is_primary=llm.preferred_provider == name,
        )
        for name, key, model in providers_config
    ]
