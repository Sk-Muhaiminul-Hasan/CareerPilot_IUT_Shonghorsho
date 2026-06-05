import asyncio
from typing import Any

from langchain_openai import OpenAIEmbeddings
from langchain_postgres.vectorstores import PGVector as PGVectorStore

from app.config.settings import get_settings


def _get_sync_connection_string() -> str:
    url = get_settings().database_url_sync or get_settings().database_url
    return url.replace("+asyncpg", "").replace("+psycopg2", "")


def _run_query(query: str, k: int, filter: dict | None) -> list[dict[str, Any]]:
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    connection_string = _get_sync_connection_string()
    vectorstore = PGVectorStore(
        embeddings=embeddings,
        collection_name="cv_chunks",
        connection=connection_string,
        use_jsonb=True,
    )
    results = vectorstore.similarity_search_with_score(
        query=query,
        k=k,
        filter=filter,
    )
    items: list[dict[str, Any]] = []
    for doc, score in results:
        items.append({
            "content": doc.page_content,
            "metadata": doc.metadata,
            "score": float(score),
        })
    return items


async def query_cv_chunks(
    query: str,
    resume_id: str | None = None,
    section_filter: str | None = None,
    k: int = 4,
) -> list[dict[str, Any]]:
    filter: dict | None = None
    if resume_id is not None or section_filter is not None:
        conditions: list[dict[str, Any]] = []
        if resume_id is not None:
            conditions.append({"resume_id": resume_id})
        if section_filter is not None:
            conditions.append({"section": section_filter})
        filter = {"$and": conditions} if len(conditions) > 1 else conditions[0]
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _run_query, query, k, filter)
