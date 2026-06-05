from typing import Any

from fastapi import APIRouter

from app.core.rag.query import query_cv_chunks

router = APIRouter()


@router.post("/query", summary="Query CV chunks")
async def query_resume_chunks(payload: dict[str, Any]) -> dict[str, Any]:
    query = payload.get("query", "")
    resume_id = payload.get("resume_id")
    section_filter = payload.get("section_filter") or payload.get("section")
    k = int(payload.get("k", 4))
    results = await query_cv_chunks(
        query=query,
        resume_id=resume_id,
        section_filter=section_filter,
        k=k,
    )
    return {"results": results}
