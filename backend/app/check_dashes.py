import asyncio
import os
import sys

sys.path.append(os.path.abspath("backend"))

from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        res = await conn.execute(text(
            "SELECT count(*) FROM voters WHERE bar_number LIKE '%-%'"
        ))
        count = res.scalar()
        print(f"Voters with dashes in CNIC: {count}")
        
        # Show a sample
        res_sample = await conn.execute(text(
            "SELECT bar_number, name_hash FROM voters WHERE bar_number LIKE '%-%' LIMIT 5"
        ))
        for row in res_sample.fetchall():
            print(f"CNIC: {row[0]}, Name: {row[1]}")

if __name__ == "__main__":
    asyncio.run(main())
