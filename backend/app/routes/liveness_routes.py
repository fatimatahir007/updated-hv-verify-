from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel
from typing import Optional
from app.services.ai_liveness_engine import AILivenessEngine

router = APIRouter(tags=["AI Real-time Liveness Verification"])
engine = AILivenessEngine()


class LivenessRequestSchema(BaseModel):
    image: str  # Base64 encoded video frame
    challenge: Optional[str] = None  # e.g. "blink", "turn_left", "turn_right"


@router.post("/verify-liveness")
@router.post("/v1/verify-liveness")
@router.post("/api/v1/verify-liveness")
async def verify_liveness_endpoint(data: LivenessRequestSchema, request: Request):
    """
    Performs real-time active (EAR + Head Pose) and passive (Laplacian Blur + FFT Moire Pattern)
    anti-spoofing verification on incoming video frames.
    """
    if not data.image:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image payload is required."
        )

    res = engine.analyze_liveness_frame(data.image, requested_challenge=data.challenge)
    return res
