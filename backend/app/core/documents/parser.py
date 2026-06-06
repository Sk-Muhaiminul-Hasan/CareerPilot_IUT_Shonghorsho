"""Resume and document parser supporting PDF and DOCX formats."""

import asyncio
import re
from pathlib import Path

import structlog
from pydantic import BaseModel, ConfigDict, Field

from app.core.exceptions import ParseError

logger = structlog.get_logger(__name__)

SECTION_HEADERS: list[str] = [
    "summary", "objective", "professional summary", "profile",
    "experience", "work experience", "professional experience", "employment",
    "education", "academic background",
    "skills", "technical skills", "core competencies", "competencies",
    "certifications", "certificates", "licenses",
    "projects", "personal projects", "key projects",
    "publications", "awards", "honors",
    "volunteer", "volunteering", "community involvement",
    "languages", "interests", "references",
]

_SECTION_HEADERS = SECTION_HEADERS

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_EMAIL_RE = EMAIL_RE

PHONE_RE = re.compile(
    r"(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}"
)
_PHONE_RE = PHONE_RE

LINKEDIN_RE = re.compile(
    r"(?:https?://)?(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+"
)
_LINKEDIN_RE = LINKEDIN_RE

GITHUB_RE = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/[a-zA-Z0-9_-]+"
)
_GITHUB_RE = GITHUB_RE

_SAFE_TEXT_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_WEAK_EXTRACT_MIN_CHARS = 100

_NON_SKILL_INDICATORS: tuple[str, ...] = (
    "bachelor", "master", "degree", "diploma", "certificate",
    "university", "college", "institute", "school", "board",
    "company", "corporation", "inc", "ltd", "corp",
    "built", "developed", "designed", "implemented", "created",
    "using", "worked", "responsible", "managed", "led",
    "project", "experience", "education", "contact", "references",
    "summary", "objective", "profile",
)

NON_SKILL_INDICATORS = _NON_SKILL_INDICATORS

_TECH_HINTS: tuple[str, ...] = (
    "python", "java", "javascript", "typescript", "react", "angular",
    "vue", "node", "spring", "django", "flask", "fastapi",
    "aws", "azure", "gcp", "docker", "kubernetes", "k8s",
    "sql", "nosql", "postgres", "mysql", "mongodb", "redis",
    "git", "ci/cd", "agile", "scrum", "rest", "graphql",
    "tensorflow", "pytorch", "machine learning", "deep learning",
    "nlp", "cv", "computer vision", "data", "cloud", "devops",
    "html", "css", "sass", "tailwind", "bootstrap",
    "laravel", "codeigniter", "php", "ruby", "rails",
    "c++", "c#", ".net", "go", "golang", "rust", "scala",
    "kafka", "rabbitmq", "jenkins", "terraform", "ansible",
    "excel", "tableau", "power bi", "looker",
    "figma", "sketch", "adobe", "photoshop",
)

TECH_HINTS = _TECH_HINTS


def _sanitize_extracted_text(text: str) -> str:
    """Remove null bytes, non-printable control characters, and
    letter-by-letter spacing artifacts left by some PDF encodings.

    Artifact detection: if no word in the text is longer than 4 characters,
    the PDF is likely per-character-position encoded and every non-newline
    space between tokens can be safely collapsed.
    """
    text = _SAFE_TEXT_RE.sub("", text)
    words = text.split()
    if words:
        max_word_len = max(len(w) for w in words)
        if max_word_len <= 4:
            text = re.sub(r"(?<=[^\s\n]) (?=[^\s\n])", "", text)
    return text


class ParsedResume(BaseModel):
    """Structured data extracted from a parsed resume."""

    model_config = ConfigDict(frozen=True)

    raw_text: str
    file_path: str
    file_format: str
    sections: dict[str, str] = Field(default_factory=dict)
    contact_info: dict[str, str] = Field(default_factory=dict)
    skills: list[str] = Field(default_factory=list)
    word_count: int = 0


class DocumentParser:
    """Async parser for PDF and DOCX resume files.

    Delegates blocking I/O to a thread-pool executor so the event
    loop is never blocked by file reads or library calls.
    """

    _SUPPORTED_FORMATS: frozenset[str] = frozenset({".pdf", ".docx"})

    async def parse(self, file_path: Path) -> ParsedResume:
        """Parse a resume file and extract structured data.

        Args:
            file_path: Path to the PDF or DOCX file.

        Returns:
            ``ParsedResume`` with extracted text and metadata.

        Raises:
            ParseError: If the file cannot be read or parsed.
        """
        path = Path(file_path)
        if not path.exists():
            raise ParseError(str(path), "File does not exist")

        suffix = path.suffix.lower()
        if suffix not in self._SUPPORTED_FORMATS:
            raise ParseError(
                str(path),
                f"Unsupported format '{suffix}'. Supported: {', '.join(self._SUPPORTED_FORMATS)}",
            )

        logger.info("parsing_document", file_path=str(path), format=suffix)
        loop = asyncio.get_running_loop()

        try:
            if suffix == ".pdf":
                raw_text = await loop.run_in_executor(
                    None, self._parse_pdf_sync, path
                )
            else:
                raw_text = await loop.run_in_executor(
                    None, self._parse_docx_sync, path
                )
        except ParseError:
            raise
        except Exception as exc:
            raise ParseError(str(path), str(exc)) from exc

        sections = self._extract_sections(raw_text)
        contact_info = self._extract_contact_info(raw_text)
        skills = self._extract_skills_from_text(raw_text, sections)

        result = ParsedResume(
            raw_text=raw_text,
            file_path=str(path),
            file_format=suffix.lstrip("."),
            sections=sections,
            contact_info=contact_info,
            skills=skills,
            word_count=len(raw_text.split()),
        )
        logger.info(
            "document_parsed",
            file_path=str(path),
            word_count=result.word_count,
            sections_found=len(sections),
            skills_found=len(skills),
        )
        return result

    def _parse_pdf_sync(self, file_path: Path) -> str:
        """Synchronous PDF parsing with PyPDF2 + pypdf fallback.

        Tries PyPDF2 first; if it is not installed or returns weak text
        (< 100 chars), falls back to pypdf automatically.

        Args:
            file_path: Path to the PDF file.

        Returns:
            Extracted plain text from all pages.
        """
        extracted = ""
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(str(file_path))
            pages: list[str] = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)

            extracted = "\n".join(pages)
        except ImportError:
            pass

        if len(extracted.strip()) < _WEAK_EXTRACT_MIN_CHARS:
            extracted = self._parse_pdf_sync_pypdf(file_path)

        sanitized = _sanitize_extracted_text(extracted)

        if not sanitized.strip():
            raise ParseError(str(file_path), "No text content found in PDF")
        return sanitized

    def _parse_pdf_sync_pypdf(self, file_path: Path) -> str:
        """Fallback PDF parsing with pypdf."""
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise ParseError(
                str(file_path), "pypdf is required for PDF fallback parsing"
            ) from exc

        reader = PdfReader(str(file_path))
        pages: list[str] = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)

        return "\n".join(pages)

    def _parse_docx_sync(self, file_path: Path) -> str:
        """Synchronous DOCX parsing with python-docx.

        Args:
            file_path: Path to the DOCX file.

        Returns:
            Extracted plain text from all paragraphs.
        """
        try:
            from docx import Document
        except ImportError as exc:
            raise ParseError(
                str(file_path), "python-docx is required for DOCX parsing"
            ) from exc

        doc = Document(str(file_path))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]

        if not paragraphs:
            raise ParseError(str(file_path), "No text content found in DOCX")
        raw = "\n".join(paragraphs)
        return _sanitize_extracted_text(raw)

    def _extract_sections(self, text: str) -> dict[str, str]:
        """Extract resume sections by matching known header patterns.

        Args:
            text: Full resume text.

        Returns:
            Mapping of section name to section content.
        """
        lines = text.split("\n")
        sections: dict[str, str] = {}
        current_section: str | None = None
        current_lines: list[str] = []

        for line in lines:
            stripped = line.strip()
            normalized = stripped.lower().rstrip(":")

            if normalized in _SECTION_HEADERS:
                if current_section is not None:
                    sections[current_section] = "\n".join(current_lines).strip()
                current_section = normalized
                current_lines = []
            elif current_section is not None:
                current_lines.append(stripped)

        if current_section is not None:
            sections[current_section] = "\n".join(current_lines).strip()

        return sections

    def _extract_contact_info(self, text: str) -> dict[str, str]:
        """Extract email, phone, LinkedIn, and GitHub URLs from text.

        Args:
            text: Full resume text.

        Returns:
            Mapping of contact type to extracted value.
        """
        info: dict[str, str] = {}

        email_match = _EMAIL_RE.search(text)
        if email_match:
            info["email"] = email_match.group()

        phone_match = _PHONE_RE.search(text)
        if phone_match:
            info["phone"] = phone_match.group()

        linkedin_match = _LINKEDIN_RE.search(text)
        if linkedin_match:
            info["linkedin"] = linkedin_match.group()

        github_match = _GITHUB_RE.search(text)
        if github_match:
            info["github"] = github_match.group()

        return info

    def _extract_skills_from_text(
        self, text: str, sections: dict[str, str]
    ) -> list[str]:
        """Extract skill keywords from resume text.

        Strictly prefers a dedicated skills/competencies section.
        If the section yields no valid skills, does a controlled
        line-by-line scan of the full text and only keeps lines
        that plausibly look like skill lists or tool names.
        """
        skills_text = ""
        for key in ("skills", "technical skills", "core competencies", "competencies"):
            if key in sections:
                skills_text = sections[key]
                break

        raw_skills = self._parse_skill_lines(skills_text or text)
        if not raw_skills and skills_text:
            return []

        seen: set[str] = set()
        unique: list[str] = []
        for skill in raw_skills:
            lower = skill.lower()
            if lower not in seen and len(skill) > 1:
                seen.add(lower)
                unique.append(skill)

        return unique

    @staticmethod
    def validate_skills_against_source(skills: list[str], source_text: str) -> list[str]:
        """Lightweight cleanup for LLM-extracted skills.

        Only removes obvious non-skills: URLs, paths, dates, entries with
        parentheses/brackets, strings with mixed-language quote/separator
        characters, or masses of parenthesized noise. Does not depend on
        a dedicated skills section or keyword lists.
        """
        url_re = re.compile(r"(https?://|ftp://|www\.)|github\.com/|linkedin\.com/|bitbucket\.org")
        ects_re = re.compile(r"[\u202a-\u202e\u2060-\u206f]")
        numbers_re = re.compile(r"\d{3,}")
        parens_re = re.compile(r"\([^)]{0,80}\)")
        valid: list[str] = []
        seen: set[str] = set()
        for skill in skills:
            text = skill.strip()
            lower = text.lower()
            if not lower:
                continue
            if lower in seen:
                continue
            seen.add(lower)
            if "(" in lower or ")" in lower or "[" in lower or "]" in lower:
                continue
            if url_re.search(lower):
                continue
            if ects_re.search(text):
                continue
            if numbers_re.search(lower) and not re.search(r"[a-z]{3,}", lower):
                continue
            if len(lower) > 50:
                continue
            valid.append(text)
        return valid

    def _parse_skill_lines(self, text: str) -> list[str]:
        raw_skills: list[str] = []
        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue
            lower_line = line.lower()
            if any(ind in lower_line for ind in _NON_SKILL_INDICATORS):
                continue
            if len(line) > 100:
                continue
            if re.search(r"\d{4}", line) and any(d in line for d in ("/", "-")):
                continue
            is_tech_hint = any(hint in lower_line for hint in _TECH_HINTS)
            is_list = any(d in line for d in [",", "|", ";", "\u2022", "\u2023"])
            if not is_tech_hint and not is_list:
                continue
            for delimiter in [",", "|", ";", "\u2022", "\u2023", "\u25e6"]:
                if delimiter in line:
                    for part in line.split(delimiter):
                        part = part.strip().rstrip(".")
                        if part and len(part) < 60:
                            raw_skills.append(part)
                    break
            else:
                cleaned = line.lstrip("-*\u2022\u2023 ").strip().rstrip(".")
                if cleaned and len(cleaned) < 60:
                    raw_skills.append(cleaned)
        return raw_skills

    def parse_experience_section(self, text: str) -> list[dict]:
        entries: list[dict] = []
        current: dict | None = None
        for line in text.split("\n"):
            stripped = line.strip()
            if not stripped:
                continue
            if not stripped.startswith(("•", "-", "*", "·")) and len(stripped) < 80:
                if current:
                    entries.append(current)
                current = {
                    "title": stripped,
                    "company": "",
                    "duration": "",
                    "description": "",
                }
            elif current:
                current["description"] += stripped.lstrip("•-*· ") + "\n"
        if current:
            entries.append(current)
        return entries

    def parse_education_section(self, text: str) -> list[dict]:
        entries: list[dict] = []
        for line in text.split("\n"):
            stripped = line.strip()
            if not stripped or stripped.startswith(("•", "-", "*")):
                continue
            entries.append({
                "degree": stripped,
                "institution": "",
                "year": "",
            })
        return entries


ParseResume = ParsedResume
