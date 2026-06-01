from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    message: str
    active_job_id: Optional[str] = None
    user_profile_id: Optional[str] = None