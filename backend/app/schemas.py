from typing import Optional, List, Union
from datetime import datetime
import uuid

from pydantic import BaseModel


class RegisterSchema(BaseModel):
    full_name: str
    cnic: str
    phone: str
    constituency: str
    polling_station_id: Optional[str] = None


class VoterCreate(BaseModel):
    full_name: str
    email: str
    password: str
    cnic: str
    district: str
    phone: Optional[str] = None
    constituency: Optional[str] = None


class AuthRegisterSchema(BaseModel):
    full_name: str
    email: str
    password: str
    cnic: str
    district: str
    phone: Optional[str] = None
    constituency: Optional[str] = None


class AuthUpdateSchema(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    district: Optional[str] = None


class LoginSchema(BaseModel):
    email: str
    password: str


class CandidateCreateSchema(BaseModel):
    name: str
    party: str
    district: str
    symbol: Optional[str] = None
    unique_key: Optional[str] = None

class VoteSchema(BaseModel):
    voter_id: Optional[str] = None
    candidate_id: Union[int, str]
    polling_station_id: Optional[str] = None


class DashboardSummaryResponse(BaseModel):
    total_voters: int
    total_votes_cast: int
    total_candidates: int
    total_districts: int
    open_security_incidents: int
    turnout_percent: float


class VotingTrendItem(BaseModel):
    date: str
    votes_cast: int


class VoterTrendItem(BaseModel):
    date: str
    new_voters: int


class DashboardVotingTrendResponse(BaseModel):
    voting_trend: List[VotingTrendItem]
    voter_trend: List[VoterTrendItem]


class DistrictVoteShare(BaseModel):
    district_name: str
    vote_count: int
    percent: float


class RecentIncidentItem(BaseModel):
    incident_id: uuid.UUID
    incident_type: Optional[str]
    severity: Optional[str]
    description: Optional[str]
    resolved: bool
    resolved_by: Optional[str]
    created_at: Optional[datetime]


class RecentAuditLogItem(BaseModel):
    id: int
    action: Optional[str]
    details: Optional[str]
    severity: Optional[str]
    timestamp: Optional[datetime]


class ServiceHealthStatus(BaseModel):
    status: str


class SystemHealthResponse(BaseModel):
    database: ServiceHealthStatus
    authentication: ServiceHealthStatus
    encryption_service: ServiceHealthStatus
    audit_service: ServiceHealthStatus
    backup_service: ServiceHealthStatus
    api_gateway: ServiceHealthStatus