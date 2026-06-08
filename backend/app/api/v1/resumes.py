"""Resume management API routes."""

import io
import tempfile
from pathlib import Path
from typing import Any

import httpx
import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.resume import Resume
from app.core.exceptions import RecordNotFoundError
from app.core.llm.client import LLMNotConfiguredError
from app.core.storage import storage as storage_client
from app.schemas.resume import (
    ResumeContentResponse,
    ResumeContentUpdate,
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
from app.services.chat import clear_session_cv_cache

logger = structlog.get_logger(__name__)
router = APIRouter()

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".pdf", ".docx"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

class ResumeCreateRequest(BaseModel):
    name: str
    type: str = "base"
    template_id: str = "modern"
    content_text: str


class ResumeRawResponse(BaseModel):
    id: str
    raw_text: str
    filename: str
    created_at: str
    versions: list[dict[str, Any]] = []


class ResumeRawUpdateRequest(BaseModel):
    raw_text: str


@router.post(
    "/",
    response_model=ResumeResponse,
    status_code=201,
    summary="Create a new resume version from text",
)
async def create_resume_from_text(
    request: ResumeCreateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ResumeResponse:
    """Create a new resume from text (e.g., when saving an edited version)."""
    # Parse the content text to build initial metadata if needed
    from app.core.documents.generator import DocumentGenerator
    from app.services.resume import _build_resume_data_from_text
    
    resume_data = _build_resume_data_from_text(request.content_text)
    resume_data["user_id"] = user_id
    
    # Generate files on-the-fly for this new resume
    generator = DocumentGenerator(
        llm_client=None,
        upload_file=lambda bucket, path, file_bytes, content_type: storage_client.upload_file(
            bucket=bucket, path=path, file_bytes=file_bytes, content_type=content_type,
        ),
    )
    
    doc = await generator.generate_resume(
        resume_data=resume_data,
        job_description="",
        template_name=request.template_id,
        formats=["pdf", "docx"],
    )
    
    new_resume = Resume(
        name=request.name,
        type=request.type,
        template_id=request.template_id,
        file_path_pdf=doc.pdf_path,
        file_path_docx=doc.docx_path,
        content_text=request.content_text,
        user_id=user_id,
    )
    db.add(new_resume)
    await db.commit()
    await db.refresh(new_resume)
    
    return ResumeResponse.model_validate(new_resume)


MIME_PDF = "application/pdf"
MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


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


@router.get(
    "/uploaded",
    response_model=ResumeListResponse,
    summary="List all uploaded base resumes",
)
async def list_uploaded_resumes(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ResumeListResponse:
    """List all user-uploaded base resumes."""
    all_resumes = await resume_service.list_resumes(db, user_id)
    filtered = [r for r in all_resumes.items if r.type == "base"]
    return ResumeListResponse(items=filtered, total=len(filtered))


@router.get(
    "/tailored",
    response_model=ResumeListResponse,
    summary="List all tailored and optimized resumes",
)
async def list_tailored_resumes(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ResumeListResponse:
    """List all AI-generated tailored and optimized resumes."""
    all_resumes = await resume_service.list_resumes(db, user_id)
    filtered = [r for r in all_resumes.items if r.type in ("tailored", "optimized", "cover_letter")]
    return ResumeListResponse(items=filtered, total=len(filtered))


@router.get(
    "/{resume_id}/content",
    response_model=ResumeContentResponse,
    summary="Get parsed resume text",
)
async def get_resume_content(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
) -> ResumeContentResponse:
    """Return parsed text for a resume so Pillar 3 can inspect/edit it."""
    resume = await resume_service.get_resume(db, resume_id)
    return ResumeContentResponse(
        resume_id=resume.id,
        name=resume.name,
        content_text=resume.content_text or "",
    )


@router.patch(
    "/{resume_id}/content",
    response_model=ResumeContentResponse,
    summary="Update parsed resume text",
)
async def update_resume_content(
    resume_id: str,
    request: ResumeContentUpdate,
    db: AsyncSession = Depends(get_db),
) -> ResumeContentResponse:
    """Update parsed resume text until Pillar 2 owns richer editing."""
    resume = await resume_service.get_resume(db, resume_id)
    resume.content_text = request.content_text
    
    # Reset compiled files so they get regenerated on download with new text
    resume.file_path_pdf = None
    resume.file_path_docx = None
    
    await db.commit()
    await db.refresh(resume)
    clear_session_cv_cache(resume_id)
    return ResumeContentResponse(
        resume_id=resume.id,
        name=resume.name,
        content_text=resume.content_text or "",
    )
@router.get(
    "/{resume_id}/raw",
    response_model=ResumeRawResponse,
    summary="Get resume raw text",
)
async def get_resume_raw(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ResumeRawResponse:
    """Get the raw text of a resume."""
    resume = await resume_service.get_resume(db, resume_id, user_id)
    
    if resume.file_path_pdf:
        filename = Path(resume.file_path_pdf).name
    elif resume.file_path_docx:
        filename = Path(resume.file_path_docx).name
    else:
        filename = f"{resume.name}.pdf"
        
    created_at_str = resume.created_at.isoformat() if resume.created_at else ""
    
    return ResumeRawResponse(
        id=resume.id,
        raw_text=resume.content_text or "",
        filename=filename,
        created_at=created_at_str,
        versions=[],
    )


@router.put(
    "/{resume_id}/raw",
    response_model=ResumeRawResponse,
    summary="Update resume raw text",
)
async def update_resume_raw(
    resume_id: str,
    request: ResumeRawUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> ResumeRawResponse:
    """Update the raw text of a resume."""
    resume = await resume_service.get_resume(db, resume_id, user_id)
    resume.content_text = request.raw_text
    
    # Reset compiled files so they get regenerated on download with new text
    resume.file_path_pdf = None
    resume.file_path_docx = None
    
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    
    clear_session_cv_cache(resume_id)
    
    if resume.file_path_pdf:
        filename = Path(resume.file_path_pdf).name
    elif resume.file_path_docx:
        filename = Path(resume.file_path_docx).name
    else:
        filename = f"{resume.name}.pdf"
        
    created_at_str = resume.created_at.isoformat() if resume.created_at else ""
    
    return ResumeRawResponse(
        id=resume.id,
        raw_text=resume.content_text or "",
        filename=filename,
        created_at=created_at_str,
        versions=[],
    )



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
    try:
        return await resume_service.generate_tailored_resume(db, request, user_id)
    except LLMNotConfiguredError:
        raise HTTPException(
            status_code=428,
            detail={"message": "AI not configured", "code": "ai_not_configured"},
        ) from None


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
    try:
        return await resume_service.optimize_resume(db, resume_id, request.job_id, user_id)
    except LLMNotConfiguredError:
        raise HTTPException(
            status_code=428,
            detail={"message": "AI not configured", "code": "ai_not_configured"},
        ) from None


@router.get(
    "/{resume_id}/download",
    summary="Download resume file",
)
async def download_resume(
    resume_id: str,
    format: str = Query(default="pdf", pattern="^(pdf|docx)$"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> StreamingResponse:
    """Download a resume in PDF or DOCX format."""
    resume = await resume_service.get_resume(db, resume_id, user_id)

    storage_path = resume.file_path_pdf if format == "pdf" else resume.file_path_docx
    if not storage_path:
        logger.info("resume_file_not_found_triggering_dynamic_generation", resume_id=resume_id, format=format)
        from app.core.documents.generator import DocumentGenerator
        from app.services.resume import _build_resume_data_from_text
        
        resume_data = _build_resume_data_from_text(resume.content_text or "")
        resume_data["user_id"] = user_id
        
        generator = DocumentGenerator(
            llm_client=None,
            upload_file=lambda bucket, path, file_bytes, content_type: storage_client.upload_file(
                bucket=bucket, path=path, file_bytes=file_bytes, content_type=content_type,
            ),
        )
        
        doc = await generator.generate_resume(
            resume_data=resume_data,
            job_description="",
            template_name=resume.template_id or "modern",
            formats=[format],
        )
        
        if format == "pdf" and doc.pdf_path:
            resume.file_path_pdf = doc.pdf_path
            storage_path = doc.pdf_path
        elif format == "docx" and doc.docx_path:
            resume.file_path_docx = doc.docx_path
            storage_path = doc.docx_path
            
        if storage_path:
            await db.commit()
            await db.refresh(resume)
            logger.info("resume_file_generated_and_saved", resume_id=resume_id, format=format, path=storage_path)
        else:
            raise HTTPException(status_code=404, detail="Failed to dynamically generate resume file")

    bucket = "generated" if resume.type in ("tailored", "optimized") else "resumes"
    signed_url = await storage_client.get_signed_url(bucket, storage_path)

    async with httpx.AsyncClient() as client:
        file_response = await client.get(signed_url)
        file_response.raise_for_status()
        file_bytes = file_response.content

    media_type = MIME_PDF if storage_path.endswith(".pdf") else MIME_DOCX
    filename = Path(storage_path).name

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename!r}"},
    )


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
    clear_session_cv_cache(resume_id)

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


@router.get(
    "/templates",
    summary="List available resume templates",
)
async def list_resume_templates() -> list[dict[str, Any]]:
    """List all available resume templates (default and user-uploaded)."""
    templates_dir = Path("templates/resume")
    if not templates_dir.exists():
        return []
    
    results = []
    for path in templates_dir.iterdir():
        if path.is_dir():
            name = path.name
            formats = []
            if (path / "template.html").exists():
                formats.append("html")
            if (path / "template.md").exists():
                formats.append("md")
            if (path / "template.docx").exists():
                formats.append("docx")
            
            results.append({
                "id": name,
                "name": name.replace("_", " ").title(),
                "formats": formats or ["html"],
            })
    return results


@router.post(
    "/templates/upload",
    summary="Upload a custom resume template",
)
async def upload_resume_template(
    name: str,
    file: UploadFile,
) -> dict[str, Any]:
    """Upload a custom resume template (.html, .md, or .docx) and register it."""
    base_dir = Path("templates/resume")
    base_dir.mkdir(parents=True, exist_ok=True)
    
    # Slugify the name to prevent directory traversal or invalid characters
    import re
    slug_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", name.lower()).strip("_")
    if not slug_name:
        raise HTTPException(status_code=400, detail="Invalid template name")
        
    template_dir = base_dir / slug_name
    template_dir.mkdir(parents=True, exist_ok=True)
    
    suffix = Path(file.filename or "").suffix.lower()
    if suffix in (".html", ".htm"):
        target_name = "template.html"
    elif suffix in (".md", ".markdown"):
        target_name = "template.md"
    elif suffix == ".docx":
        target_name = "template.docx"
    elif suffix in (".css",):
        target_name = "style.css"
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported template file extension. Must be .html, .md, or .docx"
        )
        
    target_path = template_dir / target_name
    content = await file.read()
    with open(target_path, "wb") as f:
        f.write(content)
        
    return {
        "status": "success",
        "template_id": slug_name,
        "filename": target_name,
        "message": f"Successfully uploaded template '{name}' as '{slug_name}'"
    }


@router.delete(
    "/{resume_id}",
    summary="Delete a resume",
)
async def delete_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete a resume by ID, removing its files from storage and record from DB."""
    await resume_service.delete_resume(db, resume_id, user_id)
    return {"status": "success", "message": "Resume successfully deleted"}
