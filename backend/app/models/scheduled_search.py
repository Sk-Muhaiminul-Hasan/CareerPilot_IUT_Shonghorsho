"""Scheduled job search database model."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, JSON, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ScheduledSearch(Base, TimestampMixin):
    """A scheduled multi-platform job search for a user."""

    __tablename__ = "scheduled_searches"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="default_user",
        index=True,
    )
    query: Mapped[str] = mapped_column(String(500), nullable=False)
    location: Mapped[str | None] = mapped_column(String(300), nullable=True, default=None)
    platforms: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: ["linkedin"],
    )
    schedule: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )
    last_run: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        default=None,
    )
    next_run: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    def __repr__(self) -> str:
        return (
            f"<ScheduledSearch(id={self.id}, query={self.query!r}, "
            f"schedule={self.schedule!r}, is_active={self.is_active})>"
        )
