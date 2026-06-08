"""Pydantic schemas for user settings API requests and responses."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class WorkExperienceSchema(BaseModel):
    """A single work experience entry."""

    title: str = ""
    company: str = ""
    start_date: str = ""
    end_date: str = ""
    description: str = ""
    responsibilities: list[str] = Field(default_factory=list)


class EducationSchema(BaseModel):
    """A single education entry."""

    degree: str = ""
    institution: str = ""
    graduation_year: str = ""
    gpa: str | None = None


class CandidateProfileSchema(BaseModel):
    """Structured candidate profile for resume generation."""

    full_name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin_url: str = ""
    github_url: str = ""
    summary: str = ""
    skills: list[str] = Field(default_factory=list)
    experience: list[WorkExperienceSchema] = Field(default_factory=list)
    education: list[EducationSchema] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)


class SettingsResponse(BaseModel):
    """Current user settings."""

    model_config = ConfigDict(from_attributes=True)

    apply_mode: str = "review"
    min_ats_score: float = 0.75
    max_parallel: int = 3

    # Two separate AI slots
    general_provider: str | None = None
    general_model: str | None = None
    general_api_key: str | None = None

    extraction_provider: str | None = None
    extraction_model: str | None = None
    extraction_api_key: str | None = None

    onboarding_complete: bool = False
    is_premium: bool = False

    platforms_enabled: list[str] = Field(
        default_factory=lambda: ["linkedin", "indeed", "glassdoor"],
    )
    candidate_profile: CandidateProfileSchema = Field(
        default_factory=CandidateProfileSchema,
    )

    @field_validator("candidate_profile", mode="before")
    @classmethod
    def _coerce_candidate_profile(
        cls, v: Any,
    ) -> CandidateProfileSchema | dict[str, Any]:
        if v is None:
            return CandidateProfileSchema()
        if isinstance(v, dict):
            return CandidateProfileSchema(**v)
        return v


class SettingsUpdate(BaseModel):
    """Request to update user settings. Only provided fields are changed."""

    apply_mode: str | None = None
    min_ats_score: float | None = Field(default=None, ge=0.0, le=1.0)
    max_parallel: int | None = Field(default=None, ge=1, le=5)

    general_provider: str | None = None
    general_model: str | None = None
    general_api_key: str | None = None

    extraction_provider: str | None = None
    extraction_model: str | None = None
    extraction_api_key: str | None = None

    onboarding_complete: bool | None = None
    is_premium: bool | None = None

    platforms_enabled: list[str] | None = None
    candidate_profile: CandidateProfileSchema | None = None


class LLMProviderStatus(BaseModel):
    """Status of a configured LLM provider."""

    provider: str
    configured: bool = False
    model: str = ""
    is_primary: bool = False
