"""In-memory service for calendar events.

No database dependency — data lives in a module-level dict.
To switch to a real DB: replace each function body with SQLAlchemy
async queries against the CalendarEvent model. Keep the signatures
identical so the router never needs to change.
"""

from datetime import datetime, timezone
from uuid import uuid4

from app.core.exceptions import RecordNotFoundError
from app.schemas.calendar_event import (
    CalendarEventCreate,
    CalendarEventListResponse,
    CalendarEventResponse,
    CalendarEventUpdate,
)

# ── In-memory store ───────────────────────────────────────────────────────────
# Key: event id (str), Value: dict matching CalendarEventResponse fields
_store: dict[str, dict] = {}


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _make_response(record: dict) -> CalendarEventResponse:
    return CalendarEventResponse.model_validate(record)


# ── CRUD operations ───────────────────────────────────────────────────────────

async def create_event(data: CalendarEventCreate) -> CalendarEventResponse:
    """Create a new calendar event."""
    now = _now()
    event_id = uuid4().hex
    record: dict = {
        "id": event_id,
        "user_id": None,
        "application_id": data.application_id,
        "title": data.title,
        "description": data.description,
        "event_date": data.event_date,
        "end_date": data.end_date,
        "all_day": data.all_day,
        "event_type": data.event_type,
        "location": data.location,
        "meeting_url": data.meeting_url,
        "reminder_minutes": data.reminder_minutes,
        "is_completed": False,
        "completed_at": None,
        "created_at": now,
        "updated_at": now,
    }
    _store[event_id] = record
    return _make_response(record)


async def get_event(event_id: str) -> CalendarEventResponse:
    """Get a single calendar event by ID. Raises 404 if not found."""
    record = _store.get(event_id)
    if not record:
        raise RecordNotFoundError(f"CalendarEvent '{event_id}' not found")
    return _make_response(record)


async def list_events(
    page: int = 1,
    page_size: int = 20,
    event_type: str | None = None,
) -> CalendarEventListResponse:
    """List calendar events with optional type filter and pagination."""
    items = list(_store.values())

    if event_type:
        items = [e for e in items if e["event_type"] == event_type]

    # Sort by event_date ascending
    items.sort(key=lambda e: e["event_date"])

    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]

    return CalendarEventListResponse(
        items=[_make_response(e) for e in page_items],
        total=total,
        page=page,
        page_size=page_size,
        has_next=start + page_size < total,
    )


async def update_event(
    event_id: str,
    data: CalendarEventUpdate,
) -> CalendarEventResponse:
    """Partially update a calendar event. Raises 404 if not found."""
    record = _store.get(event_id)
    if not record:
        raise RecordNotFoundError(f"CalendarEvent '{event_id}' not found")

    patch = data.model_dump(exclude_unset=True)
    record.update(patch)
    record["updated_at"] = _now()

    # Auto-set completed_at when marking done
    if patch.get("is_completed") and not record.get("completed_at"):
        record["completed_at"] = _now()

    _store[event_id] = record
    return _make_response(record)


async def delete_event(event_id: str) -> None:
    """Delete a calendar event. Raises 404 if not found."""
    if event_id not in _store:
        raise RecordNotFoundError(f"CalendarEvent '{event_id}' not found")
    _store.pop(event_id)
