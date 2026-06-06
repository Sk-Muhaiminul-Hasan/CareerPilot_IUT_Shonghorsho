"""Tests for the Pillar 3 CV RAG service."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from app.models.resume import Resume
from app.services.rag_service import RAGService


class FakeVectorStore:
    """Small in-memory stand-in for VectorStore."""

    def __init__(self) -> None:
        self.ids: list[str] = []
        self.texts: list[str] = []
        self.info: dict[str, Any] | None = None

    async def get_index_info(self, index_name: str) -> dict[str, Any] | None:
        return self.info

    async def delete_index(self, index_name: str) -> bool:
        self.ids = []
        self.texts = []
        self.info = None
        return True

    async def create_index(self, index_name: str, dimension: int = 384) -> bool:
        self.info = {"name": index_name, "vectors": 0, "dimension": dimension}
        return True

    async def add_items(
        self,
        index_name: str,
        texts: list[str],
        ids: list[str] | None = None,
    ) -> int:
        self.texts = texts
        self.ids = ids or []
        self.info = {"name": index_name, "vectors": len(texts), "dimension": 384}
        return len(texts)

    async def search(
        self,
        index_name: str,
        query: str,
        top_k: int = 10,
    ) -> list[dict[str, Any]]:
        return [
            {"id": item_id, "score": 0.9 - index * 0.1, "rank": index + 1}
            for index, item_id in enumerate(self.ids[:top_k])
        ]


async def test_retrieve_relevant_chunks_builds_index(
    db_session,
    tmp_path: Path,
) -> None:
    resume = Resume(
        name="cv.pdf",
        type="base",
        template_id="modern",
        content_text="Python SQL ETL Airflow projects " * 50,
    )
    db_session.add(resume)
    await db_session.commit()
    await db_session.refresh(resume)

    vector_store = FakeVectorStore()
    service = RAGService(index_dir=tmp_path, vector_store=vector_store)  # type: ignore[arg-type]

    context = await service.retrieve_relevant_chunks(
        db_session,
        "data engineer readiness",
        resume_id=resume.id,
    )

    assert context is not None
    assert context.resume_id == resume.id
    assert context.chunks
    assert "Python" in context.chunks[0].text
    assert (tmp_path / f"cv_{resume.id}_chunks.json").exists()


async def test_retrieve_relevant_chunks_returns_demo_without_cv(
    db_session,
    tmp_path: Path,
) -> None:
    service = RAGService(index_dir=tmp_path, vector_store=FakeVectorStore())  # type: ignore[arg-type]

    context = await service.retrieve_relevant_chunks(db_session, "roadmap")

    assert context is not None
    assert context.is_demo is True
    assert context.resume_id == "demo_profile"
