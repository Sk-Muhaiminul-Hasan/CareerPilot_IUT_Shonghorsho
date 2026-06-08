from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class ConversationMessage(BaseModel):
    """A prior conversation message supplied by the client."""

    role: Literal["user", "assistant", "system"]
    content: str


class ChatAttachment(BaseModel):
    """Context attached from the chat composer."""

    type: str
    label: str
    value: str


class ChatRequest(BaseModel):
    """Assistant chat request.

    ``message`` is kept for the existing drawer. ``query`` is the preferred
    JSON API field for new clients.
    """

    message: Optional[str] = None
    query: Optional[str] = None
    active_job_id: Optional[str] = None
    user_profile_id: Optional[str] = None
    resume_id: Optional[str] = None
    job_description: Optional[str] = None
    session_id: Optional[str] = None
    conversation_history: list[ConversationMessage] = Field(default_factory=list)
    attachments: list[ChatAttachment] = Field(default_factory=list)

    @model_validator(mode="after")
    def _require_text(self) -> "ChatRequest":
        if not ((self.query or "").strip() or (self.message or "").strip()):
            raise ValueError("message or query is required")
        return self

    @property
    def query_text(self) -> str:
        """Return the normalized user query regardless of request field."""
        if self.query and self.query.strip():
            return self.query.strip()
        return (self.message or "").strip()

    @property
    def resolved_resume_id(self) -> str | None:
        """Return the explicit resume ID or legacy profile ID."""
        return self.resume_id or self.user_profile_id


class ChatSource(BaseModel):
    """A CV source chunk used to ground an assistant response."""

    id: str
    resume_id: str
    resume_name: str
    rank: int
    score: float
    text: str


class ChatArtifact(BaseModel):
    """Reusable assistant-created content."""

    type: str
    title: str
    content: str
    format: str = "markdown"
    filename: str | None = None
    description: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    """JSON response from the Pillar 3 assistant."""

    answer: str
    intent: str
    sources: list[ChatSource] = Field(default_factory=list)
    artifacts: list[ChatArtifact] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
