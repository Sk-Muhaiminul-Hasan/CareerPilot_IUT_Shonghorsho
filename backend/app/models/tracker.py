"""Application tracker note database model.

The Application model itself is the source of truth for Kanban column
placement (via `status`).  This model stores the user-facing notes,
custom labels, and per-card activity log entries that enrich the tracker
view without polluting the core Application record.
"""

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class TrackerNote(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A user-authored note or activity log entry attached to an application card."""

    __tablename__ = "tracker_notes"
    __table_args__ = (
        Index("ix_tracker_note_application", "application_id"),
        Index("ix_tracker_note_type", "note_type"),
    )

    # Foreign key to the application this note belongs to
    application_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Type: note | status_change | interview_feedback | offer_detail | rejection_reason
    note_type: Mapped[str] = mapped_column(
        String(40), nullable=False, default="note"
    )

    # Content
    body: Mapped[str] = mapped_column(Text, nullable=False)

    # Optional rating / score for interview rounds (0-10)
    rating: Mapped[int | None] = mapped_column(nullable=True)

    # Optional snapshot of what status was when the note was written
    status_snapshot: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # Relationships
    application: Mapped["Application"] = relationship(  # noqa: F821
        back_populates="tracker_notes"
    )

    def __repr__(self) -> str:
        return (
            f"<TrackerNote(id={self.id}, application_id={self.application_id}, "
            f"type='{self.note_type}')>"
        )


class TrackerLabel(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A custom coloured label that can be attached to any application card."""

    __tablename__ = "tracker_labels"
    __table_args__ = (
        Index("ix_tracker_label_application", "application_id"),
    )

    application_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Display
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    color_hex: Mapped[str] = mapped_column(String(7), nullable=False, default="#004ac6")

    # Relationships
    application: Mapped["Application"] = relationship(  # noqa: F821
        back_populates="tracker_labels"
    )

    def __repr__(self) -> str:
        return (
            f"<TrackerLabel(id={self.id}, name='{self.name}', "
            f"application_id={self.application_id})>"
        )
