import sqlite3
import os

db_path = 'hc_verify.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    tables = [row[0] for row in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    print("Tables:", tables)
    if 'polling_stations' in tables:
        count = c.execute("SELECT count(*) FROM polling_stations").fetchone()[0]
        print("polling_stations count:", count)
        rows = c.execute("SELECT * FROM polling_stations").fetchall()
        print("Rows:", rows)
    if 'districts' in tables:
        count = c.execute("SELECT count(*) FROM districts").fetchone()[0]
        print("districts count:", count)
        rows = c.execute("SELECT * FROM districts").fetchall()
        print("District Rows:", rows)
else:
    print("hc_verify.db does not exist in cwd")
