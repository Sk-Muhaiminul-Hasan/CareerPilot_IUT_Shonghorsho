"""Quick verification that deadline + work_type columns and CHECK constraint exist on Neon."""
import asyncio
from sqlalchemy import text
from app.db.session import async_session_factory


async def main() -> None:
    async with async_session_factory() as s:
        # Check columns
        r = await s.execute(
            text(
                "SELECT column_name, data_type, is_nullable, column_default "
                "FROM information_schema.columns "
                "WHERE table_name='jobs' AND column_name IN ('deadline','work_type') "
                "ORDER BY column_name"
            )
        )
        print("COLUMNS:")
        for row in r.fetchall():
            print(" ", row)

        # Check constraint
        r = await s.execute(
            text(
                "SELECT conname, pg_get_constraintdef(oid) "
                "FROM pg_constraint "
                "WHERE conrelid = 'jobs'::regclass AND conname = 'ck_job_work_type'"
            )
        )
        row = r.fetchone()
        print("CONSTRAINT:", row)

        # Quick enum check
        r = await s.execute(text("SELECT DISTINCT work_type FROM jobs LIMIT 10"))
        print("EXISTING work_type VALUES:", [row[0] for row in r.fetchall()])


if __name__ == "__main__":
    asyncio.run(main())
