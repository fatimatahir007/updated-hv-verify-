import httpx
import os
import sys

sys.path.append(os.path.abspath("backend"))

from app.dependencies import create_admin_token

def main():
    token = create_admin_token("nadra_boundary_test", "nadra_officer", 50, is_env_bypass=True)
    
    # We explicitly set "Content-Type" to "multipart/form-data" manually (simulating the Axios bug)
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "multipart/form-data"
    }
    
    url = "http://127.0.0.1:8000/nadra/import-voters"
    print(f"Sending POST to {url} with manual Content-Type...")
    
    try:
        # Send raw bytes simulating a file upload but without boundary in Content-Type
        response = httpx.post(
            url,
            headers=headers,
            content=b"some raw data",
            timeout=10.0
        )
        print(f"Response status: {response.status_code}")
        print("Response JSON:")
        print(response.json())
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    main()
