"""Career goal API routes.

Endpoints
---------
POST   /goals/                       Create a goal
GET    /goals/                       List goals (paginated, optional filters)
GET    /goals/{goal_id}              Get a single goal
PATCH  /goals/{goal_id}              Partially update a goal
PUT    /goals/{goal_id}/progress     Update only the current progress value
DELETE /goals/{goal_id}              Delete a goal
"""

import structlog
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.config.constants import DEFAULT_PAGE_SIZE
from app.schemas.goal import (
    GoalCreate,
    GoalListResponse,
    GoalProgressUpdate,
    GoalResponse,
    GoalUpdate,
)
from app.services import goal as goal_service

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post(
    "/",
    response_model=GoalResponse,
    status_code=201,
    summary="Create a career goal",
)
async def create_goal(
    data: GoalCreate,
    user_id: str = Depends(get_current_user),
) -> GoalResponse:
    """Create a new career accountability goal."""
    goal = await goal_service.create_goal(data, user_id=user_id)
    logger.info("goal_created", goal_id=goal.id, title=goal.title)
    return goal


@router.get(
    "/",
    response_model=GoalListResponse,
    summary="List career goals",
)
async def list_goals(
    user_id: str = Depends(get_current_user),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=100, description="Items per page"),
    status: str | None = Query(
        default=None,
        description="Filter by status: active | paused | completed | cancelled",
    ),
    category: str | None = Query(
        default=None,
        description=(
            "Filter by category: applications | learning | "
            "networking | interview_prep | other"
        ),
    ),
) -> GoalListResponse:
    """List goals sorted by status (active first) then progress descending."""
    return await goal_service.list_goals(user_id, page, page_size, status, category)


@router.get(
    "/{goal_id}",
    response_model=GoalResponse,
    summary="Get a career goal",
)
async def get_goal(
    goal_id: str,
    user_id: str = Depends(get_current_user),
) -> GoalResponse:
    """Get a single goal by ID. Returns 404 if not found."""
    return await goal_service.get_goal(goal_id, user_id)


@router.patch(
    "/{goal_id}",
    response_model=GoalResponse,
    summary="Update a career goal",
)
async def update_goal(
    goal_id: str,
    data: GoalUpdate,
    user_id: str = Depends(get_current_user),
) -> GoalResponse:
    """Partially update a goal. Only supplied fields are changed.
    Setting status='completed' auto-sets completed_at and progress to 100%.
    """
    goal = await goal_service.update_goal(goal_id, user_id, data)
    logger.info("goal_updated", goal_id=goal_id)
    return goal


@router.put(
    "/{goal_id}/progress",
    response_model=GoalResponse,
    summary="Update goal progress",
)
async def update_progress(
    goal_id: str,
    data: GoalProgressUpdate,
    user_id: str = Depends(get_current_user),
) -> GoalResponse:
    """Set the current progress value for a goal.
    progress_percent is recomputed automatically.
    If current_value reaches target_value, the goal is auto-completed.
    """
    goal = await goal_service.update_progress(goal_id, user_id, data)
    logger.info("goal_progress_updated", goal_id=goal_id, current=data.current_value)
    return goal


@router.delete(
    "/{goal_id}",
    status_code=204,
    summary="Delete a career goal",
)
async def delete_goal(
    goal_id: str,
    user_id: str = Depends(get_current_user),
) -> None:
    """Delete a goal by ID. Returns 404 if not found."""
    await goal_service.delete_goal(goal_id, user_id)
    logger.info("goal_deleted", goal_id=goal_id)
