import asyncio
import os
import sys

sys.path.append(os.path.abspath("backend"))

from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        res = await conn.execute(text(
            "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'voters'"
        ))
        print("--- Column Nullability ---")
        for row in res.fetchall():
            print(f"Column: {row[0]}, Nullable: {row[1]}")

if __name__ == "__main__":
    asyncio.run(main())
