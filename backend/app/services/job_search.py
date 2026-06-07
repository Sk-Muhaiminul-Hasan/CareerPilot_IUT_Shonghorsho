"""Job search and management service.

Handles job CRUD operations, search orchestration across platform
scrapers, and ATS-based job analysis.
"""

import asyncio
import re
from datetime import datetime
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.websocket.events import manager as ws_manager
from app.config.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.config.settings import get_settings
from app.core.automation.platforms import platform_registry
from app.core.automation.platforms.base import JobListing
from app.core.exceptions import RecordNotFoundError
from app.core.job_discovery.exa_search import ExaJobSearch
from app.db.session import AsyncSessionLocal
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
    collected_listings: list[tuple[str, JobListing]] = []

    for platform_name in platforms_to_search:
        if not platform_registry.has(platform_name):
            logger.warning(
                "job_search.platform_not_registered",
                platform=platform_name,
            )
            continue

        try:
            async with platform_registry.create_async(
                platform_name, db=db, user_id=user_id,
            ) as platform:
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
            for listing in listings:
                collected_listings.append((platform_name, listing))
        except Exception as exc:
            logger.error(
                "job_search.platform_search_failed",
                platform=platform_name,
                error=str(exc),
            )
            continue

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
                collected_listings.append((listing.platform, listing))
            logger.info("job_search.exa_results", count=len(exa_listings))
    except Exception as exc:
        logger.debug("job_search.exa_skipped", reason=str(exc))

    for platform_name, listing in collected_listings:
        try:
            job = _listing_to_job(listing, user_id)

            async with AsyncSessionLocal() as save_db, save_db.begin():
                existing = await save_db.execute(
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

                url_id = _extract_platform_job_id_from_url(listing.url or "")
                if url_id:
                    job.platform_job_id = url_id

                try:
                    save_db.add(job)
                    await save_db.flush()
                except IntegrityError:
                    await save_db.rollback()
                    existing = await save_db.execute(
                        select(Job).where(
                            Job.platform == job.platform,
                            Job.platform_job_id == job.platform_job_id,
                            Job.user_id == user_id,
                        ),
                    )
                    existing_job = existing.scalar_one_or_none()
                    if existing_job is not None:
                        all_jobs.append(existing_job)
                    else:
                        logger.warning(
                            "job_search.duplicate_not_recovered",
                            platform=platform_name,
                            platform_job_id=job.platform_job_id,
                            user_id=user_id,
                        )
                    continue

                all_jobs.append(job)
        except Exception as exc:
            logger.warning(
                "job_search.listing_conversion_failed",
                platform=platform_name,
                listing_id=listing.platform_job_id,
                error=str(exc),
            )
            continue

    limited = [
        j for j in all_jobs[: request.limit]
        if j.id is not None and j.created_at is not None
    ]
    items = [JobListingResponse.model_validate(j) for j in limited]

    # Fire enrichment in background - don't await it. The search response
    # is returned to the user immediately; enrichment runs after.
    asyncio.create_task(  # noqa: RUF006
        _enrich_jobs_background(
            job_ids=[job.id for job in all_jobs],
            listings=collected_listings,
            user_id=user_id,
        ),
    )

    return JobListResponse(
        items=items,
        total=len(all_jobs),
        page=1,
        page_size=request.limit,
        has_next=len(all_jobs) > request.limit,
    )


async def _enrich_jobs_background(
    job_ids: list[str],
    listings: list[tuple[str, JobListing]],
    user_id: str,
) -> None:
    """Enrich saved jobs by visiting each listing's URL for full details.

    Runs entirely in the background after ``search_jobs`` returns to the
    caller. For each listing it:

    1. Normalizes the URL (``bd.linkedin.com`` -> ``www.linkedin.com``).
    2. Re-instantiates the originating platform (using the per-user LLM
       resolver) and calls ``scrape_details(url)``.
    3. Opens a fresh ``AsyncSessionLocal()`` session, finds the
       corresponding ``Job`` by ``platform_job_id`` + ``user_id``, and
       updates ``description``, ``salary_range``, ``work_type``,
       ``skills_required`` plus ``is_enriched=True``.
    4. Emits a ``job_enriched`` WebSocket event per job so the UI can
       swap in the richer record.

    Each job is wrapped in its own ``try/except`` so a single failure
    never stops the rest of the batch.
    """
    logger.info(
        "job_search.background_enrich_started",
        total=len(listings),
        user_id=user_id,
    )

    for platform_name, listing in listings:
        if not listing.url:
            continue

        # Normalize LinkedIn tracking subdomain to canonical host.
        visit_url = listing.url.replace("bd.linkedin.com", "www.linkedin.com")

        # The platform's search-time LLM extraction may not produce a usable
        # ``platform_job_id`` (it can be empty, a hash, or a duplicate
        # string), but the URL itself always carries the canonical numeric
        # ID — e.g. ``/jobs/view/frontend-engineer-at-verneek-4375021807``.
        # Extract that and use it as the authoritative lookup key.
        url_id = _extract_platform_job_id_from_url(visit_url)
        lookup_id = url_id or listing.platform_job_id
        if not lookup_id:
            logger.info(
                "job_search.enrich.no_id",
                platform=platform_name,
                url=visit_url,
            )
            continue

        print(f"ENRICH LOOKUP: platform_job_id={lookup_id}, user_id={user_id}")

        if not platform_registry.has(platform_name):
            logger.warning(
                "job_search.enrich.platform_unknown",
                platform=platform_name,
            )
            continue

        try:
            async with AsyncSessionLocal() as db:
                async with platform_registry.create_async(
                    platform_name, db=db, user_id=user_id,
                ) as platform:
                    details = await platform.scrape_details(visit_url)

                if details is None:
                    logger.info(
                        "job_search.enrich.no_details",
                        platform=platform_name,
                        url=visit_url,
                    )
                    continue

                async with AsyncSessionLocal() as save_db:
                    async with save_db.begin():
                        result = await save_db.execute(
                            select(Job).where(
                                Job.platform == platform_name,
                                Job.platform_job_id == lookup_id,
                                Job.user_id == user_id,
                            ),
                        )
                        job = result.scalar_one_or_none()
                        print(f"ENRICH RESULT: job found={job is not None}")
                        if job is None:
                            url_q = select(Job).where(
                                Job.user_id == user_id,
                                Job.url == visit_url,
                            )
                            if lookup_id:
                                url_q = url_q.where(Job.platform == platform_name)
                            url_result = await save_db.execute(url_q)
                            job = url_result.scalar_one_or_none()
                        print(f"ENRICH RESULT AFTER URL FALLBACK: job found={job is not None}")
                        if job is None:
                            logger.warning(
                                "job_search.enrich.job_not_found",
                                platform=platform_name,
                                platform_job_id=lookup_id,
                                listing_platform_job_id=listing.platform_job_id,
                                url_id=url_id,
                            )
                            continue

                        if url_id and job.platform_job_id != url_id:
                            job.platform_job_id = url_id

                        job.description = details.description or job.description
                        job.salary_range = details.salary_range or job.salary_range
                        if not job.salary_range or job.salary_range in ('None', ''):
                            if details.salary_min is not None or details.salary_max is not None:
                                job.salary_range = _format_salary_range(details)
                        job.work_type = details.work_type or job.work_type
                        if details.skills_required or details.skills_preferred:
                            job.skills_required = {
                                "required": details.skills_required,
                                "preferred": details.skills_preferred,
                            }
                        job.is_enriched = True

                job_id = job.id
                job_title = job.title

            await ws_manager.send_to_user(
                user_id,
                {
                    "type": "job_enriched",
                    "job_id": job_id,
                    "title": job_title,
                },
            )
            logger.info(
                "job_search.enrich.completed",
                platform=platform_name,
                platform_job_id=lookup_id,
                title=job_title,
            )
        except Exception as exc:
            logger.warning(
                "job_search.enrich.job_failed",
                platform=platform_name,
                platform_job_id=lookup_id,
                url=visit_url,
                error=str(exc),
            )
            continue

    logger.info(
        "job_search.background_enrich_finished",
        total=len(listings),
        user_id=user_id,
    )


# Match the trailing numeric ID that LinkedIn and most job boards put at
# the end of a job-detail URL, e.g.:
#   https://www.linkedin.com/jobs/view/...-at-verneek-4375021807?...
#   https://www.linkedin.com/jobs/view/4375021807
#   https://www.indeed.com/viewjob?jk=4375021807
#   https://boards.greenhouse.io/verneek/jobs/4375021807
# We strip the query string first because the URL tail is the most
# reliable place to find the canonical job ID; query strings may also
# contain numeric tracking parameters that would confuse a greedy regex.
_PLATFORM_JOB_ID_TAIL_RE = re.compile(r"/(\d{6,})/?$")
_PLATFORM_JOB_ID_HYPHEN_TAIL_RE = re.compile(r"-(\d{6,})/?$")
_PLATFORM_JOB_ID_QUERY_RE = re.compile(r"[?&](?:jk|job[_-]?id)=(\d+)")


def _extract_platform_job_id_from_url(url: str) -> str | None:
    """Pull the canonical numeric job ID out of a job-detail URL.

    The search-time ``JobListing.platform_job_id`` is whatever the LLM
    happened to put in the ``id`` field of the search-result row, which is
    often empty, a hash, or a non-numeric placeholder. The URL itself,
    however, always carries the numeric ID at the end of the path — so
    we extract that and use it as the authoritative lookup key when
    correlating enrichment data back to a saved ``Job`` row.

    Args:
        url: Job-detail URL (already normalized to ``www.linkedin.com``
            upstream for LinkedIn tracking subdomains).

    Returns:
        The numeric job ID as a string, or ``None`` if the URL doesn't
        contain one. We require at least 6 digits to avoid mistaking
        short path segments (e.g. ``/jobs/``) for IDs.
    """
    if not url:
        return None

    # 1) Greenhouse / Indeed direct path-style ID, e.g.
    #    https://boards.greenhouse.io/.../jobs/4375021807
    #    https://www.linkedin.com/jobs/view/4375021807
    path = url.split("?", 1)[0].split("#", 1)[0]
    match = _PLATFORM_JOB_ID_TAIL_RE.search(path)
    if match:
        return match.group(1)

    # 2) LinkedIn slugged style, e.g.
    #    https://www.linkedin.com/jobs/view/...-at-verneek-4375021807
    match = _PLATFORM_JOB_ID_HYPHEN_TAIL_RE.search(path)
    if match:
        return match.group(1)

    # 3) Indeed ``?jk=...`` style.
    match = _PLATFORM_JOB_ID_QUERY_RE.search(url)
    if match:
        return match.group(1)

    return None


def _format_salary_range(details: JobListing) -> str:
    """Build a human-readable salary_range from min/max on a JobListing."""
    if details.salary_min is not None and details.salary_max is not None:
        return (
            f"{details.salary_currency} "
            f"{details.salary_min:,.0f} - {details.salary_max:,.0f}"
        )
    if details.salary_min is not None:
        return f"{details.salary_currency} {details.salary_min:,.0f}+"
    if details.salary_max is not None:
        return f"Up to {details.salary_currency} {details.salary_max:,.0f}"
    return ""


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
    if listing.salary_range:
        salary_range = listing.salary_range

    deadline_dt: datetime | None = None
    if listing.deadline:
        deadline_dt = _parse_iso_date(listing.deadline)

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
        is_enriched=False,
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
    """List jobs with pagination and optional status filter."""
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
    """Get a single job by ID."""
    result = await db.execute(select(Job).where(Job.id == job_id, Job.user_id == user_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise RecordNotFoundError("Job", job_id)
    return job


async def delete_job(db: AsyncSession, job_id: str, user_id: str = "default_user") -> None:
    """Delete a job by ID."""
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
    """Analyze job-candidate match using ATS scoring."""
    job = await get_job(db, job_id, user_id)
    logger.info("job_analysis_requested", job_id=job_id, title=job.title)

    if not resume_id:
        return JobAnalysisResponse(
            job_id=job.id,
            match_score=0.0,
            skill_match=0.0,
            keyword_match=0.0,
            missing_skills=[],
            suggestions=["Provide a resume_id to get accurate ATS scoring."],
        )

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
            suggestions=["Resume has no extracted text. Re-upload for analysis."],
        )

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
        logger.warning("job_analysis.spacy_unavailable", error=str(exc))
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
