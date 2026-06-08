import asyncio
import asyncpg

NEON_CONN = "postgresql://neondb_owner:npg_vdwa5zEC9GMf@ep-plain-paper-aozhhrqo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

async def main():
    conn = await asyncpg.connect(NEON_CONN)
    await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    print("pgvector extension enabled successfully")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())