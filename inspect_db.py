import asyncio
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models import Voter, Vote, Election

async def main():
    async with AsyncSessionLocal() as db:
        voters = (await db.execute(select(Voter))).scalars().all()
        print(f"Total voters: {len(voters)}")
        for v in voters:
            print(f"Voter: {v.full_name}, ID: {v.voter_id}, has_voted: {v.has_voted}")
            
        votes = (await db.execute(select(Vote))).scalars().all()
        print(f"Total votes: {len(votes)}")
        for vt in votes:
            print(f"Vote: {vt.vote_id}, ballot_id (voter_id): {vt.ballot_id}, election_id: {vt.election_id}")
            
        elections = (await db.execute(select(Election))).scalars().all()
        print(f"Total elections: {len(elections)}")
        for e in elections:
            print(f"Election: {e.title}, ID: {e.election_id}, status: {e.status}, date: {e.date}")

if __name__ == "__main__":
    asyncio.run(main())
