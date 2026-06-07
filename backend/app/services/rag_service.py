"""CV retrieval service for the Pillar 3 assistant.

The assistant grounds answers in parsed resume text. This service turns stored
``Resume.content_text`` into per-resume FAISS indices and retrieves the matching
chunks needed for a user query.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.constants import EMBEDDING_DIMENSION
from app.core.matching.vector_store import VectorStore
from app.models.resume import Resume
from app.services.rag_fallbacks import demo_context, lexical_context, section_chunks
from app.services.rag_types import CVChunk, CVContext

logger = structlog.get_logger(__name__)

VECTOR_INDEX_DIR = Path("data/vector_indices")
DEFAULT_TOP_K = 5


class RAGService:
    """Build and query FAISS indices from stored resume text."""

    def __init__(
        self,
        index_dir: Path = VECTOR_INDEX_DIR,
        vector_store: VectorStore | None = None,
    ) -> None:
        self.index_dir = index_dir
        self.vector_store = vector_store or VectorStore(index_dir=index_dir)

    async def retrieve_relevant_chunks(
        self,
        db: AsyncSession,
        query: str,
        resume_id: str | None = None,
        top_k: int = DEFAULT_TOP_K,
    ) -> CVContext | None:
        """Resolve a resume, ensure its index exists, and retrieve chunks."""
        resume = await self._resolve_resume(db, resume_id)
        if resume is None or not (resume.content_text or "").strip():
            return demo_context(query, top_k)

        try:
            metadata = await self._ensure_cv_index(resume)
            results = await self.vector_store.search(
                self._index_name(resume.id), query, top_k=top_k
            )
        except Exception as exc:
            logger.warning(
                "cv_vector_retrieval_failed_using_lexical",
                resume_id=resume.id,
                error=str(exc),
            )
            return lexical_context(resume, query, top_k)

        chunks_by_id = {chunk["id"]: chunk for chunk in metadata["chunks"]}
        chunks = [
            CVChunk(
                id=str(result["id"]),
                text=str(chunks_by_id.get(result["id"], {}).get("text", "")),
                rank=int(result["rank"]),
                score=float(result["score"]),
            )
            for result in results
            if result["id"] in chunks_by_id
        ]

        return CVContext(
            resume_id=resume.id,
            resume_name=resume.name,
            chunks=chunks,
            full_text=resume.content_text or "",
        )

    async def get_full_cv_text(
        self,
        db: AsyncSession,
        resume_id: str | None = None,
    ) -> CVContext | None:
        """Return the full resolved CV text plus representative chunks."""
        resume = await self._resolve_resume(db, resume_id)
        if resume is None or not (resume.content_text or "").strip():
            return demo_context("full cv", top_k=6)

        chunks = [
            CVChunk(id=f"{resume.id}:full", text=resume.content_text or "", rank=1, score=1.0)
        ]
        return CVContext(
            resume_id=resume.id,
            resume_name=resume.name,
            chunks=chunks,
            full_text=resume.content_text or "",
        )

    async def _resolve_resume(
        self,
        db: AsyncSession,
        resume_id: str | None,
    ) -> Resume | None:
        """Resolve an explicit resume ID or fallback to the latest base resume."""
        if resume_id and resume_id != "default_user":
            result = await db.execute(select(Resume).where(Resume.id == resume_id))
            resume = result.scalar_one_or_none()
            if resume is not None:
                return resume
            logger.warning("assistant_resume_id_not_found", resume_id=resume_id)

        result = await db.execute(
            select(Resume)
            .where(
                Resume.content_text.is_not(None),
                Resume.content_text != "",
                Resume.type == "base",
            )
            .order_by(Resume.created_at.desc())
        )
        return result.scalars().first()

    async def _ensure_cv_index(self, resume: Resume) -> dict[str, Any]:
        """Create or refresh the FAISS index for a resume."""
        index_name = self._index_name(resume.id)
        metadata_path = self._metadata_path(index_name)
        text = resume.content_text or ""
        content_hash = self._content_hash(text)
        existing = self._read_metadata(metadata_path)
        index_info = await self.vector_store.get_index_info(index_name)

        if (
            existing is not None
            and existing.get("content_hash") == content_hash
            and index_info is not None
        ):
            return existing

        chunks = self._chunk_text(text)
        ids = [chunk["id"] for chunk in chunks]
        await self.vector_store.delete_index(index_name)
        await self.vector_store.create_index(index_name, dimension=EMBEDDING_DIMENSION)
        if chunks:
            await self.vector_store.add_items(
                index_name,
                [chunk["text"] for chunk in chunks],
                ids=ids,
            )

        metadata = {
            "resume_id": resume.id,
            "resume_name": resume.name,
            "content_hash": content_hash,
            "chunks": chunks,
        }
        metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        logger.info("cv_rag_index_ready", resume_id=resume.id, chunks=len(chunks))
        return metadata

    def _metadata_path(self, index_name: str) -> Path:
        return self.index_dir / f"{index_name}_chunks.json"

    def _read_metadata(self, path: Path) -> dict[str, Any] | None:
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            logger.warning("cv_rag_metadata_unreadable", path=str(path))
            return None

    def _index_name(self, resume_id: str) -> str:
        safe_id = re.sub(r"[^a-zA-Z0-9_-]", "_", resume_id)
        return f"cv_{safe_id}"

    def _content_hash(self, text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def _chunk_text(
        self,
        text: str,
        max_words: int = 140,
        overlap_words: int = 30,
    ) -> list[dict[str, str]]:
        """Split CV text into overlapping word chunks for retrieval."""
        sectioned = section_chunks(text)
        if sectioned:
            return sectioned

        words = text.split()
        if not words:
            return []

        chunks: list[dict[str, str]] = []
        step = max(1, max_words - overlap_words)
        for index, start in enumerate(range(0, len(words), step), start=1):
            chunk_words = words[start : start + max_words]
            if not chunk_words:
                continue
            chunks.append(
                {
                    "id": f"chunk_{index}",
                    "text": " ".join(chunk_words),
                }
            )
            if start + max_words >= len(words):
                break
        return chunks
