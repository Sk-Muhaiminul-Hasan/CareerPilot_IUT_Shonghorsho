from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat import process_chat_query

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def assistant_chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Return a JSON assistant response for non-streaming clients."""
    return await process_chat_query(
        db=db,
        query=payload.query_text,
        resume_id=payload.resolved_resume_id,
        job_id=payload.active_job_id,
        job_description=payload.job_description,
        conversation_history=[
            message.model_dump() for message in payload.conversation_history
        ],
        attachments=[attachment.model_dump() for attachment in payload.attachments],
    )
