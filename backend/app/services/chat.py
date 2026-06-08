"""Personal AI assistant service for Pillar 3."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm.client import LLMClient, UserLLMConfig
from app.core.llm.prompts.assistant import SYSTEM_PROMPT, AssistantIntent, render_assistant_prompt
from app.models.job import Job
from app.services.artifact_builder import prepare_assistant_output
from app.services.assistant_support import (
    benchmark_context,
    classify_intent,
    fallback_answer,
    format_attachments,
    format_cv_context,
    source_payload,
    extract_profile_overview,
)
from app.services.rag_service import RAGService
from app.services.settings_helper import get_or_create_settings

logger = structlog.get_logger(__name__)

MISSING_CV_MESSAGE = "Please upload your CV first in the Resume section."


# In-memory cache for CV Context to avoid querying DB/RAG on every message in a session
# Keys: (session_id, resume_id) -> CVContext
_session_cv_cache: dict[tuple[str, str], Any] = {}


def clear_session_cv_cache(resume_id: str | None = None) -> None:
    """Clear cached CV contexts, optionally for a specific resume_id."""
    global _session_cv_cache
    if resume_id:
        keys_to_delete = [k for k in _session_cv_cache.keys() if k[1] == resume_id]
        for k in keys_to_delete:
            _session_cv_cache.pop(k, None)
    else:
        _session_cv_cache.clear()


async def process_chat_query(
    *,
    db: AsyncSession,
    user_id: str,  # ✅ required, no default — removed duplicate optional param
    query: str,
    resume_id: str | None = None,
    job_id: str | None = None,
    job_description: str | None = None,
    conversation_history: list[dict[str, str]] | None = None,
    attachments: list[dict[str, Any]] | None = None,
    rag_service: RAGService | None = None,
    llm_client: LLMClient | None = None,
    session_id: str | None = None,  # ✅ kept from toolcall
) -> dict[str, Any]:
    """Process a Pillar 3 assistant query and return a JSON-safe response."""
    normalized_query = query.strip()
    intent = classify_intent(normalized_query)
    conversational_query = _query_with_history(normalized_query, conversation_history)
    attached_context = format_attachments(attachments)
    job_context = await _resolve_job_description(db, job_id, job_description, attached_context)

    if intent in {AssistantIntent.READINESS, AssistantIntent.COVER_LETTER} and not job_context:
        return {
            "answer": "Please paste a job description or attach a saved job first.",
            "intent": intent.value,
            "sources": [],
            "artifacts": [],
            "metadata": {"needs_job_description": True},
        }

    global _session_cv_cache
    base_cv = None
    cache_key = (session_id or "", resume_id or "")
    if session_id and resume_id and cache_key in _session_cv_cache:
        base_cv = _session_cv_cache[cache_key]
        logger.info("using_cached_cv_for_session", session_id=session_id, resume_id=resume_id)

    rag = rag_service or RAGService()
    if base_cv is None:
        base_cv = await rag.get_full_cv_text(db, resume_id)
        if base_cv is not None and session_id and resume_id:
            _session_cv_cache[cache_key] = base_cv
            logger.info("cached_cv_for_session", session_id=session_id, resume_id=resume_id)

    if base_cv is None:
        return {
            "answer": MISSING_CV_MESSAGE,
            "intent": intent.value,
            "sources": [],
            "artifacts": [],
            "metadata": {"needs_resume": True},
        }

    # Always retrieve query-specific chunks on every message using the cached base_cv
    # For cover letters or resume/CV tailoring/generation requests, use the full CV text so that the LLM has all sections available
    is_tailor_or_generate = (
        intent == AssistantIntent.COVER_LETTER
        or any(term in normalized_query.lower() for term in ("tailor", "generate", "create", "draft", "modify"))
        and any(term in normalized_query.lower() for term in ("resume", "cv", "cover letter", "coverletter"))
    )
    if is_tailor_or_generate:
        cv = base_cv
    else:
        cv = await rag.retrieve_relevant_chunks(
            db, normalized_query, resume_id=resume_id, base_cv=base_cv
        )
        if cv is None:
            cv = base_cv

    benchmark = benchmark_context(normalized_query, intent)
    profile_overview = extract_profile_overview(base_cv.full_text)
    prompt = render_assistant_prompt(
        intent=intent,
        query=_query_with_attachments(conversational_query, attached_context),
        cv_context=format_cv_context(cv),
        job_description=job_context,
        benchmark_context=benchmark,
        profile_overview=profile_overview,
    )

    # Resolve user settings/keys
    settings_record = await get_or_create_settings(db, user_id)
    user_cfg = UserLLMConfig.from_settings(settings_record)

    try:
        if llm_client is None:
            llm_client = LLMClient()
        # ✅ MERGED: wasi-not-final wins — user_cfg is the correctly resolved config
        response = await llm_client.complete(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            purpose=f"assistant_{intent.value}",
            user_settings=user_cfg,
        )
        raw_answer = response.content.strip()
        metadata: dict[str, Any] = {
            "resume_id": cv.resume_id,
            "resume_name": cv.resume_name,
            "model": response.model,
            "provider": response.provider,
            "used_demo_cv": cv.is_demo,
        }
    except Exception as exc:
        logger.warning(
            "assistant_llm_failed_using_grounded_fallback",
            intent=intent.value,
            error=str(exc),
        )
        raw_answer = fallback_answer(
            intent=intent,
            query=normalized_query,
            cv=cv,
            job_description=job_context,
            benchmark=benchmark,
        )
        metadata = {
            "resume_id": cv.resume_id,
            "resume_name": cv.resume_name,
            "fallback": True,
            "used_demo_cv": cv.is_demo,
        }

    answer, artifacts = prepare_assistant_output(intent, raw_answer, normalized_query)

    # Automatically save generated resume/CV or cover letter artifacts to the Resume database table
    from app.models.resume import Resume
    for artifact in artifacts:
        art_type = artifact.get("type")
        art_title = str(artifact.get("title", "")).lower()
        art_filename = str(artifact.get("filename", "")).lower()

        is_resume_art = (
            art_type in ("resume", "tailored_resume")
            or "resume" in art_title
            or "cv" in art_title
            or "resume" in art_filename
            or "cv" in art_filename
        )
        is_cover_letter_art = (
            art_type == "cover_letter"
            or "cover letter" in art_title
            or "coverletter" in art_title
            or "cover_letter" in art_filename
            or "coverletter" in art_filename
        )

        if (is_resume_art or is_cover_letter_art) and not artifact.get("data", {}).get("resume_id"):
            try:
                base_id = resume_id or (cv.resume_id if cv else None)
                db_type = "cover_letter" if is_cover_letter_art else "tailored"
                name_prefix = "Cover Letter" if is_cover_letter_art else "Tailored"

                tailored = Resume(
                    name=artifact.get("title") or f"{name_prefix} - {cv.resume_name if cv else 'Resume'}",
                    type=db_type,
                    base_resume_id=base_id,
                    job_id=job_id,
                    template_id="modern",
                    content_text=artifact.get("content", ""),
                    user_id=user_id,
                )
                db.add(tailored)
                await db.commit()
                await db.refresh(tailored)

                if "data" not in artifact or artifact["data"] is None:
                    artifact["data"] = {}
                artifact["data"]["resume_id"] = str(tailored.id)
                logger.info("saved_chat_doc_to_db", resume_id=str(tailored.id), doc_type=db_type)
            except Exception as e:
                logger.error("failed_to_save_chat_doc_to_db", error=str(e))

    return {
        "answer": answer,
        "intent": intent.value,
        "sources": source_payload(cv),
        "artifacts": artifacts,
        "metadata": metadata,
    }


async def generate_assistant_stream(
    db: AsyncSession,
    user_id: str,
    message: str,
    job_id: str | None = None,
    profile_id: str | None = None,
    job_description: str | None = None,
) -> AsyncGenerator[str, None]:
    """Compatibility SSE generator for clients that still expect SSE."""
    response = await process_chat_query(
        db=db,
        user_id=user_id,
        query=message,
        resume_id=profile_id,
        job_id=job_id,
        job_description=job_description,
    )
    yield response["answer"]


async def _resolve_job_description(
    db: AsyncSession,
    job_id: str | None,
    job_description: str | None,
    attached_context: str,
) -> str:
    if job_description and job_description.strip():
        return job_description.strip()
    if attached_context and "job" in attached_context.lower():
        return attached_context
    if not job_id:
        return ""

    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        logger.warning("assistant_job_not_found", job_id=job_id)
        return ""
    return (
        f"Role: {job.title}\n"
        f"Company: {job.company}\n"
        f"Location: {job.location}\n"
        f"Description:\n{job.description}"
    ).strip()


def _query_with_attachments(query: str, attached_context: str) -> str:
    if not attached_context:
        return query
    return f"{query}\n\nUser-attached context:\n{attached_context}"


def _query_with_history(
    query: str,
    conversation_history: list[dict[str, str]] | None,
) -> str:
    if not conversation_history:
        return query
    recent = conversation_history[-6:]
    lines = [
        f"{str(item.get('role', 'user')).title()}: {str(item.get('content', '')).strip()}"
        for item in recent
        if str(item.get("content", "")).strip()
    ]
    if not lines:
        return query
    return f"Recent chat:\n{chr(10).join(lines)}\n\nCurrent user message:\n{query}"