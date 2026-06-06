"""LinkedIn job platform integration using browser-use Agent.

Implements the ``JobPlatform`` interface for LinkedIn, handling login,
job search, detail scraping, and Easy Apply submission.
"""

from __future__ import annotations

from typing import Any

import structlog

from app.core.automation.agent import BrowserAgent
from app.core.automation.platforms.base import JobListing, JobPlatform
from app.core.automation.session_manager import SessionManager
from app.core.exceptions import (
    ApplicationSubmissionError,
    AuthenticationError,
    SearchError,
)

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
                    "If the feed loads normally, report 'LOGGED_IN'."
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
        import os
        # Login before searching
        try:
            await self.login({
                "email": os.environ.get("LINKEDIN_EMAIL", ""),
                "password": os.environ.get("LINKEDIN_PASSWORD", ""),
            })
        except Exception as e:
            logger.warning("linkedin.login_skipped", error=str(e))

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
            "description, salary_range, deadline, work_type, remote."
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

        # Enrich each listing with full description by visiting its URL.
        # This is slower (~10-30s total) but gives ATS scoring the complete JD
        # with all keywords, requirements, and experience expectations.
        enriched: list[JobListing] = []
        for listing in listings:
            if not listing.url:
                enriched.append(listing)
                continue
            try:
                details = await self.scrape_details(listing.url)
                if details is not None and details.description:
                    enriched.append(
                        listing.model_copy(
                            update={
                                "description": details.description,
                                "skills_required": details.skills_required
                                or listing.skills_required,
                                "salary_min": details.salary_min or listing.salary_min,
                                "salary_max": details.salary_max or listing.salary_max,
                                "salary_range": listing.salary_range
                                or details.salary_range,
                                "job_type": listing.job_type or details.job_type,
                                "remote": listing.remote or details.remote,
                            },
                        )
                    )
                else:
                    enriched.append(listing)
            except Exception as exc:
                logger.warning(
                    "linkedin.enrich_failed",
                    url=listing.url,
                    error=str(exc),
                )
                enriched.append(listing)

        logger.info(
            "linkedin.enrichment_complete",
            query=query,
            enriched=sum(1 for l in enriched if len(l.description) > 200),
        )
        return enriched

    async def scrape_details(self, job_url: str) -> JobListing | None:
        """Scrape full job details from a LinkedIn job page.

        Args:
            job_url: Direct URL to the LinkedIn job posting.

        Returns:
            ``JobListing`` with full details, or ``None`` on failure.
        """
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
            return self._parse_job_details(result, job_url)
        except Exception as exc:
            logger.warning(
                "linkedin.scrape_failed",
                url=job_url,
                error=str(exc),
            )
            return None
        finally:
            await agent.close()

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

        Handles the three common shapes returned by browser-use
        ``ActionResult.extracted_content``:

        1. Browser-use wrapper: ``{"done": {"text": "<actual JSON>"}, "success": true}``
        2. Bare JSON with trailing garbage after the closing ``]`` or ``}``
        3. Multiple JSON values concatenated — returns the first complete value
        """
        import json

        # Fast path: direct parse
        try:
            value = json.loads(text)
            if isinstance(value, (dict, list)):
                return value
        except Exception:
            pass

        # Unwrap {"done": {"text": "<json>"}}
        try:
            wrapper = json.loads(text)
            if isinstance(wrapper, dict):
                done = wrapper.get("done")
                if isinstance(done, dict) and isinstance(done.get("text"), str):
                    inner = done["text"]
                    value = json.loads(inner)
                    if isinstance(value, (dict, list)):
                        return value
        except Exception:
            pass

        # Walk from each '[' or '{' until we decode a real dict/list
        decoder = json.JSONDecoder()
        start = 0
        while True:
            bracket = -1
            for marker in ("[", "{"):
                idx = text.find(marker, start)
                if idx != -1:
                    if bracket == -1 or idx < bracket:
                        bracket = idx
            if bracket == -1:
                break
            try:
                value, end = decoder.raw_decode(text, bracket)
                if isinstance(value, (dict, list)):
                    return value
            except json.JSONDecodeError:
                pass
            start = bracket + 1
            if start >= len(text):
                break

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
                            content_len=len(text),
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

        Args:
            raw_result: Raw output from the browser-use Agent.
            url: The job posting URL.

        Returns:
            ``JobListing`` with full details, or ``None`` if unparseable.
        """
        if isinstance(raw_result, dict):
            return JobListing(
                platform="linkedin",
                platform_job_id=str(raw_result.get("id", "")),
                title=raw_result.get("title", ""),
                company=raw_result.get("company", ""),
                location=raw_result.get("location", ""),
                url=url,
                description=raw_result.get("description", ""),
                skills_required=raw_result.get("skills", []),
                salary_min=raw_result.get("salary_min"),
                salary_max=raw_result.get("salary_max"),
                salary_range=raw_result.get("salary_range", ""),
                job_type=raw_result.get("job_type", ""),
                remote=raw_result.get("remote", False),
                work_type=_normalize_work_type(
                    raw_result.get("work_type", ""),
                ),
                deadline=raw_result.get("deadline", ""),
            )
        return None


_VALID_WORK_TYPES = {"", "remote", "hybrid", "onsite"}


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
