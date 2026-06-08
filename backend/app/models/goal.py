"""Career goal database model."""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Goal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A career accountability goal with progress tracking."""

    __tablename__ = "goals"
    __table_args__ = (
        Index("ix_goal_status", "status"),
        Index("ix_goal_category", "category"),
        Index("ix_goal_user", "user_id"),
    )

    # Owner
    user_id: Mapped[str | None] = mapped_column(
        String(32),
        ForeignKey("user_settings.id", ondelete="CASCADE"),
        nullable=True,
    )

    # Core fields
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Category: applications | learning | networking | interview_prep | other
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="other")

    # Progress tracking
    target_value: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    current_value: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Completion percentage (0.0 – 100.0), optionally computed by the API
    progress_percent: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Status: active | paused | completed | cancelled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    # Priority / display variant: primary | secondary | tertiary
    color_variant: Mapped[str] = mapped_column(
        String(20), nullable=False, default="primary"
    )

    # Due date label (free-text like "This week", "Friday", or "Ongoing")
    due_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Completion
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    todo_items: Mapped[list["TodoItem"]] = relationship(  # noqa: F821
        back_populates="goal",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<Goal(id={self.id}, title='{self.title}', "
            f"status='{self.status}', progress={self.progress_percent:.1f}%)>"
        )
