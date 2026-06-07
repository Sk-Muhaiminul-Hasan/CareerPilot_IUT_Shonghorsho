"""Pydantic schemas for the application tracker (notes and labels)."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


# ── Tracker Note ──────────────────────────────────────────────────────────────

class NoteTypeEnum(StrEnum):
    """Valid tracker note types."""

    NOTE = "note"
    STATUS_CHANGE = "status_change"
    INTERVIEW_FEEDBACK = "interview_feedback"
    OFFER_DETAIL = "offer_detail"
    REJECTION_REASON = "rejection_reason"


class TrackerNoteCreate(BaseModel):
    """Request to add a note to an application card."""

    body: str = Field(..., min_length=1)
    note_type: NoteTypeEnum = NoteTypeEnum.NOTE
    rating: int | None = Field(default=None, ge=0, le=10)
    status_snapshot: str | None = None


class TrackerNoteUpdate(BaseModel):
    """Request to update an existing tracker note."""

    body: str | None = Field(default=None, min_length=1)
    note_type: NoteTypeEnum | None = None
    rating: int | None = Field(default=None, ge=0, le=10)


class TrackerNoteResponse(BaseModel):
    """Single tracker note in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    application_id: str
    note_type: str
    body: str
    rating: int | None = None
    status_snapshot: str | None = None
    created_at: datetime
    updated_at: datetime


# ── Tracker Label ─────────────────────────────────────────────────────────────

class TrackerLabelCreate(BaseModel):
    """Request to attach a label to an application card."""

    name: str = Field(..., max_length=80)
    color_hex: str = Field(default="#004ac6", pattern=r"^#[0-9a-fA-F]{6}$")


class TrackerLabelUpdate(BaseModel):
    """Request to update an existing label."""

    name: str | None = Field(default=None, max_length=80)
    color_hex: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class TrackerLabelResponse(BaseModel):
    """Single tracker label in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    application_id: str
    name: str
    color_hex: str
    created_at: datetime
    updated_at: datetime


# ── Enriched application card (tracker board view) ────────────────────────────

class TrackerCardResponse(BaseModel):
    """Application card as displayed in the Kanban tracker view.

    Combines the core ApplicationResponse fields with tracker-specific
    enrichment (notes count, labels) so the board only needs one API call.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    job_id: str
    resume_id: str | None = None
    status: str
    apply_mode: str
    ats_score: float | None = None
    applied_at: datetime | None = None
    response_date: datetime | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    # Tracker enrichment
    labels: list[TrackerLabelResponse] = []
    tracker_notes: list[TrackerNoteResponse] = []
    notes_count: int = 0
