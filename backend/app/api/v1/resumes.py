"""Resume management API routes."""

import tempfile
from pathlib import Path

import httpx
import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.exceptions import RecordNotFoundError
from app.core.storage import storage as storage_client
from app.schemas.resume import (
    ResumeGenerateRequest,
    ResumeListResponse,
    ResumeOptimizeRequest,
    ResumeResponse,
    ResumeScoreRequest,
    ResumeScoreResponse,
    ResumeUploadResponse,
)
from app.schemas.settings import CandidateProfileSchema
from app.services import resume as resume_service

logger = structlog.get_logger(__name__)
router = APIRouter()

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".pdf", ".docx"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@router.post(
    "/upload",
    response_model=ResumeUploadResponse,
    status_code=201,
    summary="Upload a resume file",
)
async def upload_resume(
    file: UploadFile,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ResumeUploadResponse:
    """Upload a PDF or DOCX resume for parsing and storage."""
    # Validate file extension
    file_ext = Path(file.filename or "").suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Only PDF and DOCX files accepted, got '{file_ext}'",
        )

    # Validate MIME type
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid file type: {file.content_type}",
        )

    # Validate file size by reading in chunks to avoid loading huge files into memory
    size = 0
    chunk_size = 64 * 1024  # 64KB
    while chunk := await file.read(chunk_size):
        size += len(chunk)
        if size > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Max 10MB.")
    await file.seek(0)

    return await resume_service.upload_resume(db, file, background_tasks, user_id)


@router.get(
    "/",
    response_model=ResumeListResponse,
    summary="List all resumes",
)
async def list_resumes(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ResumeListResponse:
    """List all uploaded and generated resumes."""
    return await resume_service.list_resumes(db, user_id)


@router.post(
    "/generate",
    response_model=ResumeResponse,
    status_code=201,
    summary="Generate a tailored resume",
)
async def generate_resume(
    request: ResumeGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ResumeResponse:
    """Generate a job-tailored resume from a base resume."""
    return await resume_service.generate_tailored_resume(db, request, user_id)


@router.post(
    "/{resume_id}/score",
    response_model=ResumeScoreResponse,
    summary="Score resume against a job",
)
async def score_resume(
    resume_id: str,
    request: ResumeScoreRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ResumeScoreResponse:
    """Score a resume's ATS compatibility against a specific job."""
    return await resume_service.score_resume(db, resume_id, request, user_id)


@router.post(
    "/{resume_id}/optimize",
    response_model=ResumeResponse,
    summary="Optimize resume for ATS",
)
async def optimize_resume(
    resume_id: str,
    request: ResumeOptimizeRequest = ResumeOptimizeRequest(),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ResumeResponse:
    """Optimize a resume for ATS keyword matching using LLM rewriting."""
    return await resume_service.optimize_resume(db, resume_id, request.job_id, user_id)


@router.get(
    "/{resume_id}/download",
    summary="Download resume file",
)
async def download_resume(
    resume_id: str,
    format: str = Query(default="pdf", pattern="^(pdf|docx)$"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> FileResponse:
    """Download a resume in PDF or DOCX format."""
    resume = await resume_service.get_resume(db, resume_id, user_id)

    storage_path = resume.file_path_pdf if format == "pdf" else resume.file_path_docx
    if not storage_path:
        raise RecordNotFoundError("Resume file", resume_id)

    bucket = "resumes"
    signed_url = await storage_client.get_signed_url(bucket, storage_path)
    return RedirectResponse(url=signed_url)


@router.post(
    "/{resume_id}/reextract",
    response_model=dict,
    summary="Re-extract text from a stored resume file",
)
async def reextract_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> JSONResponse:
    """Re-extract text from a stored PDF or DOCX resume file and update the record."""
    resume = await resume_service.get_resume(db, resume_id, user_id)

    storage_path = resume.file_path_pdf or resume.file_path_docx
    if not storage_path:
        raise RecordNotFoundError("Resume file", resume_id)

    tmp_path = None
    try:
        bucket = "resumes"
        signed_url = await storage_client.get_signed_url(bucket, storage_path)

        async with httpx.AsyncClient() as client:
            file_response = await client.get(signed_url)
            file_response.raise_for_status()
            file_bytes = file_response.content

        suffix = ".pdf" if storage_path.endswith(".pdf") else ".docx"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        from app.core.documents.parser import DocumentParser

        parsed = await DocumentParser().parse(Path(tmp_path))
        content_text = parsed.raw_text.replace("\x00", "").strip()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to re-extract text: {exc}") from exc
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)

    resume.content_text = content_text or None
    await db.commit()
    await db.refresh(resume)

    return JSONResponse({"status": "ok", "text_length": len(content_text)})


@router.get(
    "/{resume_id}/profile-data",
    response_model=CandidateProfileSchema,
    summary="Extract profile data from a resume",
)
async def extract_profile_from_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> CandidateProfileSchema:
    """Extract structured candidate profile data from a resume."""
    resume = await resume_service.get_resume(db, resume_id, user_id)
    content = resume.content_text or ""

    if not content.strip():
        logger.warning("profile_extract_empty_resume", resume_id=resume_id)
        return CandidateProfileSchema()

    from app.core.documents.parser import DocumentParser

    parser = DocumentParser()
    contact = parser._extract_contact_info(content)
    sections = parser._extract_sections(content)
    skills = parser._extract_skills_from_text(content, sections)

    # Derive the full name from the first non-empty line before any section
    full_name = ""
    for line in content.split("\n"):
        stripped = line.strip()
        if (
            stripped
            and stripped.lower().rstrip(":") not in sections
            and "@" not in stripped
            and "http" not in stripped.lower()
        ):
            full_name = stripped
            break

    summary = ""
    for key in ("summary", "objective", "professional summary", "profile"):
        if key in sections:
            summary = sections[key]
            break

    certifications: list[str] = []
    for key in ("certifications", "certificates", "licenses"):
        if key in sections:
            cert_text = sections[key]
            certifications = [
                line.lstrip("-*\u2022\u2023 ").strip()
                for line in cert_text.split("\n")
                if line.strip()
            ]
            break

    logger.info(
        "profile_data_extracted",
        resume_id=resume_id,
        skills_count=len(skills),
        has_contact=bool(contact),
    )

    return CandidateProfileSchema(
        full_name=full_name,
        email=contact.get("email", ""),
        phone=contact.get("phone", ""),
        linkedin_url=contact.get("linkedin", ""),
        github_url=contact.get("github", ""),
        summary=summary,
        skills=skills,
        certifications=certifications,
    )
