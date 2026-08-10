import sqlite3
import uuid
from datetime import datetime, timezone

db_path = "backend/hc_verify.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Create an active election
election_id = str(uuid.uuid4())
title = "Teacher Demo Election"
start_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

c.execute("INSERT INTO elections (election_id, title, date, status) VALUES (?, ?, ?, ?)", (election_id, title, start_time, "Active"))

# Create 2 candidates
candidate1_id = str(uuid.uuid4())
c.execute("INSERT INTO candidates (id, name, party, district, symbol, unique_key, election_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
          (candidate1_id, "Candidate A", "Party X", "District 1", "🦁", "CAND-A", election_id))

candidate2_id = str(uuid.uuid4())
c.execute("INSERT INTO candidates (id, name, party, district, symbol, unique_key, election_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
          (candidate2_id, "Candidate B", "Party Y", "District 1", "🦅", "CAND-B", election_id))

conn.commit()
conn.close()
print("Active election and candidates created successfully!")
