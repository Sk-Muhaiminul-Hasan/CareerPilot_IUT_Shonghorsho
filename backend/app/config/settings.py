"""Application settings loaded from environment variables."""

from enum import StrEnum
from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ApplyMode(StrEnum):
    """Job application submission mode."""

    AUTONOMOUS = "autonomous"
    REVIEW = "review"
    BATCH = "batch"


class Environment(StrEnum):
    """Application environment."""

    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class LLMSettings(BaseSettings):
    """LLM provider configuration."""

    model_config = SettingsConfigDict(env_prefix="LLM__")

    portkey_api_key: SecretStr = SecretStr("")
    openai_api_key: SecretStr = SecretStr("")
    groq_api_key: SecretStr = SecretStr("")
    gemini_api_key: SecretStr = SecretStr("")
    openrouter_api_key: SecretStr = SecretStr("")
    github_token: SecretStr = SecretStr("")
    preferred_provider: str = "openai"
    fallback_providers: list[str] = ["groq", "openrouter"]
    default_model: str = "gpt-4o"
    temperature: float = 0.7
    max_tokens: int = 4096

    @field_validator("temperature")
    @classmethod
    def validate_temperature(cls, v: float) -> float:
        """Clamp temperature to valid range."""
        return max(0.0, min(2.0, v))

    @field_validator("max_tokens")
    @classmethod
    def validate_max_tokens(cls, v: int) -> int:
        """Ensure max_tokens is positive."""
        return max(1, v)


class BrowserSettings(BaseSettings):
    """Browser automation configuration."""

    model_config = SettingsConfigDict(env_prefix="BROWSER__", extra="ignore")

    headless: bool = True
    max_parallel: int = 3
    max_steps: int = 50
    max_failures: int = 3
    step_timeout: int = 120
    use_vision: str = "auto"

    @field_validator("max_parallel")
    @classmethod
    def validate_max_parallel(cls, v: int) -> int:
        """Clamp parallelism to 1-5 range."""
        return max(1, min(5, v))


_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """Root application settings."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_PATH),
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://neondb_owner:npg_vdwa5zEC9GMf@ep-plain-paper-aozhhrqo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb"
    database_url_sync: str = "postgresql+psycopg2://neondb_owner:npg_vdwa5zEC9GMf@ep-plain-paper-aozhhrqo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
    redis_url: str = "rediss://default:gQAAAAAAAbscAAIgcDIwMDlkMzlhNmY2MTU0ZjlhOGI2YTkyNTMyMWU1OTRhNQ@rested-sheepdog-113436.upstash.io:6379"

    # Vector store
    vector_store_type: str = "pgvector"  # pgvector (formerly faiss)
    pgvector_collection: str = "cv_embeddings"

    # Application behavior
    apply_mode: ApplyMode = ApplyMode.REVIEW
    min_ats_score: float = 0.75
    environment: Environment = Environment.DEVELOPMENT
    log_level: str = "INFO"

    # Nested settings
    llm: LLMSettings = LLMSettings()
    browser: BrowserSettings = BrowserSettings()

    # Job discovery
    exa_api_key: SecretStr = SecretStr("")

    # Supabase Auth
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    @field_validator("min_ats_score")
    @classmethod
    def validate_min_ats_score(cls, v: float) -> float:
        """Clamp ATS score threshold to 0-1 range."""
        return max(0.0, min(1.0, v))

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Normalize log level to uppercase."""
        return v.upper()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Get cached application settings singleton."""
    return Settings()
