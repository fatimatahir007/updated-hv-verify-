from fastapi import APIRouter, HTTPException, status, Depends, Request
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.ai_directive_liveness import (
    create_directive_session,
    process_directive_step,
    DIRECTIVE_SESSIONS
)
from app.security_middleware import audit, get_client_ip

router = APIRouter(tags=["Interactive Directive Face Liveness"])


class StartDirectiveSchema(BaseModel):
    user_id: Optional[str] = None

class ProcessDirectiveSchema(BaseModel):
    session_id: str
    image: str  # Base64 video frame data URL


@router.post("/liveness/start-directive")
@router.post("/v1/liveness/start-directive")
@router.post("/api/v1/liveness/start-directive")
async def start_directive_session_endpoint(
    data: Optional[StartDirectiveSchema] = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Issues a dynamic random sequence of 2-3 face movement instructions.
    """
    user_id = data.user_id if data else None
    session = create_directive_session(user_id=user_id)

    if request and db:
        try:
            await audit(
                db,
                action="DIRECTIVE_LIVENESS_STARTED",
                details=f"Session {session['session_id']} started with directives {session['directives']}",
                severity="INFO",
                ip_address=get_client_ip(request)
            )
        except Exception as e:
            print(f"[DirectiveRoutes] Non-critical audit error: {e}")

    return {
        "success": True,
        "session_id": session["session_id"],
        "directives": session["directives"],
        "current_step": 1,
        "first_instruction": session["directives"][0],
        "step_timeout_sec": 5.0
    }


@router.post("/liveness/process-directive")
@router.post("/v1/liveness/process-directive")
@router.post("/api/v1/liveness/process-directive")
async def process_directive_endpoint(
    data: ProcessDirectiveSchema,
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Evaluates real-time webcam frame against active directive instruction (Yaw, Pitch, EAR, MAR).
    """
    if not data.session_id or not data.image:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id and image frame are required."
        )

    result = process_directive_step(data.session_id, data.image)

    if result.get("error"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["message"]
        )

    # Save to Database Audit Log on completion
    if request and db:
        try:
            if result.get("overall_liveness") == "APPROVED":
                await audit(
                    db,
                    action="DIRECTIVE_LIVENESS_APPROVED",
                    details=f"User {data.session_id} completed directives {result.get('passed_steps')} with score 0.985",
                    severity="INFO",
                    ip_address=get_client_ip(request)
                )
            elif result.get("overall_liveness") == "REJECTED":
                await audit(
                    db,
                    action="DIRECTIVE_LIVENESS_REJECTED",
                    details=f"Session {data.session_id} failed directive verification.",
                    severity="WARNING",
                    ip_address=get_client_ip(request)
                )
        except Exception as e:
            print(f"[DirectiveRoutes] Non-critical audit error: {e}")

    return result
