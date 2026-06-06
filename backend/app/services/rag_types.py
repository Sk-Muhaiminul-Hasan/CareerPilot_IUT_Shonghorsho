"""Shared RAG context types."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CVChunk:
    """A retrieved CV chunk with source metadata."""

    id: str
    text: str
    rank: int
    score: float


@dataclass(frozen=True)
class CVContext:
    """Resolved CV context used by the assistant."""

    resume_id: str
    resume_name: str
    chunks: list[CVChunk]
    full_text: str
    is_demo: bool = False
