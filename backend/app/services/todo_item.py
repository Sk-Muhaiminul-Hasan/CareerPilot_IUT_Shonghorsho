"""To-do item service — all operations now async SQLAlchemy DB queries."""

from datetime import UTC, datetime

from sqlalchemy import select

from app.core.exceptions import RecordNotFoundError
from app.db.session import AsyncSessionLocal
from app.models.todo_item import TodoItem
from app.schemas.todo_item import (
    TodoItemCreate,
    TodoItemListResponse,
    TodoItemResponse,
    TodoItemUpdate,
)


def _now() -> datetime:
    return datetime.now(tz=UTC)


async def create_todo(data: TodoItemCreate, user_id: str | None = None) -> TodoItemResponse:
    async with AsyncSessionLocal() as db, db.begin():
        record = TodoItem(
            user_id=user_id,
            goal_id=data.goal_id,
            calendar_event_id=data.calendar_event_id,
            title=data.title,
            description=data.description,
            due_date=data.due_date,
            priority=data.priority.value,
            recurrence=data.recurrence.value if data.recurrence else None,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return TodoItemResponse.model_validate(record)


async def get_todo(todo_id: str) -> TodoItemResponse:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TodoItem).where(TodoItem.id == todo_id)
        )
        record = result.scalar_one_or_none()
        if not record:
            raise RecordNotFoundError("TodoItem", todo_id)
        return TodoItemResponse.model_validate(record)


async def list_todos(
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    goal_id: str | None = None,
) -> TodoItemListResponse:
    async with AsyncSessionLocal() as db:
        query = select(TodoItem)
        if status:
            query = query.where(TodoItem.status == status)
        if goal_id:
            query = query.where(TodoItem.goal_id == goal_id)

        count_q = select(TodoItem.id)
        if status:
            count_q = count_q.where(TodoItem.status == status)
        if goal_id:
            count_q = count_q.where(TodoItem.goal_id == goal_id)

        total_result = await db.execute(count_q)
        total = len(total_result.scalars().all())

        query = query.order_by(TodoItem.priority.desc(), TodoItem.due_date.asc())
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        result = await db.execute(query)
        records = result.scalars().all()

        return TodoItemListResponse(
            items=[TodoItemResponse.model_validate(r) for r in records],
            total=total,
            page=page,
            page_size=page_size,
            has_next=(offset + page_size) < total,
        )


async def update_todo(
    todo_id: str,
    data: TodoItemUpdate,
) -> TodoItemResponse:
    async with AsyncSessionLocal() as db, db.begin():
        result = await db.execute(
            select(TodoItem).where(TodoItem.id == todo_id)
        )
        record = result.scalar_one_or_none()
        if not record:
            raise RecordNotFoundError("TodoItem", todo_id)

        patch = data.model_dump(exclude_unset=True)

        if "priority" in patch and patch["priority"] is not None:
            patch["priority"] = patch["priority"].value

        if "status" in patch and patch["status"] is not None:
            patch["status"] = patch["status"].value

        if "recurrence" in patch:
            if patch["recurrence"] is not None:
                patch["recurrence"] = patch["recurrence"].value
            else:
                patch.pop("recurrence", None)

        for field, value in patch.items():
            setattr(record, field, value)

        record.updated_at = _now()

        if patch.get("is_completed") and not record.completed_at:
            record.completed_at = _now()
            record.status = "done"

        await db.commit()
        await db.refresh(record)
        return TodoItemResponse.model_validate(record)


async def delete_todo(todo_id: str) -> None:
    async with AsyncSessionLocal() as db, db.begin():
        result = await db.execute(
            select(TodoItem).where(TodoItem.id == todo_id)
        )
        record = result.scalar_one_or_none()
        if not record:
            raise RecordNotFoundError("TodoItem", todo_id)
        await db.delete(record)
        await db.commit()
