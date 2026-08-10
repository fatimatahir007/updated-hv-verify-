import asyncio
from datetime import datetime, timezone
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models import Election
import uuid

async def main():
    async with AsyncSessionLocal() as db:
        new_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        print(f"Attempting to insert election with start_time: {now}")
        new_election = Election(
            election_id=new_id,
            title=f"Test Election {new_id}",
            date=now,
            end_time=None,
            status="Upcoming"
        )
        db.add(new_election)
        await db.commit()
        print("Success inserting!")
        
        # Verify it is retrieved
        res = await db.execute(select(Election).where(Election.election_id == new_id))
        inserted = res.scalars().first()
        print(f"Retrieved: {inserted.title}, date: {inserted.date}, tzinfo: {inserted.date.tzinfo}")
        
        # Delete it to clean up
        await db.delete(inserted)
        await db.commit()
        print("Cleaned up!")

if __name__ == "__main__":
    asyncio.run(main())
