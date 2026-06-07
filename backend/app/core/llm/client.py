"""Unified LLM client with Portkey gateway and LiteLLM provider abstraction."""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Any

import litellm
import structlog
from pydantic import BaseModel, ConfigDict

from app.config.settings import get_settings
from app.core.exceptions import LLMProviderError, LLMRateLimitError, LLMTimeoutError
from app.observability.metrics import (
    llm_cost_usd,
    llm_latency_seconds,
    llm_requests_total,
    llm_tokens_total,
)

logger = structlog.get_logger(__name__)

_VALID_PROVIDERS = {"openai", "anthropic", "openrouter", "groq", "gemini", "google", "server"}

_AUTO_PREFIX: dict[str, str] = {
    "openrouter": "openrouter/",
    "anthropic": "anthropic/",
    "groq": "groq/",
    "gemini": "gemini/",
    "google": "gemini/",
}


@dataclass
class UserLLMConfig:
    """Per-user LLM configuration stored in settings."""

    # Legacy unified fields (still written by older frontend code, kept during transition)
    preferred_provider: str | None = None
    preferred_model: str | None = None
    user_api_key: str | None = None

    # General-purpose AI — used for nudges, cover letters, resume tailoring, chat.
    general_provider: str | None = None
    general_model: str | None = None
    general_api_key: str | None = None

    # Extraction AI — used only for CV parsing (needs reliable JSON/structured output).
    extraction_provider: str | None = None
    extraction_model: str | None = None
    extraction_api_key: str | None = None

    def provider_for(self, purpose: str) -> str | None:
        if purpose == "extraction":
            return self.extraction_provider or self.preferred_provider
        return self.general_provider or self.preferred_provider

    def model_for(self, purpose: str) -> str | None:
        if purpose == "extraction":
            return self.extraction_model or self.preferred_model
        return self.general_model or self.preferred_model

    def api_key_for(self, purpose: str) -> str | None:
        if purpose == "extraction":
            return self.extraction_api_key or self.user_api_key
        return self.general_api_key or self.user_api_key

    @classmethod
    def from_settings(cls, settings_obj: Any) -> UserLLMConfig:
        """Build config from a SQLAlchemy UserSettings model instance."""
        if settings_obj is None:
            return cls()
        return cls(
            preferred_provider=getattr(settings_obj, "preferred_provider", None),
            preferred_model=getattr(settings_obj, "preferred_model", None),
            user_api_key=getattr(settings_obj, "user_api_key", None),
            general_provider=getattr(settings_obj, "general_provider", None),
            general_model=getattr(settings_obj, "general_model", None),
            general_api_key=getattr(settings_obj, "general_api_key", None),
            extraction_provider=getattr(settings_obj, "extraction_provider", None),
            extraction_model=getattr(settings_obj, "extraction_model", None),
            extraction_api_key=getattr(settings_obj, "extraction_api_key", None),
        )


class LLMNotConfiguredError(Exception):
    pass


class LLMResponse(BaseModel):
    """Structured response from an LLM completion call."""

    model_config = ConfigDict(frozen=True)

    content: str
    model: str
    provider: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: float = 0.0


_PROVIDER_MODEL_DEFAULTS: dict[str, str] = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-sonnet-20241022",
    "gemini": "gemini-1.5-flash",
    "google": "gemini-1.5-flash",
    "groq": "llama-3.1-70b-versatile",
    "openrouter": "openrouter/auto",
}

_EXTRACTION_MODEL_FALLBACK = "gpt-4o-mini"


class LLMClient:
    """Unified async LLM client with provider fallback and cost tracking.

    Wraps LiteLLM's ``acompletion`` with Portkey gateway headers,
    automatic fallback through configured providers, and Prometheus
    metrics recording for every call.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._llm = settings.llm
        self._cv_extraction_api_key = settings.cv_extraction_api_key.get_secret_value()
        self._cv_extraction_model = settings.cv_extraction_model
        self._configure_portkey()
        self._configure_api_keys()

    def _configure_portkey(self) -> None:
        """Configure Portkey gateway headers if API key is available."""
        portkey_key = self._llm.portkey_api_key.get_secret_value()
        if portkey_key:
            litellm.set_verbose = False
            litellm.success_callback = ["portkey"]
            litellm.failure_callback = ["portkey"]
            logger.info("portkey_gateway_configured")

    def _configure_api_keys(self) -> None:
        """Push provider API keys into litellm's key registry and os environment."""
        key_map: dict[str, str] = {
            "openai_api_key": self._llm.openai_api_key.get_secret_value(),
            "groq_api_key": self._llm.groq_api_key.get_secret_value(),
            "gemini_api_key": self._llm.gemini_api_key.get_secret_value(),
            "openrouter_api_key": self._llm.openrouter_api_key.get_secret_value(),
        }
        for attr, value in key_map.items():
            if value:
                setattr(litellm, attr, value)
        if self._cv_extraction_api_key:
            import os as _os
            _os.environ["OPENAI_API_KEY"] = self._cv_extraction_api_key

    def _build_messages(
        self, prompt: str, system_prompt: str
    ) -> list[dict[str, str]]:
        """Build the messages list for a chat completion request."""
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        return messages

    def _resolve_model(
        self,
        model: str | None,
        user_settings: UserLLMConfig | None,
        purpose: str = "general",
    ) -> str:
        """Resolve the effective model considering user preferences and purpose."""
        fallback_default = (
            _EXTRACTION_MODEL_FALLBACK
            if purpose == "extraction"
            else self._llm.default_model
        )

        if user_settings:
            provider = user_settings.provider_for(purpose) or "openai"
            raw = user_settings.model_for(purpose)

            if raw:
                if provider == "openai":
                    if raw.startswith("openai/"):
                        return raw
                    return raw
                if provider in _AUTO_PREFIX:
                    prefix = _AUTO_PREFIX[provider]
                    if not raw.startswith(prefix):
                        return f"{prefix}{raw}"
                return raw

        resolved = model or fallback_default
        if "/" in resolved:
            prefix = resolved.split("/", 1)[0]
            known_providers = set(_PROVIDER_MODEL_DEFAULTS.keys()) - {"server"}
            if prefix not in known_providers:
                return f"{self._llm.preferred_provider}/{resolved}"
        return resolved

    def _get_model_chain(
        self,
        model: str | None,
        user_settings: UserLLMConfig | None,
        purpose: str = "general",
    ) -> list[str]:
        """Return the ordered list of models to try (primary + fallbacks)."""
        primary = self._resolve_model(model, user_settings, purpose)
        fallbacks = [
            f"{provider}/{primary.split('/')[-1]}"
            for provider in self._llm.fallback_providers
        ]
        return [primary, *fallbacks]

    def _portkey_metadata(self) -> dict[str, Any]:
        """Build Portkey metadata dict for request tracing."""
        portkey_key = self._llm.portkey_api_key.get_secret_value()
        if not portkey_key:
            return {}
        return {
            "portkey_api_key": portkey_key,
        }

    async def complete(
        self,
        prompt: str,
        system_prompt: str = "",
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        response_format: dict[str, Any] | None = None,
        purpose: str = "general",
        user_settings: UserLLMConfig | None = None,
        usage_db: Any | None = None,
        usage_user_id: str = "",
    ) -> LLMResponse:
        """Send completion request with fallback chain and metrics.

        Uses ``litellm.acompletion()`` under the hood. Falls back through
        configured providers on failure. Records Prometheus metrics.

        When ``user_settings`` is provided with an API key for the given
        ``purpose``, the per-user provider/model/api_key are used instead of
        server defaults.

        Args:
            prompt: The user prompt text.
            system_prompt: Optional system prompt prepended to messages.
            model: Override model identifier (e.g. ``gpt-4o``).
            temperature: Sampling temperature override.
            max_tokens: Max completion tokens override.
            response_format: JSON mode / structured output spec.
            purpose: Label for metrics and AI slot selection
                (``general`` or ``extraction``).
            user_settings: Optional per-user LLM configuration.

        Returns:
            Populated ``LLMResponse`` with content and usage metadata.

        Raises:
            LLMRateLimitError: Provider rate limit hit on all attempts.
            LLMTimeoutError: All providers timed out.
            LLMProviderError: Non-recoverable provider failure.
        """
        messages = self._build_messages(prompt, system_prompt)
        temp = temperature if temperature is not None else self._llm.temperature
        tokens = max_tokens if max_tokens is not None else self._llm.max_tokens

        if purpose == "general":
            user_api_key = user_settings.api_key_for(purpose) if user_settings else None
            if not user_api_key:
                raise LLMNotConfiguredError(
                    "AI not configured. Please configure your AI model in Settings."
                )
        elif purpose == "extraction":
            user_api_key = self._cv_extraction_api_key or (
                user_settings.api_key_for(purpose) if user_settings else None
            )
            if not user_api_key:
                raise LLMNotConfiguredError(
                    "AI not configured. Please configure your AI model in Settings."
                )
        else:
            user_api_key = user_settings.api_key_for(purpose) if user_settings else None
            if not user_api_key:
                raise LLMNotConfiguredError(
                    "AI not configured. Please configure your AI model in Settings."
                )

        if purpose == "extraction":
            model_chain = [self._cv_extraction_model]
        else:
            model_chain = self._get_model_chain(model, user_settings, purpose)
        metadata = self._portkey_metadata()
        last_error: Exception | None = None

        for attempt_model in model_chain:
            provider = (
                attempt_model.split("/", 1)[0]
                if "/" in attempt_model
                else "openai"
            )
            start = time.perf_counter()
            try:
                all_kwargs: dict[str, Any] = {
                    "model": attempt_model,
                    "messages": messages,
                    "temperature": temp,
                    "max_tokens": tokens,
                }
                if response_format is not None:
                    all_kwargs["response_format"] = response_format
                if metadata:
                    all_kwargs["metadata"] = metadata
                if user_api_key:
                    all_kwargs["api_key"] = user_api_key

                response = await litellm.acompletion(**all_kwargs)
                latency_s = time.perf_counter() - start
                elapsed_ms = latency_s * 1000

                usage = response.usage or litellm.Usage()
                cost = litellm.completion_cost(completion_response=response)

                self._record_metrics(
                    provider=provider,
                    model=attempt_model,
                    purpose=purpose,
                    status="success",
                    latency_s=latency_s,
                    prompt_tokens=usage.prompt_tokens or 0,
                    completion_tokens=usage.completion_tokens or 0,
                    cost=cost,
                )

                content = response.choices[0].message.content or ""
                logger.info(
                    "llm_completion_success",
                    model=attempt_model,
                    tokens=usage.total_tokens,
                    cost_usd=round(cost, 6),
                    latency_ms=round(elapsed_ms, 1),
                )
                result = LLMResponse(
                    content=content,
                    model=attempt_model,
                    provider=provider,
                    prompt_tokens=usage.prompt_tokens or 0,
                    completion_tokens=usage.completion_tokens or 0,
                    total_tokens=usage.total_tokens or 0,
                    cost_usd=cost,
                    latency_ms=elapsed_ms,
                )
                if usage_db is not None and usage_user_id:
                    try:
                        from app.core.llm.usage_tracker import record_usage_atomic
                        await record_usage_atomic(
                            db=usage_db,
                            response=result,
                            purpose=purpose,
                            user_id=usage_user_id,
                        )
                    except Exception:
                        pass
                return result

            except litellm.RateLimitError as exc:
                last_error = exc
                self._record_metrics(
                    provider=provider,
                    model=attempt_model,
                    purpose=purpose,
                    status="rate_limited",
                    latency_s=(time.perf_counter() - start),
                )
                logger.warning(
                    "llm_rate_limited", model=attempt_model, error=str(exc)
                )
                continue

            except litellm.Timeout as exc:
                last_error = exc
                self._record_metrics(
                    provider=provider,
                    model=attempt_model,
                    purpose=purpose,
                    status="timeout",
                    latency_s=(time.perf_counter() - start),
                )
                logger.warning(
                    "llm_timeout", model=attempt_model, error=str(exc)
                )
                continue

            except litellm.APIError as exc:
                last_error = exc
                self._record_metrics(
                    provider=provider,
                    model=attempt_model,
                    purpose=purpose,
                    status="error",
                    latency_s=(time.perf_counter() - start),
                )
                logger.error(
                    "llm_api_error", model=attempt_model, error=str(exc)
                )
                continue

        # All models exhausted — raise the appropriate typed error
        if isinstance(last_error, litellm.RateLimitError):
            raise LLMRateLimitError(provider=model_chain[-1])
        if isinstance(last_error, litellm.Timeout):
            raise LLMTimeoutError(f"All models timed out: {model_chain}")
        raise LLMProviderError(
            provider=model_chain[-1],
            message=str(last_error) if last_error else "Unknown error",
        )

    async def complete_with_structured_output(
        self,
        prompt: str,
        output_schema: type[BaseModel],
        system_prompt: str = "",
        model: str | None = None,
        purpose: str = "structured",
        user_settings: UserLLMConfig | None = None,
        usage_db: Any | None = None,
        usage_user_id: str = "",
    ) -> BaseModel:
        """Get structured JSON output parsed into a Pydantic model.

        Uses prompt-based JSON schema injection rather than ``response_format``
        so it works with any LiteLLM provider.

        Args:
            prompt: The user prompt text.
            output_schema: Pydantic model class for response validation.
            system_prompt: Optional system prompt.
            model: Override model identifier.
            purpose: Label for metrics and AI slot selection.
            user_settings: Optional per-user LLM configuration.

        Returns:
            Instance of ``output_schema`` populated from the LLM response.

        Raises:
            LLMProviderError: If JSON parsing or validation fails.
        """
        schema = output_schema.model_json_schema()
        augmented_system = (
            f"{system_prompt}\n\n"
            "You MUST respond with valid JSON matching this schema:\n"
            f"```json\n{json.dumps(schema, indent=2)}\n```\n"
            "Respond ONLY with the JSON object, no extra text."
        ).strip()

        response = await self.complete(
            prompt=prompt,
            system_prompt=augmented_system,
            model=model,
            purpose=purpose,
            user_settings=user_settings,
            usage_db=usage_db,
            usage_user_id=usage_user_id,
        )

        try:
            cleaned = re.sub(r'^```(?:json)?\s*', '', response.content.strip())
            cleaned = re.sub(r'\s*```$', '', cleaned)
            data = json.loads(cleaned)
            return output_schema.model_validate(data)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.error(
                "structured_output_parse_failed",
                content=response.content[:500],
                error=str(exc),
            )
            try:
                data = json.loads(response.content)
                return output_schema.model_validate(data)
            except Exception:
                raise LLMProviderError(
                    provider=response.provider,
                    message=f"Failed to parse structured output: {exc}",
                ) from exc

    def _record_metrics(
        self,
        *,
        provider: str,
        model: str,
        purpose: str,
        status: str,
        latency_s: float,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        cost: float = 0.0,
    ) -> None:
        """Record Prometheus metrics for an LLM call."""
        llm_requests_total.labels(
            provider=provider, model=model, status=status
        ).inc()
        llm_latency_seconds.labels(
            provider=provider, model=model, purpose=purpose
        ).observe(latency_s)
        if prompt_tokens:
            llm_tokens_total.labels(
                provider=provider, model=model, direction="prompt"
            ).inc(prompt_tokens)
        if completion_tokens:
            llm_tokens_total.labels(
                provider=provider, model=model, direction="completion"
            ).inc(completion_tokens)
        if cost > 0:
            llm_cost_usd.labels(provider=provider, model=model).inc(cost)
