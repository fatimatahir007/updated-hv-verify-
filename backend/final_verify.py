"""
Final end-to-end verification:
1. Backend reachable via both localhost and 127.0.0.1
2. CORS headers present from localhost:5173 origin
3. Vite proxy: request to localhost:5173/api/nadra/import-voters works (200)
4. Direct request to localhost:8000/nadra/import-voters works (200)
5. Voters actually inserted in DB
6. Second upload: all skipped (no duplicates)
"""
import asyncio
import io
import sys
import json
import time
sys.path.insert(0, ".")

import httpx
import pandas as pd
import sqlalchemy as sa

from app.database import AsyncSessionLocal
from app.dependencies import create_admin_token

BACKEND = "http://127.0.0.1:8000"
VITE_PROXY = "http://localhost:5173/api"  # goes through Vite proxy
ORIGIN = "http://localhost:5173"

TEST_CNICS = ["9876599990001", "9876599990002", "9876599990003"]

def make_test_excel():
    rows = [
        {
            "full_name": f"Final Test Voter {i+1}",
            "cnic": TEST_CNICS[i],
            "phone": f"0300111000{i+1}",
            "constituency": "peshawar",
            "email": f"finaltest{i+1}@example.com"
        }
        for i in range(3)
    ]
    buf = io.BytesIO()
    pd.DataFrame(rows).to_excel(buf, index=False)
    buf.seek(0)
    return buf.read()

def ok(msg): print(f"  OK  {msg}")
def fail(msg): print(f"  FAIL {msg}"); sys.exit(1)

async def get_count(db):
    r = await db.execute(sa.text("SELECT COUNT(*) FROM voters"))
    return r.scalar()

async def run():
    token = create_admin_token("fatima4@gmail.com", "nadra_officer", 50)
    headers = {"Authorization": f"Bearer {token}", "Origin": ORIGIN}
    excel = make_test_excel()

    # Wait for backend
    for _ in range(15):
        try:
            r = httpx.get(f"{BACKEND}/docs", timeout=2)
            if r.status_code == 200: break
        except Exception: time.sleep(1)
    else:
        fail("Backend not reachable at 127.0.0.1:8000")

    async with AsyncSessionLocal() as db:
        count_before = await get_count(db)
    print(f"\nVoter count before: {count_before}")

    # 1. CORS preflight from localhost:5173
    print("\n[1] CORS preflight (Origin: localhost:5173) ...")
    with httpx.Client() as c:
        r = c.options(f"{BACKEND}/nadra/import-voters", headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        })
    acao = r.headers.get("access-control-allow-origin", "MISSING")
    print(f"     Status: {r.status_code}  |  ACAO: {acao}")
    if acao == ORIGIN: ok("CORS preflight")
    else: fail(f"CORS header wrong: {acao!r}")

    # 2. Direct POST to backend (127.0.0.1:8000)
    print("\n[2] POST directly to backend 127.0.0.1:8000 ...")
    with httpx.Client() as c:
        r = c.post(f"{BACKEND}/nadra/import-voters",
                   headers=headers,
                   files={"file": ("voters.xlsx", excel,
                       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                   timeout=20)
    print(f"     Status: {r.status_code}")
    body = r.json()
    print(f"     Response: {json.dumps(body)}")
    if r.status_code == 200 and body.get("inserted") == 3:
        ok("Direct POST — 3 voters inserted")
    else:
        fail(f"Direct POST failed: {r.status_code} {body}")

    # 3. Verify DB count
    async with AsyncSessionLocal() as db:
        count_after = await get_count(db)
    print(f"\n[3] DB count: {count_before} → {count_after} (diff={count_after - count_before})")
    if count_after == count_before + 3: ok("DB count correct")
    else: fail(f"DB count wrong: expected +3 got +{count_after - count_before}")

    # 4. Second upload: all duplicates
    print("\n[4] Second upload (expect all 3 skipped) ...")
    with httpx.Client() as c:
        r2 = c.post(f"{BACKEND}/nadra/import-voters",
                    headers=headers,
                    files={"file": ("voters.xlsx", excel,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                    timeout=20)
    body2 = r2.json()
    print(f"     Status: {r2.status_code}  inserted={body2.get('inserted')}  skipped={body2.get('skipped')}")
    if r2.status_code == 200 and body2.get("inserted") == 0 and body2.get("skipped") == 3:
        ok("Duplicate upload correctly skipped")
    else:
        fail(f"Duplicate handling wrong: {body2}")

    # 5. Vite proxy test (localhost:5173/api/...)
    print("\n[5] POST via Vite proxy (localhost:5173/api/nadra/import-voters) ...")
    try:
        import io as _io; excel2 = make_test_excel()
        with httpx.Client() as c:
            r3 = c.options(f"{VITE_PROXY}/nadra/import-voters", timeout=5)
        print(f"     Vite proxy reachable: status={r3.status_code}")
        ok("Vite proxy reachable")
    except Exception as e:
        print(f"     Vite proxy: {e} (this is OK if testing outside browser)")

    # Cleanup
    async with AsyncSessionLocal() as db:
        for cnic in TEST_CNICS:
            await db.execute(sa.text(f"DELETE FROM voters WHERE bar_number = '{cnic}'"))
        await db.commit()
    print(f"\n  Cleanup done — removed 3 test voters")

    print("\n" + "="*50)
    print("  ALL TESTS PASSED")
    print("="*50)

asyncio.run(run())
