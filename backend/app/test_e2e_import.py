"""
End-to-end verification:
1. OPTIONS preflight returns Access-Control-Allow-Origin: http://localhost:5173
2. POST /nadra/import-voters inserts new voters (200, inserted > 0)
3. Second POST with same file skips all (200, inserted = 0, skipped = same count)
4. DB count increased by expected amount
"""
import sys, os, json, httpx, asyncio, pandas as pd, tempfile
sys.path.append(os.path.abspath("backend"))

from app.dependencies import create_admin_token
from app.database import AsyncSessionLocal
from sqlalchemy import text

BASE = "http://127.0.0.1:8000"
ORIGIN = "http://localhost:5173"

def make_token():
    return create_admin_token("e2e_test", "nadra_officer", 50, is_env_bypass=True)

def make_excel(path: str):
    rows = [
        {"full_name": f"E2E Voter {i}", "cnic": f"3333{i:09d}", "phone": f"030000{i:05d}",
         "constituency": "peshawar", "email": f"e2etest{i}@test.com"}
        for i in range(1, 6)  # 5 unique test voters
    ]
    pd.DataFrame(rows).to_excel(path, index=False)

async def get_voter_count(db):
    r = await db.execute(text("SELECT count(*) FROM voters"))
    return r.scalar()

async def run():
    token = make_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    excel_path = tempfile.mktemp(suffix=".xlsx")
    make_excel(excel_path)
    
    async with AsyncSessionLocal() as db:
        count_before = await get_voter_count(db)
    
    print(f"\n[0] Voters in DB before test: {count_before}")
    
    # ---- Step 1: CORS Preflight ----
    print("\n[1] Testing OPTIONS preflight from http://localhost:5173 ...")
    with httpx.Client() as c:
        r = c.options(
            f"{BASE}/nadra/import-voters",
            headers={
                "Origin": ORIGIN,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Authorization,Content-Type",
            }
        )
    acao = r.headers.get("access-control-allow-origin", "MISSING")
    print(f"    Preflight status : {r.status_code}")
    print(f"    Access-Control-Allow-Origin : {acao}")
    assert acao == ORIGIN, f"CORS FAILED — header is '{acao}'"
    print("    ✅ CORS preflight PASSED")

    # ---- Step 2: First POST (should insert 5) ----
    print("\n[2] First POST — expecting 5 inserts ...")
    with open(excel_path, "rb") as f:
        r2 = httpx.post(
            f"{BASE}/nadra/import-voters",
            headers={**headers, "Origin": ORIGIN},
            files={"file": ("voters.xlsx", f,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            timeout=15.0
        )
    print(f"    Status : {r2.status_code}")
    body2 = r2.json()
    print("    Response:", json.dumps(body2, indent=4))
    assert r2.status_code == 200, f"Expected 200 got {r2.status_code}: {r2.text}"
    assert body2["inserted"] == 5, f"Expected 5 inserted, got {body2['inserted']}"
    print("    ✅ First upload PASSED — 5 voters inserted")

    # ---- Step 3: Second POST (all duplicates) ----
    print("\n[3] Second POST — expecting 5 skipped (all duplicates) ...")
    with open(excel_path, "rb") as f:
        r3 = httpx.post(
            f"{BASE}/nadra/import-voters",
            headers={**headers, "Origin": ORIGIN},
            files={"file": ("voters.xlsx", f,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            timeout=15.0
        )
    body3 = r3.json()
    print(f"    Status : {r3.status_code}")
    print("    Response:", json.dumps(body3, indent=4))
    assert r3.status_code == 200
    assert body3["inserted"] == 0
    assert body3["skipped"] == 5
    print("    ✅ Second upload PASSED — 5 duplicates correctly skipped")

    # ---- Step 4: DB count ----
    async with AsyncSessionLocal() as db:
        count_after = await get_voter_count(db)
    print(f"\n[4] DB count after: {count_after} (was {count_before}, diff = {count_after - count_before})")
    assert count_after == count_before + 5
    print("    ✅ DB count increased by exactly 5")

    # ---- Cleanup ----
    async with AsyncSessionLocal() as db:
        for i in range(1, 6):
            await db.execute(text(f"DELETE FROM voters WHERE bar_number = '3333{i:09d}'"))
        await db.commit()
    os.remove(excel_path)
    print("\n✅ ALL END-TO-END TESTS PASSED ✅\n")

if __name__ == "__main__":
    asyncio.run(run())
