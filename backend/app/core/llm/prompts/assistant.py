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

You know the user through the CV context provided to you. Ground every claim in
that context or in the provided job description. If important information is
missing, ask for it instead of inventing it. Be specific, practical, and concise.
"""

READINESS_PROMPT = """Task: decide whether the user is ready for the role.

CV context:
{cv_context}

Job description:
{job_description}

User question:
{query}

Return:
- Verdict: Ready, Partially ready, or Not ready
- Reasoning grounded in CV evidence and JD requirements
- Matching strengths
- Missing or weak areas
- Suggested next actions
"""

GAP_ANALYSIS_PROMPT = """Task: identify skill gaps for the target role/company.

CV context:
{cv_context}

Benchmark profile:
{benchmark_context}

User question:
{query}

Return:
- Target role/company inferred
- Skills the user already demonstrates
- Missing or weak skills
- Proof from the CV context
- Priority order for closing gaps
"""

ROADMAP_PROMPT = """Task: build a 3-month job-readiness roadmap.

CV context:
{cv_context}

User question:
{query}

Return a structured 12-week plan. Each week must include:
- Focus
- Concrete learning or project tasks
- Suggested resources or resource types
- Deliverable that proves progress

Tie the plan to the user's current CV strengths and gaps.
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

Answer helpfully and ground claims in the CV. If the request matches readiness,
gap analysis, roadmap, or cover letter, use that structure.
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
