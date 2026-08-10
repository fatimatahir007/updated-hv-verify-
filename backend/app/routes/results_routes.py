from fastapi.security import HTTPAuthorizationCredentials
import os
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.database import get_db
from app.models import Voter, Candidate, Vote, District, AuditLog
from app.schemas import RegisterSchema, AuthRegisterSchema, AuthUpdateSchema, LoginSchema, CandidateCreateSchema, VoteSchema
from app.dependencies import require_admin, security, get_current_voter
from app.utils.security import hash_password, verify_password
from app.utils.jwt_handler import create_access_token
from app.face_service import extract_embedding, match_faces
from app.security_middleware import login_limiter, vote_limiter, register_limiter, audit, validate_registration
import uuid
from datetime import datetime, timezone
import hashlib

def calculate_registration_hash(voter_id: str, cnic: str, full_name: str) -> str:
    return hashlib.sha256(f"{voter_id}{cnic}{full_name}".encode()).hexdigest()

def calculate_vote_hash(voter_id: int, candidate_id: int, receipt_code: str) -> str:
    return hashlib.sha256(f"{voter_id}{candidate_id}{receipt_code}".encode()).hexdigest()

router = APIRouter()

@router.get("/results")
async def results(
    election_id: str = None,
    db: AsyncSession = Depends(get_db)
):
    candidate_query = select(Candidate)
    if election_id:
        try:
            eid = uuid.UUID(election_id)
            candidate_query = candidate_query.where(Candidate.election_id == eid)
        except Exception:
            pass
            
    result = await db.execute(candidate_query)
    candidates = result.scalars().all()
    
    vote_counts = {}
    try:
        vote_query = select(Vote)
        if election_id:
            try:
                eid = uuid.UUID(election_id)
                vote_query = vote_query.where(Vote.election_id == eid)
            except Exception:
                pass
                
        vote_result = await db.execute(vote_query)
        all_votes = vote_result.scalars().all()
        for v in all_votes:
            cid = str(getattr(v, "candidate_id", ""))
            vote_counts[cid] = vote_counts.get(cid, 0) + 1
    except Exception:
        pass

    return [
        {
            "id": str(c.candidate_id),
            "candidate_id": str(c.candidate_id),
            "name": c.full_name,
            "full_name": c.full_name,
            "party": c.party_name,
            "party_name": c.party_name,
            "symbol": c.symbol_name or "",
            "symbol_name": c.symbol_name or "",
            "district": str(c.district_id) if c.district_id else "",
            "constituency": str(c.district_id) if c.district_id else "",
            "votes": vote_counts.get(str(c.candidate_id), 0)
        } for c in candidates
    ]


