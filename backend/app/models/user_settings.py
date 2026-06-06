"""User settings database model."""

from sqlalchemy import JSON, Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserSettings(TimestampMixin, Base):
    """User preferences and configuration."""

    __tablename__ = "user_settings"

    id: Mapped[str] = mapped_column(
        String(32),
        primary_key=True,
    )

    # Application behavior
    apply_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="review")
    max_parallel: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    min_ats_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.75)

    # General AI — powered nudges, cover letters, resume tailoring, chat.
    general_provider: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default=None,
    )
    general_model: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default=None,
    )
    general_api_key: Mapped[str | None] = mapped_column(
        String(512), nullable=True, default=None,
    )
    # NOTE: api_key fields stored as plaintext — needs encryption for prod.

    # Extraction AI — CV parsing / structured extraction.
    extraction_provider: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default=None,
    )
    extraction_model: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default=None,
    )
    extraction_api_key: Mapped[str | None] = mapped_column(
        String(512), nullable=True, default=None,
    )
    # NOTE: api_key fields stored as plaintext — needs encryption for prod.

    # Onboarding tracking
    onboarding_complete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false",
    )

    # Platform config
    platforms_enabled: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: ["linkedin", "indeed", "glassdoor"],
    )

    # Candidate profile
    candidate_profile: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    def __repr__(self) -> str:
        return (
            f"<UserSettings(id='{self.id}', "
            f"general_provider='{self.general_provider}', "
            f"extraction_provider='{self.extraction_provider}')>"
        )
