import asyncio
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models import Candidate

async def main():
    async with AsyncSessionLocal() as db:
        candidates = (await db.execute(select(Candidate))).scalars().all()
        print(f"Total candidates: {len(candidates)}")
        for c in candidates:
            print(f"Candidate: {c.full_name}, ID: {c.candidate_id}, election_id: {c.election_id}")

if __name__ == "__main__":
    asyncio.run(main())
