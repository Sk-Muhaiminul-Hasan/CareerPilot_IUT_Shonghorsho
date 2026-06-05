import asyncio
import json

import structlog
from langchain_openai import OpenAIEmbeddings
from langchain_postgres.vectorstores import PGVector as PGVectorStore
from sqlalchemy import text

from app.config.settings import get_settings
from app.core.llm.client import LLMClient
from app.db.session import async_session_factory

logger = structlog.get_logger(__name__)


def _get_sync_connection_string() -> str:
    settings = get_settings()
    url = settings.database_url_sync or settings.database_url
    return url.replace("+asyncpg", "").replace("+psycopg2", "")


def _chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[dict]:
    chunks: list[dict] = []
    start = 0
    index = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append({
            "text": text[start:end],
            "section": f"chunk_{index}",
        })
        start = end - overlap
        index += 1
    return chunks


async def process_resume_upload(resume_id: str, content_text: str) -> None:
    if not content_text or len(content_text.strip()) < 200:
        return

    raw = ""
    try:
        llm = LLMClient()
        response = await llm.complete(
            prompt=(
                "Extract a structured candidate profile from the following resume text.\n"
                "Return ONLY valid JSON with keys: full_name, email, phone, location, linkedin_url, github_url, "
                "title, summary, skills (list), experience (list), education (list), certifications (list), projects (list).\n\n"
                f"Resume:\n{content_text[:6000]}"
            ),
            purpose="cv_extraction",
            response_format={"type": "json_object"},
        )
        raw = response.content
    except Exception as exc:
        logger.warning("cv_extraction_failed", resume_id=resume_id, error=str(exc))

    profile: dict = {}
    if raw:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned[3:].lstrip()
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].lstrip()
        try:
            profile = json.loads(cleaned)
        except Exception as exc:
            logger.warning(
                "cv_pipeline.profile_json_parse_failed",
                resume_id=resume_id,
                raw_preview=raw[:500],
                error=str(exc),
            )
            profile = {}

    if not profile:
        try:
            from app.core.documents.parser import DocumentParser
            parser = DocumentParser()
            sections = parser._extract_sections(content_text)
            contact = parser._extract_contact_info(content_text)
            parsed_skills = parser._extract_skills_from_text(content_text, sections)
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
                "title": list(sections.values())[0].split("\n")[0].strip() if sections else "",
                "summary": next((v for k, v in sections.items() if k in {"summary", "objective", "professional summary", "profile"}), ""),
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
        async with async_session_factory() as session:
            result = await session.execute(
                text("SELECT * FROM user_settings WHERE id = 'singleton'")
            )
            row = result.mappings().one_or_none()
            if row is None:
                await session.execute(
                    text("INSERT INTO user_settings (id, candidate_profile) VALUES ('singleton', :profile)"),
                    {"profile": json.dumps(profile)},
                )
            else:
                await session.execute(
                    text("UPDATE user_settings SET candidate_profile = :profile WHERE id = 'singleton'"),
                    {"profile": json.dumps(profile)},
                )
            await session.commit()
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
        try:
            await asyncio.to_thread(vectorstore.create_collection)
        except Exception:
            pass
        try:
            await asyncio.to_thread(vectorstore.delete, filter={"resume_id": resume_id})
        except Exception:
            pass
        from langchain_core.documents import Document

        documents = [
            Document(
                page_content=c["text"],
                metadata={"resume_id": resume_id, "section": c["section"]},
            )
            for c in chunks
        ]
        await asyncio.to_thread(vectorstore.add_documents, documents)
        logger.info("cv_pipeline.chunks_embedded", resume_id=resume_id, count=len(documents))
    except Exception as exc:
        logger.warning("cv_chunk_store_failed", resume_id=resume_id, error=exc)
