"""Pydantic schemas for career goal API requests and responses."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class GoalCategoryEnum(StrEnum):
    """Valid goal categories."""

    APPLICATIONS = "applications"
    LEARNING = "learning"
    NETWORKING = "networking"
    INTERVIEW_PREP = "interview_prep"
    OTHER = "other"


class GoalStatusEnum(StrEnum):
    """Valid goal statuses."""

    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class GoalColorVariantEnum(StrEnum):
    """Display variant for progress bar colour, matching the frontend design system."""

    PRIMARY = "primary"
    SECONDARY = "secondary"
    TERTIARY = "tertiary"


class GoalCreate(BaseModel):
    """Request to create a career goal."""

    title: str = Field(..., max_length=300)
    description: str | None = None
    category: GoalCategoryEnum = GoalCategoryEnum.OTHER
    target_value: int = Field(default=1, ge=1)
    color_variant: GoalColorVariantEnum = GoalColorVariantEnum.PRIMARY
    due_label: str | None = Field(default=None, max_length=100)
    due_date: datetime | None = None


class GoalUpdate(BaseModel):
    """Request to update an existing goal (all fields optional)."""

    title: str | None = Field(default=None, max_length=300)
    description: str | None = None
    category: GoalCategoryEnum | None = None
    target_value: int | None = Field(default=None, ge=1)
    current_value: int | None = Field(default=None, ge=0)
    status: GoalStatusEnum | None = None
    color_variant: GoalColorVariantEnum | None = None
    due_label: str | None = None
    due_date: datetime | None = None


class GoalProgressUpdate(BaseModel):
    """Lightweight request to increment/set goal progress."""

    current_value: int = Field(..., ge=0)


class GoalResponse(BaseModel):
    """Single goal in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str | None = None
    title: str
    description: str | None = None
    category: str
    target_value: int
    current_value: int
    progress_percent: float
    status: str
    color_variant: str
    due_label: str | None = None
    due_date: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class GoalListResponse(BaseModel):
    """Paginated list of goals."""

    items: list[GoalResponse]
    total: int
    page: int
    page_size: int
    has_next: bool
