import asyncio
import os
import sys

sys.path.append(os.path.abspath("backend"))

from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        res = await conn.execute(text(
            "SELECT clean_cnic, count(*) "
            "FROM (SELECT replace(replace(bar_number, '-', ''), ' ', '') as clean_cnic FROM voters) t "
            "GROUP BY clean_cnic HAVING count(*) > 1"
        ))
        rows = res.fetchall()
        print(f"Duplicate CNICs when cleaned: {len(rows)}")
        for r in rows[:10]:
            print(f"CNIC: {r[0]}, Count: {r[1]}")

if __name__ == "__main__":
    asyncio.run(main())
