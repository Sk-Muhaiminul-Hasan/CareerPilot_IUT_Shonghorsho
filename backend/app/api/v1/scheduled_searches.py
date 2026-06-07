"""Scheduled job search API routes."""

from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.scheduled_search import ScheduledSearch
from app.schemas.job import JobSearchRequest
from app.schemas.scheduled_search import (
    ScheduledSearchCreate,
    ScheduledSearchResponse,
    ScheduledSearchUpdate,
)
from app.services import job_search as job_search_service

logger = structlog.get_logger(__name__)
router = APIRouter()
SCHEDULE_VALUES = {"daily", "weekly", "monday", "wednesday", "friday"}


@router.get(
    "/",
    response_model=list[ScheduledSearchResponse],
    summary="List scheduled job searches",
)
async def list_scheduled_searches(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> list[ScheduledSearchResponse]:
    """Return all scheduled searches for the current user."""
    result = await db.execute(
        select(ScheduledSearch).where(ScheduledSearch.user_id == user_id)
    )
    schedules = list(result.scalars().all())
    return [ScheduledSearchResponse.model_validate(s) for s in schedules]


@router.post(
    "/",
    response_model=ScheduledSearchResponse,
    status_code=201,
    summary="Create a scheduled job search",
)
async def create_scheduled_search(
    data: ScheduledSearchCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ScheduledSearchResponse:
    """Create a new scheduled search that starts running immediately."""
    now = datetime.utcnow()
    schedule: str = data.schedule
    if schedule not in SCHEDULE_VALUES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid schedule value: {schedule}. Must be one of {sorted(SCHEDULE_VALUES)}",
        )

    search = ScheduledSearch(
        user_id=user_id,
        query=data.query,
        location=data.location,
        platforms=data.platforms,
        schedule=schedule,
        is_active=True,
        next_run=now,
    )
    db.add(search)
    try:
        await db.commit()
        await db.refresh(search)
    except IntegrityError as exc:
        await db.rollback()
        logger.exception("scheduled_search.create_failed", error=str(exc))
        raise HTTPException(status_code=400, detail="Failed to create scheduled search.") from exc

    logger.info(
        "scheduled_search.created",
        scheduled_search_id=search.id,
        schedule=schedule,
        query=data.query,
    )
    return ScheduledSearchResponse.model_validate(search)


@router.patch(
    "/{search_id}",
    response_model=ScheduledSearchResponse,
    summary="Update a scheduled job search",
)
async def update_scheduled_search(
    search_id: str,
    data: ScheduledSearchUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ScheduledSearchResponse:
    """Partial update for a scheduled search, including toggle of is_active."""
    result = await db.execute(
        select(ScheduledSearch).where(
            ScheduledSearch.id == search_id,
            ScheduledSearch.user_id == user_id,
        )
    )
    search = result.scalar_one_or_none()
    if search is None:
        raise HTTPException(status_code=404, detail="Scheduled search not found.")

    update_data = data.model_dump(exclude_unset=True)

    if "schedule" in update_data:
        schedule = update_data["schedule"]
        if schedule not in SCHEDULE_VALUES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid schedule value: {schedule}. Must be one of {sorted(SCHEDULE_VALUES)}",
            )

    for key, value in update_data.items():
        setattr(search, key, value)

    try:
        await db.commit()
        await db.refresh(search)
    except IntegrityError as exc:
        await db.rollback()
        logger.exception("scheduled_search.update_failed", error=str(exc))
        raise HTTPException(status_code=400, detail="Failed to update scheduled search.") from exc

    logger.info(
        "scheduled_search.updated",
        scheduled_search_id=search.id,
        changes=list(update_data.keys()),
    )
    return ScheduledSearchResponse.model_validate(search)


@router.delete(
    "/{search_id}",
    status_code=204,
    summary="Delete a scheduled job search",
)
async def delete_scheduled_search(
    search_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> None:
    """Delete a scheduled search by ID."""
    result = await db.execute(
        select(ScheduledSearch).where(
            ScheduledSearch.id == search_id,
            ScheduledSearch.user_id == user_id,
        )
    )
    search = result.scalar_one_or_none()
    if search is None:
        raise HTTPException(status_code=404, detail="Scheduled search not found.")

    await db.delete(search)
    await db.commit()

    logger.info(
        "scheduled_search.deleted",
        scheduled_search_id=search_id,
    )
