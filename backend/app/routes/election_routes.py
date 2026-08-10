from fastapi.security import HTTPAuthorizationCredentials
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.database import get_db
from app.models import Election
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/admin/elections", tags=["Admin Elections"])


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
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


from datetime import timezone

def _compute_status(election: Election) -> str:
    # Use current aware local time
    now = datetime.now().astimezone()
    
    # If the database returns naive, treat it as local time
    start_time = election.date if election.date.tzinfo else election.date.astimezone()
    
    if now < start_time:
        return "Upcoming"
    
    if election.end_time:
        end_time = election.end_time if election.end_time.tzinfo else election.end_time.astimezone()
        if now > end_time:
            return "Closed"
            
    # Default to Active if past start_time and either no end_time or before end_time
    return "Active"

@router.get("/", response_model=list[ElectionResponse])
async def get_all_elections(db: AsyncSession = Depends(get_db)):
    """Return all elections from the database."""
    result = await db.execute(select(Election).order_by(Election.created_at.desc()))
    elections = result.scalars().all()
    for e in elections:
        e.status = _compute_status(e)
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
    """Create a new election."""
    title_clean = (payload.title or "").strip()
    if not title_clean:
        raise HTTPException(status_code=400, detail="Title is required")

    # Check if election with this title already exists
    existing = await db.execute(select(Election).where(func.lower(Election.title) == title_clean.lower()))
    existing_election = existing.scalars().first()
    if existing_election:
        return existing_election

    new_election = Election(
        election_id=uuid.uuid4(),
        title=title_clean,
        date=payload.date,
        end_time=payload.end_time,
        status="Upcoming", # Will be computed dynamically on GET
        polling_station_id=uuid.UUID(payload.polling_station_id) if payload.polling_station_id else None
    )
    
    try:
        db.add(new_election)
        await db.commit()
    except Exception:
        await db.rollback()
        # Auto-migrate SQLite elections table if end_time column is missing
        try:
            from sqlalchemy import text
            await db.execute(text("ALTER TABLE elections ADD COLUMN end_time DATETIME"))
            await db.commit()
        except Exception:
            await db.rollback()
        
        new_election = Election(
            election_id=uuid.uuid4(),
            title=title_clean,
            date=payload.date,
            end_time=payload.end_time,
            status="Upcoming",
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
    """Manually start an election by setting its start date to now."""
    result = await db.execute(select(Election).where(Election.election_id == election_id))
    election = result.scalars().first()
    if not election:
        raise HTTPException(status_code=404, detail="Election not found")
    
    # Set the start time to now so the dynamic logic considers it Active
    now = datetime.now(timezone.utc)
    election.date = now
    
    db.add(election)
    await db.commit()
    await db.refresh(election)
    
    election.status = _compute_status(election)
    return election
