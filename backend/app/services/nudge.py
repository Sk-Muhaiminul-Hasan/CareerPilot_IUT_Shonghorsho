"""Nudge service -- AI-powered career suggestions with Redis caching."""

import asyncio
import json
import traceback
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

_REDIS_TTL = 300

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
    print(f"[NUDGE DEBUG] _create_todo_for_job called: {job.title} @ {job.company}")
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
            return record.id, record.title, record.due_date, record.priority
    except Exception as exc:
        logger.warning(
            "nudge.todo_creation_failed",
            job_id=job.id,
            job_title=job.title,
            job_company=job.company,
            error=str(exc),
            traceback=traceback.format_exc(),
        )
        return None


async def get_or_create_custom_todo(
    db: AsyncSession,
    user_id: str,
    title: str,
) -> tuple[str, str, datetime | None, int] | None:
    from app.models.todo_item import TodoItem
    from app.schemas.todo_item import TodoPriorityEnum

    try:
        # Check if an incomplete todo with the same title already exists for the user
        result = await db.execute(
            select(TodoItem).where(
                TodoItem.user_id == user_id,
                TodoItem.title == title,
            )
        )
        record = result.scalars().first()
        if record is not None:
            return record.id, record.title, record.due_date, record.priority

        # Otherwise, create a new TodoItem record
        due = datetime.utcnow() + timedelta(days=3)
        record = TodoItem(
            user_id=user_id,
            title=title,
            due_date=due,
            priority=TodoPriorityEnum.HIGH.value,
            recurrence=None,
        )
        db.add(record)
        await db.commit()
        return record.id, record.title, record.due_date, record.priority
    except Exception as exc:
        logger.warning("nudge.custom_todo_failed", title=title, error=str(exc))
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
                nudge = NudgeResponse.model_validate_json(cached)
                return nudge
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
    from app.models.resume import Resume
    from app.services.rag_service import RAGService

    settings = await get_or_create_settings(db, user_id)
    user_cfg = UserLLMConfig.from_settings(settings)

    # 1. Retrieve user's latest base CV
    resume_result = await db.execute(
        select(Resume)
        .where(
            Resume.user_id == user_id,
            Resume.type == "base",
            Resume.content_text.is_not(None),
            Resume.content_text != "",
        )
        .order_by(Resume.created_at.desc())
    )
    resume = resume_result.scalars().first()

    cv_text = ""
    
    if resume:
        try:
            rag = RAGService()
            cv_context = await rag.get_full_cv_text(db, resume.id)
            if cv_context:
                cv_text = cv_context.full_text or ""
        except Exception as e:
            logger.warning("nudge.rag_retrieval_failed", error=str(e))
            cv_text = resume.content_text or ""

    profile = (settings.candidate_profile or {}) if settings else {}
    full_name = (profile.get("full_name") or "").strip()
    skills = profile.get("skills") or []
    experience = profile.get("experience") or []

    if not cv_text.strip():
        # Fallback to profile
        if full_name:
            exp_text = "\n".join(f"- {exp.get('title', '')} at {exp.get('company', '')}" for exp in experience if exp)
            cv_text = f"Name: {full_name}\nSkills: {', '.join(skills)}\nExperience:\n{exp_text}"

    # Let's check if we have ANY profile/CV information. If completely missing, return beautiful onboarding nudge.
    if not cv_text.strip() and not full_name:
        logger.info("nudge_fallback_missing_profile")
        
        # We will retrieve default onboarding jobs
        fallback_result = await db.execute(
            select(Job)
            .where(
                (Job.user_id == "default_user") | (Job.user_id == user_id),
                ~Job.id.in_(select(Application.job_id).where(Application.user_id == user_id)),
            )
            .order_by(Job.created_at.desc())
            .limit(3)
        )
        jobs = list(fallback_result.scalars().all())
        for j in jobs:
            j.match_score = 0.75  # default onboarding score

        # Create onboarding todos
        onboarding_todos = [
            "Upload your primary CV to Resume Manager",
            "Browse our job search platform for matching roles",
            "Update your goals in Goal Management",
        ]
        
        todo_results = []
        for t_title in onboarding_todos:
            res = await get_or_create_custom_todo(db, user_id, t_title)
            if res:
                todo_results.append(res)
                
        suggested_todos = [
            SuggestedTodoResponse(
                id=t[0],
                title=t[1],
                due_date=t[2],
                priority=t[3],
                is_completed=False,
            )
            for t in todo_results
        ]
        
        generic_nudge = NudgeResponse(
            headline="Welcome! Upload your CV to unlock AI-powered career personalization.",
            bullets=[
                "Upload your resume in Resume Manager to enable automatic tailoring.",
                "Add your target career goals to track your milestones.",
                "Browse job listings to find matches for your skills.",
            ],
            type="active" if applications_this_week > 0 else "inactive",
            applications_this_week=applications_this_week,
            recommended_jobs=[JobListingResponse.model_validate(j) for j in jobs],
            suggested_todos=suggested_todos,
        )
        
        if redis is not None:
            try:
                await redis.set(redis_key, generic_nudge.model_dump_json(), ex=_REDIS_TTL)
            except Exception as exc:
                logger.warning("nudge_cache_write_failed", error=str(exc))
        return generic_nudge

    # Retrieve goals
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

    # Retrieve up to 10 unapplied jobs
    jobs_result = await db.execute(
        select(Job)
        .where(
            Job.user_id == user_id,
            ~Job.id.in_(select(Application.job_id).where(Application.user_id == user_id)),
        )
        .order_by(Job.created_at.desc())
        .limit(10)
    )
    jobs = list(jobs_result.scalars().all())

    # Fallback to default_user if user has no jobs in the DB
    if not jobs:
        fallback_result = await db.execute(
            select(Job)
            .where(
                (Job.user_id == "default_user") | (Job.user_id == user_id),
                ~Job.id.in_(select(Application.job_id).where(Application.user_id == user_id)),
            )
            .order_by(Job.created_at.desc())
            .limit(10)
        )
        jobs = list(fallback_result.scalars().all())

    # Create job list for LLM context (up to 10 jobs to keep context clean and response fast)
    job_lines = []
    for idx, j in enumerate(jobs):
        desc_snippet = j.description[:300] + "..." if len(j.description) > 300 else j.description
        job_lines.append(f"[{idx}] ID: {j.id} | Title: {j.title} | Company: {j.company} | Description: {desc_snippet}")
    jobs_context_str = "\n".join(job_lines)

    # Let's craft the LLM Prompt!
    goals_section = ""
    if goals_context:
        goal_lines = "\n".join(f"- {g['title']} ({g['current_value']}/{g['target_value']})" for g in goals_context)
        goals_section = f"\nActive goals:\n{goal_lines}\n"

    prompt = (
        f"Candidate CV / Profile:\n{cv_text}\n"
        f"Applications submitted this week: {applications_this_week}\n"
        f"{goals_section}"
        f"\nAvailable Job Listings:\n{jobs_context_str}\n\n"
        "Please analyze the candidate's CV and current goals, match them against the available jobs, "
        "and generate a personalized dashboard response."
    )

    llm = LLMClient()
    system_prompt = (
        "You are a supportive, high-fidelity career coach. Reply ONLY with a JSON object containing:\n"
        "- headline: ONE short, actionable, highly personalized nudge (max 20 words). It MUST reference specific details from the CV (e.g. projects, skills, GPA, courses) and recent application activity.\n"
        "- bullets: exactly 3 actionable career advice bullet points (strings), tailored to the candidate's skills and projects (e.g. 'Your Mars Rover project is unique...'). Keep each bullet under 25 words.\n"
        "- recommended_jobs: list of objects for the top 3 recommended jobs from the list provided, each with:\n"
        "  - job_id: the exact ID of the job from the provided list (string)\n"
        "  - match_score: a decimal match score between 0.10 and 0.99 indicating how well their CV matches the job requirements (float)\n"
        "- todos: exactly 3 personalized, specific, highly actionable to-do items (strings) for the candidate (e.g. 'Apply to ML Research Fellowship at...', 'Complete your blockchain portfolio project...')."
    )

    fallback_headline = "You're Closer Than You Think!"
    fallback_bullets = _GENERIC_BULLETS

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
        headline = str(data.get("headline") or fallback_headline)
        bullets = data.get("bullets") or fallback_bullets
        if not isinstance(bullets, list):
            bullets = [str(bullets)]
        if len(bullets) < 3:
            bullets = (bullets + _GENERIC_BULLETS)[:3]

        # Parse LLM recommended jobs and match scores
        llm_recommended = data.get("recommended_jobs") or []
        recommended_map = {}
        if isinstance(llm_recommended, list):
            for item in llm_recommended:
                if isinstance(item, dict) and "job_id" in item:
                    try:
                        recommended_map[item["job_id"]] = float(item.get("match_score", 0.75))
                    except ValueError:
                        recommended_map[item["job_id"]] = 0.75

        recommended_jobs_list = []
        for j in jobs:
            if j.id in recommended_map:
                j.match_score = recommended_map[j.id]
                recommended_jobs_list.append(j)

        # Ensure we have exactly 3 jobs if possible
        if len(recommended_jobs_list) < 3 and len(jobs) > 0:
            for j in jobs:
                if j not in recommended_jobs_list:
                    j.match_score = j.match_score or 0.70
                    recommended_jobs_list.append(j)
                if len(recommended_jobs_list) >= 3:
                    break

        recommended_jobs_list = recommended_jobs_list[:3]

        # Parse LLM custom todos
        llm_todos = data.get("todos") or []
        if not isinstance(llm_todos, list) or len(llm_todos) < 3:
            llm_todos = [
                "Tailor your resume for ML roles this week",
                "Update your goals in Goal Management",
                "Apply to at least 1 job on the platform",
            ]
        llm_todos = [str(t) for t in llm_todos[:3]]

        # Create/retrieve custom database todos
        todo_results = []
        for t_title in llm_todos:
            res = await get_or_create_custom_todo(db, user_id, t_title)
            if res:
                todo_results.append(res)

        suggested_todos = [
            SuggestedTodoResponse(
                id=t[0],
                title=t[1],
                due_date=t[2],
                priority=t[3],
                is_completed=False,
            )
            for t in todo_results
        ]

    except Exception as exc:
        logger.error("nudge_llm_failed_using_fallback", error=str(exc))
        # Complete fallback
        for j in jobs[:3]:
            j.match_score = 0.75
        recommended_jobs_list = jobs[:3]
        
        fallback_todos = [
            "Tailor your resume for ML roles this week",
            "Update your goals in Goal Management",
            "Apply to at least 1 job on the platform",
        ]
        todo_results = []
        for t_title in fallback_todos:
            res = await get_or_create_custom_todo(db, user_id, t_title)
            if res:
                todo_results.append(res)
                
        suggested_todos = [
            SuggestedTodoResponse(
                id=t[0],
                title=t[1],
                due_date=t[2],
                priority=t[3],
                is_completed=False,
            )
            for t in todo_results
        ]
        
        headline = fallback_headline
        bullets = fallback_bullets

    result = NudgeResponse(
        headline=headline,
        bullets=[str(b) for b in bullets[:3]],
        type="active" if applications_this_week > 0 else "inactive",
        applications_this_week=applications_this_week,
        recommended_jobs=[JobListingResponse.model_validate(j) for j in recommended_jobs_list],
        suggested_todos=suggested_todos,
    )

    if redis is not None:
        try:
            await redis.set(redis_key, result.model_dump_json(), ex=_REDIS_TTL)
        except Exception as exc:
            logger.warning("nudge_cache_write_failed", error=str(exc))

    return result
