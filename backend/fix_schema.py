import sqlite3
import os

db_path = 'hc_verify.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # 1. elections table columns
    if 'elections' in [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        election_cols = [info[1] for info in c.execute("PRAGMA table_info(elections)").fetchall()]
        if 'start_time' not in election_cols:
            try: c.execute("ALTER TABLE elections ADD COLUMN start_time DATETIME")
            except Exception: pass
        if 'end_time' not in election_cols:
            try: c.execute("ALTER TABLE elections ADD COLUMN end_time DATETIME")
            except Exception: pass
        if 'polling_station_id' not in election_cols:
            try: c.execute("ALTER TABLE elections ADD COLUMN polling_station_id VARCHAR")
            except Exception: pass

    # 2. districts table columns
    if 'districts' in [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        district_cols = [info[1] for info in c.execute("PRAGMA table_info(districts)").fetchall()]
        if 'state_id' not in district_cols:
            try: c.execute("ALTER TABLE districts ADD COLUMN state_id VARCHAR")
            except Exception: pass

    # 3. users table columns
    if 'users' in [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        user_cols = [info[1] for info in c.execute("PRAGMA table_info(users)").fetchall()]
        user_additions = [
            ('invite_token_hash', 'VARCHAR'),
            ('invite_expires_at', 'DATETIME'),
            ('state_id', 'VARCHAR'),
            ('polling_station_id', 'VARCHAR'),
            ('permissions', 'TEXT')
        ]
        for col_name, col_type in user_additions:
            if col_name not in user_cols:
                try: c.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
                except Exception: pass

    # 4. roles table columns
    if 'roles' in [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        role_cols = [info[1] for info in c.execute("PRAGMA table_info(roles)").fetchall()]
        print("roles columns before:", role_cols)
        if 'level' not in role_cols:
            try:
                c.execute("ALTER TABLE roles ADD COLUMN level INTEGER")
                print("Added level column to roles table.")
            except Exception as e:
                print("Error adding level to roles:", e)

    conn.commit()
    conn.close()
    print("Schema fix completed!")
