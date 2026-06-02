"""Pydantic schemas for to-do item API requests and responses."""

from datetime import datetime
from enum import IntEnum, StrEnum

from pydantic import BaseModel, ConfigDict, Field


class TodoPriorityEnum(IntEnum):
    """To-do item priority levels."""

    LOW = 1
    MEDIUM = 2
    HIGH = 3


class TodoStatusEnum(StrEnum):
    """Valid to-do item statuses."""

    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"


class RecurrenceEnum(StrEnum):
    """Valid recurrence patterns."""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class TodoItemCreate(BaseModel):
    """Request to create a to-do item."""

    title: str = Field(..., max_length=300)
    description: str | None = None
    due_date: datetime | None = None
    priority: TodoPriorityEnum = TodoPriorityEnum.MEDIUM
    recurrence: RecurrenceEnum | None = None
    goal_id: str | None = None
    calendar_event_id: str | None = None


class TodoItemUpdate(BaseModel):
    """Request to update an existing to-do item (all fields optional)."""

    title: str | None = Field(default=None, max_length=300)
    description: str | None = None
    due_date: datetime | None = None
    priority: TodoPriorityEnum | None = None
    status: TodoStatusEnum | None = None
    is_completed: bool | None = None
    recurrence: RecurrenceEnum | None = None
    goal_id: str | None = None
    calendar_event_id: str | None = None


class TodoItemResponse(BaseModel):
    """Single to-do item in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str | None = None
    goal_id: str | None = None
    calendar_event_id: str | None = None
    title: str
    description: str | None = None
    due_date: datetime | None = None
    priority: int
    status: str
    is_completed: bool
    completed_at: datetime | None = None
    recurrence: str | None = None
    created_at: datetime
    updated_at: datetime


class TodoItemListResponse(BaseModel):
    """Paginated list of to-do items."""

    items: list[TodoItemResponse]
    total: int
    page: int
    page_size: int
    has_next: bool
