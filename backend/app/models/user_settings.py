"""User settings database model."""

from sqlalchemy import JSON, Float, Integer, String
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

    # LLM preferences
    preferred_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="openai")
    preferred_model: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)
    user_api_key: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        default=None,
    )
    # NOTE: user_api_key is stored as plaintext for now.
    # It should be encrypted before production use.

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
            f"<UserSettings(apply_mode='{self.apply_mode}', "
            f"provider='{self.preferred_provider}', "
            f"model='{self.preferred_model}')>"
        )
