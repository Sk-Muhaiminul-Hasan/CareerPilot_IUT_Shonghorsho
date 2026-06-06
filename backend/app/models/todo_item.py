"""To-do item database model."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class TodoItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single actionable to-do item, optionally linked to a goal or calendar event."""

    __tablename__ = "todo_items"
    __table_args__ = (
        Index("ix_todo_due_date", "due_date"),
        Index("ix_todo_status", "status"),
        Index("ix_todo_user", "user_id"),
    )

    # Owner
    user_id: Mapped[str | None] = mapped_column(
        String(32),
        ForeignKey("user_settings.id", ondelete="CASCADE"),
        nullable=True,
    )

    # Optional link to a goal
    goal_id: Mapped[str | None] = mapped_column(
        String(32),
        ForeignKey("goals.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Optional link to a calendar event
    calendar_event_id: Mapped[str | None] = mapped_column(
        String(32),
        ForeignKey("calendar_events.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Core fields
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Scheduling
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Priority: 1=low, 2=medium, 3=high
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=2)

    # Status: todo | in_progress | done | cancelled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="todo")

    # Completion
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Recurrence: daily | weekly | monthly | None
    recurrence: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Relationships
    goal: Mapped["Goal | None"] = relationship(  # noqa: F821
        back_populates="todo_items"
    )

    def __repr__(self) -> str:
        return (
            f"<TodoItem(id={self.id}, title='{self.title}', status='{self.status}')>"
        )
