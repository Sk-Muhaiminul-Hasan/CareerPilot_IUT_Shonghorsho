"""Background scoring pipeline for applications.

Runs ATS scoring and LLM reasoning generation for a newly created
application, updates database state, and pushes results to the user
over WebSockets.
"""

from __future__ import annotations

import asyncio

import structlog
from pydantic import BaseModel
from sqlalchemy import select

from app.api.websocket.events import manager as ws_manager
from app.config.constants import (
    ApplicationStatus,
    LLMPurpose,
)
from app.core.ats.experience_analyzer import ExperienceAnalyzer
from app.core.ats.keyword_analyzer import KeywordAnalyzer
from app.core.ats.scorer import ResumeScorer, ScoreDetails
from app.core.ats.skill_matcher import SkillMatcher
from app.core.llm.client import LLMClient, LLMNotConfiguredError, UserLLMConfig
from app.core.llm.prompts.ats_optimize import ATS_OPTIMIZE_SYSTEM_PROMPT, ATS_REASONING_SYSTEM_PROMPT
from app.db.session import async_session_factory
from app.models.job import Job
from app.models.resume import Resume
from app.services.application import get_application
from app.services.settings_helper import get_or_create_settings

logger = structlog.get_logger(__name__)


class ATSReasoningOutput(BaseModel):
    matches: list[str]
    gaps: list[str]


async def _run_ats_scoring(job: Job, resume_id: str, user_id: str) -> ScoreDetails | None:
    if not resume_id:
        return None

    try:
        async with async_session_factory() as db:
            resume_query = select(Resume).where(
                Resume.id == resume_id,
                Resume.user_id == user_id,
            )
            result = await db.execute(resume_query)
            resume = result.scalar_one_or_none()

        if resume is None:
            logger.warning("scoring_pipeline.no_resume", resume_id=resume_id)
            return None

        resume_text = resume.content_text or ""
        if not resume_text.strip() or len(resume_text.strip()) < 50:
            logger.warning("scoring_pipeline.resume_text_empty", resume_id=resume_id)
            fallback_text = (
                f"Resume: {resume.name}"
                if resume.name
                else "No resume content available"
            )
            resume_text = fallback_text

        try:
            import spacy

            nlp = spacy.load("en_core_web_sm")
        except (ImportError, OSError):
            logger.warning("scoring_pipeline.spacy_unavailable")
            return None

        skill_matcher = SkillMatcher(nlp)
        keyword_analyzer = KeywordAnalyzer(nlp)
        experience_analyzer = ExperienceAnalyzer(nlp)
        scorer = ResumeScorer(
            skill_matcher=skill_matcher,
            keyword_analyzer=keyword_analyzer,
            experience_analyzer=experience_analyzer,
        )

        return scorer.score_resume(
            resume_text=resume_text,
            job_description=job.description or "",
            candidate_profile={"skills": [], "experience": [], "education": []},
            job_metadata={
                "required_skills": job.skills_required.get("required", [])
                if isinstance(job.skills_required, dict)
                else []
            },
        )
    except Exception as exc:
        logger.error("scoring_pipeline.ats_scoring_failed", error=str(exc))
        return None


async def _generate_reasoning(
    job: Job,
    score_details: ScoreDetails,
    user_settings: UserLLMConfig | None,
    resume_id: str | None = None,
) -> dict | None:
    try:
        llm = LLMClient()

        resume_text = ""
        if resume_id:
            async with async_session_factory() as db:
                resume_query = select(Resume).where(
                    Resume.id == resume_id,
                    Resume.user_id == job.user_id,
                )
                resume_result = await db.execute(resume_query)
                resume = resume_result.scalar_one_or_none()

            resume_text = (resume.content_text if resume else "") or ""
            resume_text = resume_text[:4000] if resume_text else ""

        prompt = (
            f"ATS Score: {score_details.overall_score:.2f}\n"
            f"Missing required skills: {', '.join(score_details.missing_required_skills)}\n"
            f"Missing preferred skills: {', '.join(score_details.missing_preferred_skills)}\n"
            f"Improvement suggestions: {'; '.join(score_details.improvement_suggestions)}\n"
            f"Employer: {job.company}\nRole: {job.title}\n\n"
            f"RESUME TEXT:\n{resume_text}\n\n"
            f"JOB DESCRIPTION:\n{(job.description or '')[:4000]}"
        )
        result = await llm.complete_with_structured_output(
            prompt=prompt,
            output_schema=ATSReasoningOutput,
            system_prompt=ATS_REASONING_SYSTEM_PROMPT,
            purpose=LLMPurpose.ATS_OPTIMIZE,
            user_settings=user_settings,
        )
        return result.model_dump()
    except Exception as exc:
        logger.error("scoring_pipeline.reasoning_failed", error=str(exc))
        return None


async def run_scoring_pipeline(application_id: str, user_id: str) -> None:
    try:
        logger.info(
            "scoring_pipeline.started",
            application_id=application_id,
            user_id=user_id,
        )
        async with async_session_factory() as db:
            try:
                application = await get_application(db, application_id, user_id)
            except Exception:
                logger.error(
                    "scoring_pipeline.app_not_found",
                    application_id=application_id,
                )
                return

            job_query = select(Job).where(
                Job.id == application.job_id,
                Job.user_id == user_id,
            )
            job_result = await db.execute(job_query)
            job = job_result.scalar_one_or_none()
            if job is None:
                logger.error(
                    "scoring_pipeline.job_not_found",
                    application_id=application_id,
                    job_id=application.job_id,
                )
                return

            settings = await get_or_create_settings(db, user_id)
            user_cfg = UserLLMConfig.from_settings(settings)

            score_details, reasoning = await asyncio.gather(
                _run_ats_scoring(
                    job, application.resume_id or "", user_id,
                ),
                _generate_reasoning(
                    job,
                    ScoreDetails(
                        overall_score=0,
                        skill_score=0,
                        experience_score=0,
                        education_score=0,
                        keyword_score=0,
                    ),
                    user_cfg,
                    application.resume_id,
                ),
                return_exceptions=True,
            )

            if isinstance(reasoning, Exception):
                logger.warning(
                    "scoring_pipeline.reasoning_failed",
                    application_id=application_id,
                    error=str(reasoning),
                )
                reasoning = None

            # Re-run reasoning with actual scores if available
            if score_details is not None and not isinstance(score_details, Exception):
                try:
                    reasoning = await _generate_reasoning(job, score_details, user_cfg, application.resume_id)
                except LLMNotConfiguredError:
                    logger.warning(
                        "scoring_pipeline.llm_not_configured",
                        application_id=application_id,
                    )
                    reasoning = None
                except Exception as exc:
                    logger.error(
                        "scoring_pipeline.reasoning_failed",
                        application_id=application_id,
                        error=str(exc),
                    )
                    reasoning = None

            ats_score = score_details.overall_score if score_details is not None else 0.0
            logger.info(
                "scoring_pipeline.after_ats_and_reasoning",
                application_id=application_id,
                ats_score=ats_score,
            )
            application.ats_score = ats_score
            application.reasoning = reasoning
            application.status = ApplicationStatus.APPLIED
            await db.commit()
            await db.refresh(application)

        await ws_manager.send_to_user(
            user_id,
            {
                "type": "application_scored",
                "application_id": application_id,
                "ats_score": ats_score,
                "reasoning": reasoning,
            },
        )

        logger.info(
            "scoring_pipeline.completed",
            application_id=application_id,
            ats_score=ats_score,
        )
    except Exception as exc:
        logger.error(
            "scoring_pipeline.unexpected_failure",
            application_id=application_id,
            error=str(exc),
        )
