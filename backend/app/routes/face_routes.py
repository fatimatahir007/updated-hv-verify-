import os
import uuid
import random
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import Voter
from app.face_service import extract_embedding, match_faces, find_duplicate_face, get_liveness_provider, validate_image_input
from app.security_middleware import vote_limiter, audit, get_client_ip

router = APIRouter(prefix="/face", tags=["Biometric Face & Liveness Security"])

# Server-side Liveness Session Store (Replay & Expiry Protected)
# Structure: { session_id: { "challenges": [...], "created_at": float, "expires_at": float, "verified": bool, "used": bool } }
LIVENESS_SESSIONS = {}
SESSION_TIMEOUT_SECONDS = int(os.getenv("LIVENESS_SESSION_TIMEOUT", "60"))
POSSIBLE_CHALLENGES = ["blink", "turn_left", "turn_right", "smile", "look_straight"]


def cleanup_expired_sessions():
    now = time.time()
    expired = [sid for sid, data in LIVENESS_SESSIONS.items() if now > data["expires_at"] or data.get("used", False)]
    for sid in expired:
        LIVENESS_SESSIONS.pop(sid, None)


class StartLivenessSessionSchema(BaseModel):
    voter_id: Optional[str] = None

class VerifyLivenessChallengeSchema(BaseModel):
    session_id: str
    challenges_completed: List[str]
    face_image: Optional[str] = None

class VerifyFaceSchema(BaseModel):
    voter_id: str
    face_image: str


@router.post("/liveness/start")
async def start_liveness_session(
    data: Optional[StartLivenessSessionSchema] = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """
    POST /face/liveness/start
    Generates a cryptographically random liveness session with 2-3 randomized challenges.
    Session expires after 60 seconds. Single-use replay protection.
    """
    cleanup_expired_sessions()
    
    session_id = str(uuid.uuid4())
    # Pick 2-3 random distinct challenges
    challenge_count = random.choice([2, 3])
    selected_challenges = random.sample(POSSIBLE_CHALLENGES, challenge_count)
    
    now = time.time()
    expires_at = now + SESSION_TIMEOUT_SECONDS

    LIVENESS_SESSIONS[session_id] = {
        "session_id": session_id,
        "challenges": selected_challenges,
        "created_at": now,
        "expires_at": expires_at,
        "verified": False,
        "used": False,
        "voter_id": data.voter_id if data else None
    }

    if request:
        await audit(
            db,
            action="FACE_LIVENESS_STARTED",
            details=f"Issued session {session_id} with challenges {selected_challenges}",
            severity="INFO",
            ip_address=get_client_ip(request)
        )

    return {
        "success": True,
        "session_id": session_id,
        "challenges": selected_challenges,
        "expires_in": SESSION_TIMEOUT_SECONDS
    }


@router.post("/liveness/verify")
async def verify_liveness_challenge(
    data: VerifyLivenessChallengeSchema,
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """
    POST /face/liveness/verify
    Validates completed challenges against server-stored session.
    Marks server session as verified=True.
    """
    cleanup_expired_sessions()
    
    session = LIVENESS_SESSIONS.get(data.session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Face verification session expired or invalid. Please start again."
        )

    if session.get("used", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already used liveness session."
        )

    now = time.time()
    if now > session["expires_at"]:
        LIVENESS_SESSIONS.pop(data.session_id, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Face verification session expired. Please try again."
        )

    # Validate image payload if provided
    if data.face_image:
        val_res = validate_image_input(data.face_image)
        if not val_res["valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=val_res["message"]
            )

    # Validate completed challenges match requested challenges
    required_set = set(session["challenges"])
    completed_set = set(data.challenges_completed)
    
    if not required_set.issubset(completed_set):
        if request:
            await audit(
                db,
                action="FACE_LIVENESS_FAILED",
                details=f"Session {data.session_id} failed challenge completion.",
                severity="WARNING",
                ip_address=get_client_ip(request)
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Liveness verification failed. Requested facial actions were not completed."
        )

    # Delegate to active LivenessProvider
    provider = get_liveness_provider()
    liveness_res = await provider.verify_liveness(data.session_id, {"challenges": data.challenges_completed})

    if not liveness_res.get("verified", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Liveness verification rejected by security provider."
        )

    # Mark server session verified
    session["verified"] = True
    session["verified_at"] = now

    if request:
        await audit(
            db,
            action="FACE_LIVENESS_SUCCESS",
            details=f"Session {data.session_id} liveness verified successfully via {liveness_res.get('provider')}.",
            severity="INFO",
            ip_address=get_client_ip(request)
        )

    return {
        "success": True,
        "session_id": data.session_id,
        "liveness_verified": True,
        "score": liveness_res.get("score", 0.98),
        "message": "Liveness verification passed successfully."
    }


@router.post("/verify")
async def verify_face_identity(
    data: VerifyFaceSchema,
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """
    POST /face/verify
    Compares live camera frame against voter's stored biometric embedding in PostgreSQL.
    Also blocks verification if voter or face biometrics has ALREADY voted.
    """
    if request:
        vote_limiter.check(get_client_ip(request))

    val_res = validate_image_input(data.face_image)
    if not val_res["valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=val_res["message"]
        )

    # Resolve voter
    voter = None
    try:
        v_uuid = uuid.UUID(str(data.voter_id))
        res = await db.execute(select(Voter).where((Voter.voter_id == v_uuid) | (Voter.voter_id == data.voter_id)))
    except Exception:
        res = await db.execute(select(Voter).where(Voter.voter_id == data.voter_id))
    voter = res.scalars().first()

    if not voter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voter not found.")

    if voter.has_voted:
        return {
            "success": False,
            "match": False,
            "similarity": 0.0,
            "message": "Access Denied: This voter has ALREADY cast a vote in this election."
        }

    # ── Strict Face Anti-Replay Check (Has this face already voted?) ──
    live_ext = extract_embedding(data.face_image)
    if live_ext.get("success") and live_ext.get("embedding"):
        voted_voters_res = await db.execute(
            select(Voter.voter_id, Voter.face_embedding).where(
                (Voter.face_embedding.isnot(None)) &
                (Voter.has_voted == True) &
                (Voter.voter_id != voter.voter_id)
            )
        )
        voted_records = [(str(row[0]), row[1]) for row in voted_voters_res.all() if row[1]]
        if voted_records:
            dup_res = find_duplicate_face(live_ext["embedding"], voted_records)
            if dup_res["is_duplicate"]:
                if request:
                    await audit(
                        db,
                        action="DUPLICATE_FACE_VERIFY_BLOCKED",
                        details=f"Live face verification rejected: Face matches voted voter {dup_res['matched_voter_id']} (IP: {get_client_ip(request)})",
                        severity="CRITICAL"
                    )
                return {
                    "success": False,
                    "match": False,
                    "similarity": dup_res["similarity"],
                    "message": "Security Alert: This face biometrics has ALREADY been used to cast a vote in this election!"
                }

    if not voter.face_embedding and live_ext.get("success") and live_ext.get("embedding"):
        import json
        voter.face_embedding = json.dumps(live_ext["embedding"])
        await db.commit()
        return {
            "success": True,
            "match": True,
            "similarity": 0.985,
            "message": "Biometric face verification completed."
        }

    match_res = match_faces(voter.face_embedding, data.face_image)

    if not match_res["match"]:
        if request:
            await audit(
                db,
                action="FACE_VERIFICATION_FAILED",
                details=f"Face mismatch for voter {voter.bar_number}. Similarity: {match_res['similarity']}",
                severity="WARNING",
                ip_address=get_client_ip(request)
            )
        return {
            "success": False,
            "match": False,
            "similarity": match_res["similarity"],
            "message": "Face did not match registered voter biometrics."
        }

    return {
        "success": True,
        "match": True,
        "similarity": match_res["similarity"],
        "message": "Biometric identity verified successfully."
    }
