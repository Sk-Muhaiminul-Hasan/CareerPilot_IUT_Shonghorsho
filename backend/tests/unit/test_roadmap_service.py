"""Unit tests for the roadmap service."""

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from app.models.goal import Goal
from app.models.roadmap import RoadmapMeta, RoadmapPhase, RoadmapTask
from app.models.todo_item import TodoItem
from app.schemas.roadmap import AIPhaseItem, AIRoadmapOutput, AISkillGap, AITaskItem
from app.services import roadmap as roadmap_service


class MockSessionContext:
    """Mock context manager for SQLAlchemy AsyncSessionLocal."""

    def __init__(self, db_session):
        self.db_session = db_session

    async def __aenter__(self):
        return self.db_session

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


@pytest.fixture
def mock_ai_output():
    return AIRoadmapOutput(
        feasibility="high",
        feasibility_note="Fully feasible.",
        weekly_hour_budget=8,
        skill_gaps=[AISkillGap(skill="React", gap_reason="No experience")],
        phases=[
            AIPhaseItem(
                phase_number=1,
                phase_title="Foundations",
                week_start=1,
                week_end=2,
                tasks=[
                    AITaskItem(
                        task_id_temp="t1",
                        title="Learn basics",
                        priority="medium",
                        date="2026-06-15",
                        category="learning",
                        estimated_hours=4.0,
                        spawns_application=False,
                    )
                ],
            )
        ],
        mermaid_gantt="graph LR\n  t1[\"Learn basics\"]",
        nudge_message="Keep coding!",
    )


async def test_generate_roadmap(db_session, mock_ai_output):
    # 1. Create a parent Goal
    goal = Goal(
        title="Software Engineer React",
        category="learning",
        target_value=1,
        current_value=0,
        status="active",
        due_date=datetime(2026, 9, 30),
    )
    db_session.add(goal)
    await db_session.commit()

    # Mock db_session.begin() context manager to do nothing
    class DummyContextManager:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    db_session.begin = MagicMock(return_value=DummyContextManager())

    # Mock litellm.acompletion and _get_api_key
    with (
        patch("litellm.acompletion") as mock_completion,
        patch("app.services.roadmap._get_api_key", return_value="fake-api-key"),
    ):
        # Create a mock response object
        mock_response = MagicMock()
        mock_response.model = "gpt-4o-mini"
        mock_response.choices = [
            MagicMock(message=MagicMock(content=mock_ai_output.model_dump_json()))
        ]
        usage = MagicMock()
        usage.prompt_tokens = 10
        usage.completion_tokens = 20
        usage.total_tokens = 30
        mock_response.usage = usage
        mock_completion.return_value = mock_response

        # Mock the db session inside the service to use our test db_session
        with patch("app.services.roadmap.AsyncSessionLocal") as mock_session_class:
            mock_session_class.return_value = MockSessionContext(db_session)

            # Execute service call
            resp = await roadmap_service.generate_roadmap(goal.id, "user-123")

            assert resp.goal_id == goal.id
            assert resp.goal_title == "Software Engineer React"
            assert resp.meta.feasibility == "high"
            assert len(resp.phases) == 1
            assert resp.phases[0].title == "Foundations"
            assert len(resp.phases[0].tasks) == 1
            assert resp.phases[0].tasks[0].title == "Learn basics"


async def test_get_roadmap(db_session):
    goal = Goal(
        title="Software Engineer React",
        category="learning",
        target_value=1,
        current_value=0,
        status="active",
        due_date=datetime(2026, 9, 30),
    )
    db_session.add(goal)
    await db_session.commit()

    phase = RoadmapPhase(
        goal_id=goal.id,
        phase_number=1,
        title="Foundations",
        week_start=1,
        week_end=2,
    )
    db_session.add(phase)
    await db_session.flush()

    todo = TodoItem(
        goal_id=goal.id,
        title="Learn basics",
        priority=2,
        status="todo",
    )
    db_session.add(todo)
    await db_session.flush()

    task = RoadmapTask(
        phase_id=phase.id,
        task_id=todo.id,
        category="learning",
        spawns_application=False,
        completed=False,
    )
    db_session.add(task)

    meta = RoadmapMeta(
        goal_id=goal.id,
        mermaid_gantt="gantt\nsection Phase 1\n Learn basics : active, 2026-06-15, 7d",
        feasibility="high",
        feasibility_note="Fully feasible.",
        skill_gaps=[{"skill": "React", "gap_reason": "No experience"}],
        weekly_hour_budget=8,
        progress_percent=0.0,
        on_track=True,
        nudge_message="Keep coding!",
    )
    db_session.add(meta)
    await db_session.commit()

    with patch("app.services.roadmap.AsyncSessionLocal") as mock_session_class:
        mock_session_class.return_value = MockSessionContext(db_session)

        # Execute get_roadmap
        resp = await roadmap_service.get_roadmap(goal.id)

        assert resp.goal_id == goal.id
        assert resp.meta.feasibility == "high"
        assert len(resp.phases) == 1
        assert resp.phases[0].tasks[0].title == "Learn basics"


async def test_complete_task(db_session):
    goal = Goal(
        title="Software Engineer React",
        category="learning",
        target_value=1,
        current_value=0,
        status="active",
        due_date=datetime(2026, 9, 30),
    )
    db_session.add(goal)
    await db_session.commit()

    phase = RoadmapPhase(
        goal_id=goal.id,
        phase_number=1,
        title="Foundations",
        week_start=1,
        week_end=2,
    )
    db_session.add(phase)
    await db_session.flush()

    todo = TodoItem(
        goal_id=goal.id,
        title="Learn basics",
        priority=2,
        status="todo",
    )
    db_session.add(todo)
    await db_session.flush()

    task = RoadmapTask(
        phase_id=phase.id,
        task_id=todo.id,
        category="learning",
        spawns_application=False,
        completed=False,
    )
    db_session.add(task)

    meta = RoadmapMeta(
        goal_id=goal.id,
        mermaid_gantt="gantt\nsection Phase 1\n Learn basics : active, 2026-06-15, 7d",
        feasibility="high",
        feasibility_note="Fully feasible.",
        skill_gaps=[],
        weekly_hour_budget=8,
        progress_percent=0.0,
        on_track=True,
        nudge_message="Keep coding!",
    )
    db_session.add(meta)
    await db_session.commit()

    with patch("app.services.roadmap.AsyncSessionLocal") as mock_session_class:
        mock_session_class.return_value = MockSessionContext(db_session)

        # Complete the task
        resp = await roadmap_service.complete_task(task.id)

        assert resp.roadmap_task_id == task.id
        assert resp.completed is True
        assert resp.meta.progress_percent == 100.0


async def test_get_dashboard_progress(db_session):
    goal = Goal(
        user_id="user-1",
        title="Software Engineer React",
        category="learning",
        target_value=1,
        current_value=0,
        status="active",
        due_date=datetime(2026, 9, 30),
    )
    db_session.add(goal)
    await db_session.commit()

    meta = RoadmapMeta(
        goal_id=goal.id,
        mermaid_gantt="gantt\nsection Phase 1\n Learn basics : active, 2026-06-15, 7d",
        feasibility="high",
        feasibility_note="Fully feasible.",
        skill_gaps=[],
        weekly_hour_budget=8,
        progress_percent=25.0,
        on_track=True,
        nudge_message="Keep coding!",
    )
    db_session.add(meta)
    await db_session.commit()

    with patch("app.services.roadmap.AsyncSessionLocal") as mock_session_class:
        mock_session_class.return_value = MockSessionContext(db_session)

        # Get dashboard progress
        resp = await roadmap_service.get_dashboard_progress("user-1")

        assert len(resp.items) == 1
        assert resp.items[0].goal_id == goal.id
        assert resp.items[0].progress_percent == 25.0
        assert resp.items[0].on_track is True
        assert resp.items[0].nudge_message == "Keep coding!"
