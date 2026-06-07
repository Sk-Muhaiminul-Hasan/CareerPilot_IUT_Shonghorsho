"""Standalone harness to run _enrich_jobs_background on existing Poster rows."""
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db.session import async_session_factory
from app.models.job import Job
from app.services.job_search import _enrich_jobs_background
from sqlalchemy import select


async def main() -> None:
    async with async_session_factory() as db:
        row = await db.execute(
            select(Job)
            .where(Job.user_id == "default_user")
            .order_by(Job.created_at.desc())
            .limit(5)
        )
        jobs = list(row.scalars().all())

    print(f"Loaded {len(jobs)} job row(s)")
    listings = []
    for job in jobs:
        listings.append((
            job.platform,
            type("L", (), {
                "platform": job.platform,
                "platform_job_id": job.platform_job_id,
                "url": job.url or "",
                "title": job.title,
                "company": job.company,
            })(),
        ))

    print("\nCalling _enrich_jobs_background ...\n")
    await _enrich_jobs_background(
        job_ids=[j.id for j in jobs],
        listings=listings,
        user_id="default_user",
    )

    print("\n--- post-enrichment row check ---")
    async with async_session_factory() as db:
        row2 = await db.execute(
            select(Job)
            .where(
                Job.user_id == "default_user",
                Job.id.in_([j.id for j in jobs]),
            )
        )
        jobs2 = list(row2.scalars().all())
    for j in jobs2:
        print(f"id={j.id} platform={j.platform} platform_job_id={j.platform_job_id!r} is_enriched={j.is_enriched} title={j.title!r}")


if __name__ == "__main__":
    asyncio.run(main())
