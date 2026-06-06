"""Smoke-test the new pipeline: run a small job search and inspect the
new ``deadline``, ``work_type`` and ``salary_range`` columns on the
resulting rows.

Usage:
    python scripts/test_search_with_new_fields.py
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.core.automation.platforms import platform_registry  # noqa: E402
from app.db.session import async_session_factory  # noqa: E402
from app.models.job import Job  # noqa: E402
from app.schemas.job import JobSearchRequest  # noqa: E402
from app.services.job_search import search_jobs  # noqa: E402


async def main() -> None:
    print("Registered platforms:", platform_registry.list_platforms())

    request = JobSearchRequest(
        query="python developer",
        location="remote",
        platforms=["linkedin", "indeed"],
        limit=3,
    )
    print(f"\nRunning search: query={request.query!r}, limit={request.limit}")

    async with async_session_factory() as db:  # type: AsyncSession
        response = await search_jobs(db, request)
        print(f"Returned {len(response.items)} job(s)\n")

    async with async_session_factory() as db:
        result = await db.execute(
            select(Job)
            .order_by(Job.created_at.desc())
            .limit(request.limit)
        )
        jobs = list(result.scalars().all())

    for j in jobs:
        print("-" * 70)
        print(f"title       : {j.title}")
        print(f"company     : {j.company}")
        print(f"platform    : {j.platform}")
        print(f"salary_range: {j.salary_range!r}")
        print(f"work_type   : {j.work_type!r}")
        print(f"remote      : {j.remote}")
        print(f"deadline    : {j.deadline!r}")
        print(f"description : {(j.description or '')[:120]!r}...")


if __name__ == "__main__":
    asyncio.run(main())
