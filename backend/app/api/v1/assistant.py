import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.llm.client import LLMNotConfiguredError
from app.schemas.chat import ChatRequest
from app.services.chat import generate_assistant_stream

router = APIRouter()

@router.post("/chat")
async def assistant_chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
) -> StreamingResponse:
    # This generator yields text chunks token-by-token
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            async for chunk in generate_assistant_stream(
                db=db,
                user_id=user_id,
                message=payload.query_text,
                job_id=payload.active_job_id,
                profile_id=payload.resolved_resume_id,
                job_description=payload.job_description,
            ):
                # Format as standard Server-Sent Event (SSE)
                yield f"data: {json.dumps({'text': chunk})}\n\n"
        except LLMNotConfiguredError:
            raise HTTPException(
                status_code=428,
                detail={"message": "AI not configured", "code": "ai_not_configured"},
            ) from None

    return StreamingResponse(event_generator(), media_type="text/event-stream")
