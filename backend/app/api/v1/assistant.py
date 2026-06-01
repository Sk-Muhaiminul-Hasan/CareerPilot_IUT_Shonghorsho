from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import json

from app.api.deps import get_db
from app.services.chat import generate_assistant_stream

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    active_job_id: Optional[str] = None
    user_profile_id: Optional[str] = None

@router.post("/chat")
async def assistant_chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    # This generator yields text chunks token-by-token
    async def event_generator():
        async for chunk in generate_assistant_stream(
            db=db,
            message=payload.message,
            job_id=payload.active_job_id,
            profile_id=payload.user_profile_id
        ):
            # Format as standard Server-Sent Event (SSE)
            yield f"data: {json.dumps({'text': chunk})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")