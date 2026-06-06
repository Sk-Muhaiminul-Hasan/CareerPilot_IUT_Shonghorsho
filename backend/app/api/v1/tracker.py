"""Application tracker API routes.

Endpoints
---------
GET    /tracker/board                           Full Kanban board (all 4 columns, enriched)

Notes (scoped per application):
POST   /tracker/applications/{app_id}/notes    Add a note to a card
GET    /tracker/applications/{app_id}/notes    List all notes for a card (newest first)
GET    /tracker/notes/{note_id}                Get a single note
PATCH  /tracker/notes/{note_id}                Update a note
DELETE /tracker/notes/{note_id}                Delete a note

Labels (scoped per application):
POST   /tracker/applications/{app_id}/labels   Attach a label to a card
GET    /tracker/applications/{app_id}/labels   List all labels for a card
GET    /tracker/labels/{label_id}              Get a single label
PATCH  /tracker/labels/{label_id}              Update a label
DELETE /tracker/labels/{label_id}              Delete a label
"""

import structlog
from fastapi import APIRouter

from app.schemas.tracker import (
    TrackerCardResponse,
    TrackerLabelCreate,
    TrackerLabelResponse,
    TrackerLabelUpdate,
    TrackerNoteCreate,
    TrackerNoteResponse,
    TrackerNoteUpdate,
)
from app.services import tracker as tracker_service

logger = structlog.get_logger(__name__)
router = APIRouter()


# ── Kanban board ──────────────────────────────────────────────────────────────

@router.get(
    "/board",
    response_model=dict[str, list[TrackerCardResponse]],
    summary="Get Kanban board",
    description=(
        "Returns all applications grouped into four columns: "
        "**Applied**, **Interviewing**, **Offer**, **Rejected**. "
        "Each card is enriched with its tracker notes and labels. "
        "Applications are registered on the board by calling the "
        "`POST /applications/` endpoint."
    ),
)
async def get_board() -> dict[str, list[TrackerCardResponse]]:
    """Full Kanban board — all columns enriched with notes and labels."""
    board = await tracker_service.get_board()
    logger.info("tracker_board_fetched")
    return board


# ── Notes ─────────────────────────────────────────────────────────────────────

@router.post(
    "/applications/{app_id}/notes",
    response_model=TrackerNoteResponse,
    status_code=201,
    summary="Add a note to an application card",
)
async def create_note(
    app_id: str,
    data: TrackerNoteCreate,
) -> TrackerNoteResponse:
    """Add a note / activity-log entry to an application card.

    `note_type` options: `note` | `status_change` | `interview_feedback`
    | `offer_detail` | `rejection_reason`
    """
    note = await tracker_service.create_note(app_id, data)
    logger.info("tracker_note_created", note_id=note.id, app_id=app_id)
    return note


@router.get(
    "/applications/{app_id}/notes",
    response_model=list[TrackerNoteResponse],
    summary="List notes for an application card",
)
async def list_notes(app_id: str) -> list[TrackerNoteResponse]:
    """List all notes attached to a given application, newest first."""
    return await tracker_service.list_notes(app_id)


@router.get(
    "/notes/{note_id}",
    response_model=TrackerNoteResponse,
    summary="Get a tracker note",
)
async def get_note(note_id: str) -> TrackerNoteResponse:
    """Get a single tracker note by ID. Returns 404 if not found."""
    return await tracker_service.get_note(note_id)


@router.patch(
    "/notes/{note_id}",
    response_model=TrackerNoteResponse,
    summary="Update a tracker note",
)
async def update_note(
    note_id: str,
    data: TrackerNoteUpdate,
) -> TrackerNoteResponse:
    """Partially update a tracker note. Only supplied fields are changed."""
    note = await tracker_service.update_note(note_id, data)
    logger.info("tracker_note_updated", note_id=note_id)
    return note


@router.delete(
    "/notes/{note_id}",
    status_code=204,
    summary="Delete a tracker note",
)
async def delete_note(note_id: str) -> None:
    """Delete a tracker note by ID. Returns 404 if not found."""
    await tracker_service.delete_note(note_id)
    logger.info("tracker_note_deleted", note_id=note_id)


# ── Labels ────────────────────────────────────────────────────────────────────

@router.post(
    "/applications/{app_id}/labels",
    response_model=TrackerLabelResponse,
    status_code=201,
    summary="Attach a label to an application card",
)
async def create_label(
    app_id: str,
    data: TrackerLabelCreate,
) -> TrackerLabelResponse:
    """Attach a coloured label to an application card.

    `color_hex` must be a valid 6-digit hex colour, e.g. `#004ac6`.
    """
    label = await tracker_service.create_label(app_id, data)
    logger.info("tracker_label_created", label_id=label.id, app_id=app_id)
    return label


@router.get(
    "/applications/{app_id}/labels",
    response_model=list[TrackerLabelResponse],
    summary="List labels for an application card",
)
async def list_labels(app_id: str) -> list[TrackerLabelResponse]:
    """List all labels attached to a given application, sorted by name."""
    return await tracker_service.list_labels(app_id)


@router.get(
    "/labels/{label_id}",
    response_model=TrackerLabelResponse,
    summary="Get a tracker label",
)
async def get_label(label_id: str) -> TrackerLabelResponse:
    """Get a single tracker label by ID. Returns 404 if not found."""
    return await tracker_service.get_label(label_id)


@router.patch(
    "/labels/{label_id}",
    response_model=TrackerLabelResponse,
    summary="Update a tracker label",
)
async def update_label(
    label_id: str,
    data: TrackerLabelUpdate,
) -> TrackerLabelResponse:
    """Partially update a tracker label (name and/or color)."""
    label = await tracker_service.update_label(label_id, data)
    logger.info("tracker_label_updated", label_id=label_id)
    return label


@router.delete(
    "/labels/{label_id}",
    status_code=204,
    summary="Delete a tracker label",
)
async def delete_label(label_id: str) -> None:
    """Delete a tracker label by ID. Returns 404 if not found."""
    await tracker_service.delete_label(label_id)
    logger.info("tracker_label_deleted", label_id=label_id)
