"""Pydantic schemas for nudge API responses."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.job import JobListingResponse


class SuggestedTodoResponse(BaseModel):
    id: str
    title: str
    due_date: datetime | None = None
    priority: int
    is_completed: bool


class NudgeResponse(BaseModel):
    """Response for the AI nudge endpoint."""

    headline: str
    bullets: list[str]
    type: str = Field(..., pattern="^(active|inactive)$")
    applications_this_week: int
    recommended_jobs: list[JobListingResponse]
    suggested_todos: list[SuggestedTodoResponse] = []
