from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Voter, Vote, Election
from datetime import datetime, timezone
from app.schemas import (
    AuthRegisterSchema,
    AuthUpdateSchema,
    ForgotPasswordSchema,
    LoginSchema,
)

# In imports ko apne actual security file se match karein
from app.utils.security import (
    hash_password,
    verify_password,
)

from app.utils.jwt_handler import create_access_token, SECRET_KEY, ALGORITHM
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

voter_security = HTTPBearer(auto_error=False)

async def get_current_voter(
    credentials: HTTPAuthorizationCredentials = Depends(voter_security),
    db: AsyncSession = Depends(get_db)
):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    voter_id = payload.get("sub")
    if not voter_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    try:
        import uuid
        voter_uuid = uuid.UUID(voter_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid voter id")
    result = await db.execute(select(Voter).where(Voter.id == voter_uuid))
    voter = result.scalar_one_or_none()
    if not voter:
        raise HTTPException(status_code=401, detail="Voter not found")
    return voter
router = APIRouter(
    prefix="/auth",
    tags=["Voter Authentication"],
)


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
)
async def register_voter(
    payload: AuthRegisterSchema,
    db: AsyncSession = Depends(get_db),
):
    email = str(payload.email).strip().lower()

    cnic = (
        payload.cnic.strip()
        .replace("-", "")
        .replace(" ", "")
    )

    full_name = payload.full_name.strip()
    district = payload.district.strip()

    email_result = await db.execute(
        select(Voter.id).where(
            func.lower(Voter.membership_type) == email
        )
    )

    if email_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    cnic_result = await db.execute(
        select(Voter.id).where(
            Voter.bar_number == cnic
        )
    )

    if cnic_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CNIC is already registered",
        )

    new_voter = Voter(
        full_name=full_name,
        email=email,
        cnic=cnic,
        district=district,
        password=hash_password(
            payload.password
        ),
        phone=payload.phone or "",
        constituency=payload.constituency or "",
    )

    db.add(new_voter)

    try:
        await db.commit()
        await db.refresh(new_voter)

    except IntegrityError as e:
        print("IntegrityError during registration:", repr(e))
        await db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or CNIC is already registered",
        )

    return {
        "message": "Voter account created successfully",
        "voter": {
            "id": str(new_voter.id),
            "full_name": new_voter.full_name,
            "email": new_voter.email,
            "cnic": new_voter.cnic,
            "district": new_voter.district,
        },
    }


@router.post("/login")
async def login_voter(
    payload: LoginSchema,
    db: AsyncSession = Depends(get_db),
):
    identifier = payload.identifier.strip()

    possible_cnic = (
        identifier
        .replace("-", "")
        .replace(" ", "")
    )

    if possible_cnic.isdigit():
        if len(possible_cnic) != 13:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="CNIC must contain exactly 13 digits",
            )

        result = await db.execute(
            select(Voter).where(
                Voter.bar_number == possible_cnic
            )
        )

    else:
        normalized_email = identifier.lower()

        result = await db.execute(
            select(Voter).where(
                func.lower(Voter.membership_type)
                == normalized_email
            )
        )

    voter = result.scalar_one_or_none()

    if voter is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email, CNIC, or password",
        )

    if not verify_password(
        payload.password,
        voter.password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email, CNIC, or password",
        )

    access_token = create_access_token(
        data={
            "sub": str(voter.id),
            "role": "voter",
            "email": voter.email,
            "cnic": voter.cnic,
        }
    )

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "voter": {
            "id": str(voter.id),
            "full_name": voter.full_name,
            "email": voter.email,
            "cnic": voter.cnic,
            "district": voter.district,
        },
    }


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordSchema,
    db: AsyncSession = Depends(get_db),
):
    email = str(payload.email).strip().lower()

    result = await db.execute(
        select(Voter).where(
            func.lower(Voter.membership_type) == email
        )
    )

    voter = result.scalar_one_or_none()

    response_message = (
        "If this email is registered, "
        "password reset instructions have been sent"
    )

    if voter is None:
        return {
            "message": response_message,
        }

    # Yahan baad mein reset token/OTP generate hoga.
    # Yahan email sending service call hogi.

    return {
        "message": response_message,
    }

@router.get("/me")
async def get_voter_me(voter: Voter = Depends(get_current_voter), db: AsyncSession = Depends(get_db)):
    # Find if there is an active election right now
    elections_res = await db.execute(select(Election).order_by(Election.created_at.desc()))
    elections = elections_res.scalars().all()
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
                    active_election_id = e.election_id
                    break
            else:
                active_election_id = e.election_id
                break
                
    has_voted_active = False
    if active_election_id:
        existing_vote_res = await db.execute(select(Vote).where(
            (Vote.ballot_id == str(voter.voter_id)) & (Vote.election_id == active_election_id)
        ))
        if existing_vote_res.scalars().first():
            has_voted_active = True
    else:
        has_voted_active = voter.has_voted

    return {
        "voter_id": str(voter.id),
        "id": str(voter.id),
        "full_name": voter.full_name,
        "email": voter.email,
        "cnic": voter.cnic,
        "district": voter.district,
        "has_voted": has_voted_active,
    }

@router.put("/me")
async def update_voter_me(payload: AuthUpdateSchema, voter: Voter = Depends(get_current_voter), db: AsyncSession = Depends(get_db)):
    if payload.full_name is not None:
        voter.full_name = payload.full_name
    if payload.email is not None:
        voter.email = payload.email
    if payload.district is not None:
        voter.district = payload.district
    if payload.password is not None and payload.password != "":
        voter.password = hash_password(payload.password)
    db.add(voter)
    await db.commit()
    await db.refresh(voter)
    
    # Find if there is an active election right now
    elections_res = await db.execute(select(Election).order_by(Election.created_at.desc()))
    elections = elections_res.scalars().all()
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
                    active_election_id = e.election_id
                    break
            else:
                active_election_id = e.election_id
                break
                
    has_voted_active = False
    if active_election_id:
        existing_vote_res = await db.execute(select(Vote).where(
            (Vote.ballot_id == str(voter.voter_id)) & (Vote.election_id == active_election_id)
        ))
        if existing_vote_res.scalars().first():
            has_voted_active = True
    else:
        has_voted_active = voter.has_voted

    return {
        "message": "Profile updated successfully",
        "voter": {
            "voter_id": str(voter.id),
            "id": str(voter.id),
            "full_name": voter.full_name,
            "email": voter.email,
            "cnic": voter.cnic,
            "district": voter.district,
            "has_voted": has_voted_active,
        }
    }

@router.get("/receipts")
async def get_voter_receipts(voter: Voter = Depends(get_current_voter)):
    return []