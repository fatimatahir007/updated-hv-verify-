import asyncio
import os
import sys
import httpx
import pandas as pd

sys.path.append(os.path.abspath("backend"))

from main import app
from app.database import AsyncSessionLocal
from app.models import Voter
from sqlalchemy import text
from app.dependencies import create_admin_token

async def test_validation_errors():
    token = create_admin_token("nadra_val_test", "nadra_officer", 50, is_env_bypass=True)
    headers = {"Authorization": f"Bearer {token}"}
    
    excel_path = "C:/Users/Admin/Desktop/hvverify/hc-verify-main/test_validation_voters.xlsx"
    
    # We will create an Excel sheet with:
    # Row 2 (Index 0): Valid voter (will be inserted)
    # Row 3 (Index 1): Missing full_name (should fail validation 1)
    # Row 4 (Index 2): Invalid CNIC length (should fail validation 2)
    # Row 5 (Index 3): Duplicate CNIC in the same file (should fail validation 3)
    # Row 6 (Index 4): Duplicate CNIC in database (should fail validation 4)
    # Row 7 (Index 5): Unknown district (should fail validation 5)
    
    test_cnic_valid = "88888-8888888-8"
    clean_cnic_valid = "8888888888888"
    
    # Let's find an existing CNIC in the DB to use as a duplicate
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT bar_number FROM voters LIMIT 1"))
        existing_cnic = res.scalar() or "1111122222333"
        print(f"Using existing CNIC from database for duplicate test: {existing_cnic}")

    data = [
        # Row 2: Valid
        {
            "full_name": "Valid Test Voter",
            "cnic": test_cnic_valid,
            "phone": "0300-1111111",
            "constituency": "peshawar",
            "email": "valid.test@test.com",
            "polling_station_id": None
        },
        # Row 3: Missing full_name
        {
            "full_name": "",
            "cnic": "99999-1111111-1",
            "phone": "0300-2222222",
            "constituency": "peshawar",
            "email": "invalid1@test.com",
            "polling_station_id": None
        },
        # Row 4: Invalid CNIC length
        {
            "full_name": "Invalid CNIC Length",
            "cnic": "12345",
            "phone": "0300-3333333",
            "constituency": "peshawar",
            "email": "invalid2@test.com",
            "polling_station_id": None
        },
        # Row 5: Duplicate CNIC in same file
        {
            "full_name": "Duplicate File Voter",
            "cnic": test_cnic_valid,
            "phone": "0300-4444444",
            "constituency": "peshawar",
            "email": "invalid3@test.com",
            "polling_station_id": None
        },
        # Row 6: Duplicate CNIC in database
        {
            "full_name": "Duplicate DB Voter",
            "cnic": existing_cnic,
            "phone": "0300-5555555",
            "constituency": "peshawar",
            "email": "invalid4@test.com",
            "polling_station_id": None
        },
        # Row 7: Unknown district
        {
            "full_name": "Unknown District Voter",
            "cnic": "88888-8888888-0",
            "phone": "0300-6666666",
            "constituency": "Karachi",
            "email": "invalid5@test.com",
            "polling_station_id": None
        }
    ]
    
    df = pd.DataFrame(data)
    df.to_excel(excel_path, index=False)
    print("Created validation test Excel file.")

    # Pre-cleanup database check
    async with AsyncSessionLocal() as db:
        await db.execute(text(f"DELETE FROM voters WHERE bar_number = '{clean_cnic_valid}'"))
        await db.commit()

    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            print("\nUploading validation Excel file...")
            with open(excel_path, "rb") as f:
                response = await client.post(
                    "/nadra/import-voters",
                    headers=headers,
                    files={"file": ("test_validation_voters.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
                )
            
            print(f"Response status: {response.status_code}")
            res_json = response.json()
            print("Response JSON:")
            import json
            print(json.dumps(res_json, indent=2))
            
            assert response.status_code == 200
            assert res_json["inserted"] == 1
            assert res_json["skipped"] == 5
            
            errors = res_json["errors"]
            assert len(errors) == 5
            
            # Check row numbers and failure reasons
            assert errors[0]["row"] == 3
            assert "Missing required field" in errors[0]["reason"]
            
            assert errors[1]["row"] == 4
            assert "CNIC must be exactly 13 digits" in errors[1]["reason"]
            
            assert errors[2]["row"] == 5
            assert "Duplicate CNIC in the same Excel file" in errors[2]["reason"]
            
            assert errors[3]["row"] == 6
            assert "already registered" in errors[3]["reason"]
            
            assert errors[4]["row"] == 7
            assert "not found in the database" in errors[4]["reason"]
            
            print("\n--- ALL VALIDATION TESTS PASSED ---")
            
    finally:
        # Cleanup
        if os.path.exists(excel_path):
            os.remove(excel_path)
            
        async with AsyncSessionLocal() as db:
            await db.execute(text(f"DELETE FROM voters WHERE bar_number = '{clean_cnic_valid}'"))
            await db.commit()
            print("Cleanup completed.")

if __name__ == "__main__":
    asyncio.run(test_validation_errors())
