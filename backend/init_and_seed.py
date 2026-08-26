import asyncio
import os
import uuid
import random
import string
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from app.database import Base
from app.models import PollingStation, District

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL or "postgresql" in DATABASE_URL:
    # Try SQLite fallback if postgresql is set or not installed
    DATABASE_URL = "sqlite+aiosqlite:///./hc_verify.db"
else:
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

async def main():
    print(f"Connecting to database: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=True)
    AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    print("Creating missing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created/verified.")

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(District))
        districts = res.scalars().all()
        
        default_districts = ["Peshawar", "Multan", "Mardan", "Sahiwal", "Lahore", "Karachi"]
        existing_district_names = {d.district_name.lower(): d for d in districts}

        for dname in default_districts:
            if dname.lower() not in existing_district_names:
                new_d = District(district_id=uuid.uuid4(), district_name=dname)
                db.add(new_d)
                print(f"Added district: {dname}")
        await db.commit()

        res = await db.execute(select(District))
        districts = res.scalars().all()
        districts_map = {d.district_name.lower(): d.district_id for d in districts}

        stations_to_add = [
            ("Peshawar High Court", "peshawar", "Main Road, Peshawar", 1500),
            ("University of Peshawar", "peshawar", "Jamrud Road, Peshawar", 2000),
            ("Multan Bench", "multan", "High Court Road, Multan", 1200),
            ("Multan Model Town Station", "multan", "Model Town, Multan", 1000),
            ("Mardan District Court", "mardan", "Mardan Cantt, Mardan", 800),
            ("Mardan Cantt Station", "mardan", "Cantt Road, Mardan", 900),
            ("Sahiwal Central Polling Station", "sahiwal", "College Road, Sahiwal", 1100),
            ("Lahore High Court Main Hall", "lahore", "Mall Road, Lahore", 2500),
            ("Karachi City Court Station", "karachi", "MA Jinnah Road, Karachi", 3000)
        ]

        existing_res = await db.execute(select(PollingStation))
        existing_names = {s.station_name.lower() for s in existing_res.scalars().all()}

        added_count = 0
        for name, dist_name, addr, cap in stations_to_add:
            if name.lower() in existing_names:
                print(f"Station already exists: {name}")
                continue

            dist_id = districts_map.get(dist_name.lower())
            random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            station_code = f"ST-{random_suffix}"

            st = PollingStation(
                station_id=uuid.uuid4(),
                station_name=name,
                station_code=station_code,
                address=addr,
                location=addr,
                district_id=dist_id,
                capacity=cap,
                is_online=True
            )
            db.add(st)
            added_count += 1
            print(f"Adding station: {name} ({station_code}) in {dist_name}")

        if added_count > 0:
            await db.commit()
            print(f"Successfully added {added_count} polling stations!")
        else:
            print("No new polling stations were added.")

if __name__ == "__main__":
    asyncio.run(main())
