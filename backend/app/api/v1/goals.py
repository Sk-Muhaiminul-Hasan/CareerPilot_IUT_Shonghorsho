"""Career goal API routes.

Endpoints
---------
POST   /goals/                             Create a goal
GET    /goals/                             List goals (paginated, optional filters)
GET    /goals/dashboard-progress           Dashboard progress widget data
GET    /goals/{goal_id}                    Get a single goal
PATCH  /goals/{goal_id}                   Partially update a goal
PUT    /goals/{goal_id}/progress          Update only the current progress value
DELETE /goals/{goal_id}                   Delete a goal
POST   /goals/{goal_id}/generate-roadmap  Generate AI roadmap for a goal
GET    /goals/{goal_id}/roadmap           Retrieve existing roadmap
PATCH  /goals/roadmap-tasks/{id}/complete Mark a roadmap task as complete
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_current_user
from app.config.constants import DEFAULT_PAGE_SIZE
from app.schemas.goal import (
    GoalCreate,
    GoalListResponse,
    GoalProgressUpdate,
    GoalResponse,
    GoalUpdate,
)
from app.schemas.roadmap import (
    DashboardProgressResponse,
    RoadmapResponse,
    RoadmapTaskCompleteResponse,
)
from app.services import goal as goal_service
from app.services import roadmap as roadmap_service

logger = structlog.get_logger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Goal CRUD (existing — unchanged)
# ---------------------------------------------------------------------------


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
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=100, description="Items per page"),
    status: str | None = Query(
        default=None,
        description="Filter by status: active | paused | completed | cancelled",
    ),
    category: str | None = Query(
        default=None,
        description=(
            "Filter by category: applications | learning | networking | interview_prep | other"
        ),
    ),
) -> GoalListResponse:
    """List goals sorted by status (active first) then progress descending."""
    return await goal_service.list_goals(page, page_size, status, category)


# ---------------------------------------------------------------------------
# Roadmap dashboard-progress — MUST come before /{goal_id} to avoid conflict
# ---------------------------------------------------------------------------


@router.get(
    "/dashboard-progress",
    response_model=DashboardProgressResponse,
    summary="Goal roadmap progress for the dashboard widget",
)
async def get_dashboard_progress(
    user_id: str = Depends(get_current_user),
) -> DashboardProgressResponse:
    """Return all active goals' roadmap progress and nudge messages for the dashboard widget."""
    return await roadmap_service.get_dashboard_progress(user_id)


# ---------------------------------------------------------------------------
# Roadmap task completion — MUST come before /{goal_id} to avoid conflict
# ---------------------------------------------------------------------------


@router.patch(
    "/roadmap-tasks/{roadmap_task_id}/complete",
    response_model=RoadmapTaskCompleteResponse,
    summary="Mark a roadmap task as complete",
)
async def complete_roadmap_task(
    roadmap_task_id: str,
    _user_id: str = Depends(get_current_user),
) -> RoadmapTaskCompleteResponse:
    """Mark a roadmap task as complete, update the linked TodoItem, recompute progress.
    Triggers AI re-plan if user is more than 15% behind expected pace.
    """
    from app.core.exceptions import RecordNotFoundError

    try:
        return await roadmap_service.complete_task(roadmap_task_id)
    except RecordNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Goal CRUD (existing — unchanged)
# ---------------------------------------------------------------------------


@router.get(
    "/{goal_id}",
    response_model=GoalResponse,
    summary="Get a career goal",
)
async def get_goal(goal_id: str) -> GoalResponse:
    """Get a single goal by ID. Returns 404 if not found."""
    return await goal_service.get_goal(goal_id)


@router.patch(
    "/{goal_id}",
    response_model=GoalResponse,
    summary="Update a career goal",
)
async def update_goal(
    goal_id: str,
    data: GoalUpdate,
) -> GoalResponse:
    """Partially update a goal. Only supplied fields are changed.
    Setting status='completed' auto-sets completed_at and progress to 100%.
    """
    goal = await goal_service.update_goal(goal_id, data)
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
) -> GoalResponse:
    """Set the current progress value for a goal.
    progress_percent is recomputed automatically.
    If current_value reaches target_value, the goal is auto-completed.
    """
    goal = await goal_service.update_progress(goal_id, data)
    logger.info("goal_progress_updated", goal_id=goal_id, current=data.current_value)
    return goal


@router.delete(
    "/{goal_id}",
    status_code=204,
    summary="Delete a career goal",
)
async def delete_goal(goal_id: str) -> None:
    """Delete a goal by ID. Returns 404 if not found."""
    await goal_service.delete_goal(goal_id)
    logger.info("goal_deleted", goal_id=goal_id)


# ---------------------------------------------------------------------------
# Roadmap generation and retrieval
# ---------------------------------------------------------------------------


@router.post(
    "/{goal_id}/generate-roadmap",
    response_model=RoadmapResponse,
    status_code=201,
    summary="Generate AI roadmap for a goal",
)
async def generate_roadmap(
    goal_id: str,
    user_id: str = Depends(get_current_user),
) -> RoadmapResponse:
    """Call the AI to generate a structured career roadmap for the given goal.
    Persists RoadmapPhase, TodoItem (Task), RoadmapTask, and RoadmapMeta rows.
    Replaces any existing roadmap for this goal.
    """
    from app.core.exceptions import RecordNotFoundError

    try:
        result = await roadmap_service.generate_roadmap(goal_id, user_id)
        logger.info("roadmap_generated", goal_id=goal_id)
        return result
    except RecordNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("roadmap_generation_failed", goal_id=goal_id, error=str(exc))
        raise HTTPException(status_code=500, detail=f"Roadmap generation failed: {exc}") from exc


@router.get(
    "/{goal_id}/roadmap",
    response_model=RoadmapResponse,
    summary="Get existing roadmap for a goal",
)
async def get_roadmap(
    goal_id: str,
    _user_id: str = Depends(get_current_user),
) -> RoadmapResponse:
    """Return the previously generated roadmap for the given goal.
    Returns 404 if no roadmap has been generated yet.
    """
    from app.core.exceptions import RecordNotFoundError

    try:
        return await roadmap_service.get_roadmap(goal_id)
    except RecordNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
