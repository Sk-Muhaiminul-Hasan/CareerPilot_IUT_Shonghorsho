from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

# ✅ MERGED: LLMNotConfiguredError from wasi-not-final (needed for 428 handling)
from app.api.deps import get_current_user, get_db
from app.core.llm.client import LLMNotConfiguredError
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat import process_chat_query

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def assistant_chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> dict:
    """Return a JSON assistant response for non-streaming clients."""
    # ✅ MERGED: 428 error handling from wasi-not-final + session_id from toolcall
    try:
        return await process_chat_query(
            db=db,
            user_id=user_id,
            query=payload.query_text,
            resume_id=payload.resolved_resume_id,
            job_id=payload.active_job_id,
            job_description=payload.job_description,
            conversation_history=[
                message.model_dump() for message in payload.conversation_history
            ],
            attachments=[attachment.model_dump() for attachment in payload.attachments],
            session_id=payload.session_id,  # ✅ kept from toolcall
        )
    except LLMNotConfiguredError:
        raise HTTPException(
            status_code=428,
            detail={"message": "AI not configured", "code": "ai_not_configured"},
        ) from None