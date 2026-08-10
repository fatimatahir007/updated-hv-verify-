import asyncio
from app.database import AsyncSessionLocal
from app.models import PollingStation, District
from sqlalchemy.future import select
import uuid
import random
import string

async def main():
    async with AsyncSessionLocal() as db:
        # Fetch districts
        res = await db.execute(select(District))
        districts = res.scalars().all()
        if not districts:
            print("No districts found. Please seed districts first.")
            return

        districts_map = {d.district_name.lower(): d.district_id for d in districts}
        print("Districts available:", list(districts_map.keys()))

        stations_to_add = [
            ("Peshawar High Court", "peshawar", "Main Road, Peshawar"),
            ("University of Peshawar", "peshawar", "Jamrud Road, Peshawar"),
            ("Multan Bench", "multan", "High Court Road, Multan"),
            ("Multan Model Town Station", "multan", "Model Town, Multan"),
            ("Mardan District Court", "mardan", "Mardan Cantt, Mardan"),
            ("Mardan Cantt Station", "mardan", "Cantt Road, Mardan")
        ]

        # Fetch existing stations to avoid duplicates
        existing_res = await db.execute(select(PollingStation))
        existing_names = {s.station_name.lower() for s in existing_res.scalars().all()}

        added_count = 0
        for name, dist_name, addr in stations_to_add:
            if name.lower() in existing_names:
                print(f"Station already exists: {name}")
                continue

            dist_id = districts_map.get(dist_name.lower())
            if not dist_id:
                print(f"District not found for station {name}: {dist_name}")
                continue

            random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            station_code = f"ST-{random_suffix}"

            st = PollingStation(
                station_id=uuid.uuid4(),
                station_name=name,
                station_code=station_code,
                address=addr,
                district_id=dist_id,
                capacity=1000
            )
            db.add(st)
            added_count += 1
            print(f"Adding station: {name} (Code: {station_code}) for District: {dist_name}")

        if added_count > 0:
            await db.commit()
            print(f"Successfully added {added_count} polling stations!")
        else:
            print("No new polling stations to add.")

if __name__ == "__main__":
    asyncio.run(main())
