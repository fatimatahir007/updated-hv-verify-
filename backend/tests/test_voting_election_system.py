import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models import Voter, Candidate, Election, District, Vote, AuditLog
from app.routes.vote_routes import cast_vote, VoteSchema
from app.routes.candidate_routes import get_candidates
from app.routes.election_routes import create_election, start_election_now, close_election, ElectionCreate
from main import get_admin_stats
from app.routes.results_routes import results


class MockRequest:
    client = type('obj', (object,), {'host': '127.0.0.1'})
    headers = {}


async def run_all_tests():
    print("\n" + "="*70)
    print("STARTING ELECTION & VOTING SYSTEM TEST SUITE")
    print("="*70)

    async with AsyncSessionLocal() as db:
        # Fetch or create test districts
        res_d = await db.execute(select(District).limit(2))
        districts = res_d.scalars().all()
        if len(districts) < 2:
            d1 = District(district_id=uuid.uuid4(), district_name=f"District Test A {uuid.uuid4().hex[:4]}")
            d2 = District(district_id=uuid.uuid4(), district_name=f"District Test B {uuid.uuid4().hex[:4]}")
            db.add(d1); db.add(d2)
            await db.commit()
        else:
            d1, d2 = districts[0], districts[1]

        d1_id = d1.district_id
        d2_id = d2.district_id

        # Fetch an existing voter to use
        voter_res = await db.execute(select(Voter).limit(1))
        voter = voter_res.scalars().first()
        voter_uuid = voter.voter_id
        voter_id_str = str(voter_uuid)

        voter.district_id = d1_id
        voter.has_voted = False
        voter.voted_at = None
        await db.commit()

        # -------------------------------------------------------------
        # TEST 1: Vote from Correct District -> Should Succeed
        # -------------------------------------------------------------
        print("\n[TEST 1] Testing Correct District Vote...")
        elec1 = Election(
            election_id=uuid.uuid4(),
            title=f"Election Test Suite 1 - {uuid.uuid4().hex[:4]}",
            date=datetime.now(timezone.utc) - timedelta(minutes=2),
            end_time=datetime.now(timezone.utc) + timedelta(days=2),
            status="Active"
        )
        db.add(elec1)
        await db.commit()
        elec1_id = elec1.election_id

        cand_match = Candidate(
            candidate_id=uuid.uuid4(),
            full_name="Matched Candidate A",
            party_name="Party Alpha",
            district_id=d1_id,
            election_id=elec1_id
        )
        db.add(cand_match)
        await db.commit()
        cand_match_id = cand_match.candidate_id

        payload1 = VoteSchema(
            voter_id=voter_id_str,
            candidate_id=str(cand_match_id)
        )
        res1 = await cast_vote(vote=payload1, request=MockRequest(), db=db, credentials=None)
        print("  -> Result:", res1)
        assert res1["success"] is True, f"Expected success but got: {res1}"
        assert "receipt_code" in res1
        assert res1["receipt_code"].startswith("RCPT-")

        # Verify ballot in DB
        v_check = await db.execute(select(Vote).where(
            (Vote.ballot_id == voter_id_str) & (Vote.election_id == elec1_id)
        ))
        assert v_check.scalars().first() is not None
        print("  [OK] PASS: Correct district vote successfully cast and recorded.")

        # -------------------------------------------------------------
        # TEST 2: Vote from Mismatched District -> Should be Rejected
        # -------------------------------------------------------------
        print("\n[TEST 2] Testing Mismatched District Vote...")
        cand_mismatch = Candidate(
            candidate_id=uuid.uuid4(),
            full_name="Mismatched Candidate B",
            party_name="Party Beta",
            district_id=d2_id, # Different district!
            election_id=elec1_id
        )
        db.add(cand_mismatch)
        await db.commit()
        cand_mismatch_id = cand_mismatch.candidate_id

        # Reset voter voting status for this test
        # Fetch fresh voter object
        v_fresh_res = await db.execute(select(Voter).where(Voter.voter_id == voter_uuid))
        v_fresh = v_fresh_res.scalars().first()
        v_fresh.has_voted = False
        v_fresh.district_id = d1_id
        # Remove previous test vote so duplicate check doesn't trigger first
        await db.execute(Vote.__table__.delete().where(
            (Vote.ballot_id == voter_id_str) & (Vote.election_id == elec1_id)
        ))
        await db.commit()

        payload2 = VoteSchema(
            voter_id=voter_id_str,
            candidate_id=str(cand_mismatch_id)
        )
        res2 = await cast_vote(vote=payload2, request=MockRequest(), db=db, credentials=None)
        print("  -> Result:", res2)
        assert res2["success"] is False
        assert "not eligible to vote in this district" in res2["message"] or "District Mismatch" in res2["message"]

        # Verify no vote was recorded in database
        v_check2 = await db.execute(select(Vote).where(
            (Vote.ballot_id == voter_id_str) & (Vote.election_id == elec1_id)
        ))
        assert v_check2.scalars().first() is None, "Vote should NOT be recorded in DB on district mismatch!"
        print("  [OK] PASS: Mismatched district vote was strictly rejected and NOT recorded.")

        # -------------------------------------------------------------
        # TEST 3: Starting New Election -> Isolates Data & Candidates
        # -------------------------------------------------------------
        print("\n[TEST 3] Testing New Election Data Isolation...")
        # Close old election
        await close_election(election_id=elec1_id, db=db)

        # Create new election
        new_elec_payload = ElectionCreate(
            title=f"Brand New Election {uuid.uuid4().hex[:4]}",
            date=datetime.now(timezone.utc) - timedelta(minutes=1),
            status="Active"
        )
        elec2 = await create_election(payload=new_elec_payload, db=db)
        elec2_id = elec2.election_id
        print(f"  -> Created new election: {elec2.title} (ID: {elec2_id})")

        # Check that candidates from elec1 do NOT appear in active candidates query
        active_cands = await get_candidates(db=db)
        active_cand_ids = [c["id"] for c in active_cands]
        assert str(cand_match_id) not in active_cand_ids
        assert str(cand_mismatch_id) not in active_cand_ids

        # Check stats for new active election
        stats_new = await get_admin_stats(db=db, _={})
        print("  -> Admin Stats for New Election:", stats_new)
        assert stats_new["votes_cast"] == 0, f"Expected 0 votes in new election, got {stats_new['votes_cast']}"
        assert stats_new["turnout"] == 0.0

        # Check voters biometric and vote status reset
        v_check_reset_res = await db.execute(select(Voter).where(Voter.voter_id == voter_uuid))
        v_check_reset = v_check_reset_res.scalars().first()
        assert v_check_reset.has_voted is False
        assert v_check_reset.face_embedding is None
        print("  [OK] PASS: New election created with clean isolated state (0 votes, old candidates hidden).")

        # -------------------------------------------------------------
        # TEST 4: Duplicate Vote Attempt -> Should be Blocked
        # -------------------------------------------------------------
        print("\n[TEST 4] Testing Duplicate Vote Prevention...")
        cand_elec2 = Candidate(
            candidate_id=uuid.uuid4(),
            full_name="Candidate Election 2",
            party_name="Party Gamma",
            district_id=d1_id,
            election_id=elec2_id
        )
        db.add(cand_elec2)
        await db.commit()
        cand_elec2_id = cand_elec2.candidate_id

        v_check_reset.district_id = d1_id
        v_check_reset.has_voted = False
        await db.commit()

        payload_dup = VoteSchema(
            voter_id=voter_id_str,
            candidate_id=str(cand_elec2_id)
        )
        # Attempt 1: First Vote
        res_dup_1 = await cast_vote(vote=payload_dup, request=MockRequest(), db=db, credentials=None)
        assert res_dup_1["success"] is True, f"First vote should succeed: {res_dup_1}"

        # Attempt 2: Duplicate Vote by same voter in same election
        res_dup_2 = await cast_vote(vote=payload_dup, request=MockRequest(), db=db, credentials=None)
        print("  -> Duplicate Attempt Result:", res_dup_2)
        assert res_dup_2["success"] is False
        assert "already cast" in res_dup_2["message"].lower() or "duplicate" in res_dup_2["message"].lower()

        # Check DB only has 1 vote
        votes_count_res = await db.execute(select(Vote).where(
            (Vote.ballot_id == voter_id_str) & (Vote.election_id == elec2_id)
        ))
        all_voter_votes = votes_count_res.scalars().all()
        assert len(all_voter_votes) == 1, f"Expected exactly 1 vote in DB, found {len(all_voter_votes)}"
        print("  [OK] PASS: Duplicate vote attempt was successfully blocked.")

        # -------------------------------------------------------------
        # TEST 5: Malformed / Invalid Requests -> No Server Crashes
        # -------------------------------------------------------------
        print("\n[TEST 5] Testing Malformed & Invalid Input Handling...")
        # A. Non-existent candidate
        payload_bad_cand = VoteSchema(
            voter_id=voter_id_str,
            candidate_id=str(uuid.uuid4()) # Non-existent candidate UUID
        )
        res_bad_cand = await cast_vote(vote=payload_bad_cand, request=MockRequest(), db=db, credentials=None)
        assert res_bad_cand["success"] is False
        assert "not found" in res_bad_cand["message"].lower()

        # B. Non-existent voter
        payload_bad_voter = VoteSchema(
            voter_id=str(uuid.uuid4()), # Non-existent voter UUID
            candidate_id=str(cand_elec2_id)
        )
        res_bad_voter = await cast_vote(vote=payload_bad_voter, request=MockRequest(), db=db, credentials=None)
        assert res_bad_voter["success"] is False
        assert "invalid voter" in res_bad_voter["message"].lower() or "authentication" in res_bad_voter["message"].lower()

        # C. Empty candidate ID
        payload_empty = VoteSchema(
            voter_id=voter_id_str,
            candidate_id=""
        )
        res_empty = await cast_vote(vote=payload_empty, request=MockRequest(), db=db, credentials=None)
        assert res_empty["success"] is False
        print("  [OK] PASS: All malformed and invalid inputs handled safely without 500 errors.")

        # -------------------------------------------------------------
        # Cleanup Test Data
        # -------------------------------------------------------------
        print("\nCleaning up test data...")
        await db.execute(Candidate.__table__.delete().where(
            (Candidate.candidate_id == cand_match_id) |
            (Candidate.candidate_id == cand_mismatch_id) |
            (Candidate.candidate_id == cand_elec2_id)
        ))
        await db.execute(Vote.__table__.delete().where(
            (Vote.election_id == elec1_id) | (Vote.election_id == elec2_id)
        ))
        await db.execute(Election.__table__.delete().where(
            (Election.election_id == elec1_id) | (Election.election_id == elec2_id)
        ))
        v_final_res = await db.execute(select(Voter).where(Voter.voter_id == voter_uuid))
        v_final = v_final_res.scalars().first()
        if v_final:
            v_final.has_voted = False
            v_final.voted_at = None
        await db.commit()

        print("\n" + "="*70)
        print(">>> ALL 5 TESTS PASSED 100%! SYSTEM IS FULLY HARDENED.")
        print("="*70 + "\n")


if __name__ == "__main__":
    asyncio.run(run_all_tests())
