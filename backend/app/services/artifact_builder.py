"""Assistant artifact wrappers for reusable generated outputs."""

from __future__ import annotations

import csv
import io
import re
from typing import Any

from app.core.llm.prompts.assistant import AssistantIntent
from app.services.artifact_extractor import (
    extract_generated_artifacts,
    looks_like_generation_request,
    make_artifact,
    title_from_query,
)


def prepare_assistant_output(
    intent: AssistantIntent,
    answer: str,
    query: str,
) -> tuple[str, list[dict[str, Any]]]:
    """Split display text from reusable artifacts in an assistant response."""
    display_answer, artifacts = extract_generated_artifacts(answer, query)

    if not artifacts:
        artifacts = _intent_artifacts(intent, display_answer, query)

    if not display_answer and artifacts:
        label = "artifact" if len(artifacts) == 1 else "artifacts"
        display_answer = f"I created {len(artifacts)} {label} for you."

    return display_answer, artifacts


def build_artifacts(intent: AssistantIntent, answer: str, query: str) -> list[dict[str, Any]]:
    """Create reusable assistant artifacts for output-oriented intents."""
    return prepare_assistant_output(intent, answer, query)[1]


def _intent_artifacts(intent: AssistantIntent, answer: str, query: str) -> list[dict[str, Any]]:
    if intent == AssistantIntent.READINESS:
        return [
            make_artifact(
                "readiness_report",
                "Readiness verdict",
                answer,
                description="A reusable fit assessment grounded in CV and role context.",
            )
        ]
    if intent == AssistantIntent.GAP_ANALYSIS:
        rows = _gap_rows(answer)
        return [
            make_artifact(
                "skill_gap_report",
                "Skill gap analysis",
                answer,
                description="Readable benchmark comparison for the user.",
            ),
            make_artifact(
                "skill_gap_matrix",
                "Skill gap matrix",
                _rows_to_csv(rows),
                file_format="csv",
                data={"rows": rows},
                description="CSV-style matrix for visual analysis and reuse.",
            ),
        ]
    if intent == AssistantIntent.ROADMAP:
        return [make_artifact("roadmap", f"{_roadmap_duration(query)} roadmap", answer)]
    if intent == AssistantIntent.COVER_LETTER:
        return [make_artifact("cover_letter", "Cover letter draft", answer, file_format="text")]
    if looks_like_generation_request(query) and len(answer.strip()) > 160:
        return [make_artifact("assistant_draft", title_from_query(query, "markdown"), answer)]
    return []


def _roadmap_duration(query: str) -> str:
    text = query.lower()
    numeric = re.search(r"\b(\d{1,2})\s*(month|months|week|weeks)\b", text)
    if numeric:
        return f"{numeric.group(1)} {numeric.group(2)}"
    words = {
        "one": "1",
        "two": "2",
        "three": "3",
        "four": "4",
        "five": "5",
        "six": "6",
        "seven": "7",
        "eight": "8",
        "nine": "9",
        "ten": "10",
        "eleven": "11",
        "twelve": "12",
    }
    for word, number in words.items():
        match = re.search(rf"\b{word}\s+(month|months|week|weeks)\b", text)
        if match:
            return f"{number} {match.group(1)}"
    return "3 month"


def _gap_rows(answer: str) -> list[dict[str, Any]]:
    candidates = _extract_list_items(answer) or [
        "Role-specific tools",
        "Project evidence",
        "Interview readiness",
    ]
    return [
        {
            "skill": item[:80],
            "status": "needs evidence",
            "priority": index,
            "score": max(20, 85 - index * 12),
        }
        for index, item in enumerate(candidates[:8], start=1)
    ]


def _extract_list_items(text: str) -> list[str]:
    items = []
    for line in text.splitlines():
        cleaned = re.sub(r"^[-*\d.)\s]+", "", line).strip()
        if 4 <= len(cleaned) <= 120 and any(
            term in cleaned.lower()
            for term in ("missing", "weak", "learn", "skill", "gap", "sql", "python", "project")
        ):
            items.append(cleaned)
    return items


def _rows_to_csv(rows: list[dict[str, Any]]) -> str:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["skill", "status", "priority", "score"])
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()
