"""Pydantic schemas for scheduled search endpoints."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ScheduledSearchCreate(BaseModel):
    """Create a new scheduled job search."""

    query: str = Field(..., min_length=1, max_length=500)
    location: str | None = Field(default=None, max_length=300)
    platforms: list[str] = Field(default_factory=lambda: ["linkedin"])
    schedule: str = Field(..., pattern="^(daily|weekly|monday|wednesday|friday)$")


class ScheduledSearchUpdate(BaseModel):
    """Update an existing scheduled job search."""

    query: str | None = Field(default=None, min_length=1, max_length=500)
    location: str | None = Field(default=None, max_length=300)
    platforms: list[str] | None = Field(default=None)
    schedule: str | None = Field(default=None, pattern="^(daily|weekly|monday|wednesday|friday)$")
    is_active: bool | None = Field(default=None)


class ScheduledSearchResponse(BaseModel):
    """Returned by read endpoints for scheduled job searches."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    query: str
    location: str | None
    platforms: list[str]
    schedule: str
    is_active: bool
    last_run: datetime | None
    next_run: datetime
    created_at: datetime
    updated_at: datetime
