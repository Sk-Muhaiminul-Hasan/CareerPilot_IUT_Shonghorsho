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
            "I would call this partially ready for now.\n\n"
            "The good news: your CV has relevant signals. The part I would be careful "
            "with is the exact JD match, because I need the live LLM pass for a richer "
            "comparison.\n\n"
            f"What I can ground from your CV:\n{evidence}\n\n"
            f"Role context I considered:\n{job_description[:1200]}"
        )
    if intent == AssistantIntent.GAP_ANALYSIS:
        missing = _simple_missing_terms(cv.full_text, benchmark)
        gaps = ", ".join(missing) if missing else "No obvious gaps found."
        return (
            "Here is the honest gap read.\n\n"
            f"Benchmark: {benchmark}\n\n"
            f"The areas that look missing or thin: {gaps}\n\n"
            f"What I found in your CV:\n{evidence}"
        )
    if intent == AssistantIntent.ROADMAP:
        return _fallback_roadmap(evidence, query)
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
    if any(term in query.lower() for term in ("greet", "hello", "opening", "start")):
        return (
            "Hey, I have your CV context loaded. I can help with fit checks, gap reads, "
            "roadmaps, and tailored letters."
        )
    return f"Here is what I can tell from your CV so far:\n\n{evidence}\n\nYou asked: {query}"


def _simple_missing_terms(cv_text: str, benchmark: str) -> list[str]:
    text = cv_text.lower()
    raw_terms = benchmark.split(":", maxsplit=1)[-1].split(",")
    return [term.strip() for term in raw_terms if term.strip().lower() not in text][:8]


def _fallback_roadmap(evidence: str, query: str) -> str:
    import re
    # Default is 3 months (12 weeks)
    weeks_count = 12
    duration_label = "3-month"
    
    text = query.lower()
    # Search for numeric duration
    numeric = re.search(r"\b(\d{1,2})\s*(month|months|week|weeks)\b", text)
    if numeric:
        val = int(numeric.group(1))
        unit = numeric.group(2)
        if "month" in unit:
            weeks_count = val * 4
            duration_label = f"{val}-month"
        else:
            weeks_count = val
            duration_label = f"{val}-week"
    else:
        # Search for words
        words = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "eleven": 11, "twelve": 12
        }
        for word, val in words.items():
            match = re.search(rf"\b{word}\s+(month|months|week|weeks)\b", text)
            if match:
                unit = match.group(1)
                if "month" in unit:
                    weeks_count = val * 4
                    duration_label = f"{val}-month"
                else:
                    weeks_count = val
                    duration_label = f"{val}-week"
                break
                
    # Limit to reasonable fallback size
    weeks_count = min(max(weeks_count, 1), 52)
    
    weeks = []
    # Divide weeks into 3 phases: foundation (first 33%), projects (middle 33%), applications (last 34%)
    p1 = max(1, weeks_count // 3)
    p2 = max(1, (weeks_count * 2) // 3)
    
    for week in range(1, weeks_count + 1):
        phase = "foundation" if week <= p1 else "projects" if week <= p2 else "applications"
        weeks.append(
            f"Week {week}: Focus on {phase}. Study one targeted topic, build or improve "
            "one portfolio artifact, and document the result with measurable evidence."
        )
        
    return f"{duration_label} roadmap grounded in your CV context:\n\n" + f"{evidence}\n\n" + "\n".join(weeks)
