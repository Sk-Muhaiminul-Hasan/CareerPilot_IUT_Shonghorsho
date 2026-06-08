"""Exa AI-powered semantic job search.

Inspired by the Exa+Browserbase template pattern:
1. Semantic search for companies matching criteria
2. Find career pages via related-page discovery
3. Extract structured job listings from results

Exa provides AI-native search that understands intent, making it
far more reliable than keyword-based job board scraping for discovering
opportunities across company websites, niche boards, and aggregators.
"""

from __future__ import annotations

from typing import Any

import structlog

from app.core.automation.platforms.base import JobListing

logger = structlog.get_logger(__name__)

# Default search parameters
DEFAULT_NUM_RESULTS = 20
DEFAULT_DAYS_BACK = 30


class ExaJobSearch:
    """AI-powered job discovery using the Exa search API.

    Provides semantic search across the web for job postings,
    company career pages, and hiring signals — not limited to
    any single job board.

    Args:
        api_key: Exa API key. If empty, search methods return empty results.
    """

    def __init__(self, api_key: str = "") -> None:
        self._api_key = api_key
        self._client: Any | None = None

    def _get_client(self) -> Any:
        """Lazy-load the Exa client."""
        if self._client is None:
            if not self._api_key:
                raise RuntimeError(
                    "Exa API key not configured. Set EXA_API_KEY in .env"
                )
            try:
                from exa_py import Exa
            except ImportError as exc:
                raise RuntimeError(
                    "exa-py package not installed. "
                    "Install with: pip install exa-py"
                ) from exc
            self._client = Exa(api_key=self._api_key)
        return self._client

    @property
    def available(self) -> bool:
        """Check if Exa search is configured and available."""
        if not self._api_key:
            return False
        try:
            from exa_py import Exa  # noqa: F401
            return True
        except ImportError:
            return False

    async def search_jobs(
        self,
        query: str,
        location: str = "",
        num_results: int = DEFAULT_NUM_RESULTS,
        days_back: int = DEFAULT_DAYS_BACK,
        job_type: str = "",
    ) -> list[JobListing]:
        """Search for job postings using Exa's semantic search.

        Args:
            query: Natural language job search query
                (e.g. "Senior Python developer at AI startups").
            location: Geographic filter (e.g. "San Francisco" or "remote").
            num_results: Max results to return.
            days_back: Only include results from the last N days.
            job_type: Filter by type (full-time, contract, etc.).

        Returns:
            List of JobListing objects from search results.
        """
        import asyncio

        if not self.available:
            logger.info("exa_search_unavailable")
            return []

        search_query = self._build_query(query, location, job_type)

        try:
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(
                None,
                lambda: self._get_client().search_and_contents(
                    search_query,
                    type="auto",
                    num_results=num_results,
                    start_published_date=self._date_filter(days_back),
                    text=True,
                    highlights=True,
                ),
            )

            listings = self._parse_results(results)
            logger.info(
                "exa_search_complete",
                query=query,
                results=len(listings),
            )
            return listings

        except Exception as exc:
            logger.error("exa_search_failed", query=query, error=str(exc))
            return []

    async def find_company_careers(
        self,
        company_name: str,
        num_results: int = 5,
    ) -> list[str]:
        """Find career/jobs pages for a specific company.

        Uses Exa's semantic understanding to locate career pages
        even when URL patterns vary across companies.

        Args:
            company_name: Company name to search for.
            num_results: Max career page URLs to return.

        Returns:
            List of career page URLs.
        """
        import asyncio

        if not self.available:
            return []

        try:
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(
                None,
                lambda: self._get_client().search(
                    f"{company_name} careers jobs openings",
                    type="auto",
                    use_autoprompt=True,
                    num_results=num_results,
                ),
            )
            return [r.url for r in results.results if r.url]

        except Exception as exc:
            logger.error(
                "exa_career_search_failed",
                company=company_name,
                error=str(exc),
            )
            return []

    def _build_query(
        self,
        query: str,
        location: str,
        job_type: str,
    ) -> str:
        """Build a semantic search query string."""
        parts = [f"hiring {query}"]
        if location:
            parts.append(f"in {location}")
        if job_type:
            parts.append(f"{job_type} position")
        parts.append("job posting application")
        return " ".join(parts)

    def _date_filter(self, days_back: int) -> str:
        """Return ISO date string for N days ago."""
        from datetime import UTC, datetime, timedelta
        dt = datetime.now(UTC) - timedelta(days=days_back)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    def _parse_results(self, results: Any) -> list[JobListing]:
        """Convert Exa search results to JobListing objects."""
        listings: list[JobListing] = []

        for r in results.results:
            title = r.title or ""
            url = r.url or ""
            text = getattr(r, "text", "") or ""

            # Extract company from title or URL
            company = self._extract_company(title, url)

            # Detect remote from text
            text_lower = text.lower()
            remote = any(
                kw in text_lower
                for kw in ["remote", "work from home", "distributed"]
            )

            # Classify work arrangement (remote / hybrid / onsite)
            work_type = self._classify_work_type(text_lower, remote)

            # Extract salary range hint from the text
            salary_range = self._extract_salary(text)

            # Extract deadline hint from the text
            deadline = self._extract_deadline(text)

            # Extract location hints
            location = self._extract_location(text)

            listings.append(
                JobListing(
                    platform="exa",
                    platform_job_id=r.id or url,
                    title=title,
                    company=company,
                    location=location,
                    url=url,
                    description=text[:3000],
                    remote=remote,
                    work_type=work_type,
                    salary_range=salary_range,
                    deadline=deadline,
                )
            )

        return listings

    @staticmethod
    def _classify_work_type(text_lower: str, remote_hint: bool) -> str:
        """Map free-form text to a constrained work_type label.

        Returns one of: "remote", "hybrid", "onsite", or "" when not detected.
        """
        if not text_lower:
            return "remote" if remote_hint else ""

        # Hybrid takes precedence if both are mentioned
        if "hybrid" in text_lower:
            return "hybrid"

        # Remote: strong indicators (avoid false positives like "no remote")
        remote_indicators = (
            "fully remote",
            "100% remote",
            "remote-first",
            "work from home",
            "work from anywhere",
            "anywhere in",
            "distributed team",
        )
        if any(ind in text_lower for ind in remote_indicators):
            return "remote"
        if remote_hint and "remote" in text_lower:
            return "remote"

        # Onsite indicators
        onsite_indicators = (
            "on-site",
            "on site",
            "onsite",
            "in-office",
            "in office",
            "office-based",
        )
        if any(ind in text_lower for ind in onsite_indicators):
            return "onsite"

        return ""

    @staticmethod
    def _extract_salary(text: str) -> str:
        """Best-effort salary range extraction from job text.

        Returns a short human-readable string (e.g. "$120k - $150k") or "".
        """
        import re

        if not text:
            return ""

        # Pattern: $120,000 - $150,000  /  $120k-$150k  /  120,000 USD
        patterns = [
            r"\$\s?\d{2,3}(?:[,.]\d{3})?(?:\s?k)?\s?(?:-|to|–)\s?\$\s?\d{2,3}(?:[,.]\d{3})?(?:\s?k)?",
            r"\d{2,3}\s?k\s?(?:-|to|–)\s?\d{2,3}\s?k",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                snippet = match.group(0).replace(" ", "")
                return snippet[:64]
        return ""

    @staticmethod
    def _extract_deadline(text: str) -> str:
        """Best-effort deadline extraction from job text.

        Returns an ISO date string (YYYY-MM-DD) or "".
        """
        import re

        if not text:
            return ""

        # Look for an explicit "Apply by" / "Deadline" phrase first
        context_patterns = [
            r"(?:apply by|deadline|closing date|closing on|applications? close)[^\n:]{0,40}",
        ]
        for pattern in context_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                iso = ExaJobSearch._try_parse_date(match.group(0))
                if iso:
                    return iso

        # Fall back to any full date in the text
        date_patterns = [
            r"\b(20\d{2})-(\d{2})-(\d{2})\b",
            r"\b(20\d{2})/(\d{2})/(\d{2})\b",
            r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+20\d{2}\b",
        ]
        for pattern in date_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                iso = ExaJobSearch._try_parse_date(match.group(0))
                if iso:
                    return iso
        return ""

    @staticmethod
    def _try_parse_date(snippet: str) -> str:
        """Parse a date snippet to ISO format (YYYY-MM-DD), else ""."""
        from datetime import datetime

        for fmt in (
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%B %d, %Y",
            "%B %d %Y",
            "%b %d, %Y",
            "%b %d %Y",
        ):
            try:
                return datetime.strptime(snippet.strip(), fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        return ""

    @staticmethod
    def _extract_company(title: str, url: str) -> str:
        """Best-effort company name extraction from title or URL."""
        # Try "at Company" pattern in title
        if " at " in title:
            return title.split(" at ")[-1].strip()
        if " - " in title:
            return title.split(" - ")[-1].strip()
        # Fall back to domain
        from urllib.parse import urlparse
        domain = urlparse(url).netloc.replace("www.", "")
        return domain.split(".")[0].title() if domain else "Unknown"

    @staticmethod
    def _extract_location(text: str) -> str:
        """Best-effort location extraction from job text."""
        import re
        # Match common location patterns
        patterns = [
            r"(?:location|based in|office in)[:\s]+([A-Z][a-zA-Z\s,]+)",
            r"((?:San|New|Los|San)\s[A-Z][a-z]+(?:,\s*[A-Z]{2})?)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()[:50]
        return ""
