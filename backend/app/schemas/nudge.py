"""Pydantic schemas for nudge API responses."""

from pydantic import BaseModel, Field

from app.schemas.job import JobListingResponse


class NudgeResponse(BaseModel):
    """Response for the AI nudge endpoint."""

    headline: str
    bullets: list[str]
    type: str = Field(..., pattern="^(active|inactive)$")
    applications_this_week: int
    recommended_jobs: list[JobListingResponse]
