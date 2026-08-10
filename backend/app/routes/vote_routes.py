from fastapi.security import HTTPAuthorizationCredentials
import os
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.database import get_db
from app.models import Voter, Candidate, Vote, District, AuditLog, Election
from app.schemas import RegisterSchema, AuthRegisterSchema, AuthUpdateSchema, LoginSchema, CandidateCreateSchema, VoteSchema
from app.dependencies import require_admin, security, get_current_voter
from app.utils.security import hash_password, verify_password
from app.utils.jwt_handler import create_access_token
from app.face_service import extract_embedding, match_faces
from app.security_middleware import login_limiter, vote_limiter, register_limiter, audit, validate_registration, get_client_ip
import uuid
from datetime import datetime, timezone
import hashlib
import random
import string
from jose import jwt, JWTError
from app.utils.jwt_handler import SECRET_KEY as VOTER_JWT_SECRET, ALGORITHM as VOTER_JWT_ALGORITHM
def calculate_registration_hash(voter_id: str, cnic: str, full_name: str) -> str:
    return hashlib.sha256(f"{voter_id}{cnic}{full_name}".encode()).hexdigest()

def calculate_vote_hash(voter_id: int, candidate_id: int, receipt_code: str) -> str:
    return hashlib.sha256(f"{voter_id}{candidate_id}{receipt_code}".encode()).hexdigest()

router = APIRouter()

@router.post("/vote")
async def cast_vote(

    vote: VoteSchema,
    request: Request,
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)

):
    vote_limiter.check(get_client_ip(request))
    
    # Check if there is an active election
    elections_res = await db.execute(select(Election).order_by(Election.created_at.desc()))
    elections = elections_res.scalars().all()
    active_election_exists = False
    active_election_id = None
    # Use current aware local time
    now = datetime.now().astimezone()
    for e in elections:
        # If the database returns naive, treat it as local time
        start_time = e.date if e.date.tzinfo else e.date.astimezone()
        if now >= start_time:
            if e.end_time:
                end_time = e.end_time if e.end_time.tzinfo else e.end_time.astimezone()
                if now <= end_time:
                    active_election_exists = True
                    active_election_id = e.election_id
                    break
            else:
                active_election_exists = True
                active_election_id = e.election_id
                break
                
    if not active_election_exists:
        return {
            "success": False,
            "message": "Voting is closed. No active election available."
        }

    voter = None

    if credentials:
        try:
            payload = jwt.decode(
                credentials.credentials,
                VOTER_JWT_SECRET,
                algorithms=[VOTER_JWT_ALGORITHM]
            )
        except JWTError:
            return {
                "success": False,
                "message": "Invalid token"
            }

        if payload.get("role") != "voter":
            return {
                "success": False,
                "message": "Not authorized"
            }

        voter_id = payload.get("voter_id")
        if voter_id:
            try:
                v_uuid = uuid.UUID(str(voter_id))
                voter_result = await db.execute(
                    select(Voter).where((Voter.voter_id == v_uuid) | (Voter.voter_id == voter_id))
                )
            except Exception:
                voter_result = await db.execute(
                    select(Voter).where(Voter.voter_id == voter_id)
                )
            voter = voter_result.scalars().first()

    if not voter and vote.voter_id:
        try:
            v_uuid = uuid.UUID(str(vote.voter_id))
            voter_result = await db.execute(
                select(Voter).where((Voter.voter_id == v_uuid) | (Voter.voter_id == vote.voter_id))
            )
        except Exception:
            voter_result = await db.execute(
                select(Voter).where(Voter.voter_id == vote.voter_id)
            )
        voter = voter_result.scalars().first()

    if not voter:

        return {

            "success": False,

            "message": "Invalid voter"
        }

    # Prevent double voting per election
    if active_election_id:
        existing_vote_res = await db.execute(select(Vote).where(
            (Vote.ballot_id == str(voter.voter_id)) & (Vote.election_id == active_election_id)
        ))
        if existing_vote_res.scalars().first():
            return {
                "success": False,
                "message": "Vote already cast in this election"
            }

    # Find candidate

    try:
        c_uuid = uuid.UUID(str(vote.candidate_id))
        candidate_result = await db.execute(
            select(Candidate).where(
                (Candidate.candidate_id == c_uuid) | (Candidate.candidate_id == vote.candidate_id)
            )
        )
    except Exception:
        candidate_result = await db.execute(
            select(Candidate).where(
                Candidate.candidate_id == vote.candidate_id
            )
        )

    candidate = candidate_result.scalars().first()

    if not candidate:

        return {

            "success": False,

            "message": "Candidate not found"
        }

    # Enforce district voting if districts are explicitly assigned to both voter and candidate
    voter_district_name = ""
    if voter.district_id:
        v_dist_res = await db.execute(select(District).where(District.district_id == voter.district_id))
        v_dist_obj = v_dist_res.scalars().first()
        if v_dist_obj:
            voter_district_name = v_dist_obj.district_name.strip()
    if not voter_district_name:
        voter_district_name = (getattr(voter, "district", None) or getattr(voter, "constituency", None) or "").strip()

    candidate_district_name = ""
    if candidate.district_id:
        c_dist_res = await db.execute(select(District).where(District.district_id == candidate.district_id))
        c_dist_obj = c_dist_res.scalars().first()
        if c_dist_obj:
            candidate_district_name = c_dist_obj.district_name.strip()

    # Only enforce restriction if both voter and candidate have distinct district names assigned
    if voter_district_name and candidate_district_name:
        v_dist_lower = voter_district_name.lower()
        c_dist_lower = candidate_district_name.lower()
        if v_dist_lower != "general" and c_dist_lower != "general" and v_dist_lower != c_dist_lower:
            raise HTTPException(
                status_code=403,
                detail=f"You can only vote for candidates from your registered district ({voter_district_name})."
            )

    # Generate receipt

    receipt_code = "RCPT-" + ''.join(

        random.choices(
            string.ascii_uppercase + string.digits,
            k=8
        )
    )

    # Generate fake blockchain hash

    blockchain_hash = "0x" + ''.join(

        random.choices(
            "ABCDEF0123456789",
            k=32
        )
    )

    # Resolve polling station
    polling_station_uuid = None
    if hasattr(vote, 'polling_station_id') and vote.polling_station_id:
        try:
            polling_station_uuid = uuid.UUID(str(vote.polling_station_id))
        except Exception:
            pass
    if not polling_station_uuid:
        polling_station_uuid = voter.polling_station_id

    # Save vote

    new_vote = Vote(
        voter_id=str(voter.voter_id),
        candidate_id=str(candidate.candidate_id),
        receipt_code=receipt_code,
        vote_hash=calculate_vote_hash(str(voter.voter_id), str(candidate.candidate_id), receipt_code),
        blockchain_hash=blockchain_hash,
        election_id=active_election_id,
        timestamp=datetime.utcnow(),
        station_id=polling_station_uuid,
        district_id=voter.district_id
    )

    db.add(new_vote)

    # Update totals
    candidate.votes = (candidate.votes or 0) + 1
    # We no longer strictly need to update voter.has_voted, but we can leave it for legacy compatibility
    voter.has_voted = True

    await db.commit()

    cand_name = getattr(candidate, "full_name", None) or getattr(candidate, "name", "Selected Candidate")
    cand_symbol = getattr(candidate, "symbol_name", None) or getattr(candidate, "symbol", "🗳️")

    return {
        "success": True,
        "message": "Vote cast successfully",
        "candidate_name": cand_name,
        "candidate_symbol": cand_symbol,
        "receipt_code": receipt_code,
        "blockchain_hash": blockchain_hash
    }



