"""In-memory service for the application tracker (notes, labels, and board).

No database dependency — data lives in module-level dicts.

To switch to a real DB:
  - Replace each CRUD function body with SQLAlchemy async queries.
  - In get_board(), run a single JOIN query across applications, notes,
    and labels. The router signatures stay the same.
"""

from datetime import datetime, timezone
from uuid import uuid4

from app.core.exceptions import RecordNotFoundError
from app.schemas.tracker import (
    TrackerCardResponse,
    TrackerLabelCreate,
    TrackerLabelResponse,
    TrackerLabelUpdate,
    TrackerNoteCreate,
    TrackerNoteResponse,
    TrackerNoteUpdate,
)

# ── In-memory stores ──────────────────────────────────────────────────────────
_notes: dict[str, dict] = {}    # note_id -> note record
_labels: dict[str, dict] = {}   # label_id -> label record


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _make_note(record: dict) -> TrackerNoteResponse:
    return TrackerNoteResponse.model_validate(record)


def _make_label(record: dict) -> TrackerLabelResponse:
    return TrackerLabelResponse.model_validate(record)


# ── Tracker Note CRUD ─────────────────────────────────────────────────────────

async def create_note(
    application_id: str,
    data: TrackerNoteCreate,
) -> TrackerNoteResponse:
    """Add a note to an application card."""
    now = _now()
    note_id = uuid4().hex
    record: dict = {
        "id": note_id,
        "application_id": application_id,
        "note_type": data.note_type,
        "body": data.body,
        "rating": data.rating,
        "status_snapshot": data.status_snapshot,
        "created_at": now,
        "updated_at": now,
    }
    _notes[note_id] = record
    return _make_note(record)


async def get_note(note_id: str) -> TrackerNoteResponse:
    """Get a single tracker note by ID. Raises 404 if not found."""
    record = _notes.get(note_id)
    if not record:
        raise RecordNotFoundError(f"TrackerNote '{note_id}' not found")
    return _make_note(record)


async def list_notes(
    application_id: str,
) -> list[TrackerNoteResponse]:
    """List all notes for a given application, newest first."""
    items = [n for n in _notes.values() if n["application_id"] == application_id]
    items.sort(key=lambda n: n["created_at"], reverse=True)
    return [_make_note(n) for n in items]


async def update_note(
    note_id: str,
    data: TrackerNoteUpdate,
) -> TrackerNoteResponse:
    """Partially update a tracker note. Raises 404 if not found."""
    record = _notes.get(note_id)
    if not record:
        raise RecordNotFoundError(f"TrackerNote '{note_id}' not found")
    record.update(data.model_dump(exclude_unset=True))
    record["updated_at"] = _now()
    _notes[note_id] = record
    return _make_note(record)


async def delete_note(note_id: str) -> None:
    """Delete a tracker note. Raises 404 if not found."""
    if note_id not in _notes:
        raise RecordNotFoundError(f"TrackerNote '{note_id}' not found")
    _notes.pop(note_id)


# ── Tracker Label CRUD ────────────────────────────────────────────────────────

async def create_label(
    application_id: str,
    data: TrackerLabelCreate,
) -> TrackerLabelResponse:
    """Attach a label to an application card."""
    now = _now()
    label_id = uuid4().hex
    record: dict = {
        "id": label_id,
        "application_id": application_id,
        "name": data.name,
        "color_hex": data.color_hex,
        "created_at": now,
        "updated_at": now,
    }
    _labels[label_id] = record
    return _make_label(record)


async def get_label(label_id: str) -> TrackerLabelResponse:
    """Get a single tracker label by ID. Raises 404 if not found."""
    record = _labels.get(label_id)
    if not record:
        raise RecordNotFoundError(f"TrackerLabel '{label_id}' not found")
    return _make_label(record)


async def list_labels(
    application_id: str,
) -> list[TrackerLabelResponse]:
    """List all labels for a given application."""
    items = [l for l in _labels.values() if l["application_id"] == application_id]
    items.sort(key=lambda l: l["name"])
    return [_make_label(l) for l in items]


async def update_label(
    label_id: str,
    data: TrackerLabelUpdate,
) -> TrackerLabelResponse:
    """Partially update a tracker label. Raises 404 if not found."""
    record = _labels.get(label_id)
    if not record:
        raise RecordNotFoundError(f"TrackerLabel '{label_id}' not found")
    record.update(data.model_dump(exclude_unset=True))
    record["updated_at"] = _now()
    _labels[label_id] = record
    return _make_label(record)


async def delete_label(label_id: str) -> None:
    """Delete a tracker label. Raises 404 if not found."""
    if label_id not in _labels:
        raise RecordNotFoundError(f"TrackerLabel '{label_id}' not found")
    _labels.pop(label_id)


# ── Kanban board ──────────────────────────────────────────────────────────────

# Map of application status -> Kanban column name
_COLUMN_MAP: dict[str, str] = {
    "applied":        "Applied",
    "applying":       "Applied",
    "queued":         "Applied",
    "pending_review": "Applied",
    "approved":       "Applied",
    "interview":      "Interviewing",
    "offer":          "Offer",
    "rejected":       "Rejected",
    "withdrawn":      "Rejected",
    "failed":         "Rejected",
}

KANBAN_COLUMNS: list[str] = ["Applied", "Interviewing", "Offer", "Rejected"]

# Lightweight in-memory application store used *only* by the tracker board.
# Populated by register_application() below whenever the applications router
# creates or updates an application (no DB needed).
# When you add a real DB, delete this dict and query the DB in get_board().
_app_store: dict[str, dict] = {}


def register_application(app_dict: dict) -> None:
    """Upsert an application record into the tracker's local store.

    Call this from the applications router after every create / status-update
    so the Kanban board stays in sync without a database.
    Remove this function when switching to a real DB.
    """
    _app_store[app_dict["id"]] = app_dict


async def get_board() -> dict[str, list[TrackerCardResponse]]:
    """Return all applications grouped into Kanban columns.

    Each card is enriched with its notes and labels.
    When switching to a real DB, replace the _app_store loop with a
    single SQL JOIN across applications, tracker_notes, and tracker_labels.
    """
    board: dict[str, list[TrackerCardResponse]] = {col: [] for col in KANBAN_COLUMNS}

    for app_id, app in _app_store.items():
        column = _COLUMN_MAP.get(app["status"], "Applied")

        app_labels = [
            _make_label(lbl)
            for lbl in _labels.values()
            if lbl["application_id"] == app_id
        ]
        app_notes = [
            _make_note(n)
            for n in _notes.values()
            if n["application_id"] == app_id
        ]
        app_notes.sort(key=lambda n: n.created_at, reverse=True)

        card = TrackerCardResponse(
            id=app["id"],
            job_id=app["job_id"],
            resume_id=app.get("resume_id"),
            status=app["status"],
            apply_mode=app["apply_mode"],
            ats_score=app.get("ats_score"),
            applied_at=app.get("applied_at"),
            response_date=app.get("response_date"),
            notes=app.get("notes"),
            created_at=app["created_at"],
            updated_at=app["updated_at"],
            labels=app_labels,
            tracker_notes=app_notes,
            notes_count=len(app_notes),
        )
        board[column].append(card)

    for col in KANBAN_COLUMNS:
        board[col].sort(key=lambda c: c.updated_at, reverse=True)

    return board
