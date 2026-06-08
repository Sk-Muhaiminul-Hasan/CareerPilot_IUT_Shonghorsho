"""Resume management service.

Handles upload, listing, generation, and scoring of resumes.
Uses DocumentParser for real file parsing and SkillMatcher for skill extraction.
"""

import os
import re
import tempfile
import uuid
from pathlib import Path

import structlog
from fastapi import BackgroundTasks, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.documents.generator import DocumentGenerator
from app.core.documents.parser import DocumentParser, ParsedResume
from app.core.exceptions import ParseError, RecordNotFoundError
from app.core.llm.client import LLMClient
from app.core.storage import storage as storage_client
from app.models.job import Job
from app.models.resume import Resume
from app.schemas.resume import (
    ResumeGenerateRequest,
    ResumeListResponse,
    ResumeResponse,
    ResumeScoreRequest,
    ResumeScoreResponse,
    ResumeUploadResponse,
)

logger = structlog.get_logger(__name__)

_parser = None


def _get_parser() -> DocumentParser:
    return DocumentParser()


def _serialize_resume_data_to_text(data: dict) -> str:
    name = data.get("name", "")
    email = data.get("email", "")
    phone = data.get("phone", "")
    linkedin = data.get("linkedin", "")
    github = data.get("github", "")

    lines: list[str] = []
    lines.append(name or "")
    contact_parts = [p for p in (email, phone, linkedin, github) if p]
    if contact_parts:
        lines.append("Contact: " + " | ".join(contact_parts))

    summary = data.get("summary", "")
    if summary:
        lines.append("")
        lines.append("SUMMARY")
        lines.append(summary)

    skills = data.get("skills", [])
    if skills:
        lines.append("")
        lines.append("SKILLS")
        lines.append(", ".join(skills))

    experience = data.get("experience", [])
    if experience:
        lines.append("")
        lines.append("EXPERIENCE")
        for exp in experience:
            title = exp.get("title", "")
            company = exp.get("company", "")
            duration = exp.get("duration", "")
            parts = [title, company, duration]
            header = " — ".join(p for p in parts if p)
            lines.append(header)
            desc = exp.get("description", "")
            if isinstance(desc, str):
                for bullet in desc.split("\n"):
                    bullet = bullet.strip()
                    if bullet:
                        lines.append(f"- {bullet}")

    education = data.get("education", [])
    if education:
        lines.append("")
        lines.append("EDUCATION")
        for edu in education:
            degree = edu.get("degree", "")
            institution = edu.get("institution", "")
            year = edu.get("year", "")
            parts = [degree, institution, year]
            line = " — ".join(p for p in parts if p)
            lines.append(line)

    certifications = data.get("certifications", [])
    if certifications:
        lines.append("")
        lines.append("CERTIFICATIONS")
        for cert in certifications:
            if isinstance(cert, str) and cert.strip():
                lines.append(f"- {cert.strip()}")

    projects = data.get("projects", [])
    if projects:
        lines.append("")
        lines.append("PROJECTS")
        for proj in projects:
            proj_name = proj.get("name", "") if isinstance(proj, dict) else str(proj)
            if proj_name:
                lines.append(proj_name)
            desc = proj.get("description", "") if isinstance(proj, dict) else ""
            if isinstance(desc, str):
                for bullet in desc.split("\n"):
                    bullet = bullet.strip()
                    if bullet:
                        lines.append(f"- {bullet}")

    return "\n".join(lines)


def _extract_skills_text_based(text: str) -> list[str]:
    """Extract skills using the SkillMatcher text-based approach.

    Falls back gracefully if spaCy is not available by using only
    the regex-based word matching in SkillMatcher.extract_skills.
    """
    try:
        from app.core.ats.skill_matcher import SKILL_VARIATIONS

        lower = text.lower()
        import re

        found: list[str] = []
        seen: set[str] = set()
        for canonical, variations in SKILL_VARIATIONS.items():
            if canonical in seen:
                continue
            if re.search(rf"\b{re.escape(canonical)}\b", lower):
                found.append(canonical)
                seen.add(canonical)
                continue
            for variant in variations:
                if re.search(rf"\b{re.escape(variant)}\b", lower):
                    found.append(canonical)
                    seen.add(canonical)
                    break
        return found
    except Exception:
        logger.warning("skill_extraction_fallback_failed")
        return []


def _extract_skills(text: str) -> list[str]:
    """Extract skills, trying spaCy-backed SkillMatcher first, then text-only."""
    try:
        import spacy

        from app.core.ats.skill_matcher import SkillMatcher

        nlp = spacy.load("en_core_web_sm")
        matcher = SkillMatcher(nlp)
        return sorted(matcher.extract_skills(text))
    except Exception:
        logger.info("spacy_unavailable_using_text_extraction")
        return _extract_skills_text_based(text)


async def upload_resume(
    db: AsyncSession,
    file: UploadFile,
    background_tasks: BackgroundTasks | None = None,
    user_id: str = "default_user",
) -> ResumeUploadResponse:
    """Upload, parse, and store a resume file.

    Saves the file to disk, parses it with DocumentParser to extract
    text, then uses SkillMatcher for skill detection.

    Args:
        db: Async database session.
        file: Uploaded resume file.
        background_tasks: FasterAPI background task runner.
        user_id: Authenticated user ID.

    Returns:
        Upload response with detected metadata.
    """
    file_ext = Path(file.filename or "resume.pdf").suffix.lower()
    file_id = uuid.uuid4().hex
    storage_path = f"{user_id}/{file_id}{file_ext}"

    content = await file.read()
    content_type = file.content_type or "application/octet-stream"
    await storage_client.upload_file(
        bucket="resumes",
        path=storage_path,
        file_bytes=content,
        content_type=content_type,
    )

    tmp_path = None
    try:
        parsed_text = ""
        word_count = 0
        skills_detected: list[str] = []

        with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp:
            tmp.write(content)
            tmp.flush()
            tmp_path = tmp.name

        try:
            parsed: ParsedResume = await _get_parser().parse(Path(tmp_path))
            parsed_text = parsed.raw_text
            word_count = parsed.word_count
            skills_detected = _extract_skills(parsed_text)
            logger.info(
                "resume_parsed_successfully",
                file=file.filename,
                word_count=word_count,
                skills_count=len(skills_detected),
            )
        except (ParseError, Exception) as exc:
            logger.warning(
                "resume_parse_failed",
                file=file.filename,
                error=str(exc),
            )
            parsed_text = None
            skills_detected = []
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

    if parsed_text:
        parsed_text = parsed_text.replace("\x00", "").strip()
        parsed_text = parsed_text if parsed_text else None

    resume = Resume(
        name=file.filename or "Untitled Resume",
        type="base",
        template_id="modern",
        file_path_pdf=storage_path if file_ext == ".pdf" else None,
        file_path_docx=storage_path if file_ext == ".docx" else None,
        content_text=parsed_text[:5000] if parsed_text else None,
        user_id=user_id,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    if background_tasks and resume.content_text:
        try:
            from app.core.rag.cv_pipeline import process_resume_upload

            background_tasks.add_task(
                process_resume_upload,
                resume_id=str(resume.id),
                content_text=resume.content_text or "",
                user_id=user_id,
            )
        except Exception as exc:
            logger.warning(
                "cv_pipeline_schedule_failed",
                resume_id=str(resume.id),
                error=str(exc),
            )

    logger.info("resume_uploaded", resume_id=resume.id, filename=file.filename)

    return ResumeUploadResponse(
        id=resume.id,
        name=resume.name,
        file_format=file_ext.lstrip("."),
        word_count=word_count,
        skills_detected=skills_detected,
    )


async def list_resumes(db: AsyncSession, user_id: str = "default_user") -> ResumeListResponse:
    """List all resumes for the requested user.

    Args:
        db: Async database session.
        user_id: Authenticated user ID.

    Returns:
        List of resumes with total count.
    """
    result = await db.execute(
        select(Resume).where(Resume.user_id == user_id).order_by(Resume.created_at.desc())
    )
    resumes = list(result.scalars().all())
    items = [ResumeResponse.model_validate(r) for r in resumes]
    return ResumeListResponse(items=items, total=len(items))


async def get_resume(db: AsyncSession, resume_id: str, user_id: str = "default_user") -> Resume:
    """Get a resume by ID or raise RecordNotFoundError."""
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    )
    resume = result.scalar_one_or_none()
    if resume is None:
        raise RecordNotFoundError("Resume", resume_id)
    return resume


async def _get_job(db: AsyncSession, job_id: str, user_id: str = "default_user") -> Job:
    """Get a job by ID or raise RecordNotFoundError."""
    result = await db.execute(select(Job).where(Job.id == job_id, Job.user_id == user_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise RecordNotFoundError("Job", job_id)
    return job


def _build_resume_data_from_text(content_text: str) -> dict:
    from app.core.documents.parser import (
        EMAIL_RE,
        GITHUB_RE,
        LINKEDIN_RE,
        PHONE_RE,
        SECTION_HEADERS,
        DocumentParser,
    )

    parser = DocumentParser()

    lines = content_text.split("\n")
    name = lines[0].strip() if lines else ""

    email_m = EMAIL_RE.search(content_text)
    phone_m = PHONE_RE.search(content_text)
    linkedin_m = LINKEDIN_RE.search(content_text)
    github_m = GITHUB_RE.search(content_text)

    # Extract sections by header
    sections: dict[str, str] = {}
    current_section = ""
    current_content: list[str] = []
    lower_headers = {h.lower() for h in SECTION_HEADERS}

    for line in lines[1:]:
        stripped = line.strip()
        if stripped.lower().rstrip(":") in lower_headers:
            if current_section:
                sections[current_section] = "\n".join(current_content).strip()
            current_section = stripped.lower().rstrip(":")
            current_content = []
        elif current_section:
            current_content.append(stripped)

    if current_section:
        sections[current_section] = "\n".join(current_content).strip()

    # Build skills list
    skills_text = sections.get("skills", "") or sections.get("technical skills", "")
    skills = [s.strip() for s in re.split(r"[,\n•·|]", skills_text) if s.strip()]

    # Build experience entries
    exp_text = (
        sections.get("experience", "")
        or sections.get("work experience", "")
        or sections.get("professional experience", "")
    )
    experience = parser.parse_experience_section(exp_text) if exp_text else []

    # Build education entries
    edu_text = sections.get("education", "") or sections.get("academic background", "")
    education = parser.parse_education_section(edu_text) if edu_text else []

    # Certifications
    cert_text = sections.get("certifications", "") or sections.get("certificates", "")
    certifications = [c.strip() for c in cert_text.split("\n") if c.strip()] if cert_text else []

    summary = (
        sections.get("summary", "")
        or sections.get("professional summary", "")
        or sections.get("objective", "")
        or sections.get("profile", "")
    )

    return {
        "name": name,
        "email": email_m.group() if email_m else "",
        "phone": phone_m.group() if phone_m else "",
        "location": "",
        "linkedin": linkedin_m.group() if linkedin_m else "",
        "github": github_m.group() if github_m else "",
        "title": "",
        "summary": summary,
        "skills": skills,
        "experience": experience,
        "education": education,
        "certifications": certifications,
        "projects": [],
    }


def _parse_experience_section(text: str) -> list[dict]:
    from app.core.documents.parser import DocumentParser

    return DocumentParser.parse_experience_section(text)


def _parse_education_section(text: str) -> list[dict]:
    from app.core.documents.parser import DocumentParser

    return DocumentParser.parse_education_section(text)


async def generate_tailored_resume(
    db: AsyncSession,
    request: ResumeGenerateRequest,
    user_id: str = "default_user",
) -> ResumeResponse:
    """Generate a tailored resume for a specific job using LLM.

    Loads the base resume and target job, tailors the content via LLM,
    renders to PDF/DOCX, and stores the result.

    Args:
        db: Async database session.
        request: Generation parameters (base_resume_id, job_id, template, formats).
        user_id: Authenticated user ID.

    Returns:
        The generated tailored resume response.
    """
    base = await get_resume(db, request.base_resume_id, user_id)
    job = await _get_job(db, request.job_id, user_id)

    from app.core.llm.client import UserLLMConfig
    from app.services.settings_helper import get_or_create_settings as _get_or_create_settings
    db_settings = await _get_or_create_settings(db, user_id)
    user_cfg = UserLLMConfig.from_settings(db_settings)

    llm = LLMClient()

    system_prompt = """You are an expert resume writer and career coach.
Your task is to tailor a candidate's resume/CV for a specific job posting.

RULES:
1. The output MUST be a complete, actual, fully written tailored resume in clean Markdown format with all standard sections (e.g., Professional Summary, Skills, Experience, Education, Projects) fully populated.
2. NEVER use placeholders (such as `[Your tailored resume content will be here]`, `[Your content here]`, etc.) or empty templates. Every section and bullet point must be fully realized with real details.
3. NEVER fabricate experience, skills, or qualifications not present in the original resume.
4. Rewrite the professional summary to target the specific role.
5. Reorder and emphasize skills that match the job requirements.
6. Rewrite experience bullet points to highlight achievements and responsibilities relevant to the target job.
7. Use strong action verbs and quantify achievements where the original data supports it.
8. Preserve ALL factual content — dates, company names, degrees, and certifications must remain unchanged.
9. Use industry-standard terminology from the job posting where it accurately describes the candidate's experience.
10. Return ONLY the Markdown content of the tailored resume. Do not include any introductory or concluding conversational text, and do not wrap the output in markdown code block ticks. Only return raw Markdown resume text."""

    user_prompt = f"""Tailor the following resume for the target job posting below.

CURRENT RESUME CONTENT:
\"\"\"
{base.content_text or ""}
\"\"\"

TARGET JOB POSTING:
\"\"\"
{job.description or ""}
\"\"\"

Instructions:
- Provide the complete tailored resume in Markdown.
- Maintain the overall formatting, headers, and bullet points using standard Markdown tags (`#`, `##`, `###`, `-`, `**`).
- Do not use placeholders under any circumstances. Fill in all details truthfully based on the current resume content."""

    response = await llm.complete(
        prompt=user_prompt,
        system_prompt=system_prompt,
        purpose="resume_tailor_markdown",
        user_settings=user_cfg,
    )
    tailored_markdown = response.content.strip()

    # Strip code block decorators if present
    if tailored_markdown.startswith("```markdown"):
        tailored_markdown = tailored_markdown.removeprefix("```markdown")
        if tailored_markdown.endswith("```"):
            tailored_markdown = tailored_markdown.removesuffix("```")
    elif tailored_markdown.startswith("```"):
        tailored_markdown = tailored_markdown.removeprefix("```")
        if tailored_markdown.endswith("```"):
            tailored_markdown = tailored_markdown.removesuffix("```")
    tailored_markdown = tailored_markdown.strip()

    # Create the tailored resume record
    tailored = Resume(
        name=f"Tailored - {base.name}",
        type="tailored",
        template_id=request.template_id or "modern",
        base_resume_id=request.base_resume_id,
        job_id=request.job_id,
        file_path_pdf=None,
        file_path_docx=None,
        content_text=tailored_markdown,
        user_id=user_id,
    )
    db.add(tailored)
    await db.commit()
    await db.refresh(tailored)

    logger.info(
        "tailored_resume_generated",
        resume_id=tailored.id,
        base_id=request.base_resume_id,
        job_id=request.job_id,
    )
    return ResumeResponse.model_validate(tailored)


async def score_resume(
    db: AsyncSession,
    resume_id: str,
    request: ResumeScoreRequest,
    user_id: str = "default_user",
) -> ResumeScoreResponse:
    """Score a resume against a job listing using multi-factor ATS analysis.

    Loads the resume text and job description from the database, then
    uses ResumeScorer for real scoring. Falls back to a basic keyword
    overlap score if spaCy is not available.

    Args:
        db: Async database session.
        resume_id: UUID of the resume.
        request: Scoring request with target job ID.

    Returns:
        Detailed ATS score breakdown.
    """
    resume = await get_resume(db, resume_id, user_id)
    job = await _get_job(db, request.job_id, user_id)

    resume_text = resume.content_text or ""
    job_description = job.description or ""

    if not resume_text.strip():
        logger.warning("score_resume_empty_text", resume_id=resume_id)
        return ResumeScoreResponse(
            resume_id=resume_id,
            job_id=request.job_id,
            overall_score=0.0,
            skill_score=0.0,
            experience_score=0.0,
            education_score=0.0,
            keyword_score=0.0,
            missing_skills=["Resume has no parsed text content"],
            suggestions=["Re-upload your resume to enable parsing"],
        )

    try:
        return _score_with_full_engine(
            resume_id, request.job_id, resume_text, job_description, job,
        )
    except Exception as exc:
        logger.warning(
            "full_scoring_failed_using_fallback",
            error=str(exc),
        )
        return _score_with_text_fallback(
            resume_id, request.job_id, resume_text, job_description,
        )


def _score_with_full_engine(
    resume_id: str,
    job_id: str,
    resume_text: str,
    job_description: str,
    job: Job,
) -> ResumeScoreResponse:
    """Score using the full ResumeScorer with spaCy."""
    import spacy

    from app.core.ats.experience_analyzer import ExperienceAnalyzer
    from app.core.ats.keyword_analyzer import KeywordAnalyzer
    from app.core.ats.scorer import ResumeScorer
    from app.core.ats.skill_matcher import SkillMatcher

    nlp = spacy.load("en_core_web_sm")
    skill_matcher = SkillMatcher(nlp)
    keyword_analyzer = KeywordAnalyzer(nlp)
    experience_analyzer = ExperienceAnalyzer(nlp)
    scorer = ResumeScorer(skill_matcher, keyword_analyzer, experience_analyzer)

    # Build candidate profile from resume text
    candidate_skills = sorted(skill_matcher.extract_skills(resume_text))
    candidate_profile = {
        "skills": candidate_skills,
        "experience": [],
        "education": [],
    }

    # Build job metadata from the Job model
    required_skills: list[str] = []
    preferred_skills: list[str] = []
    if job.skills_required and isinstance(job.skills_required, dict):
        required_skills = job.skills_required.get("required", [])
        preferred_skills = job.skills_required.get("preferred", [])
    job_metadata = {
        "required_skills": required_skills,
        "preferred_skills": preferred_skills,
    }

    details = scorer.score_resume(
        resume_text, job_description, candidate_profile, job_metadata,
    )

    return ResumeScoreResponse(
        resume_id=resume_id,
        job_id=job_id,
        overall_score=details.overall_score,
        skill_score=details.skill_score,
        experience_score=details.experience_score,
        education_score=details.education_score,
        keyword_score=details.keyword_score,
        matched_skills=sorted(candidate_skills),
        missing_skills=details.missing_required_skills,
        suggestions=details.improvement_suggestions,
    )


def _score_with_text_fallback(
    resume_id: str,
    job_id: str,
    resume_text: str,
    job_description: str,
) -> ResumeScoreResponse:
    """Basic keyword overlap scoring when spaCy is unavailable."""
    resume_skills = set(_extract_skills(resume_text))
    job_skills = set(_extract_skills(job_description))

    print("[DEBUG][ATS] JD skills extracted:", sorted(job_skills))
    print("[DEBUG][ATS] CV skills extracted:", sorted(resume_skills))

    if job_skills:
        matched = resume_skills & job_skills
        unmatched = job_skills - resume_skills
        print("[DEBUG][ATS] Matched skills:", sorted(matched))
        print("[DEBUG][ATS] Missing skills:", sorted(unmatched))
        skill_score = len(matched) / len(job_skills)
        missing = sorted(job_skills - resume_skills)
    else:
        matched = set()
        unmatched = set()
        skill_score = 0.5
        missing = []

    # Simple keyword overlap
    resume_words = set(resume_text.lower().split())
    job_words = set(job_description.lower().split()) - {
        "the", "a", "an", "is", "are", "and", "or", "to", "in", "of", "for",
        "with", "on", "at", "by", "from", "as", "we", "you", "your", "our",
    }
    keyword_score = len(resume_words & job_words) / len(job_words) if job_words else 0.0

    overall = 0.5 * skill_score + 0.5 * min(keyword_score, 1.0)

    suggestions: list[str] = []
    if missing:
        suggestions.append(
            f"Add these skills to your resume: {', '.join(missing[:5])}"
        )
    if keyword_score < 0.4:
        suggestions.append(
            "Mirror more terminology from the job description in your resume."
        )

    return ResumeScoreResponse(
        resume_id=resume_id,
        job_id=job_id,
        overall_score=round(overall, 4),
        skill_score=round(skill_score, 4),
        experience_score=0.0,
        education_score=0.0,
        keyword_score=round(min(keyword_score, 1.0), 4),
        matched_skills=sorted(matched),
        missing_skills=missing,
        suggestions=suggestions,
    )


async def optimize_resume(
    db: AsyncSession,
    resume_id: str,
    job_id: str | None = None,
    user_id: str = "default_user",
) -> ResumeResponse:
    """Optimize a resume for ATS compatibility using LLM rewriting.

    Scores the resume, gets improvement suggestions, then uses the LLM
    to rewrite the content for maximum ATS pass-through. Creates a new
    optimized resume record linked to the original.

    Args:
        db: Async database session.
        resume_id: ID of the resume to optimize.
        job_id: Target job ID. Falls back to resume.job_id if absent.
        user_id: Authenticated user ID.

    Returns:
        The newly created optimized resume.
    """
    resume = await get_resume(db, resume_id, user_id)
    target_job_id = job_id or resume.job_id
    if not target_job_id:
        raise RecordNotFoundError("Job", "none (no job_id provided)")

    job = await _get_job(db, target_job_id, user_id)
    resume_text = resume.content_text or ""
    job_description = job.description or ""

    # Score the resume to get detailed breakdown
    score_result = await score_resume(
        db, resume_id, ResumeScoreRequest(job_id=target_job_id), user_id,
    )

    # Get optimizer suggestions
    score_breakdown = {
        "overall_score": score_result.overall_score,
        "skill_score": score_result.skill_score,
        "experience_score": score_result.experience_score,
        "education_score": score_result.education_score,
        "keyword_score": score_result.keyword_score,
        "missing_skills": score_result.missing_skills,
    }

    try:
        from app.core.ats.optimizer import ATSOptimizer
        from app.core.ats.skill_matcher import SkillMatcher
        optimizer = ATSOptimizer(skill_matcher=SkillMatcher())
        from app.core.ats.scorer import ScoreDetails
        # Build a minimal ScoreDetails for the optimizer
        details = ScoreDetails(
            overall_score=score_result.overall_score,
            skill_score=score_result.skill_score,
            experience_score=score_result.experience_score,
            education_score=score_result.education_score,
            keyword_score=score_result.keyword_score,
            missing_required_skills=score_result.missing_skills,
            improvement_suggestions=score_result.suggestions,
        )
        suggestions = optimizer.suggest_improvements(
            details, resume_text, job_description,
        )
    except Exception:
        logger.warning("ats_optimizer_unavailable", exc_info=True)
        suggestions = score_result.suggestions

    # Use LLM to rewrite the resume
    from app.core.llm.client import UserLLMConfig
    from app.core.llm.prompts.ats_optimize import (
        ATS_OPTIMIZE_SYSTEM_PROMPT,
        render_ats_optimize_prompt,
    )
    from app.core.llm.prompts.resume_tailor import TailoredResumeData
    from app.services.settings_helper import get_or_create_settings as _get_or_create_settings
    db_settings = await _get_or_create_settings(db, user_id)
    user_cfg = UserLLMConfig.from_settings(db_settings)

    llm = LLMClient()
    prompt = render_ats_optimize_prompt(
        resume_text, job_description, score_breakdown, suggestions,
    )
    structured = await llm.complete(
        prompt=prompt,
        system_prompt=ATS_OPTIMIZE_SYSTEM_PROMPT,
        purpose="resume_optimize",
        user_settings=user_cfg,
        response_format={"type": "json_object"},
    )

    try:
        from app.core.llm.usage_tracker import record_usage
        await record_usage(
            db=db, response=structured, purpose="resume_optimize", user_id=user_id,
        )
    except Exception:
        pass

    try:
        optimized_data = TailoredResumeData.model_validate_json(structured.content)
    except Exception:
        logger.exception("ats_optimize_parse_failed")
        optimized_data = TailoredResumeData()

    # Render optimized resume to PDF/DOCX
    generator = DocumentGenerator(
        llm_client=None,
        upload_file=lambda bucket, path, file_bytes, content_type: storage_client.upload_file(
            bucket=bucket, path=path, file_bytes=file_bytes, content_type=content_type,
        ),
    )
    doc = await generator.generate_resume(
        resume_data=optimized_data.model_dump() | {"user_id": user_id},
        job_description="",
        template_name=resume.template_id,
        formats=["docx"],
    )

    # Create new optimized resume record
    optimized = Resume(
        name=f"Optimized - {resume.name}",
        type="optimized",
        template_id=resume.template_id,
        base_resume_id=resume_id,
        job_id=target_job_id,
        file_path_pdf=doc.pdf_path,
        file_path_docx=doc.docx_path,
        content_text=resume_text,
        user_id=user_id,
    )
    db.add(optimized)
    await db.commit()
    await db.refresh(optimized)

    # Re-score the optimized resume
    try:
        new_score = await score_resume(
            db, optimized.id, ResumeScoreRequest(job_id=target_job_id), user_id,
        )
        optimized.ats_score = new_score.overall_score
        await db.commit()
        await db.refresh(optimized)
    except Exception:
        logger.warning("ats_rescore_failed", exc_info=True)

    logger.info(
        "resume_optimized",
        original_id=resume_id,
        optimized_id=optimized.id,
        original_score=score_result.overall_score,
        new_score=optimized.ats_score,
    )
    return ResumeResponse.model_validate(optimized)


async def delete_resume(db: AsyncSession, resume_id: str, user_id: str = "default_user") -> None:
    """Delete a resume by ID, removing its files from storage and record from DB."""
    resume = await get_resume(db, resume_id, user_id)
    
    # Try deleting the PDF file from storage
    if resume.file_path_pdf:
        try:
            bucket = "generated" if resume.type in ("tailored", "optimized") else "resumes"
            await storage_client.delete_file(bucket, resume.file_path_pdf)
        except Exception as exc:
            logger.warning("storage_pdf_delete_failed_during_resume_deletion", resume_id=resume_id, error=str(exc))
            
    # Try deleting the DOCX file from storage
    if resume.file_path_docx:
        try:
            bucket = "generated" if resume.type in ("tailored", "optimized") else "resumes"
            await storage_client.delete_file(bucket, resume.file_path_docx)
        except Exception as exc:
            logger.warning("storage_docx_delete_failed_during_resume_deletion", resume_id=resume_id, error=str(exc))
            
    await db.delete(resume)
    await db.commit()
    logger.info("resume_deleted_from_db", resume_id=resume_id, user_id=user_id)
