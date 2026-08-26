import asyncio
import os
import sys

sys.path.append(os.path.abspath("backend"))

from app.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        await db.execute(text("DELETE FROM voters WHERE bar_number = '7777777777777'"))
        await db.commit()
        print("Test voter cleaned successfully.")

if __name__ == "__main__":
    asyncio.run(main())
