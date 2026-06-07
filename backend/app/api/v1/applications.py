"""Application tracking API routes."""

import io

import httpx
import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, get_redis
from app.config.constants import DEFAULT_PAGE_SIZE
from app.core.llm.client import LLMNotConfiguredError
from app.core.scoring_pipeline import run_scoring_pipeline
from app.core.storage import storage as storage_client
from app.schemas.application import (
    ApplicationBatchCreate,
    ApplicationCreate,
    ApplicationListResponse,
    ApplicationResponse,
    ApplicationStatusUpdate,
)
from app.services import application as app_service

MIME_PDF = "application/pdf"
MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post(
    "/",
    response_model=ApplicationResponse,
    status_code=201,
    summary="Create an application",
)
async def create_application(
    data: ApplicationCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    redis: Redis | None = Depends(get_redis),
    user_id: str = Depends(get_current_user),
) -> ApplicationResponse:
    """Create a single job application."""
    app = await app_service.create_application(db, data, redis, user_id=user_id)
    response = ApplicationResponse.model_validate(app)
    background_tasks.add_task(run_scoring_pipeline, app.id, user_id)
    logger.info("scoring_pipeline.enqueued", app_id=app.id)
    return response


@router.post(
    "/batch",
    response_model=list[ApplicationResponse],
    status_code=201,
    summary="Batch create applications",
)
async def batch_create(
    data: ApplicationBatchCreate,
    db: AsyncSession = Depends(get_db),
    redis: Redis | None = Depends(get_redis),
    user_id: str = Depends(get_current_user),
) -> list[ApplicationResponse]:
    """Create multiple job applications at once."""
    apps = await app_service.create_batch(db, data, redis, user_id=user_id)
    return [ApplicationResponse.model_validate(a) for a in apps]


@router.get(
    "/",
    response_model=ApplicationListResponse,
    summary="List applications",
)
async def list_applications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=100),
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ApplicationListResponse:
    """List applications with pagination and optional status filter."""
    return await app_service.list_applications(db, page, page_size, status, user_id)


@router.get(
    "/{app_id}",
    response_model=ApplicationResponse,
    summary="Get a single application",
)
async def get_application(
    app_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ApplicationResponse:
    """Get a single application by ID. Returns 404 if not found."""
    app = await app_service.get_application(db, app_id, user_id)
    return ApplicationResponse.model_validate(app)


@router.put(
    "/{app_id}/approve",
    response_model=ApplicationResponse,
    summary="Approve a pending application",
)
async def approve_application(
    app_id: str,
    db: AsyncSession = Depends(get_db),
    redis: Redis | None = Depends(get_redis),
    user_id: str = Depends(get_current_user),
) -> ApplicationResponse:
    """Approve a pending application for automated submission."""
    app = await app_service.approve_application(db, app_id, redis, user_id)
    return ApplicationResponse.model_validate(app)


@router.put(
    "/{app_id}/status",
    response_model=ApplicationResponse,
    summary="Update application status",
)
async def update_status(
    app_id: str,
    update: ApplicationStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ApplicationResponse:
    app = await app_service.update_status(db, app_id, update, user_id)
    return ApplicationResponse.model_validate(app)


@router.post(
    "/{app_id}/cover-letter",
    response_model=ApplicationResponse,
    summary="Generate cover letter for an application",
)
async def generate_cover_letter(
    app_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ApplicationResponse:
    try:
        app = await app_service.generate_cover_letter(db, app_id, user_id)
    except LLMNotConfiguredError:
        raise HTTPException(
            status_code=428,
            detail={"message": "AI not configured", "code": "ai_not_configured"},
        ) from None
    return ApplicationResponse.model_validate(app)


@router.get(
    "/{app_id}/cover-letter/download",
    summary="Download generated cover letter",
)
async def download_cover_letter(
    app_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> StreamingResponse:
    app = await app_service.get_application(db, app_id, user_id)
    if not app.cover_letter_path:
        raise HTTPException(
            status_code=404,
            detail="Cover letter not found. Generate one first.",
        )

    bucket = "generated"
    signed_url = await storage_client.get_signed_url(bucket, app.cover_letter_path)

    async with httpx.AsyncClient() as client:
        file_response = await client.get(signed_url)
        file_response.raise_for_status()
        file_bytes = file_response.content

    media_type = MIME_PDF if app.cover_letter_path.endswith(".pdf") else MIME_DOCX
    filename = app.cover_letter_path.split("/")[-1]

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename!r}"},
    )
