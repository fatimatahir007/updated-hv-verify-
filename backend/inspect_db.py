import asyncio
import sqlalchemy as sa
import sys
sys.path.insert(0, ".")

from app.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        # Real DB columns for voters
        r = await db.execute(sa.text(
            "SELECT column_name, data_type, character_maximum_length, is_nullable "
            "FROM information_schema.columns "
            "WHERE table_name='voters' "
            "ORDER BY ordinal_position"
        ))
        rows = r.fetchall()
        print('=== ACTUAL DB VOTERS TABLE ===')
        for row in rows:
            print(f'  {row[0]:30s}  type={row[1]:20s}  max_len={str(row[2]):6s}  nullable={row[3]}')

        # Check unique constraints
        r2 = await db.execute(sa.text(
            "SELECT c.conname, array_agg(a.attname ORDER BY a.attname) as cols "
            "FROM pg_constraint c "
            "JOIN pg_class t ON c.conrelid = t.oid "
            "JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey) "
            "WHERE t.relname = 'voters' AND c.contype IN ('u', 'p') "
            "GROUP BY c.conname"
        ))
        print('=== UNIQUE/PK CONSTRAINTS ===')
        for row in r2.fetchall():
            print(f'  {row[0]}: {row[1]}')

        # Count voters
        r3 = await db.execute(sa.text("SELECT COUNT(*) FROM voters"))
        print(f'\n=== VOTER COUNT: {r3.scalar()} ===')

        # Check districts table
        r4 = await db.execute(sa.text("SELECT district_id, district_name FROM districts LIMIT 10"))
        print('\n=== DISTRICTS (first 10) ===')
        for row in r4.fetchall():
            print(f'  id={row[0]}  name={row[1]}')

asyncio.run(main())
