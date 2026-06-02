"""In-memory service for to-do items.

No database dependency — data lives in a module-level dict.
To switch to a real DB: replace each function body with SQLAlchemy
async queries against the TodoItem model. Keep the signatures
identical so the router never needs to change.
"""

from datetime import datetime, timezone
from uuid import uuid4

from app.core.exceptions import RecordNotFoundError
from app.schemas.todo_item import (
    TodoItemCreate,
    TodoItemListResponse,
    TodoItemResponse,
    TodoItemUpdate,
)

# ── In-memory store ───────────────────────────────────────────────────────────
_store: dict[str, dict] = {}


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _make_response(record: dict) -> TodoItemResponse:
    return TodoItemResponse.model_validate(record)


# ── CRUD operations ───────────────────────────────────────────────────────────

async def create_todo(data: TodoItemCreate) -> TodoItemResponse:
    """Create a new to-do item."""
    now = _now()
    todo_id = uuid4().hex
    record: dict = {
        "id": todo_id,
        "user_id": None,
        "goal_id": data.goal_id,
        "calendar_event_id": data.calendar_event_id,
        "title": data.title,
        "description": data.description,
        "due_date": data.due_date,
        "priority": int(data.priority),
        "status": "todo",
        "is_completed": False,
        "completed_at": None,
        "recurrence": data.recurrence,
        "created_at": now,
        "updated_at": now,
    }
    _store[todo_id] = record
    return _make_response(record)


async def get_todo(todo_id: str) -> TodoItemResponse:
    """Get a single to-do item by ID. Raises 404 if not found."""
    record = _store.get(todo_id)
    if not record:
        raise RecordNotFoundError(f"TodoItem '{todo_id}' not found")
    return _make_response(record)


async def list_todos(
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    goal_id: str | None = None,
) -> TodoItemListResponse:
    """List to-do items with optional status/goal filters and pagination."""
    items = list(_store.values())

    if status:
        items = [t for t in items if t["status"] == status]
    if goal_id:
        items = [t for t in items if t["goal_id"] == goal_id]

    # Sort by priority descending (HIGH first), then due_date ascending
    items.sort(
        key=lambda t: (
            -t["priority"],
            t["due_date"] or datetime.max.replace(tzinfo=timezone.utc),
        )
    )

    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]

    return TodoItemListResponse(
        items=[_make_response(t) for t in page_items],
        total=total,
        page=page,
        page_size=page_size,
        has_next=start + page_size < total,
    )


async def update_todo(
    todo_id: str,
    data: TodoItemUpdate,
) -> TodoItemResponse:
    """Partially update a to-do item. Raises 404 if not found."""
    record = _store.get(todo_id)
    if not record:
        raise RecordNotFoundError(f"TodoItem '{todo_id}' not found")

    patch = data.model_dump(exclude_unset=True)

    # Convert enum to its value if present
    if "priority" in patch and patch["priority"] is not None:
        patch["priority"] = int(patch["priority"])

    record.update(patch)
    record["updated_at"] = _now()

    # Auto-set completed_at when marking done
    if patch.get("is_completed") and not record.get("completed_at"):
        record["completed_at"] = _now()
        record["status"] = "done"

    _store[todo_id] = record
    return _make_response(record)


async def delete_todo(todo_id: str) -> None:
    """Delete a to-do item. Raises 404 if not found."""
    if todo_id not in _store:
        raise RecordNotFoundError(f"TodoItem '{todo_id}' not found")
    _store.pop(todo_id)
