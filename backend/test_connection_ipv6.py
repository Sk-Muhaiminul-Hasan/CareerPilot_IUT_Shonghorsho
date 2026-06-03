import asyncpg
import asyncio

async def test_ipv6():
    try:
        # Try with IPv6 address in brackets
        conn = await asyncpg.connect('postgresql://postgres:CareerPilot12345%23@[2406:da14:311:1501:59d9:36b6:42a5:29c9]:5432/postgres')
        print('Connected successfully with IPv6')
        await conn.close()
    except Exception as e:
        print(f'IPv6 connection failed: {e}')
        
    try:
        # Try without brackets (though this is incorrect format)
        conn = await asyncpg.connect('postgresql://postgres:CareerPilot12345%23@2406:da14:311:1501:59d9:36b6:42a5:29c9:5432/postgres')
        print('Connected successfully without brackets')
        await conn.close()
    except Exception as e:
        print(f'Connection without brackets failed: {e}')

asyncio.run(test_ipv6())