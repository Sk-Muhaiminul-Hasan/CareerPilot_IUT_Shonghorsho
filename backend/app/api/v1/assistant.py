from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    active_job_id: Optional[str] = None
    user_profile_id: Optional[str] = None

@router.post("/chat")
async def assistant_chat(payload: ChatRequest):
    # This generator yields text chunks token-by-token
    async def event_generator():
        async for chunk in generate_assistant_stream(
            message=payload.message,
            job_id=payload.active_job_id,
            profile_id=payload.user_profile_id
        ):
            # Format as standard Server-Sent Event (SSE)
            yield f"data: {json.dumps({'text': chunk})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")