import psycopg2


def test() -> None:
    try:
        conn = psycopg2.connect('postgresql://neondb_owner:npg_vdwa5zEC9GMf@ep-plain-paper-aozhhrqo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb')
        print('Connected successfully')
        conn.close()
    except Exception as e:
        print(f'Connection failed: {e}')

test()
