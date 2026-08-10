import asyncio
from datetime import datetime, timezone
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models import Voter, Vote, Election

async def main():
    async with AsyncSessionLocal() as db:
        # Get ali khan
        v_res = await db.execute(select(Voter).where(Voter.name_hash == "ali khan "))
        voter = v_res.scalars().first()
        
        # Run get_voter_me logic
        elections_res = await db.execute(select(Election).order_by(Election.created_at.desc()))
        elections = elections_res.scalars().all()
        active_election_id = None
        now = datetime.now(timezone.utc)
        print(f"Current UTC time: {now}")
        for e in elections:
            start_time = e.date if e.date.tzinfo else e.date.replace(tzinfo=timezone.utc)
            print(f"Election: {e.title}, date: {start_time}, tzinfo: {e.date.tzinfo}")
            if now >= start_time:
                if e.end_time:
                    end_time = e.end_time if e.end_time.tzinfo else e.end_time.replace(tzinfo=timezone.utc)
                    if now <= end_time:
                        active_election_id = e.election_id
                        print(f"Found active election (with end_time): {e.title}")
                        break
                else:
                    active_election_id = e.election_id
                    print(f"Found active election (no end_time): {e.title}")
                    break
                    
        has_voted_active = False
        if active_election_id:
            existing_vote_res = await db.execute(select(Vote).where(
                (Vote.ballot_id == str(voter.voter_id)) & (Vote.election_id == active_election_id)
            ))
            if existing_vote_res.scalars().first():
                has_voted_active = True
        else:
            has_voted_active = voter.has_voted
            
        print(f"active_election_id: {active_election_id}")
        print(f"has_voted_active: {has_voted_active}")

if __name__ == "__main__":
    asyncio.run(main())
