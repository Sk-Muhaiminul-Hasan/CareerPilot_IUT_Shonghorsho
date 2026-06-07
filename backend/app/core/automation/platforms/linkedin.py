"""LinkedIn job platform integration using browser-use Agent.

Implements the ``JobPlatform`` interface for LinkedIn, handling login,
job search, detail scraping, and Easy Apply submission.
"""

from __future__ import annotations

from typing import Any

import structlog
from sqlalchemy import select

from app.api.websocket.events import manager as ws_manager
from app.core.automation.agent import BrowserAgent
from app.core.automation.platforms.base import JobListing, JobPlatform
from app.core.automation.session_manager import SessionManager
from app.core.exceptions import (
    ApplicationSubmissionError,
    AuthenticationError,
    SearchError,
)
from app.db.session import AsyncSessionLocal
from app.models.job import Job

logger = structlog.get_logger(__name__)

# LinkedIn-specific URLs
LINKEDIN_JOBS_URL = "https://www.linkedin.com/jobs/search/"
LINKEDIN_LOGIN_URL = "https://www.linkedin.com/login"


class LinkedInPlatform(JobPlatform):
    """LinkedIn job platform integration.

    Uses browser-use Agent to navigate LinkedIn's web interface for
    authentication, job search, and application submission via Easy Apply.
    """

    def __init__(self) -> None:
        """Initialize LinkedIn platform with session manager."""
        self._session_manager = SessionManager()

    @property
    def name(self) -> str:
        """Return the platform identifier."""
        return "linkedin"

    async def login(self, credentials: dict[str, str]) -> bool:
        """Login to LinkedIn using browser-use Agent.

        Checks for an existing session first. If a saved session exists
        (via Chrome profile or cookie backup), skips credential-based login
        and validates the session is still active instead.

        Args:
            credentials: Dict with ``email`` and ``password`` keys.
                Can be empty if a valid session already exists.

        Returns:
            ``True`` if login succeeded or session is already active.

        Raises:
            AuthenticationError: If login fails.
        """
        # Check for existing session first
        if await self._session_manager.has_session("linkedin"):
            logger.info("linkedin.session_exists, verifying")
            llm = self._resolve_user_llm()
            agent = BrowserAgent(
                task=(
                    "Navigate to https://www.linkedin.com/feed/. "
                    "Check if the page shows a logged-in LinkedIn feed. "
                    "If the page redirects to a login form, report 'NOT_LOGGED_IN'. "
                    "If the feed loads normally, report 'LOGGED_IN'. "
                    "Your very last action must be `done` with exactly one key: "
                    '{"done": {"text": "<STATUS>"}, "success": true} '
                    "where <STATUS> is the literal string LOGGED_IN or NOT_LOGGED_IN."
                ),
                llm=llm,
            )
            try:
                result = await agent.run()
                if "NOT_LOGGED_IN" not in str(result):
                    logger.info("linkedin.session_reused")
                    return True
                logger.info("linkedin.session_expired, re-authenticating")
            except Exception:
                logger.info("linkedin.session_check_failed, re-authenticating")
            finally:
                await agent.close()

        # No valid session — perform fresh login
        if not credentials.get("email") or not credentials.get("password"):
            raise AuthenticationError(
                "linkedin",
                "No active session found and no credentials provided. "
                "Either log in via your browser first (Chrome profile reuse) "
                "or provide email/password.",
            )

        llm = self._resolve_user_llm()
        agent = BrowserAgent(
            task=(
                f"Go to {LINKEDIN_LOGIN_URL} and log in with the provided "
                "credentials. Enter the username in the email field and the "
                "password in the password field, then click Sign In. "
                "After login, verify you're on the LinkedIn feed page."
            ),
            llm=llm,
            sensitive_data={
                "x_username": credentials["email"],
                "x_password": credentials["password"],
            },
        )
        try:
            await agent.run()
            # Save session for future reuse
            await self._session_manager.save_cookies("linkedin", [{"logged_in": True}])
            logger.info("linkedin.login_success")
            return True
        except Exception as exc:
            logger.error("linkedin.login_failed", error=str(exc))
            raise AuthenticationError("linkedin", str(exc)) from exc
        finally:
            await agent.close()

    async def search(
        self,
        query: str,
        location: str = "",
        filters: dict[str, Any] | None = None,
        ) -> list[JobListing]:
        search_url = f"{LINKEDIN_JOBS_URL}?keywords={query}"
        if location:
            search_url += f"&location={location}"

        filter_instructions = self._build_filter_instructions(filters)

        task = (
            f"Navigate to {search_url} and wait for job listings to load. "
            f"{filter_instructions}"
            "Look at the job cards on the left panel. "
            "For the first 10 job cards, extract in ONE pass without clicking anything: "
            "job title, company name, location, "
            "the full href URL (starts with https://www.linkedin.com/jobs/view/), "
            "the visible 2-3 line description snippet/preview shown on the card, "
            "salary range if displayed (verbatim text such as \"$120K - $150K\" or \"Competitive\"), "
            "application deadline if displayed (ISO date YYYY-MM-DD or whatever format appears), "
            "and work-type (one of: \"remote\", \"hybrid\", \"onsite\") derived from any "
            "tag on the card, the location text, or the description snippet. "
            "Also set remote=true if \"remote\" appears anywhere on the card. "
            "Return as JSON array with keys: id, title, company, location, url, "
            "description, salary_range, deadline, work_type, remote. "
            "CRITICAL: After the extraction, your absolute last action must be `done` with success=true. "
            "Set done.text to the RAW JSON array ONLY — no surrounding text. "
            "Example done.text: "
            '[{"id":"...","title":"...","company":"...","location":"...","url":"...","description":"...","salary_range":null,"deadline":"...","work_type":"...","remote":true}]'
        )

        llm = self._resolve_user_llm()
        agent = BrowserAgent(task=task, llm=llm)
        try:
            result = await agent.run()
            listings = self._parse_search_results(result, query)
            logger.info(
                "linkedin.search_complete",
                query=query,
                count=len(listings),
            )
        except Exception as exc:
            logger.error("linkedin.search_failed", query=query, error=str(exc))
            raise SearchError("linkedin", str(exc)) from exc
        finally:
            await agent.close()

        return listings

    async def enrich(self, user_id: str, job_urls: list[str]) -> int:
        """Scrape full details for a batch of job URLs and persist to DB.

        For each URL the method calls :meth:`scrape_details`, then updates the
        corresponding ``Job`` row with the enriched data. A WebSocket event is
        pushed per job so the frontend can update in real time.

        Args:
            user_id: Owner of the jobs.
            job_urls: Direct LinkedIn job posting URLs to enrich.

        Returns:
            Number of jobs successfully enriched.
        """
        import json as _json

        enriched_count = 0

        for job_url in job_urls:
            try:
                detailed = await self.scrape_details(job_url)
            except Exception as exc:
                logger.warning("linkedin.enrich_scrape_failed", url=job_url, error=str(exc))
                continue

            if detailed is None:
                logger.warning("linkedin.enrich_no_details", url=job_url)
                continue

            try:
                async with AsyncSessionLocal() as db:
                    async with db.begin():
                        result = await db.execute(
                            select(Job).where(
                                Job.platform_job_id == detailed.platform_job_id,
                                Job.user_id == user_id,
                            ),
                        )
                        job = result.scalar_one_or_none()
                        if job is None:
                            logger.warning(
                                "linkedin.enrich_job_not_found",
                                platform_job_id=detailed.platform_job_id,
                                url=job_url,
                            )
                            continue

                        if detailed.description:
                            job.description = detailed.description
                        if detailed.salary_range:
                            job.salary_range = detailed.salary_range
                        if detailed.work_type:
                            job.work_type = detailed.work_type
                        if detailed.deadline:
                            job.deadline = _parse_iso_date(detailed.deadline) or job.deadline
                        if detailed.skills_required:
                            job.skills_required = detailed.skills_required
                        job.is_enriched = True
                enriched_count += 1
                await ws_manager.send_to_user(
                    user_id,
                    {"type": "job_enriched", "job_id": str(job.id)},
                )
            except Exception as exc:
                logger.error(
                    "linkedin.enrich_save_failed",
                    url=job_url,
                    error=str(exc),
                )
                continue

        logger.info(
            "linkedin.enrichment_complete",
            user_id=user_id,
            enriched=enriched_count,
            total=len(job_urls),
        )
        return enriched_count

    @staticmethod
    def _parse_iso_date(value: str):
        from datetime import datetime

        if not value:
            return None
        text = value.strip()
        for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
            try:
                return datetime.strptime(text, fmt)
            except ValueError:
                continue
        return None

    async def scrape_details(self, job_url: str) -> JobListing | None:
        """Scrape full job details from a LinkedIn job page.

        Args:
            job_url: Direct URL to the LinkedIn job posting.

        Returns:
            ``JobListing`` with full details, or ``None`` on failure.
        """
        logger.info(
            "linkedin.scrape_details.start",
            url=job_url,
        )
        task = (
            f"Navigate to {job_url}. Extract the full job posting details: "
            "job title, company name, location, full job description text, "
            "required skills or qualifications, salary range if displayed, "
            "job type (full-time/part-time/contract), and whether it's remote. "
            "Return the data as a JSON object with keys: id, title, company, "
            "location, description, skills, salary_min, salary_max, "
            "job_type, remote."
        )
        llm = self._resolve_user_llm()
        agent = BrowserAgent(task=task, llm=llm)
        try:
            result = await agent.run()
            parsed = self._parse_job_details(result, job_url)
            logger.info(
                "linkedin.scrape_details.parsed",
                url=job_url,
                result_type=type(result).__name__,
                result_is_none=result is None,
                parsed_is_none=parsed is None,
                parsed_title=parsed.title if parsed is not None else None,
                parsed_company=parsed.company if parsed is not None else None,
                parsed_desc_len=(
                    len(parsed.description) if parsed is not None and parsed.description else 0
                ),
            )
            return parsed
        except Exception as exc:
            logger.warning(
                "linkedin.scrape_details.failed",
                url=job_url,
                error=str(exc),
                exc_type=type(exc).__name__,
                exc_repr=repr(exc),
            )
            logger.debug(
                "linkedin.scrape_details.traceback",
                url=job_url,
                exc_info=True,
            )
            return None
        finally:
            try:
                await agent.close()
            except Exception as close_exc:  # noqa: BLE001
                logger.warning(
                    "linkedin.scrape_details.close_failed",
                    url=job_url,
                    error=str(close_exc),
                )

    async def apply(
        self,
        job: JobListing,
        resume_path: str,
        cover_letter_path: str | None = None,
    ) -> bool:
        """Apply to a LinkedIn job using Easy Apply.

        Args:
            job: The target job listing.
            resume_path: Absolute path to the resume file.
            cover_letter_path: Optional path to the cover letter file.

        Returns:
            ``True`` if the application was submitted successfully.

        Raises:
            AuthenticationError: If authentication fails.
            ApplicationSubmissionError: If application submission fails.
        """
        import os

        try:
            await self.login({
                "email": os.environ.get("LINKEDIN_EMAIL", ""),
                "password": os.environ.get("LINKEDIN_PASSWORD", ""),
            })
        except AuthenticationError as e:
            logger.warning("linkedin.apply_auth_failed", error=str(e))
            raise

        if not resume_path:
            raise ApplicationSubmissionError(
                "linkedin",
                "No resume provided. Upload a resume before applying to jobs.",
            )

        task = (
            f"Navigate to {job.url}. "
            "Click the 'Easy Apply' button if available. "
            "Fill out the application form step by step. "
            f"Upload the resume from '{resume_path}'. "
        )
        if cover_letter_path:
            task += f"Upload the cover letter from '{cover_letter_path}'. "
        task += (
            "Complete all required fields in the application. "
            "Review and submit the application. "
            "Confirm the submission was successful."
        )

        llm = self._resolve_user_llm()
        agent = BrowserAgent(task=task, llm=llm)
        try:
            await agent.run()
            logger.info(
                "linkedin.apply_success",
                job_id=job.platform_job_id,
            )
            return True
        except Exception as exc:
            logger.error(
                "linkedin.apply_failed",
                job_id=job.platform_job_id,
                error=str(exc),
            )
            raise ApplicationSubmissionError("linkedin", str(exc)) from exc
        finally:
            await agent.close()

    def _build_filter_instructions(
        self,
        filters: dict[str, Any] | None,
    ) -> str:
        """Build agent task instructions from search filters.

        Args:
            filters: Optional dict of LinkedIn filter parameters.

        Returns:
            Instruction string to append to the search task.
        """
        if not filters:
            return ""

        parts: list[str] = []
        if "date_posted" in filters:
            parts.append(f"Filter by date posted: {filters['date_posted']}. ")
        if "experience_level" in filters:
            parts.append(
                f"Filter by experience level: {filters['experience_level']}. "
            )
        if filters.get("remote"):
            parts.append("Filter for remote positions only. ")
        if "job_type" in filters:
            parts.append(f"Filter by job type: {filters['job_type']}. ")
        return "".join(parts)

    @staticmethod
    def _decode_json_candidate(text: str) -> dict | list | None:
        """Return the first valid JSON object/array found in *text*, or ``None``.

        Handles the shapes returned by browser-use ``ActionResult.extracted_content``:

        1. Text prefix (e.g. ``📄 Extracted from page\n: ``) followed by JSON
        2. Browser-use wrapper: ``{"done": {"text": "<actual JSON>"}, ...}``
        3. Double-escaped JSON string embedded as a Python string literal
           (e.g. ``[{\\"id\\":1}]`` — the agent serialised JSON inside a
           string value, so ``\\\"`` is an escaped quote inside the outer
           string representation)
        4. Bare JSON with trailing garbage after the closing ``]`` or ``}``
        """
        import json

        # 1. Strip any text prefix (emojis, "Extracted from page", etc.) before
        #    the first structural JSON character so we always start parsing from
        #    a clean `{` or `[`.
        #    Also unescape any double-escaped content so `{\\"id\\":1}` becomes
        #    `{"id":1}` before `json.loads` is called.
        def _clean(text_in: str) -> str:
            cleaned = text_in.strip()
            first = -1
            for marker in ("{", "["):
                idx = cleaned.find(marker)
                if idx != -1:
                    if first == -1 or idx < first:
                        first = idx
            if first == -1:
                return cleaned
            cleaned = cleaned[first:]
            if "\\\\" in cleaned[:40] or "\\\\" in cleaned[-40:]:
                cleaned = cleaned.replace('\\\\"', '"').replace('\\\\n', '\\n')
            return cleaned

        stripped = _clean(text)

        # 2. Fast path: direct parse of the cleaned text
        try:
            value = json.loads(stripped)
            if isinstance(value, (dict, list)):
                return value
        except Exception:
            pass

        # 3. Browser-use wrapper: {"done": {"text": "<json>"}, ...}
        try:
            wrapper = json.loads(stripped)
            if isinstance(wrapper, dict):
                done = wrapper.get("done")
                if isinstance(done, dict) and isinstance(done.get("text"), str):
                    inner = done["text"]
                    # inner may itself be a JSON-stringified value; try direct first
                    try:
                        value = json.loads(inner)
                        # If it's a dict with a jobs/listings/results list, unwrap it
                        if isinstance(value, dict):
                            for key in ("jobs", "listings", "results"):
                                val = value.get(key)
                                if isinstance(val, list):
                                    return val
                        if isinstance(value, (dict, list)):
                            return value
                    except Exception:
                        pass
                    # inner may be double-escaped (e.g. [\"id\":1])
                    return LinkedInPlatform._decode_double_escaped_json(inner)
        except Exception:
            pass

        # 4. The whole text may be a double-escaped JSON string literal
        if stripped.startswith("[{") and "\\" in stripped[:20]:
            return LinkedInPlatform._decode_double_escaped_json(stripped)

        # 5. Walk from each '[' or '{' until we decode a real dict/list
        decoder = json.JSONDecoder()
        start = 0
        while True:
            bracket = -1
            for marker in ("[", "{"):
                idx = stripped.find(marker, start)
                if idx != -1:
                    if bracket == -1 or idx < bracket:
                        bracket = idx
            if bracket == -1:
                break
            try:
                value, end = decoder.raw_decode(stripped, bracket)
                if isinstance(value, (dict, list)):
                    return value
            except json.JSONDecodeError:
                pass
            start = bracket + 1
            if start >= len(stripped):
                break

        return None

    @staticmethod
    def _decode_double_escaped_json(text: str) -> dict | list | None:
        """Unescape a double-escaped JSON string and parse it.

        The browser-use agent sometimes emits JSON as the *string contents* of
        a ``done`` action, e.g.::

            "[{\\"id\\":1, \\"title\\": \\"Engineer\\"}]"

        After the outer wrapper is removed we are left with a Python-style
        string repr of JSON.  Wrapping it in quotes and calling ``json.loads``
        twice reconstructs the original JSON structure.
        """
        import json

        # Normalise literal newlines that were escaped as \\\\n
        cleaned = text.replace('\\\\n', '\\n')
        try:
            # The string is a JSON string literal — wrap and decode once to
            # get the inner JSON text, then decode again to get the object.
            inner = json.loads(f'"{cleaned}"')
            value = json.loads(inner)
            if isinstance(value, (dict, list)):
                return value
        except Exception:
            pass

        # Fallback: naive unescape then try once more
        fallback = cleaned.replace('\\"', '"').replace('\\\\', '\\')
        try:
            value = json.loads(fallback)
            if isinstance(value, (dict, list)):
                return value
        except Exception:
            pass

        return None

    def _parse_search_results(self, raw_result: Any, query: str) -> list[JobListing]:
        import json

        listings = []
        text = ""

        logger.info(
            "linkedin.parse_search_results.input",
            query=query,
            result_type=type(raw_result).__name__,
            has_history=hasattr(raw_result, 'history'),
            has_final_result=hasattr(raw_result, 'final_result'),
            result_type_full=str(type(raw_result)),
        )

        # Primary: walk AgentHistoryList.history[i].result[j].extracted_content
        history_list = getattr(raw_result, 'history', None)
        if hasattr(history_list, 'history'):
            history_list = getattr(history_list, 'history', history_list)

        items: list[Any] = []
        if isinstance(history_list, list):
            items = history_list
        elif hasattr(raw_result, 'history') and isinstance(getattr(raw_result, 'history'), list):
            items = getattr(raw_result, 'history')

        for h_idx, hist in enumerate(items):
            results: list[Any] = []
            if hasattr(hist, 'result'):
                results = hist.result  # type: ignore[attr-defined]
            elif isinstance(hist, dict):
                results = hist.get('result', [])

            for r_idx, result in enumerate(results):
                content = ""
                if hasattr(result, 'extracted_content'):
                    content = result.extracted_content or ""
                elif isinstance(result, dict):
                    content = result.get('extracted_content') or result.get('text') or ""

                logger.info(
                    "linkedin.parse_search_results.history_item",
                    h_idx=h_idx,
                    r_idx=r_idx,
                    result_type=type(result).__name__,
                    content_len=len(content),
                    content_preview=content[:500],
                )

                if content.startswith('{') or content.startswith('['):
                    if 'title' in content or 'company' in content or 'jobs' in content:
                        text = content
                        logger.info(
                            "linkedin.parse_search_results.json_found",
                            source=f"history[{h_idx}].result[{r_idx}].extracted_content",
                            content_len=len(content),
                        )
                        break
            if text:
                break

        # Super-fallback: try decoding every history/source item through the
        # tolerant decoder regardless of leading non-JSON prefix.
        if not text:
            for h_idx, hist in enumerate(items):
                results = getattr(hist, 'result', []) if hasattr(hist, 'result') else (hist.get('result', []) if isinstance(hist, dict) else [])
                for r_idx, result in enumerate(results):
                    raw = ""
                    if hasattr(result, 'extracted_content'):
                        raw = result.extracted_content or ""
                    elif hasattr(result, 'text'):
                        raw = result.text or ""
                    elif isinstance(result, dict):
                        raw = result.get('extracted_content') or result.get('text') or ""
                    decoded = self._decode_json_candidate(raw)
                    if decoded is not None:
                        text = raw
                        logger.info(
                            "linkedin.parse_search_results.json_found_via_decoder",
                            source=f"history[{h_idx}].result[{r_idx}]",
                            content_len=len(raw),
                        )
                        break
                if text:
                    break

        # Fallback: final_result text (usually a summary, rarely the JSON)
        if not text and hasattr(raw_result, 'final_result'):
            text = str(raw_result.final_result() or "")
            logger.info(
                "linkedin.parse_search_results.final_result_fallback",
                text_len=len(text),
                text_preview=text[:500],
            )

        if not text:
            text = str(raw_result)
            logger.info(
                "linkedin.parse_search_results.str_fallback",
                text_len=len(text),
                text_preview=text[:500],
            )

        sources: list[Any] = []

        # Source 1: all_results (newer browser-use versions)
        if hasattr(raw_result, 'all_results'):
            sources.extend(getattr(raw_result, 'all_results', []) or [])

        # Source 2: history (browser-use 0.1.x AgentHistoryList)
        if hasattr(raw_result, 'history'):
            history = getattr(raw_result, 'history', None)
            if isinstance(history, list):
                sources.extend(history)

        # Source 3: raw_result itself might be iterable
        if isinstance(raw_result, (list, tuple)):
            sources.extend(raw_result)

        logger.info(
            "linkedin.parse_search_results.sources",
            source_count=len(sources),
        )

        for idx, item in enumerate(sources):
            logger.info(
                "linkedin.parse_search_results.item",
                idx=idx,
                item_type=type(item).__name__,
                item_attrs=sorted([a for a in dir(item) if not a.startswith('_')])[:20],
                extracted_content_len=len(getattr(item, 'extracted_content', '') or ''),
                extracted_content_preview=str(getattr(item, 'extracted_content', '') or '')[:200],
            )

            for attr in ('extracted_content', 'content', 'text', 'result'):
                if hasattr(item, attr):
                    content = getattr(item, attr) or ""
                    if '[' in content and ('title' in content or 'id' in content):
                        text = content
                        logger.info(
                            "linkedin.parse_search_results.json_found",
                            source=f"item[{idx}].{attr}",
                            content_len=len(text),
                        )
                        break
                elif isinstance(item, dict):
                    content = item.get(attr) or ""
                    if '[' in content and ('title' in content or 'id' in content):
                        text = content
                        logger.info(
                            "linkedin.parse_search_results.json_found",
                            source=f"item[{idx}] dict.{attr}",
                            content_len=len(text),
                        )
                        break
            if text:
                break

        if not text:
            if hasattr(raw_result, 'final_result'):
                text = str(raw_result.final_result() or "")
                logger.info(
                    "linkedin.parse_search_results.final_result",
                    text_len=len(text),
                    text_preview=text[:500],
                )

        if not text:
            text = str(raw_result)
            logger.info(
                "linkedin.parse_search_results.str_fallback",
                text_len=len(text),
                text_preview=text[:500],
            )

        try:
            parsed_obj = self._decode_json_candidate(text)
            if parsed_obj is None:
                logger.error(
                    "linkedin.parse_error",
                    error="No valid JSON found in extracted text",
                    text_preview=text[:500],
                )
                return listings

            raw_items: list[dict[str, Any]] = []
            if isinstance(parsed_obj, dict):
                for key in ("jobs", "listings", "results"):
                    val = parsed_obj.get(key)
                    if isinstance(val, list):
                        raw_items = val
                        break
                if not raw_items:
                    raw_items = [parsed_obj]
            elif isinstance(parsed_obj, list):
                raw_items = parsed_obj

            logger.info(
                "linkedin.parse_search_results.parsed",
                total_items=len(raw_items),
                sample_keys=sorted(raw_items[0].keys()) if raw_items else [],
            )

            for item in raw_items:
                if not isinstance(item, dict):
                    continue
                remote_val = item.get("remote")
                if remote_val is None:
                    remote_val = False
                listings.append(
                    JobListing(
                        platform="linkedin",
                        platform_job_id=str(item.get("id", item.get("platform_job_id", ""))),
                        title=item.get("title", ""),
                        company=item.get("company", ""),
                        location=item.get("location", ""),
                        url=item.get("url") or "",
                        description=item.get("description") or "",
                        salary_range=item.get("salary_range") or "",
                        deadline=item.get("deadline") or "",
                        work_type=_normalize_work_type(item.get("work_type")),
                        remote=bool(remote_val) if not isinstance(remote_val, bool) else remote_val,
                    )
                )
        except Exception as e:
            logger.error(
                "linkedin.parse_error",
                error=str(e),
                text_preview=text[:500],
            )

        return listings

    def _parse_job_details(
        self,
        raw_result: Any,
        url: str,
    ) -> JobListing | None:
        """Parse scraped job details into a JobListing model.

        The browser-use ``Agent.run()`` returns an ``AgentHistoryList`` whose
        JSON payload is tucked into ``history[i].result[j].extracted_content``,
        not a plain ``dict``. This walker mirrors :meth:`_parse_search_results`
        so that the same shape is handled uniformly.

        Args:
            raw_result: Raw output from the browser-use Agent.
            url: The job posting URL.

        Returns:
            ``JobListing`` with full details, or ``None`` if unparseable.
        """
        payload: dict | None = None

        # 1. Direct dict (legacy / synthetic callers).
        if isinstance(raw_result, dict):
            payload = raw_result

        # 2. AgentHistoryList → walk history[*].result[*].extracted_content.
        if payload is None:
            history_list = getattr(raw_result, "history", None)
            history_list = getattr(history_list, "history", history_list)
            if history_list:
                for hist in history_list:
                    results = getattr(hist, "result", None) or (
                        hist.get("result") if isinstance(hist, dict) else None
                    )
                    if not results:
                        continue
                    for item in results:
                        # ``item`` may be a dict OR an object with
                        # ``extracted_content`` (browser-use ``ActionResult``).
                        if isinstance(item, dict):
                            content = item.get("extracted_content")
                            if not content:
                                content = item.get("content")
                        else:
                            content = getattr(item, "extracted_content", None)
                            if not content:
                                content = getattr(item, "content", None)

                        if not content:
                            continue
                        if isinstance(content, str):
                            text = content.strip()
                            if not (
                                text.startswith("{") or text.startswith("[")
                            ):
                                continue
                            parsed = self._decode_json_candidate(text)
                            if (
                                parsed
                                and isinstance(parsed, dict)
                                and (
                                    "title" in parsed
                                    or "description" in parsed
                                    or "company" in parsed
                                )
                            ):
                                payload = parsed
                                break
                    if payload is not None:
                        break

        # 3. Fallback to ``final_result`` text (e.g. a markdown summary).
        if payload is None:
            final_text = ""
            get_final = getattr(raw_result, "final_result", None)
            if callable(get_final):
                try:
                    final_text = get_final() or ""
                except Exception:  # pragma: no cover - defensive
                    final_text = ""
            if isinstance(final_text, str) and final_text.strip():
                decoded = self._decode_json_candidate(final_text)
                if isinstance(decoded, dict):
                    payload = decoded

        # 4. Last-ditch: stringify and try tolerant decode.
        if payload is None:
            decoded = self._decode_json_candidate(str(raw_result))
            if isinstance(decoded, dict):
                payload = decoded

        if not isinstance(payload, dict):
            return None

        title = (payload.get("title") or "").strip()
        if not title:
            # A job-details payload without a title is unusable.
            return None

        # Coerce skills list (LLM sometimes returns comma-separated string).
        skills_raw = payload.get("skills") or payload.get(
            "skills_required"
        ) or []
        if isinstance(skills_raw, str):
            skills_list = [
                s.strip() for s in skills_raw.split(",") if s.strip()
            ]
        elif isinstance(skills_raw, list):
            skills_list = [str(s).strip() for s in skills_raw if str(s).strip()]
        else:
            skills_list = []

        return JobListing(
            platform="linkedin",
            platform_job_id=str(
                payload.get("id") or payload.get("platform_job_id") or ""
            ),
            title=title,
            company=(payload.get("company") or "").strip(),
            location=(payload.get("location") or "").strip(),
            url=url,
            description=(payload.get("description") or "").strip(),
            skills_required=skills_list,
            salary_min=_coerce_int(payload.get("salary_min")),
            salary_max=_coerce_int(payload.get("salary_max")),
            salary_range=(payload.get("salary_range") or "").strip(),
            job_type=(payload.get("job_type") or "").strip(),
            remote=bool(payload.get("remote", False)),
            work_type=_normalize_work_type(payload.get("work_type", "")),
            deadline=(payload.get("deadline") or "").strip(),
        )


_VALID_WORK_TYPES = {"", "remote", "hybrid", "onsite"}


def _coerce_int(value: Any) -> int | None:
    """Best-effort coerce a value to ``int``; return ``None`` if not numeric."""
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        digits = re.sub(r"[^0-9.\-]", "", value)
        if not digits or digits in {"-", ".", "-."}:
            return None
        try:
            return int(float(digits))
        except (TypeError, ValueError):
            return None
    return None


def _normalize_work_type(value: Any) -> str:
    """Coerce a work-type hint into one of the allowed values.

    Accepts free-form strings (case-insensitive) from scraper prompts and
    maps them to the constrained set ``{"", "remote", "hybrid", "onsite"}``.
    Anything unrecognized collapses to empty string.
    """
    if value is None:
        return ""
    text = str(value).strip().lower()
    if not text:
        return ""
    # Direct matches and common aliases
    aliases = {
        "remote": "remote",
        "work from home": "remote",
        "wfh": "remote",
        "distributed": "remote",
        "anywhere": "remote",
        "hybrid": "hybrid",
        "onsite": "onsite",
        "on-site": "onsite",
        "on site": "onsite",
        "in-office": "onsite",
        "in office": "onsite",
        "office": "onsite",
    }
    if text in aliases:
        return aliases[text]
    if "remote" in text and "hybrid" not in text:
        return "remote"
    if "hybrid" in text:
        return "hybrid"
    if "on-site" in text or "on site" in text or "onsite" in text or "office" in text:
        return "onsite"
    return "" if text not in _VALID_WORK_TYPES else text
