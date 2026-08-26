"""
Test the actual /nadra/import-voters endpoint with a real Excel file,
using a real NADRA user token. Captures the exact 500 response body.
"""
import asyncio
import io
import sys
import json
sys.path.insert(0, ".")

import httpx
import pandas as pd

from app.database import AsyncSessionLocal
from app.dependencies import create_admin_token
import sqlalchemy as sa

BASE = "http://127.0.0.1:8000"

def make_test_excel():
    rows = [
        {"full_name": "Debug Voter One", "cnic": "1234599990001",
         "phone": "03001000001", "constituency": "peshawar",
         "email": "debugvoter1@example.com", "polling_station_id": ""},
    ]
    buf = io.BytesIO()
    pd.DataFrame(rows).to_excel(buf, index=False)
    buf.seek(0)
    return buf.read()

async def run():
    # Get voter count before
    async with AsyncSessionLocal() as db:
        r = await db.execute(sa.text("SELECT COUNT(*) FROM voters"))
        count_before = r.scalar()
    print(f"Voters before: {count_before}")

    # Make a NADRA officer token
    nadra_token = create_admin_token("fatima4@gmail.com", "nadra_officer", 50)
    print(f"Using token (first 40 chars): {nadra_token[:40]}...")

    excel_bytes = make_test_excel()

    # Wait for server to be ready
    import time
    for _ in range(10):
        try:
            r = httpx.get(f"{BASE}/docs", timeout=2)
            if r.status_code == 200:
                print("Server is up!")
                break
        except Exception:
            time.sleep(1)
    else:
        print("ERROR: Server not reachable!")
        return

    # 1. OPTIONS preflight
    print("\n--- CORS Preflight ---")
    with httpx.Client() as c:
        pr = c.options(
            f"{BASE}/nadra/import-voters",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            }
        )
    print(f"OPTIONS status: {pr.status_code}")
    print(f"Access-Control-Allow-Origin: {pr.headers.get('access-control-allow-origin', 'MISSING')}")

    # 2. POST import
    print("\n--- POST /nadra/import-voters ---")
    with httpx.Client() as c:
        resp = c.post(
            f"{BASE}/nadra/import-voters",
            headers={
                "Authorization": f"Bearer {nadra_token}",
                "Origin": "http://localhost:5173",
            },
            files={"file": ("voters.xlsx", excel_bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            timeout=20.0
        )
    print(f"POST status: {resp.status_code}")
    print(f"Access-Control-Allow-Origin: {resp.headers.get('access-control-allow-origin', 'MISSING')}")
    print(f"Response body:")
    try:
        print(json.dumps(resp.json(), indent=2))
    except Exception:
        print(repr(resp.text[:1000]))

asyncio.run(run())
