"""Assistant artifact wrappers for reusable generated outputs."""

from __future__ import annotations

import csv
import io
import re
from typing import Any

from app.core.llm.prompts.assistant import AssistantIntent


def build_artifacts(intent: AssistantIntent, answer: str, query: str) -> list[dict[str, Any]]:
    """Create reusable assistant artifacts for output-oriented intents."""
    if intent == AssistantIntent.READINESS:
        return [
            _artifact(
                "readiness_report",
                "Readiness verdict",
                answer,
                description="A reusable fit assessment grounded in CV and role context.",
            )
        ]
    if intent == AssistantIntent.GAP_ANALYSIS:
        rows = _gap_rows(answer)
        return [
            _artifact(
                "skill_gap_report",
                "Skill gap analysis",
                answer,
                description="Readable benchmark comparison for the user.",
            ),
            _artifact(
                "skill_gap_matrix",
                "Skill gap matrix",
                _rows_to_csv(rows),
                file_format="csv",
                data={"rows": rows},
                description="CSV-style matrix for visual analysis and reuse.",
            ),
        ]
    if intent == AssistantIntent.ROADMAP:
        return [_artifact("roadmap", f"{_roadmap_duration(query)} roadmap", answer)]
    if intent == AssistantIntent.COVER_LETTER:
        return [_artifact("cover_letter", "Cover letter draft", answer, file_format="text")]
    if any(term in query.lower() for term in ("draft", "write", "make", "build")):
        return [_artifact("assistant_note", "Assistant draft", answer)]
    return []


def _artifact(
    kind: str,
    title: str,
    content: str,
    *,
    file_format: str = "markdown",
    data: dict[str, Any] | None = None,
    description: str | None = None,
) -> dict[str, Any]:
    extension = {"markdown": "md", "text": "txt"}.get(file_format, file_format)
    filename = f"{_slug(title)}.{extension}"
    return {
        "type": kind,
        "title": title,
        "content": content,
        "format": file_format,
        "filename": filename,
        "description": description,
        "data": data or {},
    }


def _slug(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "careerpilot-artifact"


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
