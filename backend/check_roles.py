"""
Check what roles exist in DB and what the NADRA admin token actually contains.
"""
import asyncio
import sys
sys.path.insert(0, ".")

import sqlalchemy as sa
from app.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        # List all roles
        r = await db.execute(sa.text("SELECT role_id, role_name, level FROM roles ORDER BY level"))
        print("=== ALL ROLES IN DB ===")
        for row in r.fetchall():
            print(f"  id={row[0]}  name={row[1]!r:30s}  level={row[2]}")

        # List all users with their roles
        r2 = await db.execute(sa.text("""
            SELECT u.username, u.email, u.is_active, r.role_name 
            FROM users u 
            LEFT JOIN roles r ON u.role_id = r.role_id
            ORDER BY r.level
        """))
        print("\n=== ALL USERS WITH ROLES ===")
        for row in r2.fetchall():
            print(f"  username={row[0]!r:20s}  email={row[1]!r:30s}  active={row[2]}  role={row[3]!r}")

asyncio.run(main())
