"""Calendar event database model."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CalendarEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A scheduled calendar event (interview, deadline, session, task)."""

    __tablename__ = "calendar_events"
    __table_args__ = (
        Index("ix_calendar_event_date", "event_date"),
        Index("ix_calendar_event_type", "event_type"),
        Index("ix_calendar_event_user", "user_id"),
    )

    # Owner (user reference — simple string FK, matches UserSettings pattern)
    user_id: Mapped[str | None] = mapped_column(
        String(32),
        ForeignKey("user_settings.id", ondelete="CASCADE"),
        nullable=True,
    )

    # Optional link to an application
    application_id: Mapped[str | None] = mapped_column(
        String(32),
        ForeignKey("applications.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Core fields
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # When
    event_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Categorisation
    event_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="task"
    )  # interview | deadline | session | task

    # Optional location / URL for virtual meetings
    location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    meeting_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    # Reminder / completion tracking
    reminder_minutes: Mapped[int | None] = mapped_column(nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    application: Mapped["Application | None"] = relationship(  # noqa: F821
        back_populates="calendar_events"
    )

    def __repr__(self) -> str:
        return (
            f"<CalendarEvent(id={self.id}, title='{self.title}', "
            f"event_date='{self.event_date}', type='{self.event_type}')>"
        )
