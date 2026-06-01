import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db
from app.schemas.chat import ChatRequest
from app.services.chat import generate_assistant_stream

router = APIRouter()

@router.post("/chat")
async def assistant_chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    async def event_generator():
        async_gen = generate_assistant_stream(
            db=db,
            message=payload.message,
            job_id=payload.active_job_id,
            profile_id=payload.user_profile_id
        )
        async for chunk in async_gen:
            # Send standard SSE structured chunks
            yield f"data: {json.dumps({'text': chunk})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")