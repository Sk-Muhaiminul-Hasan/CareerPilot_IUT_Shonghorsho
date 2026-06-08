"""Roadmap database models: phase, task link, and meta for AI-generated career roadmaps."""

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class RoadmapPhase(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single phase within an AI-generated goal roadmap."""

    __tablename__ = "roadmap_phases"

    # FK to the parent goal
    goal_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("goals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    phase_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)

    # Week numbers from goal start date (1-indexed)
    week_start: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    week_end: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Relationships
    tasks: Mapped[list["RoadmapTask"]] = relationship(
        back_populates="phase",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<RoadmapPhase(id={self.id}, goal_id={self.goal_id}, "
            f"phase={self.phase_number}, title='{self.title}')>"
        )


class RoadmapTask(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Links an AI-generated roadmap phase to a TodoItem (Task)."""

    __tablename__ = "roadmap_tasks"

    # FK to the phase
    phase_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("roadmap_phases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # FK to the underlying todo item (the "Task" model)
    task_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("todo_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Category: learning | project | application | networking | cv_update
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="learning")

    # Whether completing this task should spawn a job application
    spawns_application: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Completion tracking
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    phase: Mapped["RoadmapPhase"] = relationship(back_populates="tasks")

    def __repr__(self) -> str:
        return (
            f"<RoadmapTask(id={self.id}, phase_id={self.phase_id}, "
            f"task_id={self.task_id}, completed={self.completed})>"
        )


class RoadmapMeta(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One-to-one metadata record for each goal roadmap (mermaid gantt, feasibility, etc.)."""

    __tablename__ = "roadmap_meta"
    __table_args__ = (UniqueConstraint("goal_id", name="uq_roadmap_meta_goal"),)

    goal_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("goals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Mermaid gantt chart string
    mermaid_gantt: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Feasibility assessment
    feasibility: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    feasibility_note: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # JSON list of {skill, gap_reason} objects
    skill_gaps: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)

    # Estimated hours per week
    weekly_hour_budget: Mapped[int] = mapped_column(Integer, nullable=False, default=8)

    # Progress (0.0 - 100.0)
    progress_percent: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # On-track status
    on_track: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Motivational nudge message for the dashboard widget
    nudge_message: Mapped[str] = mapped_column(Text, nullable=False, default="")

    def __repr__(self) -> str:
        return (
            f"<RoadmapMeta(id={self.id}, goal_id={self.goal_id}, "
            f"progress={self.progress_percent:.1f}%, on_track={self.on_track})>"
        )
