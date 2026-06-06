"""User settings API routes with database persistence."""

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.config.settings import get_settings as get_app_settings
from app.schemas.settings import LLMProviderStatus, SettingsResponse, SettingsUpdate
from app.services.settings_helper import get_or_create_settings

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get(
    "/",
    response_model=SettingsResponse,
    summary="Get current settings",
)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> SettingsResponse:
    """Get the current user settings from the database."""
    settings = await get_or_create_settings(db, user_id)
    return SettingsResponse.model_validate(settings)


@router.put(
    "/",
    response_model=SettingsResponse,
    summary="Update settings",
)
async def update_settings(
    update: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> SettingsResponse:
    """Update user settings. Only provided fields are changed."""
    settings = await get_or_create_settings(db, user_id)

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

    providers_config = [
        ("openai", llm.openai_api_key, "gpt-4o"),
        ("groq", llm.groq_api_key, "llama-3.1-70b-versatile"),
        ("gemini", llm.gemini_api_key, "gemini-pro"),
        ("openrouter", llm.openrouter_api_key, llm.default_model),
        ("github", llm.github_token, "gpt-4o"),
    ]

    return [
        LLMProviderStatus(
            provider=name,
            configured=bool(key.get_secret_value()),
            model=model,
            is_primary=llm.preferred_provider == name,
        )
        for name, key, model in providers_config
    ]
