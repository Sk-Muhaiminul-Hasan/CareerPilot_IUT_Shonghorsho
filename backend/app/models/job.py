"""Job listing database model."""

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Job(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A job listing scraped from a platform."""

    __tablename__ = "jobs"
    __table_args__ = (
        UniqueConstraint("platform", "platform_job_id", name="uq_job_platform_id"),
        Index("ix_job_status", "status"),
        Index("ix_job_match_score", "match_score"),
        CheckConstraint(
            "work_type IN ('', 'remote', 'hybrid', 'onsite')",
            name="ck_job_work_type",
        ),
    )

    user_id: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="default_user",
        index=True,
    )

    # Platform identification
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    platform_job_id: Mapped[str] = mapped_column(String(200), nullable=False)

    # Job details
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    company: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    url: Mapped[str] = mapped_column(String(2000), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Optional fields
    salary_range: Mapped[str | None] = mapped_column(String(200), nullable=True)
    job_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    remote: Mapped[bool] = mapped_column(Boolean, default=False)
    posted_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    experience_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    work_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="",
        server_default="",
    )

    # Analysis
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    skills_required: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Status tracking
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new")
    is_enriched: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    applications: Mapped[list["Application"]] = relationship(  # noqa: F821
        back_populates="job",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Job(id={self.id}, title='{self.title}', company='{self.company}')>"
