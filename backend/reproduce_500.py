"""
Reproduce the exact 500 error by directly calling the import logic with a test Excel.
This tells us the EXACT traceback without needing the browser.
"""
import asyncio
import io
import sys
import traceback
sys.path.insert(0, ".")

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.database import AsyncSessionLocal
from app.models import Voter, District
import uuid, hashlib

def calculate_registration_hash(voter_id: str, cnic: str, full_name: str) -> str:
    return hashlib.sha256(f"{voter_id}{cnic}{full_name}".encode()).hexdigest()

async def test_import():
    # Build a minimal test row
    async with AsyncSessionLocal() as db:
        # Get a real district
        res = await db.execute(select(District).limit(1))
        district = res.scalars().first()
        if not district:
            print("ERROR: No districts in DB!")
            return
        
        district_id = district.district_id
        district_name = district.district_name
        print(f"Using district: {district_name} ({district_id})")

        # Simulate the exact nadra_routes Voter constructor
        test_cnic = "1234500000001"
        test_name = "Test Import Voter"
        test_phone = "03001234567"
        test_email = None
        new_voter_id = uuid.uuid4()

        print(f"\nAttempting to create Voter object...")
        try:
            new_voter = Voter(
                voter_id=new_voter_id,
                full_name=test_name,
                cnic=test_cnic,
                phone=test_phone,
                constituency=district_name,
                district=district_name,        # <-- This line from original code
                email=test_email,
                password="",
                polling_station_id=None,
                district_id=district_id,
                has_voted=False,
                is_verified=True,
                is_pending=False
            )
            new_voter.registration_hash = calculate_registration_hash(
                str(new_voter_id), test_cnic, test_name
            )
            print(f"  Voter object created OK")
            print(f"  bar_number (cnic):       {new_voter.bar_number!r}")
            print(f"  name_hash (full_name):   {new_voter.name_hash!r}  len={len(new_voter.name_hash or '')}")
            print(f"  commitment_hash (phone): {new_voter.commitment_hash!r}  len={len(new_voter.commitment_hash or '')}")
            print(f"  membership_type (email): {new_voter.membership_type!r}")
            print(f"  qr_hash (constituency):  {new_voter.qr_hash!r}  len={len(new_voter.qr_hash or '')}")
            print(f"  secret_code_hash (pass): {new_voter.secret_code_hash!r}  len={len(new_voter.secret_code_hash or '')}")
            print(f"  registration_hash:       {new_voter.registration_hash_col!r}  len={len(new_voter.registration_hash_col or '')}")
            print(f"  district_id:             {new_voter.district_id!r}")
        except Exception as e:
            print(f"VOTER CONSTRUCTION FAILED: {e}")
            traceback.print_exc()
            return

        # Now try to add and commit
        print(f"\nAttempting DB add + commit...")
        try:
            db.add(new_voter)
            await db.commit()
            print("  COMMIT SUCCEEDED!")
            # Cleanup
            await db.execute(
                __import__('sqlalchemy').text("DELETE FROM voters WHERE bar_number = '1234500000001'")
            )
            await db.commit()
            print("  Cleanup done.")
        except Exception as e:
            await db.rollback()
            print(f"COMMIT FAILED: {e}")
            traceback.print_exc()

asyncio.run(test_import())
