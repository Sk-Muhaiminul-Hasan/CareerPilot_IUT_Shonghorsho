import asyncio

import asyncpg


async def test() -> None:
    try:
        conn = await asyncpg.connect('postgresql://neondb_owner:npg_vdwa5zEC9GMf@ep-plain-paper-aozhhrqo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb')
        print('Connected successfully')
        await conn.close()
    except Exception as e:
        print(f'Connection failed: {e}')

asyncio.run(test())
