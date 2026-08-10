from fastapi.security import HTTPAuthorizationCredentials
import os
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.database import get_db
from app.models import Voter, Candidate, Vote, District, AuditLog, District, AuditLog
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

@router.get("/candidates")
async def get_candidates(
    district: str = None,
    voter_id: str = None,
    election_id: str = None,
    db: AsyncSession = Depends(get_db)
):

    target_district_id = None
    target_district_name = None

    if voter_id:
        try:
            v_uuid = uuid.UUID(str(voter_id))
            v_res = await db.execute(select(Voter).where((Voter.voter_id == v_uuid) | (Voter.voter_id == voter_id)))
        except Exception:
            v_res = await db.execute(select(Voter).where(Voter.voter_id == voter_id))
        v_obj = v_res.scalars().first()
        if v_obj:
            if v_obj.district_id:
                target_district_id = v_obj.district_id
            if v_obj.district:
                target_district_name = v_obj.district.lower().strip()

    if district:
        target_district_name = district.lower().strip()

    try:
        result = await db.execute(
            select(Candidate)
        )
        all_candidates = result.scalars().all()
    except Exception:
        # Fallback: if unique_key column doesn't exist yet, select without it
        await db.rollback()
        from sqlalchemy import text
        raw = await db.execute(text("SELECT candidate_id, full_name, party_name, symbol_name, district_id, election_id, bar_number, photo_url, public_key FROM candidates"))
        rows = raw.fetchall()
        class _C:
            pass
        all_candidates = []
        for r in rows:
            c = _C()
            c.candidate_id = r[0]; c.full_name = r[1]; c.party_name = r[2]; c.symbol_name = r[3]; c.district_id = r[4]; c.election_id = r[5]
            all_candidates.append(c)

    districts_res = await db.execute(select(District))
    districts_map = {d.district_id: d.district_name for d in districts_res.scalars().all()}

    filtered_candidates = []
    for c in all_candidates:
        if election_id:
            c_eid_str = str(c.election_id) if hasattr(c, 'election_id') and c.election_id else None
            if c_eid_str != election_id:
                # If election_id is provided, only show candidates explicitly assigned to this election
                continue

        c_district_name = districts_map.get(c.district_id, "").lower().strip()
        c_district_id = c.district_id
        
        if target_district_id or target_district_name:
            matches_id = target_district_id and c_district_id and str(target_district_id) == str(c_district_id)
            matches_name = target_district_name and c_district_name and target_district_name == c_district_name
            if matches_id or matches_name:
                filtered_candidates.append(c)
        else:
            filtered_candidates.append(c)

    return [
        {
            "id": str(c.candidate_id),
            "candidate_id": str(c.candidate_id),
            "name": c.full_name,
            "party": c.party_name,
            "symbol": c.symbol_name,
            "district": districts_map.get(c.district_id, str(c.district_id) if c.district_id else ""),
            "district_id": str(c.district_id) if c.district_id else "",
            "constituency": districts_map.get(c.district_id, str(c.district_id) if c.district_id else ""),
            "unique_key": getattr(c, 'unique_key', None) or "",
            "votes": 0
        } for c in filtered_candidates
    ]



@router.post("/candidates")
async def create_candidate(
    candidate: CandidateCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin)
):
    name_clean = (candidate.name or "").strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Candidate name is required")

    unique_key_clean = (candidate.unique_key or "").strip()
    if unique_key_clean:
        try:
            existing_key = await db.execute(select(Candidate).where(func.lower(Candidate.unique_key) == unique_key_clean.lower()))
            if existing_key.scalars().first():
                raise HTTPException(status_code=409, detail=f"A candidate with unique key '{unique_key_clean}' already exists. Duplicate candidates are not allowed.")
        except HTTPException:
            raise
        except Exception:
            await db.rollback()

    try:
        existing = await db.execute(select(Candidate).where(func.lower(Candidate.full_name) == name_clean.lower()))
        existing_cand = existing.scalars().first()
    except Exception:
        await db.rollback()
        existing_cand = None
        
    # If no unique key was provided, we do a legacy name-based deduplication
    if existing_cand and not unique_key_clean:
        return {
            "success": True,
            "message": "Candidate already exists by name",
            "candidate_id": str(existing_cand.candidate_id),
            "id": str(existing_cand.candidate_id),
            "name": existing_cand.full_name,
            "party": existing_cand.party_name,
            "symbol": existing_cand.symbol_name
        }

    district_uuid = None
    if candidate.district:
        try:
            district_uuid = uuid.UUID(candidate.district)
        except Exception:
            pass

    election_uuid = None
    if candidate.election_id:
        try:
            election_uuid = uuid.UUID(candidate.election_id)
        except Exception:
            pass

    new_candidate = Candidate(
        candidate_id=uuid.uuid4(),
        full_name=name_clean,
        party_name=candidate.party or "",
        symbol_name=candidate.symbol or "Symbol",
        district_id=district_uuid,
        election_id=election_uuid
    )
    if unique_key_clean:
        try:
            new_candidate.unique_key = unique_key_clean
        except Exception:
            pass

    try:
        db.add(new_candidate)
        await db.commit()
    except Exception:
        await db.rollback()
        # Auto-migrate SQLite candidates table if unique_key column is missing
        try:
            from sqlalchemy import text
            await db.execute(text("ALTER TABLE candidates ADD COLUMN unique_key VARCHAR(100)"))
            await db.commit()
        except Exception:
            await db.rollback()
        
        new_candidate = Candidate(
            candidate_id=uuid.uuid4(),
            full_name=name_clean,
            party_name=candidate.party or "",
            symbol_name=candidate.symbol or "Symbol",
            district_id=district_uuid,
            election_id=election_uuid
        )
        db.add(new_candidate)
        await db.commit()

    return {
        "success": True,
        "message": "Candidate created successfully",
        "candidate_id": str(new_candidate.candidate_id),
        "id": str(new_candidate.candidate_id),
        "name": new_candidate.full_name,
        "party": new_candidate.party_name,
        "symbol": new_candidate.symbol_name
    }



@router.put("/candidates/{id}")
async def update_candidate(
    id: str,
    candidate: CandidateCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin)
):
    try:
        cand_uuid = uuid.UUID(id)
        res = await db.execute(select(Candidate).where(Candidate.candidate_id == cand_uuid))
    except Exception:
        res = await db.execute(select(Candidate).where(cast(Candidate.candidate_id, String) == str(id)))
    
    cand_obj = res.scalars().first()
    if not cand_obj:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.name:
        cand_obj.full_name = candidate.name
    if candidate.party:
        cand_obj.party_name = candidate.party
    if candidate.symbol:
        cand_obj.symbol_name = candidate.symbol
    if candidate.unique_key:
        try:
            cand_obj.unique_key = candidate.unique_key
        except Exception:
            pass

    await db.commit()
    return {"success": True, "message": "Candidate updated successfully"}



@router.delete("/candidates/{id}")
async def delete_candidate(
    id: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin)
):
    try:
        cand_uuid = uuid.UUID(id)
        candidate_result = await db.execute(select(Candidate).where(Candidate.candidate_id == cand_uuid))
    except Exception:
        candidate_result = await db.execute(select(Candidate).where(cast(Candidate.candidate_id, String) == str(id)))

    candidate = candidate_result.scalars().first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    await db.delete(candidate)
    await db.commit()
    return {
        "success": True,
        "message": "Candidate deleted successfully",
    }



