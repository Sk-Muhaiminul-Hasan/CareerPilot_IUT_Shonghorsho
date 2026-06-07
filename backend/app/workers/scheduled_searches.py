"""Background worker for scheduled job searches."""

from datetime import datetime

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.automation.platforms import platform_registry
from app.db.session import AsyncSessionLocal
from app.models.scheduled_search import ScheduledSearch
from app.schemas.job import JobSearchRequest
from app.services import job_search as job_search_service

logger = structlog.get_logger(__name__)

_WEEKDAY_NEXT: dict[str, int] = {
    "monday": 0,
    "wednesday": 2,
    "friday": 4,
}
_VALID_SCHEDULES = {"daily", "weekly", "monday", "wednesday", "friday"}


def _compute_next_run(schedule: str, from_dt: datetime) -> datetime:
    """Calculate the next run timestamp for a given schedule.

    Args:
        schedule: One of ``daily``, ``weekly``, ``monday``, ``wednesday``, ``friday``.
        from_dt: The reference datetime to compute from.

    Returns:
        A timezone-naive ``datetime`` representing the next scheduled run.

    Raises:
        ValueError: If ``schedule`` is not a recognized value.
    """
    if schedule not in _VALID_SCHEDULES:
        raise ValueError(
            f"Unknown schedule value {schedule!r}. "
            f"Expected one of {sorted(_VALID_SCHEDULES)}."
        )

    hour = from_dt.hour
    minute = from_dt.minute
    if schedule == "daily":
        return from_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if schedule == "weekly":
        return from_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)

    target_weekday = _WEEKDAY_NEXT[schedule]
    days_ahead = (target_weekday - from_dt.weekday()) % 7
    if days_ahead == 0 and from_dt.replace(second=0, microsecond=0) <= datetime.utcnow().replace(
        second=0, microsecond=0
    ):
        days_ahead = 7
    next_dt = from_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
    from datetime import timedelta

    return next_dt + timedelta(days=days_ahead)


async def run_scheduled_searches() -> None:
    """Execute all active scheduled searches whose next_run is due."""
    now = datetime.utcnow()
    logger.info("scheduled_searches.run_started", now=now.isoformat())

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ScheduledSearch).where(
                    ScheduledSearch.is_active.is_(True),
                    ScheduledSearch.next_run <= now,
                )
            )
            due = list(result.scalars().all())

            if not due:
                logger.info("scheduled_searches.none_due")
                return

            for search in due:
                await _run_single_search(db, search, now)
    except Exception as exc:
        logger.exception("scheduled_searches.run_failed", error=str(exc))


async def _run_single_search(db: AsyncSession, search: ScheduledSearch, now: datetime) -> None:
    """Run a single scheduled search and refresh its next run time."""
    try:
        request = JobSearchRequest(
            query=search.query,
            location=search.location or "",
            platforms=search.platforms or ["linkedin"],
            limit=20,
        )

        logger.info(
            "scheduled_searches.search_started",
            scheduled_search_id=search.id,
            query=search.query,
            schedule=search.schedule,
            platforms=request.platforms,
        )

        await job_search_service.search_jobs(db, request, user_id=search.user_id)

        next_run = _compute_next_run(search.schedule, now)

        await db.execute(
            update(ScheduledSearch)
            .where(ScheduledSearch.id == search.id)
            .values(
                last_run=now,
                next_run=next_run,
            )
        )
        await db.commit()

        logger.info(
            "scheduled_searches.search_completed",
            scheduled_search_id=search.id,
            next_run=next_run.isoformat(),
        )
    except Exception as exc:
        await db.rollback()
        logger.exception(
            "scheduled_searches.search_failed",
            scheduled_search_id=search.id,
            error=str(exc),
        )


def setup_scheduler() -> AsyncIOScheduler:
    """Build and start the APScheduler instance."""
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_scheduled_searches,
        trigger="interval",
        hours=1,
        id="scheduled_search_master",
        name="Master scheduled job search sweep",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("scheduled_searches.scheduler_started")
    return scheduler
