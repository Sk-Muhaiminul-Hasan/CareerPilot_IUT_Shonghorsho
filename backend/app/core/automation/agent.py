"""Browser automation agent wrapping the browser-use package.

Provides a high-level ``BrowserAgent`` that delegates to the browser-use
``Agent`` for AI-driven web navigation, form filling, and data extraction.
"""

from __future__ import annotations

import asyncio
from typing import Any

import structlog
from pydantic import BaseModel

from app.config.settings import get_settings
from app.core.exceptions import BrowserError

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
        self._agent: Any | None = None
        self._browser: Any | None = None

    async def run(self) -> Any:
        try:
            from browser_use import Agent, Browser, BrowserConfig
        except Exception as exc:
            import traceback
            traceback.print_exc()
            raise

        browser_config = BrowserConfig(
            headless=self._settings.headless,
            user_data_dir=self._settings.user_data_dir,
            keep_alive=self._settings.keep_alive,
        )
        self._browser = Browser(config=browser_config)

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
            # Apply timeout to the agent execution using step_timeout setting
            result = await asyncio.wait_for(
                self._agent.run(max_steps=self._settings.max_steps),
                timeout=self._settings.step_timeout
            )
            logger.info("browser_agent.completed", task=self._task[:80])

            if self._output_model and hasattr(result, "model_output"):
                return result.model_output()
            return result

        except asyncio.TimeoutError:
            logger.error("browser_agent.timeout", task=self._task[:80], timeout=self._settings.step_timeout)
            raise BrowserError(f"Agent execution timed out after {self._settings.step_timeout} seconds") from None
        except Exception as exc:
            logger.error("browser_agent.failed", task=self._task[:80], error=str(exc))
            raise BrowserError(str(exc)) from exc

        finally:    
            if not self._settings.keep_alive and self._browser:
                await self._browser.close()

    def _get_default_llm(self) -> Any:
        """Create a default LLM instance for browser-use Agent."""
        settings = get_settings()
        model = settings.llm.default_model
        temperature = settings.llm.temperature

    # OpenRouter model (format: provider/model)
        

    # Default: OpenAI models
        try:
            from langchain_openai import ChatOpenAI
        except ImportError as exc:
            raise BrowserError(
                "langchain-openai not installed. "
                "Install with: pip install langchain-openai"
            ) from exc

        return ChatOpenAI(
            model=model,
            api_key=settings.llm.openai_api_key.get_secret_value(),
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
