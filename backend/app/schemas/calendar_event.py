"""Pydantic schemas for calendar event API requests and responses."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class EventTypeEnum(StrEnum):
    """Valid calendar event types."""

    INTERVIEW = "interview"
    DEADLINE = "deadline"
    SESSION = "session"
    TASK = "task"


class CalendarEventCreate(BaseModel):
    """Request to create a calendar event."""

    title: str = Field(..., max_length=300)
    description: str | None = None
    event_date: datetime
    end_date: datetime | None = None
    all_day: bool = False
    event_type: EventTypeEnum = EventTypeEnum.TASK
    location: str | None = None
    meeting_url: str | None = None
    reminder_minutes: int | None = None
    application_id: str | None = None


class CalendarEventUpdate(BaseModel):
    """Request to update an existing calendar event (all fields optional)."""

    title: str | None = Field(default=None, max_length=300)
    description: str | None = None
    event_date: datetime | None = None
    end_date: datetime | None = None
    all_day: bool | None = None
    event_type: EventTypeEnum | None = None
    location: str | None = None
    meeting_url: str | None = None
    reminder_minutes: int | None = None
    is_completed: bool | None = None


class CalendarEventResponse(BaseModel):
    """Single calendar event in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str | None = None
    application_id: str | None = None
    title: str
    description: str | None = None
    event_date: datetime
    end_date: datetime | None = None
    all_day: bool
    event_type: str
    location: str | None = None
    meeting_url: str | None = None
    reminder_minutes: int | None = None
    is_completed: bool
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CalendarEventListResponse(BaseModel):
    """Paginated list of calendar events."""

    items: list[CalendarEventResponse]
    total: int
    page: int
    page_size: int
    has_next: bool
