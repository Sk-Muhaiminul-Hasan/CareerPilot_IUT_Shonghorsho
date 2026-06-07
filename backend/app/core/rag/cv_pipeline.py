import asyncio
import contextlib

import structlog
from langchain_openai import OpenAIEmbeddings
from langchain_postgres.vectorstores import PGVector as PGVectorStore

from app.config.settings import get_settings
from app.core.llm.client import LLMClient
from app.db.session import async_session_factory
from app.schemas.settings import CandidateProfileSchema

logger = structlog.get_logger(__name__)


def _get_sync_connection_string() -> str:
    settings = get_settings()
    url = settings.database_url_sync or settings.database_url
    return url.replace("+asyncpg", "").replace("+psycopg2", "")


def _get_extraction_api_key() -> str | None:
    settings = get_settings()
    return settings.cv_extraction_api_key.get_secret_value() or None


def _chunk_text(
    raw_text: str,
    chunk_size: int = 1000,
    overlap: int = 200,
) -> list[dict]:
    chunks: list[dict] = []
    start = 0
    index = 0
    while start < len(raw_text):
        end = start + chunk_size
        chunks.append({
            "text": raw_text[start:end],
            "section": f"chunk_{index}",
        })
        start = end - overlap
        index += 1
    return chunks


async def process_resume_upload(resume_id: str, content_text: str, user_id: str) -> None:
    if not content_text or len(content_text.strip()) < 200:
        return

    profile = {}
    user_cfg = None
    try:
        from app.core.llm.client import UserLLMConfig
        from app.services.settings_helper import get_or_create_settings as _goc
        async with async_session_factory() as _session:
            _settings = await _goc(_session, user_id)
            user_cfg = UserLLMConfig.from_settings(_settings)
    except Exception:
        pass

    try:
        from app.core.llm.usage_tracker import record_usage

        async def _record(response: LLMResponse) -> None:
            try:
                if response.cost_usd > 0:
                    async with async_session_factory() as _usage_db:
                        await record_usage(
                            db=_usage_db, response=response,
                            purpose="cv_extraction", user_id=user_id,
                        )
            except Exception:
                pass

        llm = LLMClient()
        result = await llm.complete_with_structured_output(
            prompt=(
                "Extract a structured candidate profile from the following resume text.\n\n"
                f"Resume:\n{content_text[:6000]}"
            ),
            output_schema=CandidateProfileSchema,
            purpose="extraction",
            user_settings=user_cfg,
            post_complete=_record,
        )
        profile = result.model_dump()
    except Exception as exc:
        logger.warning("cv_extraction_failed", resume_id=resume_id, error=str(exc))
        profile = {}

    if not profile:
        try:
            from app.core.documents.parser import DocumentParser

            parser = DocumentParser()
            sections = parser._extract_sections(content_text)
            contact = parser._extract_contact_info(content_text)
            parsed_skills = parser._extract_skills_from_text(
                content_text, sections,
            )
            full_name = ""
            for line in content_text.split("\n"):
                stripped = line.strip()
                if (
                    stripped
                    and stripped.lower().rstrip(":") not in sections
                    and "@" not in stripped
                    and "http" not in stripped.lower()
                ):
                    full_name = stripped
                    break
            profile = {
                "full_name": full_name,
                "email": contact.get("email", ""),
                "phone": contact.get("phone", ""),
                "location": "",
                "linkedin_url": contact.get("linkedin", ""),
                "github_url": contact.get("github", ""),
                "title": next(iter(sections.values())).split("\n")[0].strip() if sections else "",
                "summary": next(
                    (
                        v for k, v in sections.items()
                        if k in {
                            "summary", "objective",
                            "professional summary", "profile",
                        }
                    ),
                    "",
                ),
                "skills": parsed_skills,
                "experience": [],
                "education": [],
                "certifications": [],
                "projects": [],
            }
            logger.info(
                "cv_pipeline.profile_extracted_fallback",
                resume_id=resume_id,
                profile_keys=list(profile.keys()),
            )
        except Exception as exc:
            logger.warning(
                "cv_pipeline.profile_fallback_failed",
                resume_id=resume_id,
                error=str(exc),
            )

    try:
        from app.core.documents.parser import DocumentParser

        parser = DocumentParser()

        if profile.get("skills"):
            profile["skills"] = DocumentParser.validate_skills_against_source(
                profile.get("skills", []), content_text,
            )

        if not profile.get("experience") or len(profile.get("experience", [])) == 0:
            sections = parser._extract_sections(content_text)
            exp_text = (
                sections.get("experience", "")
                or sections.get("work experience", "")
                or sections.get("professional experience", "")
            )
            if exp_text:
                profile["experience"] = parser.parse_experience_section(exp_text)

        if not profile.get("education") or len(profile.get("education", [])) == 0:
            sections = parser._extract_sections(content_text)
            edu_text = (
                sections.get("education", "")
                or sections.get("academic background", "")
            )
            if edu_text:
                profile["education"] = parser.parse_education_section(edu_text)

        if not profile.get("certifications"):
            sections = parser._extract_sections(content_text)
            cert_text = (
                sections.get("certifications", "")
                or sections.get("certificates", "")
                or sections.get("licenses", "")
            )
            if cert_text:
                profile["certifications"] = [c.strip() for c in cert_text.split("\n") if c.strip()]

    except Exception as exc:
        logger.warning("cv_pipeline.validation_failed", resume_id=resume_id, error=str(exc))

    try:
        from app.services.settings_helper import get_or_create_settings

        async with async_session_factory() as session:
            settings = await get_or_create_settings(session, user_id)
            settings.candidate_profile = profile
            await session.commit()
            await session.refresh(settings)
        logger.info(
            "cv_pipeline.profile_saved",
            resume_id=resume_id,
            profile_keys=list(profile.keys())[:5],
        )
    except Exception as exc:
        logger.warning("cv_pipeline.profile_save_failed", resume_id=resume_id, error=exc)

    try:
        chunks = _chunk_text(content_text)
        if not chunks:
            return
        embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        connection_string = _get_sync_connection_string()
        vectorstore = PGVectorStore(
            embeddings=embeddings,
            collection_name="cv_chunks",
            connection=connection_string,
        )
        with contextlib.suppress(Exception):
            await asyncio.to_thread(vectorstore.create_collection)
        with contextlib.suppress(Exception):
            await asyncio.to_thread(vectorstore.delete, filter={"resume_id": resume_id})
        from langchain_core.documents import Document

        documents = [
            Document(
                page_content=c["text"],
                metadata={
                    "resume_id": resume_id,
                    "section": c["section"],
                    "user_id": user_id,
                },
            )
            for c in chunks
        ]
        await asyncio.to_thread(vectorstore.add_documents, documents)
        logger.info(
            "cv_pipeline.chunks_embedded",
            resume_id=resume_id,
            count=len(documents),
        )
    except Exception as exc:
        logger.warning("cv_chunk_store_failed", resume_id=resume_id, error=exc)
