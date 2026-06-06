"""Nudge API routes."""

import structlog
from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, get_redis
from app.schemas.nudge import NudgeResponse
from app.services.nudge import get_nudge

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get(
    "",
    response_model=NudgeResponse,
    summary="Get AI career nudge",
    description="Returns a personalized career nudge with recommended jobs.",
)
async def get_nudge_endpoint(
    db: AsyncSession = Depends(get_db),
    redis: Redis | None = Depends(get_redis),
    user_id: str = Depends(get_current_user),
) -> NudgeResponse:
    return await get_nudge(db, redis, user_id=user_id)
