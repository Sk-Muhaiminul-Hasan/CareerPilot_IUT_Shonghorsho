"""Calendar event API routes.

Endpoints
---------
POST   /calendar/                   Create a new event
GET    /calendar/                   List events (paginated, optional ?event_type filter)
GET    /calendar/{event_id}         Get a single event
PATCH  /calendar/{event_id}         Partially update an event
DELETE /calendar/{event_id}         Delete an event
"""

import structlog
from fastapi import APIRouter, Query

from app.config.constants import DEFAULT_PAGE_SIZE
from app.schemas.calendar_event import (
    CalendarEventCreate,
    CalendarEventListResponse,
    CalendarEventResponse,
    CalendarEventUpdate,
)
from app.services import calendar_event as calendar_service

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post(
    "/",
    response_model=CalendarEventResponse,
    status_code=201,
    summary="Create a calendar event",
)
async def create_event(data: CalendarEventCreate) -> CalendarEventResponse:
    """Create a new calendar event (interview, deadline, session, or task)."""
    event = await calendar_service.create_event(data)
    logger.info("calendar_event_created", event_id=event.id, event_type=event.event_type)
    return event


@router.get(
    "/",
    response_model=CalendarEventListResponse,
    summary="List calendar events",
)
async def list_events(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=100, description="Items per page"),
    event_type: str | None = Query(default=None, description="Filter by type: interview | deadline | session | task"),
) -> CalendarEventListResponse:
    """List calendar events sorted by event_date ascending."""
    return await calendar_service.list_events(page, page_size, event_type)


@router.get(
    "/{event_id}",
    response_model=CalendarEventResponse,
    summary="Get a calendar event",
)
async def get_event(event_id: str) -> CalendarEventResponse:
    """Get a single calendar event by ID. Returns 404 if not found."""
    return await calendar_service.get_event(event_id)


@router.patch(
    "/{event_id}",
    response_model=CalendarEventResponse,
    summary="Update a calendar event",
)
async def update_event(
    event_id: str,
    data: CalendarEventUpdate,
) -> CalendarEventResponse:
    """Partially update a calendar event. Only supplied fields are changed."""
    event = await calendar_service.update_event(event_id, data)
    logger.info("calendar_event_updated", event_id=event_id)
    return event


@router.delete(
    "/{event_id}",
    status_code=204,
    summary="Delete a calendar event",
)
async def delete_event(event_id: str) -> None:
    """Delete a calendar event by ID. Returns 404 if not found."""
    await calendar_service.delete_event(event_id)
    logger.info("calendar_event_deleted", event_id=event_id)
