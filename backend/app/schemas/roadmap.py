"""Pydantic schemas for Goal Roadmap API requests and responses."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

# ---------------------------------------------------------------------------
# AI-parsed internal schemas (not exposed directly to clients)
# ---------------------------------------------------------------------------


class AITaskItem(BaseModel):
    """A single task as returned by the AI generation prompt."""

    task_id_temp: str
    title: str
    priority: str = "medium"
    date: str  # YYYY-MM-DD string
    category: str = "learning"
    estimated_hours: float = 1.0
    spawns_application: bool = False


class AIPhaseItem(BaseModel):
    """A single phase as returned by the AI generation prompt."""

    phase_number: int
    phase_title: str
    week_start: int
    week_end: int
    tasks: list[AITaskItem] = []


class AISkillGap(BaseModel):
    """Skill gap entry from the AI generation prompt."""

    skill: str
    gap_reason: str


class AIRoadmapOutput(BaseModel):
    """Full AI generation response schema."""

    feasibility: str = "medium"
    feasibility_note: str = ""
    weekly_hour_budget: int = 8
    skill_gaps: list[AISkillGap] = []
    phases: list[AIPhaseItem] = []
    mermaid_gantt: str = ""
    nudge_message: str = ""  # present in re-plan responses


# ---------------------------------------------------------------------------
# Public API response schemas
# ---------------------------------------------------------------------------


class RoadmapTaskResponse(BaseModel):
    """A single roadmap task (linked to a TodoItem)."""

    model_config = ConfigDict(from_attributes=True)

    id: str  # RoadmapTask.id
    task_id: str  # TodoItem.id
    title: str  # pulled from the linked TodoItem
    priority: int  # 1=low, 2=medium, 3=high (from TodoItem)
    due_date: datetime | None  # from TodoItem
    category: str
    spawns_application: bool
    completed: bool
    completed_at: datetime | None


class RoadmapPhaseResponse(BaseModel):
    """A roadmap phase with its tasks."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    phase_number: int
    title: str
    week_start: int
    week_end: int
    tasks: list[RoadmapTaskResponse] = []


class RoadmapMetaResponse(BaseModel):
    """Roadmap metadata — mermaid gantt, feasibility, progress."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    goal_id: str
    mermaid_gantt: str
    feasibility: str
    feasibility_note: str
    skill_gaps: Any | None  # list[{skill, gap_reason}]
    weekly_hour_budget: int
    progress_percent: float
    on_track: bool
    nudge_message: str
    created_at: datetime
    updated_at: datetime


class RoadmapResponse(BaseModel):
    """Full roadmap response: meta + phases with nested tasks."""

    goal_id: str
    goal_title: str
    goal_deadline: datetime | None
    meta: RoadmapMetaResponse
    phases: list[RoadmapPhaseResponse] = []


class RoadmapTaskCompleteResponse(BaseModel):
    """Response after marking a roadmap task complete."""

    roadmap_task_id: str
    completed: bool
    completed_at: datetime | None
    meta: RoadmapMetaResponse


# ---------------------------------------------------------------------------
# Dashboard progress widget
# ---------------------------------------------------------------------------


class DashboardProgressItem(BaseModel):
    """Per-goal progress summary for the dashboard widget."""

    goal_id: str
    goal_title: str
    progress_percent: float
    on_track: bool
    nudge_message: str
    feasibility: str


class DashboardProgressResponse(BaseModel):
    """All active goals' roadmap progress for the dashboard widget."""

    items: list[DashboardProgressItem]
