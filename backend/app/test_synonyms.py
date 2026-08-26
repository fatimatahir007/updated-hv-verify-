import httpx
import os
import sys
import pandas as pd
import json

sys.path.append(os.path.abspath("backend"))

from app.dependencies import create_admin_token

def main():
    token = create_admin_token("nadra_syn_test", "nadra_officer", 50, is_env_bypass=True)
    headers = {"Authorization": f"Bearer {token}"}
    
    excel_path = "C:/Users/Admin/Desktop/hvverify/hc-verify-main/test_syn_voters.xlsx"
    
    # Capitalized / synonym headers
    data = [
        {
            "Full Name": "Synonym Test Voter",
            "CNIC Number": "77777-7777777-7",
            "Mobile": "0300-9999999",
            "District": "peshawar",
            "Email Address": "syn.test@test.com"
        }
    ]
    
    df = pd.DataFrame(data)
    df.to_excel(excel_path, index=False)
    print("Created synonym headers test Excel file.")

    try:
        url = "http://127.0.0.1:8000/nadra/import-voters"
        print(f"Sending POST to {url}...")
        with open(excel_path, "rb") as f:
            response = httpx.post(
                url,
                headers=headers,
                files={"file": ("test_syn_voters.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                timeout=10.0
            )
            
        print(f"Response status: {response.status_code}")
        print("Response JSON:")
        res_json = response.json()
        print(json.dumps(res_json, indent=2))
        
        assert response.status_code == 200
        assert res_json["inserted"] == 1 or ("already registered" in res_json["errors"][0]["reason"])
        print("\n--- SYNONYM MAPPING TESTS PASSED ---")
        
    except Exception as e:
        print(f"Synonym request failed: {e}")
    finally:
        if os.path.exists(excel_path):
            os.remove(excel_path)

if __name__ == "__main__":
    main()
