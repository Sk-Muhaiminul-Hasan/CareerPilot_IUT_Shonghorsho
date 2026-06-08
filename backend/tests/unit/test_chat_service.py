"""Tests for the Pillar 3 chat service."""

from __future__ import annotations

from app.services.assistant_support import classify_intent
from app.services.chat import MISSING_CV_MESSAGE, process_chat_query
from app.services.rag_service import CVChunk, CVContext


class FakeRAGService:
    """RAG fake returning fixed CV context."""

    def __init__(self, context: CVContext | None) -> None:
        self.context = context

    async def retrieve_relevant_chunks(self, *args, **kwargs) -> CVContext | None:
        return self.context

    async def get_full_cv_text(self, *args, **kwargs) -> CVContext | None:
        return self.context


class FakeLLMClient:
    """LLM fake returning a deterministic answer."""

    async def complete(self, *args, **kwargs):
        class Response:
            content = "Verdict: Partially ready.\nReasoning: grounded in CV."
            model = "fake-model"
            provider = "fake"

        return Response()


def _context() -> CVContext:
    return CVContext(
        resume_id="resume-1",
        resume_name="Resume",
        full_text="Python SQL ETL project with Airflow and dashboards.",
        chunks=[
            CVChunk(
                id="chunk_1",
                text="Python SQL ETL project with Airflow and dashboards.",
                rank=1,
                score=0.95,
            )
        ],
    )


def test_classify_intent_examples() -> None:
    assert classify_intent("Am I ready for this data engineer role?") == "readiness"
    assert classify_intent("What skills am I missing for Google internship?") == "gap_analysis"
    assert classify_intent("Build me a 3-month roadmap") == "roadmap"
    assert classify_intent("Draft a cover letter for this job") == "cover_letter"


async def test_process_chat_query_returns_grounded_response(db_session) -> None:
    response = await process_chat_query(
        db=db_session,
        user_id="test_user",
        query="Am I ready for this data engineer role?",
        job_description="Need Python, SQL, Spark, and Airflow.",
        rag_service=FakeRAGService(_context()),  # type: ignore[arg-type]
        llm_client=FakeLLMClient(),  # type: ignore[arg-type]
    )

    assert response["intent"] == "readiness"
    assert "Partially ready" in response["answer"]
    assert response["sources"][0]["id"] == "chunk_1"
    assert response["metadata"]["provider"] == "fake"


async def test_process_chat_query_asks_for_resume_when_missing(db_session) -> None:
    response = await process_chat_query(
        db=db_session,
        user_id="test_user",
        query="Build me a 3-month roadmap",
        rag_service=FakeRAGService(None),  # type: ignore[arg-type]
        llm_client=FakeLLMClient(),  # type: ignore[arg-type]
    )

    assert response["answer"] == MISSING_CV_MESSAGE
    assert response["metadata"]["needs_resume"] is True


async def test_process_chat_query_asks_for_jd_when_required(db_session) -> None:
    response = await process_chat_query(
        db=db_session,
        user_id="test_user",
        query="Draft a cover letter for this job posting",
        rag_service=FakeRAGService(_context()),  # type: ignore[arg-type]
        llm_client=FakeLLMClient(),  # type: ignore[arg-type]
    )

    assert response["intent"] == "cover_letter"
    assert response["metadata"]["needs_job_description"] is True


def test_fallback_roadmap_parses_duration() -> None:
    from app.services.assistant_support import _fallback_roadmap
    
    # 1. 10 months
    res_10m = _fallback_roadmap("some evidence", "make me a 10 months roadmap")
    assert "10-month roadmap" in res_10m
    assert "Week 40:" in res_10m
    
    # 2. 6 weeks
    res_6w = _fallback_roadmap("some evidence", "give me a 6 weeks plan")
    assert "6-week roadmap" in res_6w
    assert "Week 6:" in res_6w
    assert "Week 7:" not in res_6w
