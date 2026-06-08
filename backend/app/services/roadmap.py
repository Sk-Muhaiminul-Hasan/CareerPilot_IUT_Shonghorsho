"""Roadmap service: AI generation, retrieval, task completion, and dashboard progress."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime

import litellm
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.core.exceptions import RecordNotFoundError
from app.core.llm.client import LLMClient, UserLLMConfig
from app.db.session import AsyncSessionLocal
from app.models.goal import Goal
from app.models.roadmap import RoadmapMeta, RoadmapPhase, RoadmapTask
from app.models.todo_item import TodoItem
from app.schemas.roadmap import (
    AIRoadmapOutput,
    AITaskItem,
    DashboardProgressItem,
    DashboardProgressResponse,
    RoadmapMetaResponse,
    RoadmapPhaseResponse,
    RoadmapResponse,
    RoadmapTaskCompleteResponse,
    RoadmapTaskResponse,
)

logger = structlog.get_logger(__name__)

_PRIORITY_MAP = {
    "critical": 3,
    "high": 3,
    "medium": 2,
    "low": 1,
}


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _get_api_key() -> str:
    """Return the server-side OpenAI API key for roadmap calls."""
    import os

    s = get_settings()

    # Try multiple sources for the OpenAI API Key
    key = os.getenv("OPENAI_API_KEY") or ""
    if not key:
        key = s.llm.openai_api_key.get_secret_value()
    if not key:
        key = s.cv_extraction_api_key.get_secret_value()
    if not key:
        key = os.getenv("AI_API_KEY") or ""

    # Clean the key (remove quotes if present in .env)
    key = key.strip("'\"").strip()

    if not key:
        raise RuntimeError("No OpenAI API key configured. Set OPENAI_API_KEY in .env.")
    return key


# ---------------------------------------------------------------------------
# AI prompt builders
# ---------------------------------------------------------------------------

_GENERATION_SYSTEM = """
You are a career roadmap generator inside CareerPilot.
Output ONLY valid JSON. No markdown fences, no preamble, no explanation.

Output schema:
{
  "feasibility": "high" | "medium" | "low",
  "feasibility_note": string,
  "weekly_hour_budget": number,
  "skill_gaps": [{ "skill": string, "gap_reason": string }],
  "phases": [
    {
      "phase_number": number,
      "phase_title": string,
      "week_start": number,
      "week_end": number,
      "tasks": [
        {
          "task_id_temp": string,
          "title": string,
          "priority": "critical" | "high" | "medium" | "low",
          "date": "YYYY-MM-DD",
          "category": "learning" | "project" | "application" | "networking" | "cv_update",
          "estimated_hours": number,
          "spawns_application": boolean
        }
      ]
    }
  ],
  "mermaid_gantt": string
}

Rules:
- Tasks must be specific and measurable.
  BAD: "Study DSA". GOOD: "Solve 20 LeetCode medium graph problems on NeetCode roadmap".
- weekly_hour_budget must not exceed 12.
- Total estimated_hours must fit within (deadline_weeks * weekly_hour_budget).
- "mermaid_gantt" must be a valid Mermaid flowchart string using "graph LR" (left-to-right directed graph).
  - Do NOT generate a Gantt chart or a text table. You must only output a valid Mermaid flowchart graph.
  - Use task_id_temp as node IDs.
  - Define node text using task titles enclosed in double quotes inside square brackets (e.g. t1["Solve 20 Graph problems"]).
  - Connect nodes with directional arrows to represent their dependency/sequence path (e.g. t1 --> t2).
  - Do NOT include any styling, classDefs, classes, or emojis in the diagram. Absolutely no emojis are allowed.
- Tasks with spawns_application: true must have titles starting with "Apply:".
""".strip()

_REPLAN_SYSTEM = """
You are updating a CareerPilot roadmap because the user is behind schedule.
Reschedule incomplete tasks to fit the remaining time.
Drop or defer the lowest-priority incomplete tasks first if needed.
Output ONLY valid JSON. No markdown fences. Same schema as generation, plus:
  "nudge_message": string  (one honest, motivating sentence for the dashboard)
Only reschedule incomplete tasks.

Additional Rules:
- "mermaid_gantt" must be a valid Mermaid flowchart string using "graph LR" (left-to-right directed graph).
- Do NOT generate a Gantt chart or a text table.
- Do NOT include any styling, classDefs, classes, or emojis in the diagram. Absolutely no emojis are allowed.
""".strip()


def _build_generation_prompt(goal: Goal, today: str) -> str:
    target_role = goal.description or goal.title
    deadline = goal.due_date.strftime("%Y-%m-%d") if goal.due_date else "Not specified"
    return f"Goal: {goal.title}\nTarget Role: {target_role}\nDeadline: {deadline}\nToday: {today}"


def _build_replan_prompt(
    goal: Goal,
    today: str,
    completed_titles: list[str],
    incomplete_with_priorities: list[tuple[str, str]],
    days_elapsed: int,
    total_days: int,
) -> str:
    completed_str = "\n".join(f"- {t}" for t in completed_titles) or "None"
    incomplete_str = (
        "\n".join(f"- {title} [{prio}]" for title, prio in incomplete_with_priorities) or "None"
    )
    deadline = goal.due_date.strftime("%Y-%m-%d") if goal.due_date else "Not specified"
    return (
        f"Goal: {goal.title}\n"
        f"Deadline: {deadline}\n"
        f"Today: {today}\n"
        f"Completed tasks:\n{completed_str}\n"
        f"Remaining tasks with priorities:\n{incomplete_str}\n"
        f"Days elapsed: {days_elapsed} of {total_days}"
    )


# ---------------------------------------------------------------------------
# AI call helpers
# ---------------------------------------------------------------------------


async def _call_ai(
    system_prompt: str, user_prompt: str, user_cfg: UserLLMConfig | None = None
) -> AIRoadmapOutput:
    """Call the LLM with JSON mode using unified LLMClient and parse into AIRoadmapOutput."""
    llm = LLMClient()
    response = await llm.complete(
        prompt=user_prompt,
        system_prompt=system_prompt,
        response_format={"type": "json_object"},
        purpose="general",
        user_settings=user_cfg,
    )
    raw = response.content
    # Strip any accidental markdown fences
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)
    data = json.loads(cleaned)
    return AIRoadmapOutput.model_validate(data)


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------


def _map_todo_priority(priority_str: str) -> int:
    """Convert AI priority string to TodoItem integer (1=low, 2=medium, 3=high)."""
    return _PRIORITY_MAP.get(priority_str.lower(), 2)


async def _create_todo_item(
    task: AITaskItem, goal_id: str, user_id: str | None, db_session: AsyncSession
) -> TodoItem:
    """Persist a TodoItem row for a roadmap task."""
    due_date: datetime | None = None
    if task.date:
        try:
            due_date = datetime.strptime(task.date, "%Y-%m-%d")
        except ValueError:
            due_date = None

    todo = TodoItem(
        user_id=user_id,
        goal_id=goal_id,
        title=task.title,
        due_date=due_date,
        priority=_map_todo_priority(task.priority),
        status="todo",
        is_completed=False,
    )
    db_session.add(todo)
    await db_session.flush()
    return todo


def _get_styled_flowchart(raw_flowchart: str, tasks: list[RoadmapTaskResponse]) -> str:
    """Appends classDef and class declarations to color-code completed/active/incomplete nodes."""
    # Define classes for flowchart styling
    class_defs = (
        "\n\n"
        "  classDef completed fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d;\n"
        "  classDef active fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af;\n"
        "  classDef incomplete fill:#f8fafc,stroke:#cbd5e1,stroke-width:1px,color:#475569;\n"
    )
    
    # Find first incomplete task
    active_task_id = None
    for t in tasks:
        if not t.completed:
            active_task_id = t.id
            break
            
    # Append classes to flowchart
    class_assignments = []
    for t in tasks:
        clean_id = f"task_{t.id.replace('-', '')}"
        if t.completed:
            class_assignments.append(f"  class {clean_id} completed;")
        elif t.id == active_task_id:
            class_assignments.append(f"  class {clean_id} active;")
        else:
            class_assignments.append(f"  class {clean_id} incomplete;")
            
    return raw_flowchart + class_defs + "\n".join(class_assignments)


def _build_meta_response(meta: RoadmapMeta, tasks: list[RoadmapTaskResponse] | None = None) -> RoadmapMetaResponse:
    chart_str = meta.mermaid_gantt
    if tasks:
        chart_str = _get_styled_flowchart(chart_str, tasks)

    return RoadmapMetaResponse(
        id=meta.id,
        goal_id=meta.goal_id,
        mermaid_gantt=chart_str,
        feasibility=meta.feasibility,
        feasibility_note=meta.feasibility_note,
        skill_gaps=meta.skill_gaps,
        weekly_hour_budget=meta.weekly_hour_budget,
        progress_percent=meta.progress_percent,
        on_track=meta.on_track,
        nudge_message=meta.nudge_message,
        created_at=meta.created_at,
        updated_at=meta.updated_at,
    )


def _build_task_response(rt: RoadmapTask, todo: TodoItem) -> RoadmapTaskResponse:
    return RoadmapTaskResponse(
        id=rt.id,
        task_id=rt.task_id,
        title=todo.title,
        priority=todo.priority,
        due_date=todo.due_date,
        category=rt.category,
        spawns_application=rt.spawns_application,
        completed=rt.completed,
        completed_at=rt.completed_at,
    )


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


async def generate_roadmap(goal_id: str, user_id: str) -> RoadmapResponse:
    """Generate a roadmap via AI, persist all rows, return the full response."""
    # 1. Read goal and settings from DB, then close/commit session
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Goal).where(Goal.id == goal_id))
        goal = result.scalar_one_or_none()
        if not goal:
            raise RecordNotFoundError("Goal", goal_id)

        goal_title = goal.title
        goal_due_date = goal.due_date
        goal_description = goal.description

        # Load user settings for LLM client resolution
        from app.services.settings_helper import get_or_create_settings
        user_settings_obj = await get_or_create_settings(db, user_id)
        user_cfg = UserLLMConfig.from_settings(user_settings_obj)

    # 2. Perform LLM call (no DB connection held)
    today = _now().strftime("%Y-%m-%d")
    dummy_goal = Goal(title=goal_title, due_date=goal_due_date, description=goal_description)
    user_prompt = _build_generation_prompt(dummy_goal, today)

    logger.info("roadmap.generating", goal_id=goal_id)
    ai_output = await _call_ai(_GENERATION_SYSTEM, user_prompt, user_cfg)

    # 3. Open a fresh DB session to write the roadmap data
    async with AsyncSessionLocal() as db:
        try:
            # Delete any existing roadmap for this goal
            existing_phases = await db.execute(
                select(RoadmapPhase).where(RoadmapPhase.goal_id == goal_id)
            )
            for phase in existing_phases.scalars().all():
                await db.delete(phase)

            existing_meta_q = await db.execute(
                select(RoadmapMeta).where(RoadmapMeta.goal_id == goal_id)
            )
            existing_meta = existing_meta_q.scalar_one_or_none()
            if existing_meta:
                await db.delete(existing_meta)

            await db.flush()

            # Create new phases and tasks
            phase_responses: list[RoadmapPhaseResponse] = []
            temp_id_to_uuid = {}
            for phase_data in ai_output.phases:
                phase = RoadmapPhase(
                    goal_id=goal_id,
                    phase_number=phase_data.phase_number,
                    title=phase_data.phase_title,
                    week_start=phase_data.week_start,
                    week_end=phase_data.week_end,
                )
                db.add(phase)
                await db.flush()

                task_responses: list[RoadmapTaskResponse] = []
                for task_data in phase_data.tasks:
                    todo = await _create_todo_item(task_data, goal_id, user_id, db)

                    rt = RoadmapTask(
                        phase_id=phase.id,
                        task_id=todo.id,
                        category=task_data.category,
                        spawns_application=task_data.spawns_application,
                        completed=False,
                    )
                    db.add(rt)
                    await db.flush()

                    temp_id_to_uuid[task_data.task_id_temp] = rt.id
                    task_responses.append(_build_task_response(rt, todo))

                phase_responses.append(
                    RoadmapPhaseResponse(
                        id=phase.id,
                        phase_number=phase.phase_number,
                        title=phase.title,
                        week_start=phase.week_start,
                        week_end=phase.week_end,
                        tasks=task_responses,
                    )
                )

            # Replace temporary task IDs in the mermaid flowchart with UUIDs
            raw_flowchart = ai_output.mermaid_gantt or ""
            for temp_id, rt_id in temp_id_to_uuid.items():
                clean_uuid = rt_id.replace("-", "")
                raw_flowchart = re.sub(rf"\b{re.escape(temp_id)}\b", f"task_{clean_uuid}", raw_flowchart)

            # Create RoadmapMeta
            skill_gaps_data = [sg.model_dump() for sg in ai_output.skill_gaps]
            meta = RoadmapMeta(
                goal_id=goal_id,
                mermaid_gantt=raw_flowchart,
                feasibility=ai_output.feasibility,
                feasibility_note=ai_output.feasibility_note,
                skill_gaps=skill_gaps_data,
                weekly_hour_budget=ai_output.weekly_hour_budget,
                progress_percent=0.0,
                on_track=True,
                nudge_message=ai_output.nudge_message or "Great start! Stay consistent.",
            )
            db.add(meta)
            await db.flush()

            # Flatten task responses from all phases for dynamic styling
            all_task_responses = []
            for p in phase_responses:
                all_task_responses.extend(p.tasks)

            meta_response = _build_meta_response(meta, all_task_responses)
            await db.commit()
        except Exception:
            await db.rollback()
            raise

    logger.info("roadmap.generated", goal_id=goal_id, phases=len(phase_responses))
    return RoadmapResponse(
        goal_id=goal_id,
        goal_title=goal_title,
        goal_deadline=goal_due_date,
        meta=meta_response,
        phases=phase_responses,
    )


async def get_roadmap(goal_id: str) -> RoadmapResponse:
    """Retrieve the existing roadmap for a goal."""
    async with AsyncSessionLocal() as db:
        # Load goal
        goal_q = await db.execute(select(Goal).where(Goal.id == goal_id))
        goal = goal_q.scalar_one_or_none()
        if not goal:
            raise RecordNotFoundError("Goal", goal_id)

        # Load meta
        meta_q = await db.execute(select(RoadmapMeta).where(RoadmapMeta.goal_id == goal_id))
        meta = meta_q.scalar_one_or_none()
        if not meta:
            raise RecordNotFoundError("RoadmapMeta", goal_id)

        # Load phases
        phases_q = await db.execute(
            select(RoadmapPhase)
            .where(RoadmapPhase.goal_id == goal_id)
            .order_by(RoadmapPhase.phase_number)
        )
        phases = phases_q.scalars().all()

        phase_responses: list[RoadmapPhaseResponse] = []
        for phase in phases:
            tasks_q = await db.execute(select(RoadmapTask).where(RoadmapTask.phase_id == phase.id))
            roadmap_tasks = tasks_q.scalars().all()

            task_responses: list[RoadmapTaskResponse] = []
            for rt in roadmap_tasks:
                todo_q = await db.execute(select(TodoItem).where(TodoItem.id == rt.task_id))
                todo = todo_q.scalar_one_or_none()
                if todo:
                    task_responses.append(_build_task_response(rt, todo))

            phase_responses.append(
                RoadmapPhaseResponse(
                    id=phase.id,
                    phase_number=phase.phase_number,
                    title=phase.title,
                    week_start=phase.week_start,
                    week_end=phase.week_end,
                    tasks=task_responses,
                )
            )

        # Flatten task responses from all phases for dynamic styling
        all_task_responses = []
        for p in phase_responses:
            all_task_responses.extend(p.tasks)

        return RoadmapResponse(
            goal_id=goal_id,
            goal_title=goal.title,
            goal_deadline=goal.due_date,
            meta=_build_meta_response(meta, all_task_responses),
            phases=phase_responses,
        )


async def _recompute_progress(meta: RoadmapMeta, goal_id: str, db: AsyncSession) -> float:
    """Recompute progress_percent from completed task count."""
    # Count all roadmap tasks for this goal
    phases_q = await db.execute(select(RoadmapPhase).where(RoadmapPhase.goal_id == goal_id))
    phases = phases_q.scalars().all()
    phase_ids = [p.id for p in phases]

    if not phase_ids:
        return 0.0

    tasks_q = await db.execute(select(RoadmapTask).where(RoadmapTask.phase_id.in_(phase_ids)))
    all_tasks = tasks_q.scalars().all()
    total = len(all_tasks)
    completed = sum(1 for t in all_tasks if t.completed)
    return round((completed / total) * 100, 2) if total > 0 else 0.0


async def complete_task(roadmap_task_id: str) -> RoadmapTaskCompleteResponse:
    """Mark a roadmap task complete, recompute progress, optionally re-plan."""
    async with AsyncSessionLocal() as db:
        try:
            # Load roadmap task
            rt_q = await db.execute(select(RoadmapTask).where(RoadmapTask.id == roadmap_task_id))
            rt = rt_q.scalar_one_or_none()
            if not rt:
                raise RecordNotFoundError("RoadmapTask", roadmap_task_id)

            now = _now()
            rt.completed = True
            rt.completed_at = now

            # Also mark linked TodoItem as done
            todo_q = await db.execute(select(TodoItem).where(TodoItem.id == rt.task_id))
            todo = todo_q.scalar_one_or_none()
            if todo:
                todo.status = "done"
                todo.is_completed = True
                todo.completed_at = now

            # Load phase to get goal_id
            phase_q = await db.execute(select(RoadmapPhase).where(RoadmapPhase.id == rt.phase_id))
            phase = phase_q.scalar_one_or_none()
            if not phase:
                raise RecordNotFoundError("RoadmapPhase", rt.phase_id)

            goal_id = phase.goal_id

            # Load meta
            meta_q = await db.execute(select(RoadmapMeta).where(RoadmapMeta.goal_id == goal_id))
            meta = meta_q.scalar_one_or_none()
            if not meta:
                raise RecordNotFoundError("RoadmapMeta", goal_id)

            # Load goal for re-plan check
            goal_q = await db.execute(select(Goal).where(Goal.id == goal_id))
            goal = goal_q.scalar_one_or_none()

            await db.flush()

            # Recompute progress
            new_progress = await _recompute_progress(meta, goal_id, db)
            meta.progress_percent = new_progress
            meta.updated_at = now

            # Check if behind pace
            should_replan = False
            if goal and goal.due_date and goal.created_at:
                total_days = max((goal.due_date - goal.created_at).days, 1)
                days_elapsed = max((now - goal.created_at).days, 0)
                expected_pace = (days_elapsed / total_days) * 100
                if expected_pace - new_progress > 15:
                    should_replan = True
                    meta.on_track = False
                else:
                    meta.on_track = True

            await db.flush()
            await db.commit()
        except Exception:
            await db.rollback()
            raise

        # Re-plan if behind pace (outside transaction to avoid long lock)
        if should_replan and goal:
            try:
                await _run_replan(meta, goal, goal_id, db)
            except Exception as exc:
                logger.warning("roadmap.replan_failed", goal_id=goal_id, error=str(exc))

        # Reload meta for response
        async with AsyncSessionLocal() as db2:
            meta_q2 = await db2.execute(select(RoadmapMeta).where(RoadmapMeta.goal_id == goal_id))
            meta_fresh = meta_q2.scalar_one_or_none()

            # Load phases & tasks to get full task list for styling
            phases_q = await db2.execute(select(RoadmapPhase).where(RoadmapPhase.goal_id == goal_id))
            phases_list = phases_q.scalars().all()
            phase_ids_list = [p.id for p in phases_list]
            
            all_task_responses = []
            if phase_ids_list:
                tasks_q = await db2.execute(select(RoadmapTask).where(RoadmapTask.phase_id.in_(phase_ids_list)))
                roadmap_tasks_list = tasks_q.scalars().all()
                for rt_item in roadmap_tasks_list:
                    todo_q = await db2.execute(select(TodoItem).where(TodoItem.id == rt_item.task_id))
                    todo_item = todo_q.scalar_one_or_none()
                    if todo_item:
                        all_task_responses.append(_build_task_response(rt_item, todo_item))

        return RoadmapTaskCompleteResponse(
            roadmap_task_id=roadmap_task_id,
            completed=True,
            completed_at=rt.completed_at,
            meta=_build_meta_response(meta_fresh or meta, all_task_responses),
        )


async def _run_replan(meta: RoadmapMeta, goal: Goal, goal_id: str, _db: AsyncSession) -> None:
    """Call AI re-plan prompt and update mermaid_gantt + nudge_message in meta."""
    # 1. Read required task/goal data in first session context, then close
    async with AsyncSessionLocal() as db:
        phases_q = await db.execute(
            select(RoadmapPhase)
            .where(RoadmapPhase.goal_id == goal_id)
            .order_by(RoadmapPhase.phase_number)
        )
        phases = phases_q.scalars().all()
        phase_ids = [p.id for p in phases]

        if phase_ids:
            tasks_q = await db.execute(select(RoadmapTask).where(RoadmapTask.phase_id.in_(phase_ids)))
            all_rts = tasks_q.scalars().all()
            
            task_info_list = []
            for rt in all_rts:
                todo_q = await db.execute(select(TodoItem).where(TodoItem.id == rt.task_id))
                todo = todo_q.scalar_one_or_none()
                if todo:
                    task_info_list.append((rt.completed, todo.title, todo.priority, rt.id))
        else:
            task_info_list = []

    completed_titles: list[str] = []
    incomplete_with_priorities: list[tuple[str, str]] = []
    title_to_uuid = {}

    for completed, title, priority, rt_id in task_info_list:
        title_to_uuid[title.lower().strip()] = rt_id
        if completed:
            completed_titles.append(title)
        else:
            prio_label = {3: "high", 2: "medium", 1: "low"}.get(priority, "medium")
            incomplete_with_priorities.append((title, prio_label))

    now = _now()
    today = now.strftime("%Y-%m-%d")
    total_days = max((goal.due_date - goal.created_at).days, 1) if goal.due_date else 90
    days_elapsed = max((now - goal.created_at).days, 0)

    user_prompt = _build_replan_prompt(
        goal=goal,
        today=today,
        completed_titles=completed_titles,
        incomplete_with_priorities=incomplete_with_priorities,
        days_elapsed=days_elapsed,
        total_days=total_days,
    )

    user_cfg = None
    if goal.user_id:
        async with AsyncSessionLocal() as db:
            from app.services.settings_helper import get_or_create_settings
            user_settings_obj = await get_or_create_settings(db, goal.user_id)
            user_cfg = UserLLMConfig.from_settings(user_settings_obj)

    # 2. Perform LLM call (no DB connection held)
    logger.info("roadmap.replanning", goal_id=goal_id)
    ai_output = await _call_ai(_REPLAN_SYSTEM, user_prompt, user_cfg)

    # Build temp_id to database UUID mapping by title
    temp_id_to_uuid = {}
    for phase_data in ai_output.phases:
        for task_data in phase_data.tasks:
            title_key = task_data.title.lower().strip()
            if title_key in title_to_uuid:
                temp_id_to_uuid[task_data.task_id_temp] = title_to_uuid[title_key]

    raw_flowchart = ai_output.mermaid_gantt or ""
    for temp_id, rt_id in temp_id_to_uuid.items():
        clean_uuid = rt_id.replace("-", "")
        raw_flowchart = re.sub(rf"\b{re.escape(temp_id)}\b", f"task_{clean_uuid}", raw_flowchart)

    # 3. Write results in a fresh session context
    async with AsyncSessionLocal() as db:
        try:
            meta_q = await db.execute(select(RoadmapMeta).where(RoadmapMeta.goal_id == goal_id))
            meta_fresh = meta_q.scalar_one_or_none()
            if meta_fresh:
                meta_fresh.mermaid_gantt = raw_flowchart or meta_fresh.mermaid_gantt
                meta_fresh.nudge_message = (
                    ai_output.nudge_message or "You're a bit behind — refocus and keep going!"
                )
                meta_fresh.on_track = False
                meta_fresh.updated_at = _now()
                await db.commit()
        except Exception:
            await db.rollback()
            raise


async def get_dashboard_progress(user_id: str) -> DashboardProgressResponse:
    """Return all active goals that have a roadmap, with progress/nudge for the dashboard widget."""
    async with AsyncSessionLocal() as db:
        # Get all active goals for this user
        goals_q = await db.execute(
            select(Goal).where(Goal.user_id == user_id, Goal.status == "active")
        )
        goals = goals_q.scalars().all()

        items: list[DashboardProgressItem] = []
        for goal in goals:
            meta_q = await db.execute(select(RoadmapMeta).where(RoadmapMeta.goal_id == goal.id))
            meta = meta_q.scalar_one_or_none()
            if meta:
                items.append(
                    DashboardProgressItem(
                        goal_id=goal.id,
                        goal_title=goal.title,
                        progress_percent=meta.progress_percent,
                        on_track=meta.on_track,
                        nudge_message=meta.nudge_message,
                        feasibility=meta.feasibility,
                    )
                )

        return DashboardProgressResponse(items=items)
