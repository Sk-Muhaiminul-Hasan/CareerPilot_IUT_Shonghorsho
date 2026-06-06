"""Support helpers for the Pillar 3 assistant service."""

from __future__ import annotations

from typing import Any

from app.core.llm.prompts.assistant import AssistantIntent
from app.services.rag_service import CVContext

BENCHMARKS: dict[str, list[str]] = {
    "google internship": [
        "data structures",
        "algorithms",
        "python or java or c++",
        "software engineering fundamentals",
        "sql",
        "projects with measurable impact",
        "collaboration",
        "problem solving",
    ],
    "data engineer": [
        "python",
        "sql",
        "etl pipelines",
        "data modeling",
        "spark",
        "airflow",
        "cloud data warehouses",
        "docker",
    ],
    "software engineer": [
        "data structures",
        "algorithms",
        "backend or frontend development",
        "testing",
        "git",
        "system design basics",
    ],
}


def classify_intent(query: str) -> AssistantIntent:
    """Classify a user query into the supported Pillar 3 intents."""
    text = query.lower()
    if any(term in text for term in ("cover letter", "coverletter", "letter for")):
        return AssistantIntent.COVER_LETTER
    if any(term in text for term in ("roadmap", "plan", "3-month", "three-month", "job-ready")):
        return AssistantIntent.ROADMAP
    if any(term in text for term in ("missing", "gap", "skills am i missing", "lack")):
        return AssistantIntent.GAP_ANALYSIS
    if any(term in text for term in ("am i ready", "ready for", "fit for", "fitness for")):
        return AssistantIntent.READINESS
    return AssistantIntent.GENERAL


def benchmark_context(query: str, intent: AssistantIntent) -> str:
    """Return a small benchmark profile for gap-analysis prompts."""
    if intent != AssistantIntent.GAP_ANALYSIS:
        return ""
    text = query.lower()
    for key, skills in BENCHMARKS.items():
        if key in text or all(part in text for part in key.split()):
            return f"{key}: {', '.join(skills)}"
    return (
        "General competitive early-career profile: programming fundamentals, "
        "projects, internships or applied experience, communication, teamwork, "
        "role-specific tools, and measurable impact."
    )


def format_cv_context(cv: CVContext) -> str:
    """Render retrieved CV chunks for an LLM prompt."""
    if cv.chunks:
        lines = [
            f"[{chunk.id} | score={chunk.score:.3f}] {chunk.text}"
            for chunk in cv.chunks
            if chunk.text.strip()
        ]
        if lines:
            return "\n\n".join(lines)
    return cv.full_text[:3000]


def format_attachments(attachments: list[dict[str, Any]] | None) -> str:
    """Render user-attached context from the chat UI."""
    if not attachments:
        return ""
    lines = []
    for item in attachments:
        label = str(item.get("label") or item.get("type") or "Context")
        value = str(item.get("value") or "").strip()
        if value:
            lines.append(f"{label}: {value}")
    return "\n".join(lines)


def source_payload(cv: CVContext) -> list[dict[str, Any]]:
    """Serialize source chunks for API responses."""
    return [
        {
            "id": chunk.id,
            "resume_id": cv.resume_id,
            "resume_name": cv.resume_name,
            "rank": chunk.rank,
            "score": chunk.score,
            "text": chunk.text,
        }
        for chunk in cv.chunks
        if chunk.text.strip()
    ]


def build_artifacts(intent: AssistantIntent, answer: str, query: str) -> list[dict[str, str]]:
    """Create reusable assistant artifacts for output-oriented intents."""
    if intent == AssistantIntent.READINESS:
        return [_artifact("readiness_report", "Readiness report", answer)]
    if intent == AssistantIntent.GAP_ANALYSIS:
        return [_artifact("skill_gap_report", "Skill gap analysis", answer)]
    if intent == AssistantIntent.ROADMAP:
        return [_artifact("roadmap", "3-month roadmap", answer)]
    if intent == AssistantIntent.COVER_LETTER:
        return [_artifact("cover_letter", "Cover letter draft", answer)]
    if any(term in query.lower() for term in ("draft", "write", "make", "build")):
        return [_artifact("assistant_note", "Assistant draft", answer)]
    return []


def fallback_answer(
    *,
    intent: AssistantIntent,
    query: str,
    cv: CVContext,
    job_description: str,
    benchmark: str,
) -> str:
    """Return a grounded demo-safe answer when the LLM is unavailable."""
    evidence = format_cv_context(cv)
    if intent == AssistantIntent.READINESS:
        return (
            "Verdict: Partially ready.\n\n"
            "Reasoning: I found relevant CV evidence, but the LLM provider is not "
            "available to complete a deeper comparison. Use the evidence below to "
            "validate the fit against the JD.\n\n"
            f"CV evidence:\n{evidence}\n\n"
            f"Job description considered:\n{job_description[:1200]}"
        )
    if intent == AssistantIntent.GAP_ANALYSIS:
        missing = _simple_missing_terms(cv.full_text, benchmark)
        gaps = ", ".join(missing) if missing else "No obvious gaps found."
        return (
            "Skill gap analysis:\n\n"
            f"Benchmark: {benchmark}\n\n"
            f"Likely missing or weak skills: {gaps}\n\n"
            f"Grounding from CV:\n{evidence}"
        )
    if intent == AssistantIntent.ROADMAP:
        return _fallback_roadmap(evidence)
    if intent == AssistantIntent.COVER_LETTER:
        return (
            "Dear Hiring Manager,\n\n"
            "I am excited to apply for this role. My background includes the "
            "following relevant experience from my CV:\n\n"
            f"{evidence}\n\n"
            "I would welcome the chance to connect this experience to your team's "
            "needs and contribute with practical, project-backed skills.\n\n"
            "Sincerely,"
        )
    return f"Based on your CV, here is the most relevant context I found:\n\n{evidence}\n\nQuery: {query}"


def _artifact(kind: str, title: str, content: str) -> dict[str, str]:
    return {"type": kind, "title": title, "content": content}


def _simple_missing_terms(cv_text: str, benchmark: str) -> list[str]:
    text = cv_text.lower()
    raw_terms = benchmark.split(":", maxsplit=1)[-1].split(",")
    return [term.strip() for term in raw_terms if term.strip().lower() not in text][:8]


def _fallback_roadmap(evidence: str) -> str:
    weeks = []
    for week in range(1, 13):
        phase = "foundation" if week <= 4 else "projects" if week <= 8 else "applications"
        weeks.append(
            f"Week {week}: Focus on {phase}. Study one targeted topic, build or improve "
            "one portfolio artifact, and document the result with measurable evidence."
        )
    return "3-month roadmap grounded in your CV context:\n\n" + f"{evidence}\n\n" + "\n".join(weeks)
