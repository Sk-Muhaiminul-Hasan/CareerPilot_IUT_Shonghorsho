"""WebSocket connection manager for real-time event broadcasting."""

import json
from typing import Any

import structlog
from fastapi import WebSocket

logger = structlog.get_logger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections and message broadcasting.

    Provides connect/disconnect lifecycle, targeted sends, and
    broadcast to all connected clients.
    """

    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = {}

    @property
    def active_count(self) -> int:
        """Number of currently connected clients."""
        return sum(len(sockets) for sockets in self._connections.values())

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        """Accept and register a new WebSocket connection for a user.

        Args:
            user_id: Identifier for the authenticated user.
            ws: The incoming WebSocket connection.
        """
        await ws.accept()
        self._connections.setdefault(user_id, []).append(ws)
        logger.info("ws_connected", user_id=user_id, active=self.active_count)

    async def disconnect(self, user_id: str, ws: WebSocket) -> None:
        """Remove a WebSocket connection from the active set.

        Args:
            user_id: Identifier for the authenticated user.
            ws: The WebSocket connection to remove.
        """
        sockets = self._connections.get(user_id, [])
        if ws in sockets:
            sockets.remove(ws)
        if not sockets:
            self._connections.pop(user_id, None)
        logger.info("ws_disconnected", user_id=user_id, active=self.active_count)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Send a JSON message to all connected clients.

        Disconnected clients are silently removed.

        Args:
            message: Dict to serialize and send as JSON text.
        """
        payload = json.dumps(message)
        stale: list[tuple[str, WebSocket]] = []

        for user_id, sockets in list(self._connections.items()):
            for ws in sockets:
                try:
                    await ws.send_text(payload)
                except Exception:
                    stale.append((user_id, ws))

        for user_id, ws in stale:
            await self.disconnect(user_id, ws)

    async def send_to(self, ws: WebSocket, message: dict[str, Any]) -> None:
        """Send a JSON message to a specific client.

        Args:
            ws: Target WebSocket connection.
            message: Dict to serialize and send as JSON text.
        """
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            # Disconnect handling requires knowing the user_id; fall back to noop
            pass

    async def send_to_user(
        self, user_id: str, message: dict[str, Any]
    ) -> None:
        """Send a JSON message to all sockets for a given user.

        Args:
            user_id: Target user identifier.
            message: Dict to serialize and send as JSON text.
        """
        payload = json.dumps(message)
        sockets = self._connections.get(user_id, [])
        stale: list[WebSocket] = []

        for ws in sockets:
            try:
                await ws.send_text(payload)
            except Exception:
                stale.append(ws)

        for ws in stale:
            await self.disconnect(user_id, ws)


manager = ConnectionManager()
