"""Personal AI assistant service for Pillar 3."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING, Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm.prompts.assistant import SYSTEM_PROMPT, AssistantIntent, render_assistant_prompt
from app.models.job import Job
from app.services.artifact_builder import build_artifacts
from app.services.assistant_support import (
    benchmark_context,
    classify_intent,
    fallback_answer,
    format_attachments,
    format_cv_context,
    source_payload,
)
from app.services.rag_service import RAGService

if TYPE_CHECKING:
    from app.core.llm.client import LLMClient

logger = structlog.get_logger(__name__)

MISSING_CV_MESSAGE = "Please upload your CV first in the Resume section."


async def process_chat_query(
    *,
    db: AsyncSession,
    query: str,
    resume_id: str | None = None,
    job_id: str | None = None,
    job_description: str | None = None,
    conversation_history: list[dict[str, str]] | None = None,
    attachments: list[dict[str, Any]] | None = None,
    rag_service: RAGService | None = None,
    llm_client: LLMClient | None = None,
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

    rag = rag_service or RAGService()
    cv = (
        await rag.get_full_cv_text(db, resume_id)
        if intent == AssistantIntent.COVER_LETTER
        else await rag.retrieve_relevant_chunks(db, normalized_query, resume_id=resume_id)
    )
    if cv is None:
        return {
            "answer": MISSING_CV_MESSAGE,
            "intent": intent.value,
            "sources": [],
            "artifacts": [],
            "metadata": {"needs_resume": True},
        }

    benchmark = benchmark_context(normalized_query, intent)
    prompt = render_assistant_prompt(
        intent=intent,
        query=_query_with_attachments(conversational_query, attached_context),
        cv_context=format_cv_context(cv),
        job_description=job_context,
        benchmark_context=benchmark,
    )

    try:
        if llm_client is None:
            from app.core.llm.client import LLMClient

            llm_client = LLMClient()
        response = await llm_client.complete(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            purpose=f"assistant_{intent.value}",
        )
        answer = response.content.strip()
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
        answer = fallback_answer(
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

    return {
        "answer": answer,
        "intent": intent.value,
        "sources": source_payload(cv),
        "artifacts": build_artifacts(intent, answer, normalized_query),
        "metadata": metadata,
    }


async def generate_assistant_stream(
    db: AsyncSession,
    message: str,
    job_id: str | None = None,
    profile_id: str | None = None,
    job_description: str | None = None,
) -> AsyncGenerator[str, None]:
    """Compatibility SSE generator for clients that still expect SSE."""
    response = await process_chat_query(
        db=db,
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
