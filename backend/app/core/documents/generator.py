"""Document generation orchestrator.

Coordinates resume and cover letter generation through the full
pipeline: base data -> optional LLM tailoring -> parallel render
to PDF + DOCX formats, with optional upload to Supabase Storage.
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

import structlog
from pydantic import BaseModel, ConfigDict

from app.core.documents.docx_renderer import DOCXRenderer
from app.core.documents.pdf_renderer import PDFRenderer
from app.core.exceptions import GenerationError
from app.core.llm.client import LLMClient, UserLLMConfig
from app.core.llm.prompts.cover_letter import (
    CoverLetterTemplate,
    render_prompt,
    select_best_template,
)

logger = structlog.get_logger(__name__)

OUTPUT_DIR = Path("data/generated")

UploadFn = Callable[[str, str, bytes, str], Awaitable[str]]


class GeneratedDocument(BaseModel):
    """Result of a document generation operation."""

    model_config = ConfigDict(frozen=True)

    document_id: str
    type: str
    template: str
    pdf_path: str | None = None
    docx_path: str | None = None
    tailored_data: dict[str, Any] | None = None


class DocumentGenerator:
    """Orchestrates resume and cover letter generation.

    Args:
        llm_client: Optional LLM client for content tailoring.
        output_dir: Root directory for generated documents.
        templates_dir: Root directory containing HTML/CSS templates.
        upload_file: Optional async callable that uploads a rendered file
            to remote storage and returns the storage path.
    """

    def __init__(
        self,
        llm_client: LLMClient | None = None,
        output_dir: Path = OUTPUT_DIR,
        templates_dir: Path = Path("templates"),
        upload_file: UploadFn | None = None,
    ) -> None:
        self._pdf = PDFRenderer(templates_dir=templates_dir)
        self._docx = DOCXRenderer()
        self._llm = llm_client
        self._output_dir = output_dir
        self._templates_dir = templates_dir
        self._upload_file = upload_file
        self._output_dir.mkdir(parents=True, exist_ok=True)

    async def generate_resume(
        self,
        resume_data: dict[str, Any],
        job_description: str,
        template_name: str = "modern",
        formats: list[str] | None = None,
        user_settings: UserLLMConfig | None = None,
    ) -> GeneratedDocument:
        """Generate a tailored resume in specified formats."""
        formats = formats or ["pdf", "docx"]
        doc_id = uuid.uuid4().hex[:12]

        context = resume_data
        tailored_data: dict[str, Any] | None = None
        if self._llm and job_description:
            context = await self._tailor_resume(resume_data, job_description, user_settings)
            if context is not resume_data:
                tailored_data = context

        user_id = "default_user"
        if isinstance(resume_data, dict):
            user_id = resume_data.get("user_id", user_id)

        tasks: list[asyncio.Task[Path]] = []
        task_formats: list[str] = []
        task_paths: dict[str, Path] = {}

        if "pdf" in formats:
            pdf_out = self._output_dir / "resumes" / f"{doc_id}.pdf"
            task_paths["pdf"] = pdf_out
            tasks.append(
                asyncio.ensure_future(
                    self._pdf.render(template_name, context, pdf_out),
                ),
            )
            task_formats.append("pdf")

        if "docx" in formats:
            docx_out = self._output_dir / "resumes" / f"{doc_id}.docx"
            task_paths["docx"] = docx_out
            tasks.append(
                asyncio.ensure_future(
                    self._docx.render(template_name, context, docx_out),
                ),
            )
            task_formats.append("docx")

        results = await asyncio.gather(*tasks, return_exceptions=True)

        pdf_path: str | None = None
        docx_path: str | None = None

        for fmt, result in zip(task_formats, results, strict=False):
            if isinstance(result, Exception):
                logger.error(
                    "document_render_error",
                    format=fmt,
                    template=template_name,
                    error=str(result),
                )
            elif isinstance(result, Path):
                if fmt == "pdf":
                    pdf_path = str(result)
                else:
                    docx_path = str(result)

        if not pdf_path and not docx_path:
            raise GenerationError(
                f"All formats failed for resume generation (doc_id={doc_id})",
            )

        if self._upload_file:
            pdf_path, docx_path = await self._upload_generated(
                doc_id=doc_id,
                doc_type="resumes",
                user_id=user_id,
                pdf_path=pdf_path,
                docx_path=docx_path,
            )

        logger.info(
            "resume_generated",
            document_id=doc_id,
            template=template_name,
            has_pdf=pdf_path is not None,
            has_docx=docx_path is not None,
        )
        return GeneratedDocument(
            document_id=doc_id,
            type="resume",
            template=template_name,
            pdf_path=pdf_path,
            docx_path=docx_path,
            tailored_data=tailored_data,
        )

    async def generate_cover_letter(
        self,
        resume_text: str,
        job_description: str,
        company_info: str = "",
        template: CoverLetterTemplate | None = None,
        formats: list[str] | None = None,
        user_id: str = "default_user",
        user_settings: UserLLMConfig | None = None,
    ) -> GeneratedDocument:
        """Generate a cover letter using LLM and render to PDF/DOCX."""
        formats = formats or ["pdf", "docx"]
        doc_id = uuid.uuid4().hex[:12]

        if template is None:
            template = select_best_template(
                job_title="",
                job_description=job_description,
            )

        content = await self._generate_letter_content(
            template, job_description, resume_text, company_info, user_settings,
        )

        tasks: list[asyncio.Task[Path]] = []
        task_formats: list[str] = []

        if "pdf" in formats:
            pdf_out = self._output_dir / "cover_letters" / f"{doc_id}.pdf"
            tasks.append(
                asyncio.ensure_future(
                    self._render_cover_letter_pdf(
                        content, template, pdf_out,
                    ),
                ),
            )
            task_formats.append("pdf")

        if "docx" in formats:
            docx_out = self._output_dir / "cover_letters" / f"{doc_id}.docx"
            tasks.append(
                asyncio.ensure_future(
                    self._docx.render_cover_letter(content, docx_out),
                ),
            )
            task_formats.append("docx")

        results = await asyncio.gather(*tasks, return_exceptions=True)

        pdf_path: str | None = None
        docx_path: str | None = None

        for fmt, result in zip(task_formats, results, strict=False):
            if isinstance(result, Exception):
                logger.error(
                    "cover_letter_render_error",
                    format=fmt,
                    template=template.value,
                    error=str(result),
                )
            elif isinstance(result, Path):
                if fmt == "pdf":
                    pdf_path = str(result)
                else:
                    docx_path = str(result)

        if not pdf_path and not docx_path:
            raise GenerationError(
                f"All formats failed for cover letter (doc_id={doc_id})",
            )

        if self._upload_file:
            pdf_path, docx_path = await self._upload_generated(
                doc_id=doc_id,
                doc_type="cover_letters",
                user_id=user_id,
                pdf_path=pdf_path,
                docx_path=docx_path,
            )

        logger.info(
            "cover_letter_generated",
            document_id=doc_id,
            template=template.value,
            has_pdf=pdf_path is not None,
            has_docx=docx_path is not None,
        )
        return GeneratedDocument(
            document_id=doc_id,
            type="cover_letter",
            template=template.value,
            pdf_path=pdf_path,
            docx_path=docx_path,
        )

    async def _upload_generated(
        self,
        doc_id: str,
        doc_type: str,
        user_id: str,
        pdf_path: str | None,
        docx_path: str | None,
    ) -> tuple[str | None, str | None]:
        """Upload rendered files to Supabase Storage and return storage paths."""
        uploaded_pdf = None
        uploaded_docx = None
        if pdf_path and self._upload_file:
            try:
                with open(pdf_path, "rb") as fh:
                    data = fh.read()
                uploaded_pdf = await self._upload_file(
                    bucket="generated",
                    path=f"{user_id}/{doc_type}/{doc_id}.pdf",
                    file_bytes=data,
                    content_type="application/pdf",
                )
                Path(pdf_path).unlink(missing_ok=True)
            except Exception as exc:
                logger.error("generated.upload_pdf_failed", error=str(exc))
        if docx_path and self._upload_file:
            try:
                with open(docx_path, "rb") as fh:
                    data = fh.read()
                uploaded_docx = await self._upload_file(
                    bucket="generated",
                    path=f"{user_id}/{doc_type}/{doc_id}.docx",
                    file_bytes=data,
                    content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
                Path(docx_path).unlink(missing_ok=True)
            except Exception as exc:
                logger.error("generated.upload_docx_failed", error=str(exc))
        return uploaded_pdf, uploaded_docx

    async def _tailor_resume(
        self,
        resume_data: dict[str, Any],
        job_description: str,
        user_settings: UserLLMConfig | None,
    ) -> dict[str, Any]:
        if not self._llm:
            return resume_data

        from app.core.llm.prompts.resume_tailor import (
            RESUME_TAILOR_SYSTEM_PROMPT,
            TailoredResumeData,
            render_resume_tailor_prompt,
        )

        prompt = render_resume_tailor_prompt(resume_data, job_description)
        try:
            result = await self._llm.complete_with_structured_output(
                prompt=prompt,
                output_schema=TailoredResumeData,
                system_prompt=RESUME_TAILOR_SYSTEM_PROMPT,
                purpose="extraction",
                user_settings=user_settings,
            )
            tailored = result.model_dump()
            logger.info("resume_tailored_via_llm", skills_count=len(tailored.get("skills", [])))
            return tailored
        except Exception:
            logger.exception("resume_tailoring_failed")
            return resume_data

    async def _generate_letter_content(
        self,
        template: CoverLetterTemplate,
        job_description: str,
        resume_text: str,
        company_info: str,
        user_settings: UserLLMConfig | None,
    ) -> str:
        if not self._llm:
            return self._fallback_cover_letter(job_description)

        prompt = render_prompt(
            template, job_description, resume_text, company_info,
        )
        response = await self._llm.complete(
            prompt=prompt, purpose="cover_letter", user_settings=user_settings,
        )
        return response.content

    @staticmethod
    def _fallback_cover_letter(job_description: str) -> str:
        return (
            "Dear Hiring Manager,\n\n"
            "I am writing to express my strong interest in this position. "
            "My background and skills align well with the requirements "
            "outlined in the job description.\n\n"
            "I look forward to discussing how my experience can contribute "
            "to your team's success.\n\n"
            "Sincerely,\n[Your Name]"
        )

    async def _render_cover_letter_pdf(
        self,
        content: str,
        template: CoverLetterTemplate,
        output_path: Path,
    ) -> Path:
        template_dir = self._templates_dir / "cover_letter" / template.value

        if (template_dir / "template.html").exists():
            from jinja2 import Environment, FileSystemLoader, select_autoescape

            env = Environment(
                loader=FileSystemLoader(str(template_dir)),
                autoescape=select_autoescape(["html"]),
            )
            html_tpl = env.get_template("template.html")
            html_content = html_tpl.render(content=content)

            css_path = template_dir / "style.css"
            css_string: str | None = None
            if css_path.exists():
                css_string = css_path.read_text(encoding="utf-8")

            return await self._pdf.render_html_string(
                html_content, output_path, css_string,
            )

        html = (
            "<html><body style='font-family:Georgia,serif;"
            "font-size:12pt;margin:1in;line-height:1.6;'>"
            f"{_text_to_html(content)}</body></html>"
        )
        return await self._pdf.render_html_string(
            html, output_path,
        )


def _text_to_html(text: str) -> str:
    paragraphs = text.split("\n\n")
    return "".join(f"<p>{p.strip()}</p>" for p in paragraphs if p.strip())
