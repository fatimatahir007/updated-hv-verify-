import asyncio
import os
import sys

sys.path.append(os.path.abspath("backend"))

from app.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT count(*) FROM voters"))
        count = res.scalar()
        print(f"Total registered voters in database: {count}")

if __name__ == "__main__":
    asyncio.run(main())
