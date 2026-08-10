import asyncio
from app.database import AsyncSessionLocal
from app.models import District
from sqlalchemy.future import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(District))
        districts = res.scalars().all()
        print("Total districts:", len(districts))
        for d in districts:
            print(f"District ID: {d.district_id}, Name: {d.district_name}")

if __name__ == "__main__":
    asyncio.run(main())
