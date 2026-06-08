"""Tests for SQLAlchemy ORM models."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import Application
from app.models.goal import Goal
from app.models.job import Job
from app.models.llm_usage import LLMUsage
from app.models.resume import Resume
from app.models.roadmap import RoadmapMeta, RoadmapPhase, RoadmapTask
from app.models.todo_item import TodoItem
from app.models.user_settings import UserSettings


class TestJobModel:
    """Test Job model CRUD operations."""

    async def test_create_job_with_required_fields(
        self,
        db_session: AsyncSession,
        sample_job_data: dict,
    ) -> None:
        """Job should be created with all required fields."""
        job = Job(**sample_job_data)
        db_session.add(job)
        await db_session.commit()

        result = await db_session.execute(select(Job).where(Job.id == job.id))
        fetched = result.scalar_one()

        assert fetched.title == "Senior Python Developer"
        assert fetched.company == "TechCorp Inc."
        assert fetched.platform == "linkedin"
        assert fetched.remote is True
        assert fetched.match_score == 0.85
        assert fetched.status == "new"

    async def test_job_has_auto_generated_uuid(
        self,
        db_session: AsyncSession,
        sample_job_data: dict,
    ) -> None:
        """Job should have an auto-generated UUID primary key."""
        job = Job(**sample_job_data)
        db_session.add(job)
        await db_session.commit()

        assert job.id is not None
        assert len(job.id) == 32  # UUID hex without dashes

    async def test_job_has_timestamps(
        self,
        db_session: AsyncSession,
        sample_job_data: dict,
    ) -> None:
        """Job should have created_at and updated_at timestamps."""
        job = Job(**sample_job_data)
        db_session.add(job)
        await db_session.commit()

        assert job.created_at is not None
        assert job.updated_at is not None

    async def test_job_repr(self, sample_job_data: dict) -> None:
        """Job repr should include id, title, and company."""
        job = Job(**sample_job_data)
        repr_str = repr(job)
        assert "Senior Python Developer" in repr_str
        assert "TechCorp Inc." in repr_str


class TestResumeModel:
    """Test Resume model operations."""

    async def test_create_base_resume(self, db_session: AsyncSession) -> None:
        """Base resume should be created without job or parent reference."""
        resume = Resume(
            name="My Resume",
            type="base",
            template_id="modern",
            file_path_pdf="data/generated/resumes/my_resume.pdf",
            file_path_docx="data/generated/resumes/my_resume.docx",
            content_text="Experienced developer...",
        )
        db_session.add(resume)
        await db_session.commit()

        assert resume.id is not None
        assert resume.type == "base"
        assert resume.base_resume_id is None
        assert resume.job_id is None


class TestApplicationModel:
    """Test Application model operations."""

    async def test_create_application_linked_to_job(
        self,
        db_session: AsyncSession,
        sample_job_data: dict,
    ) -> None:
        """Application should link to a job via foreign key."""
        job = Job(**sample_job_data)
        db_session.add(job)
        await db_session.flush()

        application = Application(
            job_id=job.id,
            status="queued",
            apply_mode="review",
        )
        db_session.add(application)
        await db_session.commit()

        assert application.id is not None
        assert application.job_id == job.id
        assert application.status == "queued"


class TestLLMUsageModel:
    """Test LLMUsage model operations."""

    async def test_create_llm_usage_record(self, db_session: AsyncSession) -> None:
        """LLM usage record should store provider, tokens, and cost."""
        usage = LLMUsage(
            provider="openai",
            model="gpt-4o",
            prompt_tokens=150,
            completion_tokens=80,
            total_tokens=230,
            cost_usd=0.00345,
            latency_ms=1200,
            purpose="resume_tailor",
            trace_id="autoapply-abc123",
        )
        db_session.add(usage)
        await db_session.commit()

        result = await db_session.execute(
            select(LLMUsage).where(LLMUsage.id == usage.id)
        )
        fetched = result.scalar_one()

        assert fetched.provider == "openai"
        assert fetched.total_tokens == 230
        assert fetched.cost_usd == pytest.approx(0.00345)
        assert fetched.purpose == "resume_tailor"


class TestUserSettingsModel:
    """Test UserSettings singleton model."""

    async def test_create_default_settings(self, db_session: AsyncSession) -> None:
        """Default user settings should be created with singleton id."""
        settings = UserSettings(id="singleton")
        db_session.add(settings)
        await db_session.commit()

        assert settings.id == "singleton"
        assert settings.apply_mode == "review"
        assert settings.max_parallel == 3
        assert settings.min_ats_score == 0.75


class TestRoadmapModels:
    """Test roadmap-related database models: RoadmapPhase, RoadmapTask, RoadmapMeta."""

    async def test_roadmap_lifecycle(self, db_session: AsyncSession) -> None:
        """Create goal, phase, todo, task, and meta, and verify relations and attributes."""
        # 1. Create a parent Goal
        goal = Goal(
            title="SDE Roadmap Goal",
            category="learning",
            target_value=1,
            current_value=0,
            status="active",
        )
        db_session.add(goal)
        await db_session.flush()

        # 2. Create a Phase for the goal
        phase = RoadmapPhase(
            goal_id=goal.id,
            phase_number=1,
            title="Phase 1: Foundations",
            week_start=1,
            week_end=4,
        )
        db_session.add(phase)
        await db_session.flush()

        # 3. Create a TodoItem and link to it via RoadmapTask
        todo = TodoItem(
            goal_id=goal.id,
            title="Complete 10 graph problems",
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
        await db_session.flush()

        # 4. Create RoadmapMeta for the goal
        meta = RoadmapMeta(
            goal_id=goal.id,
            mermaid_gantt="gantt\nsection Phase 1\n Foundations : active, 2026-06-08, 30d",
            feasibility="high",
            feasibility_note="Strong background.",
            skill_gaps=[{"skill": "Graph Algorithms", "gap_reason": "Needs practice"}],
            weekly_hour_budget=8,
            progress_percent=0.0,
            on_track=True,
            nudge_message="Keep up the good work!",
        )
        db_session.add(meta)
        await db_session.commit()

        # 5. Retrieve and assert
        assert phase.id is not None
        assert task.id is not None
        assert meta.id is not None

        # Verify relationships
        from sqlalchemy.orm import selectinload
        result_phase = await db_session.execute(
            select(RoadmapPhase)
            .where(RoadmapPhase.id == phase.id)
            .options(selectinload(RoadmapPhase.tasks))
        )
        fetched_phase = result_phase.scalar_one()
        assert len(fetched_phase.tasks) == 1
        assert fetched_phase.tasks[0].id == task.id
        assert fetched_phase.tasks[0].category == "learning"

        assert meta.goal_id == goal.id
        assert meta.feasibility == "high"
        assert meta.skill_gaps == [{"skill": "Graph Algorithms", "gap_reason": "Needs practice"}]

