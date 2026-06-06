"""Browser automation agent wrapping the browser-use package.

Provides a high-level ``BrowserAgent`` that delegates to the browser-use
``Agent`` for AI-driven web navigation, form filling, and data extraction.
"""

from __future__ import annotations

from typing import Any

import structlog
from pydantic import BaseModel

from app.config.settings import get_settings
from app.core.exceptions import BrowserError
from app.core.llm.client import LLMNotConfiguredError, UserLLMConfig

logger = structlog.get_logger(__name__)


class BrowserAgent:
    """Wraps browser-use Agent for AI-driven browser navigation.

    Manages a single browser session with cookie persistence,
    configurable LLM, and structured output extraction.

    Args:
        task: Natural language description of what the agent should do.
        llm: LangChain-compatible LLM instance. Defaults to ChatOpenAI.
        sensitive_data: Credentials dict passed to browser-use
            (e.g. ``{"x_username": "...", "x_password": "..."}``).
        output_model: Pydantic model for structured output extraction.
    """

    def __init__(
        self,
        task: str,
        llm: Any | None = None,
        sensitive_data: dict[str, str] | None = None,
        output_model: type[BaseModel] | None = None,
    ) -> None:
        """Initialize a browser agent for a specific task.

        Args:
            task: Natural language description of what the agent should do.
            llm: LangChain-compatible LLM instance. Defaults to ChatOpenAI.
            sensitive_data: Credentials dict passed to browser-use.
            output_model: Pydantic model for structured output extraction.
        """
        self._settings = get_settings().browser
        self._task = task
        self._llm = llm
        self._sensitive_data = sensitive_data or {}
        self._output_model = output_model
        self._user_llm_config: UserLLMConfig | None = None
        self._agent: Any | None = None
        self._browser: Any | None = None

    async def run(self) -> Any:
        try:
            from browser_use import Agent, Browser, BrowserConfig
        except Exception as exc:
            import traceback
            traceback.print_exc()
            raise

        # Support both old (0.1.x) and new (>=0.10) browser-use APIs.
        try:
            from browser_use import BrowserProfile  # noqa: F401
            self._browser = Browser(headless=self._settings.headless)
        except ImportError:
            self._browser = Browser(config=BrowserConfig(
                headless=self._settings.headless,
            ))

        llm = self._llm or self._get_default_llm()

        agent_kwargs: dict[str, Any] = {
         "task": self._task,
         "llm": llm,
         "browser": self._browser,
         "max_failures": self._settings.max_failures,
         "max_actions_per_step": 10,
        }
        if self._sensitive_data:
         agent_kwargs["sensitive_data"] = self._sensitive_data
        if self._output_model:
            agent_kwargs["generate_gif"] = False

        self._agent = Agent(**agent_kwargs)

        try:
            result = await self._agent.run(max_steps=self._settings.max_steps)
            logger.info("browser_agent.completed", task=self._task[:80])

            if self._output_model and hasattr(result, "model_output"):
                return result.model_output()
            return result

        except Exception as exc:
            logger.error("browser_agent.failed", task=self._task[:80], error=str(exc))
            raise BrowserError(str(exc)) from exc

        finally:    
            if self._browser:
                await self._browser.close()

    def _get_default_llm(self) -> Any:
        """Create a default LLM instance for browser-use Agent from user config."""
        user_cfg = getattr(self, "_user_llm_config", None)
        if user_cfg is None:
            raise LLMNotConfiguredError(
                "AI not configured. Please configure your AI model in Settings."
            )
        return self._build_langchain_llm(user_cfg)

    @staticmethod
    def _build_langchain_llm(user_cfg: UserLLMConfig) -> Any:
        """Build a langchain LLM from a per-user UserLLMConfig."""
        model = user_cfg.model_for("general")
        api_key = user_cfg.api_key_for("general")
        if not model or not api_key:
            raise LLMNotConfiguredError(
                "AI not configured. Please configure your AI model in Settings."
            )
        temperature = get_settings().llm.temperature

        if "/" in model and not model.startswith("gpt-") and not model.startswith("o1"):
            try:
                from langchain_openai import ChatOpenAI as ChatOpenRouter
            except ImportError as exc:
                raise BrowserError(
                    "langchain-openai not installed. "
                    "Install with: pip install langchain-openai"
                ) from exc
            return ChatOpenRouter(
                model=model,
                openai_api_key=api_key,
                openai_api_base="https://openrouter.ai/api/v1",
                temperature=temperature,
            )

        try:
            from langchain_openai import ChatOpenAI
        except ImportError as exc:
            raise BrowserError(
                "langchain-openai not installed. "
                "Install with: pip install langchain-openai"
            ) from exc

        return ChatOpenAI(
            model=model,
            api_key=api_key,
            temperature=temperature,
        )

    async def close(self) -> None:
        """Close the browser session and release resources."""
        if self._browser:
            try:
                await self._browser.close()
            except Exception as exc:
                logger.warning("browser_agent.close_error", error=str(exc))
            finally:
                self._browser = None
                self._agent = None

    async def __aenter__(self) -> BrowserAgent:
        """Support async context manager usage."""
        return self

    async def __aexit__(self, *exc_info: Any) -> None:
        """Close browser on context exit."""
        await self.close()
