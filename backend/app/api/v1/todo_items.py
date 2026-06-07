"""To-do item API routes.

Endpoints
---------
POST   /todos/                       Create a to-do item
GET    /todos/                       List to-do items (paginated, optional filters)
GET    /todos/{todo_id}              Get a single to-do item
PATCH  /todos/{todo_id}              Partially update a to-do item
DELETE /todos/{todo_id}              Delete a to-do item
"""

import structlog
from fastapi import APIRouter, Query

from app.config.constants import DEFAULT_PAGE_SIZE
from app.schemas.todo_item import (
    TodoItemCreate,
    TodoItemListResponse,
    TodoItemResponse,
    TodoItemUpdate,
)
from app.services import todo_item as todo_service

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post(
    "/",
    response_model=TodoItemResponse,
    status_code=201,
    summary="Create a to-do item",
)
async def create_todo(data: TodoItemCreate) -> TodoItemResponse:
    """Create a new to-do item, optionally linked to a goal or calendar event."""
    todo = await todo_service.create_todo(data)
    logger.info("todo_created", todo_id=todo.id)
    return todo


@router.get(
    "/",
    response_model=TodoItemListResponse,
    summary="List to-do items",
)
async def list_todos(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=100, description="Items per page"),
    status: str | None = Query(default=None, description="Filter by status: todo | in_progress | done | cancelled"),
    goal_id: str | None = Query(default=None, description="Filter by parent goal ID"),
) -> TodoItemListResponse:
    """List to-do items sorted by priority (high first) then due_date."""
    return await todo_service.list_todos(page, page_size, status, goal_id)


@router.get(
    "/{todo_id}",
    response_model=TodoItemResponse,
    summary="Get a to-do item",
)
async def get_todo(todo_id: str) -> TodoItemResponse:
    """Get a single to-do item by ID. Returns 404 if not found."""
    return await todo_service.get_todo(todo_id)


@router.patch(
    "/{todo_id}",
    response_model=TodoItemResponse,
    summary="Update a to-do item",
)
async def update_todo(
    todo_id: str,
    data: TodoItemUpdate,
) -> TodoItemResponse:
    """Partially update a to-do item. Only supplied fields are changed.
    Setting is_completed=true also sets status='done' automatically.
    """
    todo = await todo_service.update_todo(todo_id, data)
    logger.info("todo_updated", todo_id=todo_id)
    return todo


@router.delete(
    "/{todo_id}",
    status_code=204,
    summary="Delete a to-do item",
)
async def delete_todo(todo_id: str) -> None:
    """Delete a to-do item by ID. Returns 404 if not found."""
    await todo_service.delete_todo(todo_id)
    logger.info("todo_deleted", todo_id=todo_id)
