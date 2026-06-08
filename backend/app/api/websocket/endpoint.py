"""WebSocket endpoint for real-time client communication."""

import structlog
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.api.websocket.events import manager
from app.config.settings import get_settings
from app.core.auth import _decode_token

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = Query(...)) -> None:
    """Main WebSocket endpoint for real-time updates.

    Clients connect here to receive live events such as:
    - Application status changes
    - Job search progress
    - Queue processing updates

    Supports ping/pong keep-alive from the client side.
    """
    origin = ws.headers.get("origin", "")
    allowed = get_settings().cors_origins
    is_local_origin = (
        not origin
        or origin.startswith("http://localhost")
        or origin.startswith("http://127.0.0.1")
        or origin.startswith("https://localhost")
        or origin.startswith("https://127.0.0.1")
    )
    if not is_local_origin and origin not in allowed:
        await ws.close(code=4003, reason="Origin not allowed")
        return

    try:
        user_id = _decode_token(token)["sub"]
    except Exception:
        await ws.close(code=4001, reason="Unauthorized")
        return

    await manager.connect(user_id, ws)
    try:
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await manager.send_to(ws, {"type": "pong", "payload": {}})
            else:
                logger.debug("ws_message_received", user_id=user_id, data=data[:100])
    except WebSocketDisconnect:
        await manager.disconnect(user_id, ws)
