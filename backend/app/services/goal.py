"""In-memory service for career goals.

No database dependency — data lives in a module-level dict.
To switch to a real DB: replace each function body with SQLAlchemy
async queries against the Goal model. Keep the signatures
identical so the router never needs to change.
"""

from datetime import datetime, timezone
from uuid import uuid4

from app.core.exceptions import RecordNotFoundError
from app.schemas.goal import (
    GoalCreate,
    GoalListResponse,
    GoalProgressUpdate,
    GoalResponse,
    GoalUpdate,
)

# ── In-memory store ───────────────────────────────────────────────────────────
_store: dict[str, dict] = {}


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _compute_progress(current: int, target: int) -> float:
    """Return progress as a 0–100 float, capped at 100."""
    if target <= 0:
        return 0.0
    return min(round((current / target) * 100, 2), 100.0)


def _make_response(record: dict) -> GoalResponse:
    return GoalResponse.model_validate(record)


# ── CRUD operations ───────────────────────────────────────────────────────────

async def create_goal(data: GoalCreate) -> GoalResponse:
    """Create a new career goal."""
    now = _now()
    goal_id = uuid4().hex
    record: dict = {
        "id": goal_id,
        "user_id": None,
        "title": data.title,
        "description": data.description,
        "category": data.category,
        "target_value": data.target_value,
        "current_value": 0,
        "progress_percent": 0.0,
        "status": "active",
        "color_variant": data.color_variant,
        "due_label": data.due_label,
        "due_date": data.due_date,
        "completed_at": None,
        "created_at": now,
        "updated_at": now,
    }
    _store[goal_id] = record
    return _make_response(record)


async def get_goal(goal_id: str) -> GoalResponse:
    """Get a single goal by ID. Raises 404 if not found."""
    record = _store.get(goal_id)
    if not record:
        raise RecordNotFoundError(f"Goal '{goal_id}' not found")
    return _make_response(record)


async def list_goals(
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    category: str | None = None,
) -> GoalListResponse:
    """List goals with optional status/category filters and pagination."""
    items = list(_store.values())

    if status:
        items = [g for g in items if g["status"] == status]
    if category:
        items = [g for g in items if g["category"] == category]

    # Sort by status (active first), then progress descending
    status_order = {"active": 0, "paused": 1, "completed": 2, "cancelled": 3}
    items.sort(
        key=lambda g: (
            status_order.get(g["status"], 9),
            -g["progress_percent"],
        )
    )

    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]

    return GoalListResponse(
        items=[_make_response(g) for g in page_items],
        total=total,
        page=page,
        page_size=page_size,
        has_next=start + page_size < total,
    )


async def update_goal(goal_id: str, data: GoalUpdate) -> GoalResponse:
    """Partially update a goal. Raises 404 if not found."""
    record = _store.get(goal_id)
    if not record:
        raise RecordNotFoundError(f"Goal '{goal_id}' not found")

    patch = data.model_dump(exclude_unset=True)
    record.update(patch)
    record["updated_at"] = _now()

    # Recompute progress whenever target or current changes
    record["progress_percent"] = _compute_progress(
        record["current_value"], record["target_value"]
    )

    # Auto-set completed_at when status flips to completed
    if patch.get("status") == "completed" and not record.get("completed_at"):
        record["completed_at"] = _now()
        record["current_value"] = record["target_value"]
        record["progress_percent"] = 100.0

    _store[goal_id] = record
    return _make_response(record)


async def update_progress(
    goal_id: str,
    data: GoalProgressUpdate,
) -> GoalResponse:
    """Update only the current_value of a goal and recompute progress."""
    record = _store.get(goal_id)
    if not record:
        raise RecordNotFoundError(f"Goal '{goal_id}' not found")

    record["current_value"] = data.current_value
    record["progress_percent"] = _compute_progress(
        data.current_value, record["target_value"]
    )
    record["updated_at"] = _now()

    # Auto-complete when target reached
    if data.current_value >= record["target_value"] and record["status"] == "active":
        record["status"] = "completed"
        record["completed_at"] = _now()

    _store[goal_id] = record
    return _make_response(record)


async def delete_goal(goal_id: str) -> None:
    """Delete a goal. Raises 404 if not found."""
    if goal_id not in _store:
        raise RecordNotFoundError(f"Goal '{goal_id}' not found")
    _store.pop(goal_id)
