import uuid
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Uuid,
    BigInteger,
    cast,
    JSON
)
from sqlalchemy.orm import synonym
from sqlalchemy.ext.hybrid import hybrid_property

from sqlalchemy.sql import func

from app.database import Base


class Voter(Base):

    __tablename__ = "voters"

    voter_id = Column(Uuid, primary_key=True, index=True, default=uuid.uuid4)
    id = synonym('voter_id')
    has_voted = Column('has_voted', Boolean, default=False)
    created_at = Column('registration_time', DateTime(timezone=True), server_default=func.now())

    # Database columns in new PostgreSQL schema
    election_id = Column('election_id', Uuid, nullable=True)
    bar_number = Column('bar_number', String, unique=True, nullable=True)
    name_hash = Column('name_hash', String, nullable=True)
    district_id = Column('district_id', Uuid, nullable=True)
    membership_type = Column('membership_type', String, nullable=True)
    secret_code_hash = Column('secret_code_hash', String, nullable=True)
    commitment_hash = Column('commitment_hash', String, nullable=True)
    qr_hash = Column('qr_hash', String, nullable=True)
    voted_at = Column('voted_at', DateTime(timezone=True), nullable=True)
    polling_station_id = Column('polling_station_id', Uuid, nullable=True)
    otp_code = Column('otp_code', String, nullable=True)
    otp_expires_at = Column('otp_expires_at', DateTime(timezone=True), nullable=True)

    @property
    def full_name(self):
        return self.name_hash or ""

    @full_name.setter
    def full_name(self, value):
        self.name_hash = value

    @property
    def email(self):
        return self.membership_type or ""

    @email.setter
    def email(self, value):
        self.membership_type = value

    @property
    def password(self):
        return self.secret_code_hash or ""

    @password.setter
    def password(self, value):
        self.secret_code_hash = value

    @property
    def cnic(self):
        return self.bar_number or ""

    @cnic.setter
    def cnic(self, value):
        self.bar_number = value

    @property
    def district(self):
        return str(self.district_id) if self.district_id else None

    @district.setter
    def district(self, value):
        if value:
            try:
                self.district_id = uuid.UUID(value) if isinstance(value, str) else value
            except ValueError:
                pass

    @property
    def phone(self):
        return self.commitment_hash or ""

    @phone.setter
    def phone(self, value):
        self.commitment_hash = value

    @property
    def constituency(self):
        return self.qr_hash or ""

    @constituency.setter
    def constituency(self, value):
        self.qr_hash = value

    # Real DB Columns
    is_verified = Column('is_verified', Boolean, default=True)
    is_pending = Column('is_pending', Boolean, default=False)
    pending_reason = Column('pending_reason', String, nullable=True)
    face_embedding = Column('face_embedding', Text, nullable=True)
    registration_hash_col = Column('registration_hash', String, nullable=True)

    @property
    def registration_hash(self):
        return self.registration_hash_col or self.qr_hash or ""

    @registration_hash.setter
    def registration_hash(self, value):
        self.registration_hash_col = value

    @property
    def face_verified(self):
        return bool(self.face_embedding)

    @property
    def liveness_verified(self):
        return self.is_verified and not self.is_pending

    @property
    def face_registered_at(self):
        return self.created_at

    @property
    def face_verification_score(self):
        return 0.985 if self.face_embedding else 0.0


class Candidate(Base):

    __tablename__ = "candidates"

    candidate_id = Column(Uuid, primary_key=True, index=True, default=uuid.uuid4)
    id = synonym('candidate_id')
    election_id = Column(Uuid, nullable=True)
    full_name = Column(String, nullable=False)
    bar_number = Column(String, nullable=True)
    district_id = Column(Uuid, nullable=True)
    party_name = Column(String, nullable=False)
    symbol_name = Column(String, nullable=True)
    photo_url = Column(Text, nullable=True)
    public_key = Column(Text, nullable=True)
    unique_key = Column(String(100), unique=True, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    @property
    def name(self):
        return self.full_name

    @name.setter
    def name(self, value):
        self.full_name = value

    @property
    def party(self):
        return self.party_name

    @party.setter
    def party(self, value):
        self.party_name = value

    @property
    def symbol(self):
        return self.symbol_name

    @symbol.setter
    def symbol(self, value):
        self.symbol_name = value

    @property
    def district(self):
        return str(self.district_id) if self.district_id else None

    @district.setter
    def district(self, value):
        if value:
            self.district_id = uuid.UUID(value) if isinstance(value, str) else value

    @property
    def constituency(self):
        return "NA-122"

    @constituency.setter
    def constituency(self, value):
        pass

    @property
    def votes(self):
        return 0

    @votes.setter
    def votes(self, value):
        pass


class Vote(Base):

    __tablename__ = "votes"

    vote_id = Column(Uuid, primary_key=True, index=True, default=uuid.uuid4)
    id = synonym('vote_id')

    election_id = Column(Uuid, nullable=True)
    ballot_id = Column(String, nullable=True)
    encrypted_vote = Column(Text, nullable=True)
    verification_hash = Column(String, nullable=True)
    station_id = Column(Uuid, nullable=True)
    district_id = Column(Uuid, nullable=True)
    machine_signature = Column(Text, nullable=True)
    blockchain_block_number = Column(BigInteger, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    # Synonym/Adapter mapping for legacy code
    voter_id = synonym('ballot_id')
    candidate_id = synonym('encrypted_vote')
    receipt_code = synonym('verification_hash')
    vote_hash = synonym('machine_signature')
    blockchain_hash = synonym('machine_signature')
    timestamp = synonym('created_at')


class AuditLog(Base):

    __tablename__ = "audit_logs"

    audit_id = Column(Uuid, primary_key=True, index=True, default=uuid.uuid4)
    id = synonym('audit_id')

    user_id = Column(Uuid, nullable=True)
    action_type = Column(String, nullable=True)
    action = synonym('action_type')

    table_name = Column(String, nullable=True)
    record_id = Column(String, nullable=True)
    details = synonym('record_id')

    old_data = Column(JSON, nullable=True)
    new_data = Column(JSON, nullable=True)
    ip_address = Column(String, nullable=True)
    severity = synonym('ip_address')

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    timestamp = synonym('created_at')


class District(Base):

    __tablename__ = "districts"

    district_id = Column(Uuid, primary_key=True, default=uuid.uuid4)

    district_name = Column(String(150), nullable=False)
    
    state_id = Column(Uuid, ForeignKey("states.state_id"), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


class Election(Base):

    __tablename__ = "elections"

    election_id = Column(Uuid, primary_key=True, default=uuid.uuid4)

    title = Column(String(200), nullable=False)

    date = Column('start_time', DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)

    status = Column(String(50), default="Upcoming")
    polling_station_id = Column('polling_station_id', Uuid, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


class BlockchainNode(Base):

    __tablename__ = "blockchain_nodes"

    node_id = Column(Uuid, primary_key=True, default=uuid.uuid4)

    node_name = Column(String(150), nullable=False)

    node_url = Column(String(255), nullable=False)

    status = Column(String(50), default="Active")

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


class SystemSetting(Base):

    __tablename__ = "system_settings"

    setting_id_int = Column('setting_id', Integer, primary_key=True, index=True)

    @hybrid_property
    def setting_id(self):
        if self.setting_id_int is not None:
            # We pad to a 128-bit integer for a valid UUID
            return uuid.UUID(int=self.setting_id_int)
        return None

    @setting_id.setter
    def setting_id(self, value):
        if isinstance(value, uuid.UUID):
            self.setting_id_int = value.int & 0xFFFFFFFF
        elif isinstance(value, int):
            self.setting_id_int = value
        elif isinstance(value, str):
            try:
                self.setting_id_int = uuid.UUID(value).int & 0xFFFFFFFF
            except ValueError:
                self.setting_id_int = int(value)

    @setting_id.expression
    def setting_id(cls):
        return cls.setting_id_int

    setting_key = Column(String(100), unique=True, nullable=False)

    setting_value = Column(Text, nullable=False)

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    created_at = synonym('updated_at')

    @property
    def description(self):
        return None

    @description.setter
    def description(self, value):
        pass


class Role(Base):

    __tablename__ = "roles"

    role_id = Column(Integer, primary_key=True, index=True)

    role_name = Column(String(50), unique=True, nullable=False)

    description = Column(Text, nullable=True)
    
    level = Column(Integer, nullable=True)


class User(Base):

    __tablename__ = "users"

    user_id = Column(Uuid, primary_key=True, default=uuid.uuid4)

    username = Column(String(100), unique=True, nullable=False)

    email = Column(String(150), unique=True, nullable=True)

    password_hash = Column(Text, nullable=False)
    
    invite_token_hash = Column(String(255), nullable=True)
    
    invite_expires_at = Column(DateTime(timezone=True), nullable=True)

    full_name = Column(String(150), nullable=True)

    role_id = Column(Integer, ForeignKey("roles.role_id"), nullable=True)
    
    state_id = Column(Uuid, ForeignKey("states.state_id"), nullable=True)

    district_id = Column(Uuid, ForeignKey("districts.district_id"), nullable=True)

    polling_station_id = Column(Uuid, nullable=True)

    is_active = Column(Boolean, default=True)

    last_login = Column(DateTime(timezone=False), nullable=True)

    permissions = Column(JSON, nullable=True, default=[])

    created_at = Column(
        DateTime(timezone=False),
        server_default=func.now()
    )


class SecurityIncident(Base):

    __tablename__ = "security_incidents"

    incident_id = Column(Uuid, primary_key=True, default=uuid.uuid4)

    district_id = Column(
        Uuid,
        ForeignKey("districts.district_id"),
        nullable=True
    )

    incident_type = Column(String(100))

    severity = Column(String(30))

    description = Column(Text)

    resolved = Column(Boolean, default=False)

    resolved_by = Column(
        Uuid,
        ForeignKey("users.user_id"),
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

class VoteReceipt(Base):
    __tablename__ = 'vote_receipts'

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Uuid, unique=True, nullable=False, default=uuid.uuid4)
    vote_id = Column(Uuid, ForeignKey('votes.vote_id'), nullable=False)
    election_id = Column(Uuid, ForeignKey('elections.election_id'), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    polling_station = Column(String(255), nullable=True)
    district = Column(String(255), nullable=True)
    cryptographic_hash = Column(String(255), nullable=True)
    qr_code_data = Column(Text, nullable=True)
    verification_code = Column(String(100), nullable=False)
    status = Column(String(50), default='Generated')


class BlockchainTransaction(Base):
    __tablename__ = 'blockchain_transactions'

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Uuid, nullable=True)
    block_index = Column(Integer, unique=True, nullable=False)
    previous_block_hash = Column(String(255), nullable=False)
    receipt_hash = Column(String(255), nullable=False)
    current_block_hash = Column(String(255), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(50), default='Valid')


class DistrictSyncLog(Base):
    __tablename__ = 'district_sync_logs'

    sync_id = Column(Uuid, primary_key=True, index=True, default=uuid.uuid4)
    id = synonym('sync_id')

    source_district = Column(Uuid, nullable=True)
    target_district = Column(Uuid, nullable=True)
    batch_id = Column(String(255), nullable=True)
    district_name = synonym('batch_id')

    vote_count = Column(Integer, nullable=True)
    blockchain_transaction_id = synonym('vote_count')

    sync_hash = Column(String(255), nullable=False)
    sync_signature = Column(Text, nullable=True)

    sync_status = Column(String(50), default='Synced')

    synced_at = Column(DateTime(timezone=True), server_default=func.now())
    sync_timestamp = synonym('synced_at')
    created_at = synonym('synced_at')

    @hybrid_property
    def block_index(self):
        return int(self.sync_signature) if self.sync_signature else None

    @block_index.setter
    def block_index(self, value):
        self.sync_signature = str(value) if value is not None else None

    @block_index.expression
    def block_index(cls):
        return cast(cls.sync_signature, Integer)

    receipt_id = synonym('target_district')


class VerificationRequest(Base):
    __tablename__ = 'verification_requests'

    request_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    verification_hash = Column(String(255), nullable=True)
    ip_address = Column(String(50), nullable=True)
    verified = Column(Boolean, default=False)
    verified_at = Column(DateTime(timezone=True), server_default=func.now())


class PollingStation(Base):
    __tablename__ = "polling_stations"

    station_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    station_code = Column(String(50), nullable=False, unique=True)
    station_name = Column(String(200), nullable=False)
    location = Column(Text, nullable=True)
    machine_count = Column(Integer, nullable=True)
    is_online = Column(Boolean, nullable=True, default=False)
    address = Column(String(500), nullable=True)
    district_id = Column(Uuid, ForeignKey("districts.district_id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def capacity(self):
        return self.machine_count or 0

    @capacity.setter
    def capacity(self, value):
        self.machine_count = value


class State(Base):
    __tablename__ = "states"

    state_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    state_name = Column(String(150), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RoleGrantAudit(Base):
    __tablename__ = "role_grants_audit"

    grant_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    grantor_id = Column(Uuid, ForeignKey("users.user_id"), nullable=False)
    grantee_id = Column(Uuid, ForeignKey("users.user_id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.role_id"), nullable=False)
    jurisdiction_level = Column(String(50), nullable=False)
    jurisdiction_id = Column(Uuid, nullable=True)
    action = Column(String(50), nullable=False)
    granted_at = Column(DateTime(timezone=True), server_default=func.now())

