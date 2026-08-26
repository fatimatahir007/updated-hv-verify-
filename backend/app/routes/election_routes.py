from fastapi.security import HTTPAuthorizationCredentials
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.database import get_db
from app.models import Election
from pydantic import BaseModel, field_serializer
from typing import Optional
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/admin/elections", tags=["Admin Elections"])


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class ElectionCreate(BaseModel):
    title: str
    date: datetime
    end_time: Optional[datetime] = None
    status: str = "Upcoming"
    polling_station_id: Optional[str] = None


class ElectionResponse(BaseModel):
    election_id: uuid.UUID
    title: str
    date: datetime
    end_time: Optional[datetime] = None
    status: str
    polling_station_id: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @field_serializer("date", "end_time", "created_at", when_used="json")
    def serialize_dt(self, v: Optional[datetime]) -> Optional[str]:
        if v is None:
            return None
        dt_utc = v.astimezone(timezone.utc) if v.tzinfo else v.replace(tzinfo=timezone.utc)
        return dt_utc.isoformat()


def _compute_status(election: Election) -> str:
    if election.status and str(election.status).strip().lower() in ["closed", "inactive"]:
        return "Closed"

    now = datetime.now(timezone.utc)
    start_time = ensure_utc(election.date)
    end_time = ensure_utc(election.end_time) if election.end_time else None

    # If end_time has passed, status is Closed
    if end_time and now > end_time:
        return "Closed"

    # If start_time has not arrived yet, status is Upcoming
    if start_time and now < start_time:
        return "Upcoming"

    # Otherwise start_time has arrived and end_time is in future -> Active
    return "Active"


@router.get("/", response_model=list[ElectionResponse])
async def get_all_elections(db: AsyncSession = Depends(get_db)):
    """Return all elections from the database."""
    result = await db.execute(select(Election).order_by(Election.created_at.desc()))
    elections = result.scalars().all()
    changed = False
    for e in elections:
        computed = _compute_status(e)
        if e.status != computed:
            e.status = computed
            db.add(e)
            changed = True
    if changed:
        try:
            await db.commit()
        except Exception:
            await db.rollback()
    return elections


@router.get("/{election_id}", response_model=ElectionResponse)
async def get_election(election_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return a single election by UUID."""
    result = await db.execute(select(Election).where(Election.election_id == election_id))
    election = result.scalars().first()
    if not election:
        raise HTTPException(status_code=404, detail="Election not found")
    election.status = _compute_status(election)
    return election


@router.post("/", response_model=ElectionResponse, status_code=201)
async def create_election(payload: ElectionCreate, db: AsyncSession = Depends(get_db)):
    """Create a new election with UTC timestamps."""
    title_clean = (payload.title or "").strip()
    if not title_clean:
        raise HTTPException(status_code=400, detail="Title is required")

    # Check if election with this title already exists
    existing = await db.execute(select(Election).where(func.lower(Election.title) == title_clean.lower()))
    existing_election = existing.scalars().first()
    if existing_election:
        existing_election.status = _compute_status(existing_election)
        return existing_election

    start_date = ensure_utc(payload.date)
    end_date = ensure_utc(payload.end_time)

    # If end_time is provided but earlier than or equal to start_date, adjust to start_date + 7 days
    if end_date and start_date and end_date <= start_date:
        end_date = start_date + timedelta(days=7)

    now = datetime.now(timezone.utc)
    initial_status = "Upcoming" if start_date and start_date > now else "Active"

    new_election = Election(
        election_id=uuid.uuid4(),
        title=title_clean,
        date=start_date,
        end_time=end_date,
        status=initial_status,
        polling_station_id=uuid.UUID(payload.polling_station_id) if payload.polling_station_id else None
    )
    
    try:
        db.add(new_election)
        await db.commit()
    except Exception:
        await db.rollback()
        # Auto-migrate table if end_time column issue occurs
        try:
            from sqlalchemy import text
            await db.execute(text("ALTER TABLE elections ADD COLUMN end_time TIMESTAMPTZ"))
            await db.commit()
        except Exception:
            await db.rollback()
        
        new_election = Election(
            election_id=uuid.uuid4(),
            title=title_clean,
            date=start_date,
            end_time=end_date,
            status=initial_status,
            polling_station_id=uuid.UUID(payload.polling_station_id) if payload.polling_station_id else None
        )
        db.add(new_election)
        await db.commit()
        
    await db.refresh(new_election)
    new_election.status = _compute_status(new_election)
    return new_election


@router.delete("/{election_id}", status_code=204)
async def delete_election(election_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete an election by UUID."""
    result = await db.execute(select(Election).where(Election.election_id == election_id))
    election = result.scalars().first()
    if not election:
        raise HTTPException(status_code=404, detail="Election not found")
        
    # Delete related votes
    from app.models import Vote, Candidate
    await db.execute(Vote.__table__.delete().where(Vote.election_id == election_id))
    
    # Delete related candidates
    await db.execute(Candidate.__table__.delete().where(Candidate.election_id == election_id))
    
    # Delete the election
    await db.delete(election)
    await db.commit()


@router.put("/{election_id}/start-now", response_model=ElectionResponse)
async def start_election_now(election_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Manually start an election immediately and ensure it is active."""
    result = await db.execute(select(Election).where(Election.election_id == election_id))
    election = result.scalars().first()
    if not election:
        raise HTTPException(status_code=404, detail="Election not found")
    
    # Set start time to 2 minutes ago in UTC so it is immediately Active
    now = datetime.now(timezone.utc)
    election.date = now - timedelta(minutes=2)
    # Extend end_time to 7 days from now
    election.end_time = now + timedelta(days=7)
    election.status = "Active"
    
    db.add(election)
    await db.commit()
    await db.refresh(election)
    
    election.status = _compute_status(election)
    return election


@router.put("/{election_id}/close", response_model=ElectionResponse)
async def close_election(election_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Manually close an active election."""
    result = await db.execute(select(Election).where(Election.election_id == election_id))
    election = result.scalars().first()
    if not election:
        raise HTTPException(status_code=404, detail="Election not found")
    
    now = datetime.now(timezone.utc)
    election.end_time = now - timedelta(minutes=5)
    election.status = "Closed"
    
    db.add(election)
    await db.commit()
    await db.refresh(election)
    
    election.status = "Closed"
    return election


@router.post("/close-all")
async def close_all_elections(db: AsyncSession = Depends(get_db)):
    """Manually close all elections in the database."""
    now = datetime.now(timezone.utc)
    result = await db.execute(select(Election))
    elections = result.scalars().all()
    count = 0
    for e in elections:
        e.status = "Closed"
        e.end_time = now - timedelta(minutes=5)
        db.add(e)
        count += 1
    await db.commit()
    return {"message": f"Successfully closed {count} elections.", "count": count}
