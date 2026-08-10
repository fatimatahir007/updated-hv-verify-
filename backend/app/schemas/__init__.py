from datetime import datetime
from typing import List, Optional, Union
import uuid

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    field_validator,
)


def normalize_cnic(value: str) -> str:
    cleaned_value = (
        value.strip()
        .replace("-", "")
        .replace(" ", "")
    )

    if not cleaned_value.isdigit():
        raise ValueError("CNIC must contain digits only")

    if len(cleaned_value) != 13:
        raise ValueError(
            "CNIC must contain exactly 13 digits"
        )

    return cleaned_value


def normalize_identifier(value: str) -> str:
    cleaned_value = value.strip()

    if not cleaned_value:
        raise ValueError("Email or CNIC is required")

    possible_cnic = (
        cleaned_value
        .replace("-", "")
        .replace(" ", "")
    )

    if possible_cnic.isdigit():
        return normalize_cnic(possible_cnic)

    normalized_email = cleaned_value.lower()

    if (
        "@" not in normalized_email
        or "." not in normalized_email.split("@")[-1]
    ):
        raise ValueError(
            "Enter a valid email address or 13-digit CNIC"
        )

    return normalized_email


class RegisterSchema(BaseModel):
    full_name: str
    cnic: str
    phone: str
    constituency: str
    polling_station_id: Optional[str] = None

    @field_validator("cnic")
    @classmethod
    def validate_cnic(cls, value: str) -> str:
        return normalize_cnic(value)


class VoterCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    cnic: str
    district: str
    phone: Optional[str] = None
    constituency: Optional[str] = None

    @field_validator("cnic")
    @classmethod
    def validate_cnic(cls, value: str) -> str:
        return normalize_cnic(value)


class AuthRegisterSchema(BaseModel):
    full_name: str = Field(
        ...,
        min_length=3,
        max_length=100,
    )

    email: EmailStr

    cnic: str

    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
    )

    district: str = Field(
        ...,
        min_length=2,
        max_length=100,
    )

    phone: Optional[str] = None
    constituency: Optional[str] = None
    polling_station_id: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        return " ".join(value.strip().split())

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("cnic")
    @classmethod
    def validate_cnic(cls, value: str) -> str:
        return normalize_cnic(value)

    @field_validator("district")
    @classmethod
    def normalize_district(cls, value: str) -> str:
        return " ".join(value.strip().split())


class AuthUpdateSchema(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    cnic: Optional[str] = None
    password: Optional[str] = None
    district: Optional[str] = None


class LoginSchema(BaseModel):
    identifier: str = Field(
        ...,
        min_length=5,
        max_length=255,
        description="Registered email or 13-digit CNIC",
    )

    password: str = Field(
        ...,
        min_length=1,
        max_length=128,
    )

    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, value: str) -> str:
        return normalize_identifier(value)


class ForgotPasswordSchema(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class CandidateCreateSchema(BaseModel):
    name: str
    party: str
    district: str
    symbol: Optional[str] = None
    unique_key: Optional[str] = None
    election_id: Optional[str] = None


class CandidateUpdateSchema(BaseModel):
    name: Optional[str] = None
    party: Optional[str] = None
    district: Optional[str] = None
    symbol: Optional[str] = None


class VoteSchema(BaseModel):
    voter_id: Optional[str] = None
    candidate_id: Union[int, str]


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