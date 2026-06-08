"""Nudge service -- AI-powered career suggestions with Redis caching."""

import asyncio
import json
from datetime import datetime, timedelta

import structlog
from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm.client import LLMClient, UserLLMConfig
from app.db.session import AsyncSessionLocal
from app.models.application import Application
from app.models.goal import Goal
from app.models.job import Job
from app.schemas.job import JobListingResponse
from app.schemas.nudge import NudgeResponse, SuggestedTodoResponse

logger = structlog.get_logger(__name__)

_REDIS_TTL = 3600

_GENERIC_BULLETS = [
    "Browse new job listings that match your profile.",
    "Update your resume to highlight recent achievements.",
    "Set a goal to apply to at least one role this week.",
]


def _build_generic_response(applications_this_week: int) -> NudgeResponse:
    nudge_type = "active" if applications_this_week > 0 else "inactive"
    return NudgeResponse(
        headline="Complete your profile to unlock personalized nudges",
        bullets=_GENERIC_BULLETS,
        type=nudge_type,
        applications_this_week=applications_this_week,
        recommended_jobs=[],
        suggested_todos=[],
    )


def _build_prompt(
    full_name: str,
    skills: list[str],
    experience_title: str,
    experience_company: str,
    applications_this_week: int,
    jobs: list[Job],
    goals: list[dict] | None = None,
) -> str:
    job_descriptions = "\n".join(f"- {job.title} at {job.company} ({job.location})" for job in jobs)
    goals_section = ""
    if goals:
        goal_lines = "\n".join(
            f"- {g['title']} ({g['current_value']}/{g['target_value']})" for g in goals
        )
        goals_section = f"\nCurrent goals:\n{goal_lines}\n"
    return (
        f"User: {full_name}\n"
        f"Skills: {', '.join(skills) if skills else 'None listed'}\n"
        f"Most recent role: {experience_title} at {experience_company}\n"
        f"Applications this week: {applications_this_week}\n"
        f"{goals_section}"
        f"\nRecommended jobs:\n{job_descriptions}\n\n"
        "Generate a friendly career nudge with a short headline and 3 concise bullets "
        "encouraging the user to take action. Keep it human and specific."
    )


async def _create_todo_for_job(
    job: Job,
    user_id: str,
) -> tuple[str, str, datetime | None, int] | None:
    from app.models.todo_item import TodoItem
    from app.schemas.todo_item import TodoPriorityEnum

    try:
        async with AsyncSessionLocal() as todo_db, todo_db.begin():
            due = job.deadline or (datetime.utcnow() + timedelta(days=3))
            if due.tzinfo is not None:
                due = due.replace(tzinfo=None)
            record = TodoItem(
                user_id=user_id,
                title=f"Apply to {job.title} at {job.company}",
                due_date=due,
                priority=TodoPriorityEnum.HIGH.value,
                recurrence=None,
            )
            todo_db.add(record)
            await todo_db.commit()
            await todo_db.refresh(record)
            return record.id, record.title, record.due_date, record.priority
    except Exception as exc:
        logger.warning(
            "nudge.todo_creation_failed",
            job_id=job.id,
            error=str(exc),
        )
        return None


async def get_nudge(
    db: AsyncSession,
    redis: Redis | None,
    user_id: str,
) -> NudgeResponse:
    """Compute or retrieve a cached AI nudge for the authenticated user."""

    redis_key = f"nudge:{user_id}"

    if redis is not None:
        try:
            cached = await redis.get(redis_key)
            if cached:
                logger.info("nudge_cache_hit", user_id=user_id)
                return NudgeResponse.model_validate_json(cached)
        except Exception as exc:
            logger.warning("nudge_cache_read_failed", error=str(exc))

    apps_result = await db.execute(
        select(func.count(Application.id)).where(
            Application.created_at >= datetime.utcnow() - timedelta(days=7),
            Application.user_id == user_id,
        )
    )
    applications_this_week = apps_result.scalar() or 0

    from app.services.settings_helper import get_or_create_settings

    settings = await get_or_create_settings(db, user_id)

    profile = (settings.candidate_profile or {}) if settings else {}
    full_name = (profile.get("full_name") or "").strip()
    skills: list[str] = profile.get("skills") or []
    experience: list[dict] = profile.get("experience") or []
    experience_title = experience[0].get("title", "") if experience else ""
    experience_company = experience[0].get("company", "") if experience else ""

    if not full_name:
        logger.info("nudge_fallback_missing_profile")
        generic = _build_generic_response(applications_this_week)
        if redis is not None:
            try:
                await redis.set(redis_key, generic.model_dump_json(), ex=_REDIS_TTL)
            except Exception as exc:
                logger.warning("nudge_cache_write_failed", error=str(exc))
        return generic

    goals_result = await db.execute(
        select(Goal.title, Goal.current_value, Goal.target_value)
        .where(
            Goal.user_id == user_id,
            Goal.status == "active",
        )
        .limit(3)
    )
    goal_rows = goals_result.all()
    goals_context = [
        {
            "title": row.title,
            "current_value": row.current_value,
            "target_value": row.target_value,
        }
        for row in goal_rows
    ]

    jobs_result = await db.execute(
        select(Job)
        .where(
            Job.user_id == user_id,
            ~Job.id.in_(select(Application.job_id).where(Application.user_id == user_id)),
        )
        .order_by(Job.created_at.desc())
        .limit(3)
    )
    jobs = list(jobs_result.scalars().all())

    prompt = _build_prompt(
        full_name=full_name,
        skills=skills,
        experience_title=experience_title,
        experience_company=experience_company,
        applications_this_week=applications_this_week,
        jobs=jobs,
        goals=goals_context,
    )

    llm = LLMClient()
    user_cfg = UserLLMConfig.from_settings(settings)
    system_prompt = (
        "You are a supportive career coach. Reply ONLY with a JSON object "
        "containing:\n"
        "- headline: short motivational headline (string)\n"
        "- bullets: array of exactly 3 actionable tips (strings)\n"
        "Keep bullets under 20 words."
    )

    fallback = _build_generic_response(applications_this_week)

    try:
        response = await llm.complete(
            prompt=prompt,
            system_prompt=system_prompt,
            response_format={"type": "json_object"},
            purpose="nudge",
            user_settings=user_cfg,
        )

        try:
            from app.core.llm.usage_tracker import record_usage

            await record_usage(
                db=db,
                response=response,
                purpose="nudge",
                user_id=user_id,
            )
        except Exception as exc:
            logger.warning("llm_usage_record_failed", purpose="nudge", error=str(exc))

        data = json.loads(response.content)
        headline = str(data.get("headline") or fallback.headline)
        bullets = data.get("bullets") or fallback.bullets
        if not isinstance(bullets, list):
            bullets = [str(bullets)]
        if len(bullets) < 3:
            bullets = (bullets + _GENERIC_BULLETS)[:3]
    except Exception as exc:
        logger.error("nudge_llm_failed", error=str(exc))
        return fallback

    todo_creations = [_create_todo_for_job(job=job, user_id=user_id) for job in jobs]
    todo_results = await asyncio.gather(*todo_creations, return_exceptions=False)
    suggested_todos = [
        SuggestedTodoResponse(
            id=t[0],
            title=t[1],
            due_date=t[2],
            priority=t[3],
            is_completed=False,
        )
        for t in todo_results
        if t is not None
    ]

    result = NudgeResponse(
        headline=headline,
        bullets=[str(b) for b in bullets[:3]],
        type="active" if applications_this_week > 0 else "inactive",
        applications_this_week=applications_this_week,
        recommended_jobs=[JobListingResponse.model_validate(j) for j in jobs],
        suggested_todos=suggested_todos,
    )

    if redis is not None:
        try:
            await redis.set(redis_key, result.model_dump_json(), ex=_REDIS_TTL)
        except Exception as exc:
            logger.warning("nudge_cache_write_failed", error=str(exc))

    return result
