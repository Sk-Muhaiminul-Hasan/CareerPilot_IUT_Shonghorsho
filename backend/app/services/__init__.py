"""Business logic service layer.

Modules:
    job_search     -- Job search and CRUD operations
    application    -- Application lifecycle management
    resume         -- Resume upload, generation, and scoring
    analytics      -- Dashboard statistics and reporting
    queue          -- Redis-based task queue operations
    calendar_event -- Calendar event CRUD (in-memory until DB is ready)
    goal           -- Career goal CRUD (in-memory until DB is ready)
    todo_item      -- To-do item CRUD (in-memory until DB is ready)
    tracker        -- Kanban board, notes, and labels (in-memory until DB is ready)
"""

__all__ = [
    "analytics",
    "application",
    "calendar_event",
    "goal",
    "job_search",
    "queue",
    "resume",
    "todo_item",
    "tracker",
]
