"""Platform registry for dynamic platform plugin management."""

from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.automation.platforms.base import JobPlatform

logger = structlog.get_logger(__name__)


class PlatformRegistry:
    """Registry for job platform plugins.

    Provides a central lookup for platform classes, allowing
    dynamic registration of new platforms at runtime.
    """

    def __init__(self) -> None:
        self._platforms: dict[str, type[JobPlatform]] = {}

    def register(self, name: str, platform_class: type[JobPlatform]) -> None:
        """Register a platform class under the given name.

        Args:
            name: Unique identifier for the platform.
            platform_class: The ``JobPlatform`` subclass to register.
        """
        if name in self._platforms:
            logger.warning(
                "platform_overwritten",
                name=name,
                old=self._platforms[name].__name__,
                new=platform_class.__name__,
            )
        self._platforms[name] = platform_class
        logger.info("platform_registered", name=name, cls=platform_class.__name__)

    def get(self, name: str) -> type[JobPlatform] | None:
        """Look up a registered platform class by name.

        Args:
            name: Platform identifier.

        Returns:
            The platform class, or ``None`` if not registered.
        """
        return self._platforms.get(name)

    def has(self, name: str) -> bool:
        """Check whether a platform is registered.

        Args:
            name: Platform identifier.

        Returns:
            ``True`` if the platform is registered.
        """
        return name in self._platforms

    def list_platforms(self) -> list[str]:
        """Return the names of all registered platforms."""
        return list(self._platforms.keys())

    def create(self, name: str, **kwargs: Any) -> JobPlatform:
        """Instantiate a registered platform.

        Args:
            name: Platform identifier.
            **kwargs: Arguments forwarded to the platform constructor.

        Returns:
            A new ``JobPlatform`` instance.

        Raises:
            KeyError: If the platform name is not registered.
        """
        platform_class = self._platforms.get(name)
        if platform_class is None:
            registered = ", ".join(self._platforms.keys()) or "(none)"
            raise KeyError(
                f"Platform '{name}' not registered. Available: {registered}"
            )
        return platform_class(**kwargs)

    @asynccontextmanager
    async def create_async(
        self,
        name: str,
        db: AsyncSession,
        user_id: str,
    ) -> AsyncIterator[JobPlatform]:
        """Instantiate a registered platform using the user's per-user AI config.

        Loads user settings, builds ``UserLLMConfig``, and injects it into the
        platform instance so all subsequent ``BrowserAgent`` calls use the
        caller's credentials.

        Args:
            name: Platform identifier.
            db: Async database session for loading user settings.
            user_id: Authenticated user ID.

        Yields:
            Configured ``JobPlatform`` instance.

        Raises:
            KeyError: If the platform name is not registered.
        """
        platform_class = self._platforms.get(name)
        if platform_class is None:
            registered = ", ".join(self._platforms.keys()) or "(none)"
            raise KeyError(
                f"Platform '{name}' not registered. Available: {registered}"
            )

        from_async_fn = getattr(platform_class, "from_async", None)
        if callable(from_async_fn):
            platform = await from_async_fn(db=db, user_id=user_id)
        else:
            platform = platform_class()

        try:
            yield platform
        finally:
            await platform.aclose()


# Module-level singleton
platform_registry = PlatformRegistry()
