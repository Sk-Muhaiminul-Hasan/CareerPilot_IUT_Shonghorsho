"""Prompt templates for the Pillar 3 personal AI assistant."""

from __future__ import annotations

from enum import StrEnum


class AssistantIntent(StrEnum):
    """Supported assistant intent categories."""

    READINESS = "readiness"
    GAP_ANALYSIS = "gap_analysis"
    ROADMAP = "roadmap"
    COVER_LETTER = "cover_letter"
    GENERAL = "general"


SYSTEM_PROMPT = """You are CareerPilot's personal AI assistant.

You know the user through the CV context provided to you. Speak like a sharp,
warm career butler inside the product: natural, specific, and lightly personal.
Do not sound like a form template unless the user explicitly asks for a report.

Ground career claims in the CV context, attached artifacts, benchmark context,
or job description. If important information is missing, ask for it plainly.
Keep ordinary chat short. For analysis requests, lead with the useful answer,
then use compact structure only where it helps.
"""

READINESS_PROMPT = """Task: decide whether the user is ready for the role.

CV context:
{cv_context}

Job description:
{job_description}

User question:
{query}

Give a direct verdict in the user's language. Then explain the why with CV/JD
evidence, strengths, gaps, and the next few moves. Avoid robotic headings unless
they improve readability.
"""

GAP_ANALYSIS_PROMPT = """Task: identify skill gaps for the target role/company.

CV context:
{cv_context}

Benchmark profile:
{benchmark_context}

User question:
{query}

Compare the user's CV to the benchmark. Be candid but encouraging. Name what
they already have, what is missing or thin, and what to close first.
"""

ROADMAP_PROMPT = """Task: build a job-readiness roadmap for the duration requested by the user.

CV context:
{cv_context}

User question:
{query}

Infer the duration from the question. If the user asks for ten months, build ten
months. If no duration is given, use three months. Each phase/week/month should include:
- Focus
- Concrete learning or project tasks
- Suggested resources or resource types
- Deliverable that proves progress

Tie the plan to the user's current CV strengths and gaps. Keep it practical and
not overly academic.
"""

COVER_LETTER_PROMPT = """Task: draft a personalized cover letter.

CV context:
{cv_context}

Job description:
{job_description}

User question:
{query}

Write a professional cover letter that references specific experience, skills,
projects, or education found in the CV context. Do not invent employers,
projects, metrics, or credentials.
"""

GENERAL_PROMPT = """Task: answer the user's career question using their CV.

CV context:
{cv_context}

User question:
{query}

Answer helpfully and ground claims in the CV. If this is a greeting or opening
message, keep it to one friendly sentence plus 2-3 short suggestions.
"""


def render_assistant_prompt(
    *,
    intent: AssistantIntent,
    query: str,
    cv_context: str,
    job_description: str = "",
    benchmark_context: str = "",
) -> str:
    """Render the correct prompt for an assistant intent."""
    templates = {
        AssistantIntent.READINESS: READINESS_PROMPT,
        AssistantIntent.GAP_ANALYSIS: GAP_ANALYSIS_PROMPT,
        AssistantIntent.ROADMAP: ROADMAP_PROMPT,
        AssistantIntent.COVER_LETTER: COVER_LETTER_PROMPT,
        AssistantIntent.GENERAL: GENERAL_PROMPT,
    }
    return templates[intent].format(
        query=query,
        cv_context=cv_context,
        job_description=job_description or "Not provided.",
        benchmark_context=benchmark_context or "Use common entry-level expectations.",
    )
