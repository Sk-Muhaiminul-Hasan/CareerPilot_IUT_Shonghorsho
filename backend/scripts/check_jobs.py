"""Check existing jobs and their IDs to diagnose the lookup mismatch."""
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db.session import async_session_factory
from app.models.job import Job
from app.services.job_search import _extract_platform_job_id_from_url
from sqlalchemy import select


async def main() -> None:
    async with async_session_factory() as db:
        result = await db.execute(select(Job).where(Job.user_id == "default_user").order_by(Job.created_at.desc()).limit(10))
        jobs = list(result.scalars().all())

    print(f"{'ID':<35} {'platform':<12} {'platform_job_id':<20} {'title':<40} url_tail")
    for j in jobs:
        url_id = _extract_platform_job_id_from_url(j.url)
        url_tail = (j.url or "")[-60:]
        print(f"{j.id:<35} {j.platform:<12} {j.platform_job_id:<20} {j.title[:38]:<40} {url_tail}] (url_id={url_id})")


if __name__ == "__main__":
    asyncio.run(main())
