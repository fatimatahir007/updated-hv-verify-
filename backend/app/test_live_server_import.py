import httpx
import os
import sys
import pandas as pd
import json

sys.path.append(os.path.abspath("backend"))

from app.dependencies import create_admin_token

def main():
    # 1. Generate live admin token
    token = create_admin_token("nadra_live_test", "nadra_officer", 50, is_env_bypass=True)
    headers = {"Authorization": f"Bearer {token}"}
    
    excel_path = "C:/Users/Admin/Desktop/hvverify/hc-verify-main/test_live_voters.xlsx"
    
    # Validation data (validating duplicate db cnic, missing fields, invalid length, unknown district)
    data = [
        # Row 2: Valid (will fail duplicate DB CNIC check because we already cleaned it up)
        {
            "full_name": "Live Test Voter",
            "cnic": "88888-8888888-8",
            "phone": "0300-1111111",
            "constituency": "peshawar",
            "email": "live.test@test.com",
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
        # Row 5: Unknown district
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
    print("Created live test Excel file.")

    try:
        # Send post request to the running uvicorn server on localhost:8000
        url = "http://127.0.0.1:8000/nadra/import-voters"
        print(f"Sending POST to {url}...")
        with open(excel_path, "rb") as f:
            response = httpx.post(
                url,
                headers=headers,
                files={"file": ("test_live_voters.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                timeout=10.0
            )
            
        print(f"Response status: {response.status_code}")
        print("Response JSON:")
        print(json.dumps(response.json(), indent=2))
        
    except Exception as e:
        print(f"Live server request failed: {e}")
    finally:
        if os.path.exists(excel_path):
            os.remove(excel_path)

if __name__ == "__main__":
    main()
