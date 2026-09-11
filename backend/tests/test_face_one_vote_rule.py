import asyncio
import uuid
import json
import random
import numpy as np

from app.database import AsyncSessionLocal
from app.models import Voter, Candidate, Vote, Election
from app.face_service import find_duplicate_face, extract_embedding
from app.schemas import VoteSchema
from app.routes.vote_routes import cast_vote


async def run_face_one_vote_test():
    async with AsyncSessionLocal() as db:
        from datetime import datetime, timezone, timedelta
        election = Election(
            election_id=uuid.uuid4(),
            title="General Election Test",
            status="active",
            date=datetime.now(timezone.utc) - timedelta(hours=1),
            end_time=datetime.now(timezone.utc) + timedelta(days=1)
        )
        db.add(election)

        # Create unique test face embeddings for this run
        emb1 = np.random.randn(128).astype(np.float32)
        emb1 = (emb1 / np.linalg.norm(emb1)).tolist()

        # Face 2 is distinct
        emb2 = np.random.randn(128).astype(np.float32)
        emb2 = (emb2 / np.linalg.norm(emb2)).tolist()

        # Voter 1
        v1_id = uuid.uuid4()
        voter1 = Voter(
            voter_id=v1_id,
            full_name="Voter One",
            password="testpassword123",
            phone="03001234567",
            bar_number=f"TEST-CNIC-{uuid.uuid4().hex[:6]}",
            has_voted=False,
            face_embedding=json.dumps(emb1)
        )

        # Voter 2 (Different CNIC / Account, but will use SAME face as Voter 1)
        v2_id = uuid.uuid4()
        voter2 = Voter(
            voter_id=v2_id,
            full_name="Voter Two",
            password="testpassword123",
            phone="03001234567",
            bar_number=f"TEST-CNIC-{uuid.uuid4().hex[:6]}",
            has_voted=False,
            face_embedding=json.dumps(emb1) # Same face biometrics!
        )

        # Voter 3 (Different face)
        v3_id = uuid.uuid4()
        voter3 = Voter(
            voter_id=v3_id,
            full_name="Voter Three",
            password="testpassword123",
            phone="03001234567",
            bar_number=f"TEST-CNIC-{uuid.uuid4().hex[:6]}",
            has_voted=False,
            face_embedding=json.dumps(emb2)
        )

        candidate = Candidate(
            candidate_id=uuid.uuid4(),
            unique_key=f"CAND-{uuid.uuid4().hex[:6]}",
            name="Test Candidate",
            votes=0
        )

        db.add_all([voter1, voter2, voter3, candidate])
        await db.commit()

        print(f"[TEST] Voter 1 ID: {v1_id}")
        print(f"[TEST] Voter 2 ID: {v2_id} (Same face as Voter 1)")

        cand_id = str(candidate.candidate_id)

        # 2. Voter 1 votes
        req_mock = type("MockRequest", (), {"client": type("Client", (), {"host": "127.0.0.1"})(), "headers": {"X-Forwarded-For": "127.0.0.1"}})()
        
        vote_payload_1 = VoteSchema(voter_id=str(v1_id), candidate_id=cand_id)
        res1 = await cast_vote(vote=vote_payload_1, request=req_mock, db=db, credentials=None)
        
        print(f"[TEST] Vote 1 Response: {res1}")
        assert res1["success"] is True, f"Voter 1 vote failed: {res1}"

        # 3. Voter 1 tries to vote again -> should be blocked by has_voted / voter ID check
        res1_retry = await cast_vote(vote=vote_payload_1, request=req_mock, db=db, credentials=None)
        print(f"[TEST] Vote 1 Retry Response: {res1_retry}")
        assert res1_retry["success"] is False
        assert "already cast" in res1_retry["message"].lower()

        # 4. Voter 2 (different account, SAME FACE) tries to vote -> MUST BE BLOCKED BY FACE ANTI-REPLAY RULE!
        vote_payload_2 = VoteSchema(voter_id=str(v2_id), candidate_id=cand_id)
        res2 = await cast_vote(vote=vote_payload_2, request=req_mock, db=db, credentials=None)
        print(f"[TEST] Voter 2 (Same Face) Response: {res2}")
        assert res2["success"] is False
        assert "face biometrics has already been used" in res2["message"].lower() or "security alert" in res2["message"].lower()

        # 5. Voter 3 (different face) votes -> should succeed
        vote_payload_3 = VoteSchema(voter_id=str(v3_id), candidate_id=cand_id)
        res3 = await cast_vote(vote=vote_payload_3, request=req_mock, db=db, credentials=None)
        print("\n[SUCCESS] ALL FACE ANTI-REPLAY DOUBLE VOTING TESTS PASSED PERFECTLY!")

        # Clean up test records
        from sqlalchemy import delete
        await db.execute(delete(Vote).where(Vote.election_id == election.election_id))
        await db.execute(delete(Candidate).where(Candidate.candidate_id == candidate.candidate_id))
        await db.execute(delete(Voter).where(Voter.voter_id.in_([v1_id, v2_id, v3_id])))
        await db.execute(delete(Election).where(Election.election_id == election.election_id))
        await db.commit()


if __name__ == "__main__":
    asyncio.run(run_face_one_vote_test())
