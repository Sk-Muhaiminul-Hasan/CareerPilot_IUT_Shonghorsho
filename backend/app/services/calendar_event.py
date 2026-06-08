"""Calendar event service — all operations now async SQLAlchemy DB queries."""

from datetime import UTC, datetime

from sqlalchemy import select

from app.core.exceptions import RecordNotFoundError
from app.db.session import AsyncSessionLocal
from app.models.calendar_event import CalendarEvent
from app.schemas.calendar_event import (
    CalendarEventCreate,
    CalendarEventListResponse,
    CalendarEventResponse,
    CalendarEventUpdate,
)


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


async def create_event(data: CalendarEventCreate) -> CalendarEventResponse:
    event_date = data.event_date
    end_date = data.end_date
    if event_date.tzinfo is not None:
        event_date = event_date.replace(tzinfo=None)
    if end_date is not None and end_date.tzinfo is not None:
        end_date = end_date.replace(tzinfo=None)
    async with AsyncSessionLocal() as db, db.begin():
        record = CalendarEvent(
            user_id=data.user_id,
            application_id=data.application_id,
            title=data.title,
            description=data.description,
            event_date=event_date,
            end_date=end_date,
            all_day=data.all_day,
            event_type=data.event_type.value,
            location=data.location,
            meeting_url=data.meeting_url,
            reminder_minutes=data.reminder_minutes,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return CalendarEventResponse.model_validate(record)


async def get_event(event_id: str) -> CalendarEventResponse:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(CalendarEvent).where(CalendarEvent.id == event_id))
        record = result.scalar_one_or_none()
        if not record:
            raise RecordNotFoundError("CalendarEvent", event_id)
        return CalendarEventResponse.model_validate(record)


async def list_events(
    page: int = 1,
    page_size: int = 20,
    event_type: str | None = None,
) -> CalendarEventListResponse:
    async with AsyncSessionLocal() as db:
        query = select(CalendarEvent)
        if event_type:
            query = query.where(CalendarEvent.event_type == event_type)
        query = query.order_by(CalendarEvent.event_date.asc())

        count_q = select(CalendarEvent.id)
        if event_type:
            count_q = count_q.where(CalendarEvent.event_type == event_type)

        total_result = await db.execute(count_q)
        total = len(total_result.scalars().all())

        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        result = await db.execute(query)
        records = result.scalars().all()

        return CalendarEventListResponse(
            items=[CalendarEventResponse.model_validate(r) for r in records],
            total=total,
            page=page,
            page_size=page_size,
            has_next=(offset + page_size) < total,
        )


async def update_event(
    event_id: str,
    data: CalendarEventUpdate,
) -> CalendarEventResponse:
    async with AsyncSessionLocal() as db, db.begin():
        result = await db.execute(select(CalendarEvent).where(CalendarEvent.id == event_id))
        record = result.scalar_one_or_none()
        if not record:
            raise RecordNotFoundError("CalendarEvent", event_id)

        patch = data.model_dump(exclude_unset=True)
        for field, value in patch.items():
            setattr(record, field, value)

        record.updated_at = _now()

        if patch.get("is_completed") and not record.completed_at:
            record.completed_at = _now()

        await db.commit()
        await db.refresh(record)
        return CalendarEventResponse.model_validate(record)


async def delete_event(event_id: str) -> None:
    async with AsyncSessionLocal() as db, db.begin():
        result = await db.execute(select(CalendarEvent).where(CalendarEvent.id == event_id))
        record = result.scalar_one_or_none()
        if not record:
            raise RecordNotFoundError("CalendarEvent", event_id)
        await db.delete(record)
        await db.commit()
