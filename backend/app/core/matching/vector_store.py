"""PGVector-backed vector store with async interface and safe caching.

Provides semantic search over text collections using sentence-transformer
embeddings and PGVector similarity indices. All public methods are async;
embedding calls are dispatched to a thread executor.
"""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import structlog

logger = structlog.get_logger(__name__)


class VectorStore:
    """PGVector-backed vector store with async interface and safe caching.

    Args:
        index_dir: Directory kept for compatibility (not used with PGVector).
        model_name: HuggingFace sentence-transformer model identifier.
    """

    def __init__(
        self,
        index_dir: Path,
        model_name: str = "all-MiniLM-L6-v2",
    ) -> None:
        self.index_dir = index_dir
        self.model_name = model_name
        self._model: Any = None
        logger.info("vector_store_initialized", model=model_name)

    @property
    def model(self) -> Any:
        """Lazily load the SentenceTransformer model on first access."""
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            logger.info("loading_embedding_model", model=self.model_name)
            self._model = SentenceTransformer(self.model_name)
        return self._model

    async def _run_sync(self, func: Any, *args: Any) -> Any:
        """Run a blocking function in the default thread executor."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, func, *args)

    async def create_index(self, index_name: str, dimension: int = 384) -> bool:
        logger.info("pgvector_collection_ready", index=index_name, dimension=dimension)
        return True

    async def delete_index(self, index_name: str) -> bool:
        logger.info("pgvector_delete_requested", index=index_name)
        return True

    async def add_items(
        self,
        index_name: str,
        texts: list[str],
        ids: list[str] | None = None,
    ) -> int:
        if not texts:
            return 0

        if ids is not None and len(ids) != len(texts):
            raise ValueError(
                f"ids length ({len(ids)}) must match texts length ({len(texts)})"
            )

        from langchain_postgres.vectorstores import PGVector as PGVectorStore

        from app.config.settings import get_settings

        item_ids = ids if ids is not None else [uuid.uuid4().hex for _ in texts]
        embeddings = await self._run_sync(self._encode_sync, texts)

        def _add() -> int:
            embeddings_normalized = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
            settings = get_settings()
            connection_string = settings.database_url.replace("+asyncpg", "+psycopg2")
            vectorstore = PGVectorStore(
                embeddings=self._get_fake_embeddings(),
                collection_name=index_name,
                connection=connection_string,
                use_jsonb=True,
            )
            vectorstore.add_embeddings(embeddings_normalized, texts, item_ids)
            return len(texts)

        count = await self._run_sync(_add)
        logger.info("items_added_to_pgvector", index=index_name, count=count)
        return count

    async def search(
        self,
        index_name: str,
        query: str,
        top_k: int = 10,
    ) -> list[dict[str, Any]]:
        from langchain_postgres.vectorstores import PGVector as PGVectorStore

        from app.config.settings import get_settings

        def _search() -> list[dict[str, Any]]:
            settings = get_settings()
            connection_string = settings.database_url.replace("+asyncpg", "+psycopg2")
            embeddings = self._get_fake_embeddings()
            vectorstore = PGVectorStore(
                embeddings=embeddings,
                collection_name=index_name,
                connection=connection_string,
                use_jsonb=True,
            )
            results = vectorstore.similarity_search_with_score(query, k=top_k)
            formatted_results = []
            for rank, (_doc, score) in enumerate(results, start=1):
                formatted_results.append(
                    {
                        "id": str(uuid.uuid4()),
                        "score": float(score),
                        "rank": rank,
                    }
                )
            return formatted_results

        results = await self._run_sync(_search)
        logger.debug(
            "search_completed_pgvector",
            index=index_name,
            query_len=len(query),
            results=len(results),
        )
        return results

    async def get_index_info(self, index_name: str) -> dict[str, Any] | None:
        try:
            import asyncpg

            from app.config.settings import get_settings

            async def _get_info() -> dict[str, Any]:
                settings = get_settings()
                conn_str = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
                conn = await asyncpg.connect(conn_str, ssl="require")
                try:
                    query = """
                    SELECT uuid, name, cmetadata
                    FROM langchain_pg_collection
                    WHERE name = $1
                    """
                    result = await conn.fetchrow(query, index_name)
                    if result:
                        count_query = """
                        COUNT(*)
                        FROM langchain_pg_embedding
                        WHERE collection_id = $1
                        """
                        count = await conn.fetchval(count_query, result["uuid"])
                        await conn.close()
                        return {
                            "name": index_name,
                            "vectors": count,
                            "dimension": 384,
                            "id_count": count,
                        }
                    await conn.close()
                    return None
                except Exception as e:
                    await conn.close()
                    logger.warning("failed_to_get_pgvector_info", error=str(e))
                    return None

            return await self._run_sync(_get_info)
        except Exception as e:
            logger.warning("get_index_info_failed", error=str(e))
            return None

    def _encode_sync(self, texts: list[str]) -> np.ndarray:
        """Encode texts to embeddings (blocking)."""
        embeddings: np.ndarray = self.model.encode(
            texts, show_progress_bar=False, convert_to_numpy=True
        )
        if embeddings.ndim == 1:
            embeddings = embeddings.reshape(1, -1)
        return embeddings.astype(np.float32)

    def _get_fake_embeddings(self) -> Any:
        class FakeEmbeddings:
            def __init__(self, vector_store: Any) -> None:
                self.vector_store = vector_store

            def embed_query(self, text: str) -> list[float]:
                embedding = self.vector_store._encode_sync([text])
                normalized = embedding[0] / np.linalg.norm(embedding[0])
                return normalized.tolist()

            def embed_documents(self, texts: list[str]) -> list[list[float]]:
                embeddings = self.vector_store._encode_sync(texts)
                normalized = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
                return normalized.tolist()

        return FakeEmbeddings(self)
