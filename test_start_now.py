import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models import Election
import uuid

async def main():
    async with AsyncSessionLocal() as db:
        new_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        future = now + timedelta(days=1)
        new_election = Election(
            election_id=new_id,
            title=f"Test Upcoming Election {new_id}",
            date=future,
            end_time=None,
            status="Upcoming"
        )
        db.add(new_election)
        await db.commit()
        
        # Now call start_now logic
        from app.routes.election_routes import start_election_now
        try:
            res = await start_election_now(election_id=new_id, db=db)
            print("Successfully started now! New date:", res.date)
        except Exception as e:
            print("Error starting now:", e)
            
        # Clean up
        res_del = await db.execute(select(Election).where(Election.election_id == new_id))
        inserted = res_del.scalars().first()
        await db.delete(inserted)
        await db.commit()
        print("Cleaned up!")

if __name__ == "__main__":
    asyncio.run(main())
