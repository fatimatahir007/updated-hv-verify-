import asyncio
import uuid
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models import Voter, Vote, Election

async def main():
    async with AsyncSessionLocal() as db:
        # Load voter "ali khan "
        v_res = await db.execute(select(Voter).where(Voter.name_hash == "ali khan "))
        voter = v_res.scalars().first()
        if not voter:
            # Load first voter
            v_res = await db.execute(select(Voter))
            voter = v_res.scalars().first()
        print(f"Voter: {voter.full_name}, ID: {voter.voter_id}, type: {type(voter.voter_id)}")
        
        # Active election
        active_election_id = uuid.UUID("e6443d07-3ad3-4e50-9b47-87fdfdbc752d")
        
        # Test query
        existing_vote_res = await db.execute(select(Vote).where(
            (Vote.ballot_id == str(voter.voter_id)) & (Vote.election_id == active_election_id)
        ))
        first_vote = existing_vote_res.scalars().first()
        print(f"First vote: {first_vote}")
        
        # Let's inspect what ballot_ids are in the Votes table
        votes_res = await db.execute(select(Vote).where(Vote.election_id == active_election_id))
        votes = votes_res.scalars().all()
        for v in votes:
            print(f"Vote ballot_id: {v.ballot_id}, type: {type(v.ballot_id)}")

if __name__ == "__main__":
    asyncio.run(main())
