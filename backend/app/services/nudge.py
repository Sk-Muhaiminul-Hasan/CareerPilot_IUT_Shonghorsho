"""Nudge service -- AI-powered career suggestions with Redis caching."""

import json
from datetime import datetime, timedelta

import structlog
from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm.client import LLMClient, UserLLMConfig
from app.models.application import Application
from app.models.job import Job
from app.schemas.job import JobListingResponse
from app.schemas.nudge import NudgeResponse

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
    )


def _build_prompt(
    full_name: str,
    skills: list[str],
    experience_title: str,
    experience_company: str,
    applications_this_week: int,
    jobs: list[Job],
) -> str:
    job_descriptions = "\n".join(
        f"- {job.title} at {job.company} ({job.location})"
        for job in jobs
    )
    return (
        f"User: {full_name}\n"
        f"Skills: {', '.join(skills) if skills else 'None listed'}\n"
        f"Most recent role: {experience_title} at {experience_company}\n"
        f"Applications this week: {applications_this_week}\n\n"
        f"Recommended jobs:\n{job_descriptions}\n\n"
        "Generate a friendly career nudge with a short headline and 3 concise bullets "
        "encouraging the user to take action. Keep it human and specific."
    )


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
    )

    llm = LLMClient()
    user_cfg = UserLLMConfig.from_settings(settings)
    system_prompt = (
        "You are a supportive career coach. Reply ONLY with a JSON object "
        "containing:\n"
        '- headline: short motivational headline (string)\n'
        '- bullets: array of exactly 3 actionable tips (strings)\n'
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
                db=db, response=response, purpose="nudge", user_id=user_id,
            )
        except Exception:
            pass

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

    result = NudgeResponse(
        headline=headline,
        bullets=[str(b) for b in bullets[:3]],
        type="active" if applications_this_week > 0 else "inactive",
        applications_this_week=applications_this_week,
        recommended_jobs=[JobListingResponse.model_validate(j) for j in jobs],
    )

    if redis is not None:
        try:
            await redis.set(redis_key, result.model_dump_json(), ex=_REDIS_TTL)
        except Exception as exc:
            logger.warning("nudge_cache_write_failed", error=str(exc))

    return result
