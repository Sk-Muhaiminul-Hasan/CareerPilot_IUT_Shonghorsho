"""Application management service.

Handles creating, listing, approving, and updating job applications.
"""

from datetime import UTC, datetime

import structlog
from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.constants import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    QUEUE_APPLY,
    ApplicationStatus,
)
from app.core.exceptions import RecordNotFoundError
from app.models.application import Application
from app.models.resume import Resume
from app.schemas.application import (
    ApplicationBatchCreate,
    ApplicationCreate,
    ApplicationListResponse,
    ApplicationResponse,
    ApplicationStatusUpdate,
    ApplyModeEnum,
)

logger = structlog.get_logger(__name__)


async def create_application(
    db: AsyncSession,
    data: ApplicationCreate,
    redis: Redis | None = None,
) -> Application:
    """Create a single job application.

    Args:
        db: Async database session.
        data: Application creation data.
        redis: Optional Redis client for enqueuing tasks.

    Returns:
        The newly created Application.
    """
    from app.models.job import Job

    application = Application(
        job_id=data.job_id,
        resume_id=data.resume_id,
        apply_mode=data.apply_mode,
        status=ApplicationStatus.QUEUED
        if data.apply_mode == ApplyModeEnum.AUTONOMOUS
        else ApplicationStatus.PENDING_REVIEW,
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)
    logger.info("application_created", app_id=application.id, job_id=data.job_id)

    if data.apply_mode == ApplyModeEnum.AUTONOMOUS and redis is not None:
        result = await db.execute(
            select(Job).where(Job.id == data.job_id),
        )
        job = result.scalar_one_or_none()
        if job is not None:
            payload = {
                "job_id": data.job_id,
                "application_id": application.id,
                "resume_id": data.resume_id,
                "platform": job.platform,
            }
            from app.services.queue import enqueue

            await enqueue(redis, QUEUE_APPLY, payload)
            logger.info(
                "application_enqueued",
                app_id=application.id,
                job_id=data.job_id,
                platform=job.platform,
            )

    return application


async def create_batch(
    db: AsyncSession,
    data: ApplicationBatchCreate,
    redis: Redis | None = None,
) -> list[Application]:
    """Create multiple applications at once.

    Args:
        db: Async database session.
        data: Batch creation data containing multiple job IDs.
        redis: Optional Redis client for enqueuing tasks (unused for batch).

    Returns:
        List of newly created Applications.
    """
    applications: list[Application] = []
    for job_id in data.job_ids:
        app = Application(
            job_id=job_id,
            resume_id=data.resume_id,
            apply_mode=data.apply_mode,
            status=ApplicationStatus.QUEUED
            if data.apply_mode == ApplyModeEnum.AUTONOMOUS
            else ApplicationStatus.PENDING_REVIEW,
        )
        db.add(app)
        applications.append(app)

    await db.commit()
    for app in applications:
        await db.refresh(app)

    logger.info("batch_applications_created", count=len(applications))
    return applications


async def list_applications(
    db: AsyncSession,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    status: str | None = None,
) -> ApplicationListResponse:
    """List applications with pagination and optional status filter.

    Args:
        db: Async database session.
        page: Page number (1-indexed).
        page_size: Items per page.
        status: Optional status filter.

    Returns:
        Paginated application list response.
    """
    page_size = min(page_size, MAX_PAGE_SIZE)
    offset = (page - 1) * page_size

    query = select(Application)
    count_query = select(func.count(Application.id))

    if status:
        query = query.where(Application.status == status)
        count_query = count_query.where(Application.status == status)

    query = query.order_by(Application.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    apps = list(result.scalars().all())

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    items = [ApplicationResponse.model_validate(a) for a in apps]

    return ApplicationListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=(page * page_size) < total,
    )


async def get_application(db: AsyncSession, app_id: str) -> Application:
    """Get a single application by ID.

    Args:
        db: Async database session.
        app_id: UUID of the application.

    Returns:
        The Application model instance.

    Raises:
        RecordNotFoundError: If application does not exist.
    """
    result = await db.execute(
        select(Application).where(Application.id == app_id),
    )
    app = result.scalar_one_or_none()
    if app is None:
        raise RecordNotFoundError("Application", app_id)
    return app


async def approve_application(
    db: AsyncSession,
    app_id: str,
    redis: Redis | None = None,
) -> Application:
    """Approve a pending application for submission.

    Args:
        db: Async database session.
        app_id: UUID of the application to approve.
        redis: Optional Redis client for enqueuing tasks.

    Returns:
        The updated Application.

    Raises:
        RecordNotFoundError: If application does not exist.
    """
    from app.models.job import Job
    from app.services.queue import enqueue

    app = await get_application(db, app_id)
    if app.status not in (ApplicationStatus.PENDING_REVIEW, ApplicationStatus.QUEUED):
        raise ValueError(
            f"Cannot approve application in '{app.status}' state. "
            "Only pending_review or queued applications can be approved."
        )
    app.status = ApplicationStatus.APPROVED

    if app.resume_id is None:
        result = await db.execute(
            select(Resume)
            .where(Resume.type == "base")
            .order_by(Resume.created_at.desc())
            .limit(1),
        )
        fallback_resume = result.scalar_one_or_none()
        if fallback_resume is not None:
            app.resume_id = fallback_resume.id
            logger.info("resume_fallback_applied", app_id=app_id, resume_id=fallback_resume.id)
        else:
            logger.warning("no_base_resume_found", app_id=app_id)

    await db.commit()
    await db.refresh(app)
    logger.info("application_approved", app_id=app_id)

    if redis is not None:
        result = await db.execute(
            select(Job).where(Job.id == app.job_id),
        )
        job = result.scalar_one_or_none()
        if job is not None:
            payload = {
                "job_id": app.job_id,
                "application_id": app.id,
                "resume_id": app.resume_id,
                "platform": job.platform,
            }
            await enqueue(redis, QUEUE_APPLY, payload)
            logger.info(
                "application_enqueued",
                app_id=app.id,
                job_id=app.job_id,
                platform=job.platform,
            )

    return app


async def update_status(
    db: AsyncSession,
    app_id: str,
    update: ApplicationStatusUpdate,
) -> Application:
    """Update an application's status and optional notes.

    Args:
        db: Async database session.
        app_id: UUID of the application.
        update: Status update payload.

    Returns:
        The updated Application.

    Raises:
        RecordNotFoundError: If application does not exist.
    """
    app = await get_application(db, app_id)
    app.status = update.status
    if update.notes is not None:
        app.notes = update.notes
    if update.status == ApplicationStatus.APPLIED:
        app.applied_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(app)
    logger.info("application_status_updated", app_id=app_id, status=update.status)
    return app
