"""Job search and management service.

Handles job CRUD operations, search orchestration across platform
scrapers, and ATS-based job analysis.
"""

from typing import Any
from datetime import datetime

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.config.settings import get_settings
from app.core.automation.platforms import platform_registry
from app.core.automation.platforms.base import JobListing
from app.core.exceptions import RecordNotFoundError
from app.core.job_discovery.exa_search import ExaJobSearch
from app.db.session import async_session_factory
from app.models.job import Job
from app.models.resume import Resume
from app.schemas.job import (
    JobAnalysisResponse,
    JobListingResponse,
    JobListResponse,
    JobSearchRequest,
)

logger = structlog.get_logger(__name__)


async def search_jobs(
    db: AsyncSession,
    request: JobSearchRequest,
    user_id: str = "default_user",
) -> JobListResponse:
    """Search for jobs across configured platforms.

    Iterates over requested platforms, calls each platform's ``search``
    method, converts results to ``Job`` model instances, and persists
    them to the database. Partial failures are logged and skipped so
    that results from healthy platforms are still returned.

    Args:
        db: Async database session.
        request: Job search parameters.

    Returns:
        Paginated list of matching job listings.
    """
    logger.info(
        "job_search_requested",
        query=request.query,
        location=request.location,
        platforms=request.platforms,
        limit=request.limit,
    )

    platforms_to_search = request.platforms or platform_registry.list_platforms()

    if not platforms_to_search:
        logger.warning("job_search.no_platforms_available")
        return JobListResponse(
            items=[],
            total=0,
            page=1,
            page_size=request.limit,
            has_next=False,
        )

    all_jobs: list[Job] = []

    for platform_name in platforms_to_search:
        if not platform_registry.has(platform_name):
            logger.warning(
                "job_search.platform_not_registered",
                platform=platform_name,
            )
            continue

        try:
            async with platform_registry.create_async(platform_name, db=db, user_id=user_id) as platform:
                listings: list[JobListing] = await platform.search(
                    query=request.query,
                    location=request.location,
                    filters=request.filters or None,
                )
            logger.info(
                "job_search.platform_results",
                platform=platform_name,
                count=len(listings),
            )
        except Exception as exc:
            logger.error(
                "job_search.platform_search_failed",
                platform=platform_name,
                error=str(exc),
            )
            continue

        for listing in listings:
            try:
                job = _listing_to_job(listing, user_id)
                existing = await db.execute(
                    select(Job).where(
                        Job.platform == job.platform,
                        Job.platform_job_id == job.platform_job_id,
                        Job.user_id == user_id,
                    ),
                )
                existing_job = existing.scalar_one_or_none()
                if existing_job is not None:
                    all_jobs.append(existing_job)
                    continue

                db.add(job)
                all_jobs.append(job)
            except Exception as exc:
                logger.warning(
                    "job_search.listing_conversion_failed",
                    platform=platform_name,
                    listing_id=listing.platform_job_id,
                    error=str(exc),
                )
                continue

    # ------------------------------------------------------------------
    # Exa AI semantic search (supplementary, non-blocking)
    # ------------------------------------------------------------------
    try:
        settings = get_settings()
        exa_key = settings.exa_api_key.get_secret_value()
        exa = ExaJobSearch(api_key=exa_key)
        if exa.available:
            exa_listings = await exa.search_jobs(
                query=request.query,
                location=request.location,
                num_results=min(request.limit, 10),
            )
            for listing in exa_listings:
                try:
                    job = _listing_to_job(listing, user_id)
                    existing = await db.execute(
                        select(Job).where(
                            Job.platform == job.platform,
                            Job.platform_job_id == job.platform_job_id,
                            Job.user_id == user_id,
                        ),
                    )
                    if existing.scalar_one_or_none() is None:
                        db.add(job)
                        all_jobs.append(job)
                except Exception:
                    continue
            logger.info("job_search.exa_results", count=len(exa_listings))
    except Exception as exc:
        logger.debug("job_search.exa_skipped", reason=str(exc))

    # ------------------------------------------------------------------
    # Persist collected jobs using a fresh DB session when the request-
    # scoped one has timed out (known Neon issue with 5+ min requests).
    # ------------------------------------------------------------------
    async def _persist(
        session: AsyncSession,
        jobs: list[Job],
    ) -> list[Job]:
        """Commit and refresh a batch of unsaved Job instances."""
        try:
            session.add_all(jobs)
            await session.commit()
            for job in jobs:
                await session.refresh(job)
            return jobs
        except Exception as exc:
            logger.error("job_search.commit_failed", error=str(exc))
            await session.rollback()
            return []

    session_to_use = db
    try:
        await session_to_use.rollback()
    except Exception as exc:
        logger.warning(
            "job_search.request_session_timed_out",
            error=str(exc),
            action="opening_fresh_session",
        )
        async with async_session_factory() as fresh_db:
            all_jobs = await _persist(fresh_db, all_jobs)
    else:
        all_jobs = await _persist(session_to_use, all_jobs)

    # Apply limit
    limited = all_jobs[: request.limit]
    items = [JobListingResponse.model_validate(j) for j in limited]

    return JobListResponse(
        items=items,
        total=len(all_jobs),
        page=1,
        page_size=request.limit,
        has_next=len(all_jobs) > request.limit,
    )


def _listing_to_job(listing: JobListing, user_id: str) -> Job:
    """Convert a platform ``JobListing`` to a ``Job`` database model.

    Args:
        listing: Normalized job listing from a platform scraper.

    Returns:
        A new unsaved ``Job`` model instance.
    """
    salary_range: str | None = None
    if listing.salary_min is not None and listing.salary_max is not None:
        salary_range = (
            f"{listing.salary_currency} "
            f"{listing.salary_min:,.0f} - {listing.salary_max:,.0f}"
        )
    elif listing.salary_min is not None:
        salary_range = f"{listing.salary_currency} {listing.salary_min:,.0f}+"
    elif listing.salary_max is not None:
        salary_range = f"Up to {listing.salary_currency} {listing.salary_max:,.0f}"
    # Prefer an explicit salary_range string captured by the scraper
    # (e.g. "$120k - $150k"). It is more descriptive than the min/max
    # reconstruction above.
    if listing.salary_range:
        salary_range = listing.salary_range

    # Parse deadline ISO string from scrapers (YYYY-MM-DD)
    deadline_dt: datetime | None = None
    if listing.deadline:
        deadline_dt = _parse_iso_date(listing.deadline)

    # Normalize work_type to the constrained DB set
    work_type = _normalize_work_type_for_db(listing.work_type, listing.remote)

    skills_dict: dict[str, Any] | None = None
    if listing.skills_required or listing.skills_preferred:
        skills_dict = {
            "required": listing.skills_required,
            "preferred": listing.skills_preferred,
        }

    return Job(
        platform=listing.platform,
        platform_job_id=listing.platform_job_id,
        title=listing.title,
        company=listing.company,
        location=listing.location,
        url=listing.url,
        description=listing.description,
        salary_range=salary_range,
        job_type=listing.job_type or None,
        remote=listing.remote,
        work_type=work_type,
        deadline=deadline_dt,
        skills_required=skills_dict,
        status="new",
        user_id=user_id,
    )


def _parse_iso_date(value: str) -> datetime | None:
    """Parse a date string (YYYY-MM-DD) to ``datetime``, else ``None``."""
    if not value:
        return None
    text = value.strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _normalize_work_type_for_db(value: str, remote: bool) -> str:
    """Constrain work_type to: '', 'remote', 'hybrid', 'onsite'."""
    valid = {"", "remote", "hybrid", "onsite"}
    if not value:
        return "remote" if remote else ""
    cleaned = str(value).strip().lower()
    if cleaned in valid:
        return cleaned
    aliases = {
        "work from home": "remote",
        "wfh": "remote",
        "distributed": "remote",
        "on-site": "onsite",
        "on site": "onsite",
        "in-office": "onsite",
        "in office": "onsite",
        "office": "onsite",
    }
    if cleaned in aliases:
        return aliases[cleaned]
    if "hybrid" in cleaned:
        return "hybrid"
    if "remote" in cleaned:
        return "remote"
    if "on-site" in cleaned or "onsite" in cleaned or "office" in cleaned:
        return "onsite"
    return ""


async def list_jobs(
    db: AsyncSession,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    status: str | None = None,
    user_id: str = "default_user",
) -> JobListResponse:
    """List jobs with pagination and optional status filter.

    Args:
        db: Async database session.
        page: Page number (1-indexed).
        page_size: Items per page.
        status: Optional status filter.
        user_id: Authenticated user ID.

    Returns:
        Paginated job list response.
    """
    page_size = min(page_size, MAX_PAGE_SIZE)
    offset = (page - 1) * page_size

    query = select(Job).where(Job.user_id == user_id)
    count_query = select(func.count(Job.id)).where(Job.user_id == user_id)

    if status:
        query = query.where(Job.status == status)
        count_query = count_query.where(Job.status == status)

    query = query.order_by(Job.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    jobs = list(result.scalars().all())

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    items = [JobListingResponse.model_validate(j) for j in jobs]

    return JobListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=(page * page_size) < total,
    )


async def get_job(db: AsyncSession, job_id: str, user_id: str = "default_user") -> Job:
    """Get a single job by ID.

    Args:
        db: Async database session.
        job_id: UUID of the job.
        user_id: Authenticated user ID.

    Returns:
        The Job model instance.

    Raises:
        RecordNotFoundError: If job does not exist.
    """
    result = await db.execute(select(Job).where(Job.id == job_id, Job.user_id == user_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise RecordNotFoundError("Job", job_id)
    return job


async def delete_job(db: AsyncSession, job_id: str, user_id: str = "default_user") -> None:
    """Delete a job by ID.

    Args:
        db: Async database session.
        job_id: UUID of the job to delete.

    Raises:
        RecordNotFoundError: If job does not exist.
    """
    job = await get_job(db, job_id, user_id)
    await db.delete(job)
    await db.commit()
    logger.info("job_deleted", job_id=job_id)


async def analyze_job(
    db: AsyncSession,
    job_id: str,
    resume_id: str | None = None,
    user_id: str = "default_user",
) -> JobAnalysisResponse:
    """Analyze job-candidate match using ATS scoring.

    If a resume_id is provided, loads the resume and runs multi-factor
    ATS scoring (skills, keywords, experience, education). Falls back to
    placeholder scores when spaCy is not available or no resume is given.

    Args:
        db: Async database session.
        job_id: UUID of the job to analyze.
        resume_id: Optional UUID of the resume to score against.
        user_id: Authenticated user ID.

    Returns:
        Job analysis with match scores and suggestions.

    Raises:
        RecordNotFoundError: If job does not exist.
    """
    job = await get_job(db, job_id, user_id)
    logger.info("job_analysis_requested", job_id=job_id, title=job.title)

    # If no resume provided, return placeholder scores
    if not resume_id:
        return JobAnalysisResponse(
            job_id=job.id,
            match_score=0.0,
            skill_match=0.0,
            keyword_match=0.0,
            missing_skills=[],
            suggestions=[
                "Provide a resume_id to get accurate ATS scoring.",
            ],
        )

    # Load resume
    resume_result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id),
    )
    resume = resume_result.scalar_one_or_none()
    if resume is None:
        raise RecordNotFoundError("Resume", resume_id)

    resume_text = resume.content_text or ""
    if not resume_text:
        return JobAnalysisResponse(
            job_id=job.id,
            match_score=0.0,
            skill_match=0.0,
            keyword_match=0.0,
            missing_skills=[],
            suggestions=[
                "Resume has no extracted text. Re-upload for analysis.",
            ],
        )

    # Attempt ATS scoring with spaCy
    try:
        import spacy

        nlp = spacy.load("en_core_web_sm")
        from app.core.ats.experience_analyzer import ExperienceAnalyzer
        from app.core.ats.keyword_analyzer import KeywordAnalyzer
        from app.core.ats.scorer import ResumeScorer
        from app.core.ats.skill_matcher import SkillMatcher

        skill_matcher = SkillMatcher(nlp)
        keyword_analyzer = KeywordAnalyzer(nlp)
        experience_analyzer = ExperienceAnalyzer(nlp)

        scorer = ResumeScorer(
            skill_matcher=skill_matcher,
            keyword_analyzer=keyword_analyzer,
            experience_analyzer=experience_analyzer,
        )

        job_description = job.description or ""
        job_metadata: dict[str, Any] = {}
        if job.skills_required and isinstance(job.skills_required, dict):
            job_metadata["required_skills"] = job.skills_required.get(
                "required", job.skills_required.get("skills", []),
            )
            job_metadata["preferred_skills"] = job.skills_required.get(
                "preferred", [],
            )

        # Extract skills from resume text for candidate profile
        detected_skills = list(skill_matcher.extract_skills(resume_text))
        candidate_profile: dict[str, Any] = {
            "skills": detected_skills,
            "experience": [],
            "education": [],
        }

        details = scorer.score_resume(
            resume_text=resume_text,
            job_description=job_description,
            candidate_profile=candidate_profile,
            job_metadata=job_metadata,
        )

        return JobAnalysisResponse(
            job_id=job.id,
            match_score=details.overall_score,
            skill_match=details.skill_score,
            keyword_match=details.keyword_score,
            missing_skills=details.missing_required_skills,
            suggestions=details.improvement_suggestions,
        )

    except (ImportError, OSError) as exc:
        logger.warning(
            "job_analysis.spacy_unavailable",
            error=str(exc),
        )
        return JobAnalysisResponse(
            job_id=job.id,
            match_score=0.0,
            skill_match=0.0,
            keyword_match=0.0,
            missing_skills=[],
            suggestions=[
                "spaCy NLP model not available. Install with: "
                "python -m spacy download en_core_web_sm",
            ],
        )
