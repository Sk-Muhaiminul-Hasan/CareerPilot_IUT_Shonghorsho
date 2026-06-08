"""Career goal service — all operations now async SQLAlchemy DB queries."""

import asyncio
from datetime import UTC, datetime

import structlog
from sqlalchemy import select

from app.core.exceptions import RecordNotFoundError
from app.db.session import AsyncSessionLocal
from app.models.goal import Goal
from app.schemas.goal import (
    GoalCreate,
    GoalListResponse,
    GoalProgressUpdate,
    GoalResponse,
    GoalUpdate,
)

logger = structlog.get_logger(__name__)


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _compute_progress(current: int, target: int) -> float:
    if target <= 0:
        return 0.0
    return min(round((current / target) * 100, 2), 100.0)


async def _create_calendar_deadline(
    goal_id: str,
    title: str,
    due_date: datetime,
    user_id: str,
) -> None:
    try:
        from app.schemas.calendar_event import CalendarEventCreate, EventTypeEnum
        from app.services.calendar_event import create_event
        await create_event(
            CalendarEventCreate(
                title=f"Goal deadline: {title}",
                event_date=due_date,
                event_type=EventTypeEnum.DEADLINE,
            ),
        )
    except Exception as exc:
        logger.warning(
            "goal.calendar_deadline_failed",
            goal_id=goal_id,
            error=str(exc),
        )


async def create_goal(data: GoalCreate, user_id: str = "") -> GoalResponse:
    async with AsyncSessionLocal() as db, db.begin():
        progress = _compute_progress(0, data.target_value)
        record = Goal(
            title=data.title,
            description=data.description,
            category=data.category.value,
            target_value=data.target_value,
            current_value=0,
            progress_percent=progress,
            color_variant=data.color_variant.value,
            due_label=data.due_label,
            due_date=data.due_date,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)

    if data.due_date and user_id:
        _task = asyncio.create_task(  # noqa: RUF006
            _create_calendar_deadline(
                goal_id=record.id,
                title=record.title,
                due_date=data.due_date,
                user_id=user_id,
            ),
        )

    return GoalResponse.model_validate(record)


async def get_goal(goal_id: str) -> GoalResponse:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Goal).where(Goal.id == goal_id))
        record = result.scalar_one_or_none()
        if not record:
            raise RecordNotFoundError("Goal", goal_id)
        return GoalResponse.model_validate(record)
        result = await db.execute(select(Goal).where(Goal.id == goal_id))
        record = result.scalar_one_or_none()
        if not record:
            raise RecordNotFoundError("Goal", goal_id)
        return GoalResponse.model_validate(record)


async def list_goals(
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    category: str | None = None,
) -> GoalListResponse:
    async with AsyncSessionLocal() as db:
        query = select(Goal)
        if status:
            query = query.where(Goal.status == status)
        if category:
            query = query.where(Goal.category == category)

        count_q = select(Goal.id)
        if status:
            count_q = count_q.where(Goal.status == status)
        if category:
            count_q = count_q.where(Goal.category == category)

        total_result = await db.execute(count_q)
        total = len(total_result.scalars().all())

        status_order = {"active": 0, "paused": 1, "completed": 2, "cancelled": 3}
        query = query.order_by(
            status_order.get(Goal.status, 9),
            Goal.progress_percent.desc(),
        )
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        result = await db.execute(query)
        records = result.scalars().all()

        return GoalListResponse(
            items=[GoalResponse.model_validate(r) for r in records],
            total=total,
            page=page,
            page_size=page_size,
            has_next=(offset + page_size) < total,
        )


async def update_goal(goal_id: str, data: GoalUpdate) -> GoalResponse:
    async with AsyncSessionLocal() as db, db.begin():
        result = await db.execute(select(Goal).where(Goal.id == goal_id))
        record = result.scalar_one_or_none()
        if not record:
            raise RecordNotFoundError("Goal", goal_id)

        patch = data.model_dump(exclude_unset=True)

        if "category" in patch and patch["category"] is not None:
            patch["category"] = patch["category"].value
        if "status" in patch and patch["status"] is not None:
            patch["status"] = patch["status"].value
        if "color_variant" in patch and patch["color_variant"] is not None:
            patch["color_variant"] = patch["color_variant"].value

        for field, value in patch.items():
            setattr(record, field, value)

        record.updated_at = _now()
        record.progress_percent = _compute_progress(
            record.current_value, record.target_value
        )

        if patch.get("status") == "completed" and not record.completed_at:
            record.completed_at = _now()
            record.current_value = record.target_value
            record.progress_percent = 100.0

        await db.commit()
        await db.refresh(record)
        return GoalResponse.model_validate(record)


async def update_progress(
    goal_id: str,
    data: GoalProgressUpdate,
) -> GoalResponse:
    async with AsyncSessionLocal() as db, db.begin():
        result = await db.execute(select(Goal).where(Goal.id == goal_id))
        record = result.scalar_one_or_none()
        if not record:
            raise RecordNotFoundError("Goal", goal_id)

        record.current_value = data.current_value
        record.progress_percent = _compute_progress(
            data.current_value, record.target_value
        )
        record.updated_at = _now()

        if (
            data.current_value >= record.target_value
            and record.status == "active"
        ):
            record.status = "completed"
            record.completed_at = _now()

        await db.commit()
        await db.refresh(record)
        return GoalResponse.model_validate(record)


async def delete_goal(goal_id: str) -> None:
    async with AsyncSessionLocal() as db, db.begin():
        result = await db.execute(select(Goal).where(Goal.id == goal_id))
        record = result.scalar_one_or_none()
        if not record:
            raise RecordNotFoundError("Goal", goal_id)
        await db.delete(record)
        await db.commit()
