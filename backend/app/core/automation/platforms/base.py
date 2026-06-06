"""Base classes for job platform integrations.

Defines the ``JobListing`` data model and the ``JobPlatform`` abstract
base class that all platform plugins (LinkedIn, Indeed, Glassdoor, etc.)
must implement.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

import structlog
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm.client import LLMNotConfiguredError, UserLLMConfig

logger = structlog.get_logger(__name__)


class JobListing(BaseModel):
    """Normalized job listing from any platform.

    All platform integrations convert their raw data into this shared
    model so the rest of the system works with a single schema.
    """

    model_config = ConfigDict(frozen=True)

    platform: str
    platform_job_id: str
    title: str
    company: str
    location: str = ""
    url: str = ""
    description: str = ""  # full JD text after scrape_details(), or card snippet
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str = "USD"
    salary_range: str = ""  # raw text from card, e.g. "$120K - $150K"
    job_type: str = ""  # full-time, part-time, contract
    remote: bool = False
    work_type: str = ""  # one of: "", "remote", "hybrid", "onsite"
    deadline: str = ""  # ISO date string if shown, else ""
    skills_required: list[str] = Field(default_factory=list)
    skills_preferred: list[str] = Field(default_factory=list)
    posted_at: str = ""
    raw_data: dict[str, Any] = Field(default_factory=dict)


class JobPlatform(ABC):
    """Abstract base class for job platform integrations.

    Each supported job board (LinkedIn, Indeed, Glassdoor, etc.)
    implements this interface. Platform instances are created and
    managed through the ``PlatformRegistry``.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique platform identifier (e.g. ``linkedin``, ``indeed``)."""
        ...

    @abstractmethod
    async def login(self, credentials: dict[str, str]) -> bool:
        """Authenticate with the platform.

        Args:
            credentials: Platform-specific credential mapping
                         (e.g. ``{"email": "...", "password": "..."}``).

        Returns:
            ``True`` if login succeeded, ``False`` otherwise.
        """
        ...

    @abstractmethod
    async def search(
        self,
        query: str,
        location: str = "",
        filters: dict[str, Any] | None = None,
    ) -> list[JobListing]:
        """Search for job listings matching the given criteria.

        Args:
            query: Job search query string.
            location: Geographic filter (city, state, or "remote").
            filters: Platform-specific filter parameters.

        Returns:
            List of normalized ``JobListing`` objects.
        """
        ...

    @abstractmethod
    async def scrape_details(self, job_url: str) -> JobListing | None:
        """Scrape full details for a single job listing.

        Args:
            job_url: Direct URL to the job posting.

        Returns:
            ``JobListing`` with full description, or ``None`` if not found.
        """
        ...

    @abstractmethod
    async def apply(
        self,
        job: JobListing,
        resume_path: str,
        cover_letter_path: str | None = None,
    ) -> bool:
        """Submit a job application through the platform.

        Args:
            job: The target job listing.
            resume_path: Path to the resume file to upload.
            cover_letter_path: Optional path to the cover letter file.

        Returns:
            ``True`` if the application was submitted successfully.
        """
        ...

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} platform={self.name!r}>"

    @classmethod
    async def from_async(
        cls,
        db: AsyncSession,
        user_id: str,
        **kwargs: Any,
    ) -> JobPlatform:
        """Async factory: instantiate a platform with the user's AI settings.

        Loads ``UserSettings`` for ``user_id``, builds ``UserLLMConfig``,
        and stores it on the instance. If no AI is configured, still returns
        the instance so that ``_resolve_user_llm`` can return ``None`` and
        the caller handles it.

        Args:
            db: Async database session for loading user settings.
            user_id: Authenticated user ID.
            **kwargs: Extra keyword arguments forwarded to the constructor.

        Returns:
            A configured ``JobPlatform`` instance.
        """
        from app.services.settings_helper import get_or_create_settings
        db_settings = await get_or_create_settings(db, user_id)
        user_cfg = UserLLMConfig.from_settings(db_settings)
        instance: JobPlatform = cls(**kwargs)
        instance._user_llm_config = user_cfg
        return instance

    async def aclose(self) -> None:
        """Release any owned agent resources. Called by the registry."""

    def _resolve_user_llm(self) -> Any | None:
        """Return a langchain LLM built from per-user config, or None."""
        user_cfg: UserLLMConfig | None = getattr(self, "_user_llm_config", None)
        missing = (
            user_cfg is None
            or not user_cfg.model_for("general")
            or not user_cfg.api_key_for("general")
        )
        if missing:
            logger.warning(
                "platform.user_llm_not_configured",
                platform=getattr(self, "name", "unknown"),
            )
            return None
        from app.core.automation.agent import BrowserAgent
        try:
            return BrowserAgent._build_langchain_llm(user_cfg)
        except LLMNotConfiguredError:
            logger.warning(
                "platform.user_llm_not_configured_build_failed",
                platform=getattr(self, "name", "unknown"),
            )
            return None
