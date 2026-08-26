import asyncio
import os
import sys

sys.path.append(os.path.abspath("backend"))

from app.database import AsyncSessionLocal
from app.models import Voter, Vote
from sqlalchemy import text
from sqlalchemy.future import select

async def main():
    async with AsyncSessionLocal() as db:
        # 1. Fetch all voters
        res = await db.execute(select(Voter))
        voters = res.scalars().all()
        print(f"Total voters in database: {len(voters)}")
        
        # 2. Group by clean CNIC
        groups = {}
        for v in voters:
            clean = v.bar_number.strip().replace("-", "").replace(" ", "")
            groups.setdefault(clean, []).append(v)
            
        to_delete_ids = []
        to_update = []
        
        for clean_cnic, records in groups.items():
            if len(records) > 1:
                # Deduplicate: sort to find the best one to keep
                # Priority: 
                # 1. has_voted == True
                # 2. password (secret_code_hash) not empty
                # 3. registration_time (keep first/older)
                sorted_records = sorted(
                    records,
                    key=lambda r: (
                        1 if r.has_voted else 0,
                        1 if (r.password and r.password.strip() != "") else 0,
                        -r.created_at.timestamp() if r.created_at else 0
                    ),
                    reverse=True
                )
                keep = sorted_records[0]
                duplicates = sorted_records[1:]
                
                print(f"CNIC {clean_cnic}: Keeping voter ID {keep.id} ({keep.full_name}). Deleting {len(duplicates)} duplicates.")
                for d in duplicates:
                    to_delete_ids.append(d.id)
                
                # Update the kept one to clean CNIC
                if keep.bar_number != clean_cnic:
                    keep.bar_number = clean_cnic
                    to_update.append(keep)
            else:
                # Only one record, just clean its CNIC
                v = records[0]
                if v.bar_number != clean_cnic:
                    v.bar_number = clean_cnic
                    to_update.append(v)
                    
        # 3. Perform Deletions and Updates
        if to_delete_ids:
            print(f"\nDeleting {len(to_delete_ids)} duplicate voters...")
            # Format UUIDs for raw SQL
            ids_str = ", ".join(f"'{str(i)}'" for i in to_delete_ids)
            # Delete associated votes first to avoid foreign key violations
            await db.execute(text(f"DELETE FROM votes WHERE ballot_id IN ({ids_str})"))
            await db.execute(text(f"DELETE FROM voters WHERE voter_id IN ({ids_str})"))
            
        if to_update:
            print(f"Updating {len(to_update)} voters with clean CNICs...")
            for v in to_update:
                db.add(v)
                
        await db.commit()
        print("\nDeduplication and CNIC cleaning completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
