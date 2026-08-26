import io
import uuid
import traceback
import pandas as pd
import hashlib
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models import Voter, District, PollingStation
from app.utils.security import require_admin, enforce_role

router = APIRouter(prefix="/nadra", tags=["NADRA Voter Import"])
voters_router = APIRouter(prefix="/voters", tags=["Voters"])

class IndividualVoterSchema(BaseModel):
    full_name: str
    cnic: str
    phone: str
    constituency: str
    email: Optional[str] = None
    polling_station_id: Optional[str] = None

def calculate_registration_hash(voter_id: str, cnic: str, full_name: str) -> str:
    return hashlib.sha256(f"{voter_id}{cnic}{full_name}".encode()).hexdigest()

# Shared Helpers
async def get_voter_by_cnic(db: AsyncSession, cnic: str) -> Optional[Voter]:
    clean_cnic = cnic.strip().replace("-", "").replace(" ", "")
    res = await db.execute(
        select(Voter).where(
            func.replace(func.replace(Voter.bar_number, "-", ""), " ", "") == clean_cnic
        )
    )
    return res.scalars().first()

async def resolve_unique_email(db: AsyncSession, email: Optional[str]) -> Optional[str]:
    if not email or str(email).strip() == "":
        return None
    email = email.strip().lower()
    res = await db.execute(
        select(Voter).where(
            func.replace(func.replace(Voter.membership_type, "-", ""), " ", "") == email
        )
    )
    if res.scalars().first():
        email_parts = email.split('@')
        if len(email_parts) == 2:
            return f"{email_parts[0]}+{uuid.uuid4().hex[:4]}@{email_parts[1]}"
    return email

async def get_district_id_by_name(db: AsyncSession, constituency_name: str) -> Optional[uuid.UUID]:
    res_d = await db.execute(select(District).where(func.lower(District.district_name) == constituency_name.lower().strip()))
    d_obj = res_d.scalars().first()
    return d_obj.district_id if d_obj else None


@router.post("/import-voters")
async def import_voters(
    file: UploadFile = File(...),
    current_admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    # Enforce role
    enforce_role(current_admin, ["nadra_officer", "super_admin"])

    # Validate file extension
    filename = file.filename or ""
    if not (filename.endswith(".xlsx") or filename.endswith(".xls") or filename.endswith(".csv")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only .xlsx, .xls, and .csv files are accepted."
        )

    # Parse file based on extension
    try:
        contents = await file.read()
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse file: {str(e)}"
        )

    # Normalize column names: strip, lowercase, replace spaces/dashes with underscores
    # and map common synonyms
    normalized_cols = {}
    for col in df.columns:
        norm = str(col).strip().lower().replace(" ", "_").replace("-", "_")
        if norm in ["name", "full_name", "voter_name", "voter_names"]:
            normalized_cols[col] = "full_name"
        elif norm in ["cnic", "cnic_number", "cnic_no", "identity_no", "cnic_id"]:
            normalized_cols[col] = "cnic"
        elif norm in ["phone", "phone_number", "phone_no", "mobile", "mobile_number", "contact_no"]:
            normalized_cols[col] = "phone"
        elif norm in ["constituency", "district", "constituency_name"]:
            normalized_cols[col] = "constituency"
        elif norm in ["email", "email_address"]:
            normalized_cols[col] = "email"
        elif norm in ["polling_station_id", "polling_station", "station_id"]:
            normalized_cols[col] = "polling_station_id"
        else:
            normalized_cols[col] = norm
            
    df = df.rename(columns=normalized_cols)

    # Validate columns
    required_columns = ["full_name", "cnic", "phone", "constituency"]
    for col in required_columns:
        if col not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required column: '{col}'. Found columns: {list(df.columns)}"
            )

    inserted_count = 0
    skipped_count = 0
    error_list = []
    processed_cnics = set()

    def clean_value(val):
        if pd.isna(val) or str(val).strip().lower() in ("nan", "null", ""):
            return ""
        val_str = str(val).strip()
        if val_str.endswith(".0"):
            val_str = val_str[:-2]
        return val_str

    # Process each row
    for index, row in df.iterrows():
        row_num = index + 2  # 1-based index + 1 for header row
        
        try:
            # Handle empty/null values
            full_name = clean_value(row.get("full_name"))
            cnic = clean_value(row.get("cnic"))
            phone = clean_value(row.get("phone"))
            constituency = clean_value(row.get("constituency"))
            email_val = clean_value(row.get("email"))
            email = email_val if email_val != "" else None
            
            # 1. Skip rows with missing mandatory values
            missing_fields = []
            if not full_name: missing_fields.append("full_name")
            if not cnic: missing_fields.append("cnic")
            if not phone: missing_fields.append("phone")
            if not constituency: missing_fields.append("constituency")
            
            if missing_fields:
                error_list.append({
                    "row": row_num,
                    "cnic": cnic or "N/A",
                    "reason": f"Missing required field(s): {', '.join(missing_fields)}"
                })
                skipped_count += 1
                continue

            # 2. Clean and validate CNIC
            clean_cnic = cnic.replace("-", "").replace(" ", "")
            if not clean_cnic.isdigit() or len(clean_cnic) != 13:
                error_list.append({
                    "row": row_num,
                    "cnic": cnic,
                    "reason": "CNIC must be exactly 13 digits long"
                })
                skipped_count += 1
                continue

            # 3. Check duplicate CNIC in same file
            if clean_cnic in processed_cnics:
                error_list.append({
                    "row": row_num,
                    "cnic": cnic,
                    "reason": "Duplicate CNIC in the same Excel file"
                })
                skipped_count += 1
                continue

            # 4. Check duplicate CNIC in database using helper
            existing_voter = await get_voter_by_cnic(db, clean_cnic)
            if existing_voter:
                error_list.append({
                    "row": row_num,
                    "cnic": cnic,
                    "reason": "Voter with this CNIC is already registered in the database"
                })
                skipped_count += 1
                continue

            # 5. Resolve district ID by constituency name
            district_uuid = await get_district_id_by_name(db, constituency)
            if not district_uuid:
                error_list.append({
                    "row": row_num,
                    "cnic": cnic,
                    "reason": f"Constituency/District '{constituency}' not found in the database"
                })
                skipped_count += 1
                continue

            # Add to processed set
            processed_cnics.add(clean_cnic)

            # Resolve unique email
            email = await resolve_unique_email(db, email)

            # Polling station ID resolution and validation
            raw_station_id = row.get("polling_station_id")
            polling_station_uuid = None
            if pd.notna(raw_station_id) and str(raw_station_id).strip() != "":
                try:
                    station_str = str(raw_station_id).strip()
                    polling_station_uuid = uuid.UUID(station_str)
                    
                    # Verify if this polling station exists in the database
                    res_ps = await db.execute(select(PollingStation).where(PollingStation.station_id == polling_station_uuid))
                    ps_obj = res_ps.scalars().first()
                    if not ps_obj:
                        error_list.append({
                            "row": row_num,
                            "cnic": cnic,
                            "reason": f"Polling station ID '{station_str}' does not exist in the database"
                        })
                        skipped_count += 1
                        continue
                    
                    # Verify that voter's district matches the polling station's district
                    if ps_obj.district_id and ps_obj.district_id != district_uuid:
                        res_ps_dist = await db.execute(select(District).where(District.district_id == ps_obj.district_id))
                        ps_dist = res_ps_dist.scalars().first()
                        ps_dist_name = ps_dist.district_name if ps_dist else "Unknown"
                        error_list.append({
                            "row": row_num,
                            "cnic": cnic,
                            "reason": f"Polling station '{ps_obj.station_name}' belongs to district '{ps_dist_name}', but voter is registered in '{constituency}'"
                        })
                        skipped_count += 1
                        continue
                except ValueError:
                    error_list.append({
                        "row": row_num,
                        "cnic": cnic,
                        "reason": f"Invalid Polling station ID format: '{raw_station_id}'"
                    })
                    skipped_count += 1
                    continue

            # Insert new voter
            new_voter_id = uuid.uuid4()
            new_voter = Voter(
                voter_id=new_voter_id,
                full_name=full_name,
                cnic=clean_cnic,
                phone=phone,
                constituency=constituency,
                district=constituency,
                email=email,
                password="",  # Empty password for activation later
                polling_station_id=polling_station_uuid,
                district_id=district_uuid,
                has_voted=False,
                is_verified=True,
                is_pending=False
            )

            new_voter.registration_hash = calculate_registration_hash(
                str(new_voter_id),
                clean_cnic,
                full_name
            )

            db.add(new_voter)
            inserted_count += 1
            
        except Exception as row_exc:
            print(f"===== NADRA IMPORT ROW {row_num} ERROR =====")
            print(repr(row_exc))
            traceback.print_exc()
            error_list.append({
                "row": row_num,
                "cnic": row.get("cnic", "N/A"),
                "reason": f"Unexpected error: {str(row_exc)}"
            })
            skipped_count += 1
            continue

    if inserted_count > 0:
        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            print("===== NADRA IMPORT COMMIT ERROR =====")
            print(repr(e))
            traceback.print_exc()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database commit error: {str(e)}"
            )

    return {
        "success": True,
        "inserted": inserted_count,
        "skipped": skipped_count,
        "total_rows": inserted_count + skipped_count,
        "errors": error_list
    }


@router.post("/add-voter")
async def add_voter(
    payload: IndividualVoterSchema,
    current_admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    enforce_role(current_admin, ["nadra_officer", "super_admin"])

    # Clean CNIC
    cnic = payload.cnic.strip().replace("-", "").replace(" ", "")
    if not cnic:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CNIC cannot be empty."
        )

    # Check duplicate CNIC
    existing_voter = await get_voter_by_cnic(db, cnic)
    if existing_voter:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A voter with this CNIC is already registered."
        )

    # Resolve unique email
    email = await resolve_unique_email(db, payload.email)

    # Resolve district ID by constituency name
    district_uuid = await get_district_id_by_name(db, payload.constituency)

    # Polling station ID resolution
    polling_station_uuid = None
    if payload.polling_station_id and str(payload.polling_station_id).strip() != "":
        try:
            polling_station_uuid = uuid.UUID(str(payload.polling_station_id).strip())
        except ValueError:
            pass

    # Insert new voter
    new_voter_id = uuid.uuid4()
    new_voter = Voter(
        voter_id=new_voter_id,
        full_name=payload.full_name.strip(),
        cnic=cnic,
        phone=payload.phone.strip(),
        constituency=payload.constituency.strip(),
        district=payload.constituency.strip(),
        email=email,
        password="",  # Empty password for activation later
        polling_station_id=polling_station_uuid,
        district_id=district_uuid,
        has_voted=False,
        is_verified=True,
        is_pending=False
    )

    new_voter.registration_hash = calculate_registration_hash(
        str(new_voter_id),
        cnic,
        payload.full_name.strip()
    )

    db.add(new_voter)
    
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database commit error: {str(e)}"
        )

    return {
        "success": True,
        "message": "Voter added successfully.",
        "voter_id": str(new_voter_id)
    }


@voters_router.post("/import")
async def import_voters_v2(
    file: UploadFile = File(...),
    current_admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    # Enforce role
    enforce_role(current_admin, ["nadra_officer", "super_admin"])

    # Validate file extension
    filename = file.filename or ""
    if not (filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only .xlsx and .xls files are accepted."
        )

    # Read contents and validate file size (5MB limit)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 5MB limit."
        )

    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse file: {str(e)}"
        )

    # Normalize column names: strip, lowercase, replace spaces/dashes with underscores
    # and map common synonyms
    normalized_cols = {}
    for col in df.columns:
        norm = str(col).strip().lower().replace(" ", "_").replace("-", "_").replace("/", "_")
        if norm in ["full_name", "name", "voter_name", "voter_names"]:
            normalized_cols[col] = "full_name"
        elif norm in ["cnic", "cnic_number", "cnic_no", "identity_no"]:
            normalized_cols[col] = "cnic"
        elif norm in ["phone_number", "phone", "phone_no", "mobile", "mobile_number", "contact_no"]:
            normalized_cols[col] = "phone"
        elif norm in ["constituency", "district", "constituency_name"]:
            normalized_cols[col] = "constituency"
        elif norm in ["has_voted", "voted"]:
            normalized_cols[col] = "has_voted"
        else:
            normalized_cols[col] = norm
            
    df = df.rename(columns=normalized_cols)

    # Validate required columns for DB insertion
    required_columns = ["full_name", "cnic", "phone", "constituency"]
    for col in required_columns:
        if col not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required column: '{col}'. Found columns: {list(df.columns)}"
            )

    imported_count = 0
    skipped_count = 0
    error_list = []
    processed_cnics = set()

    def clean_value(val):
        if pd.isna(val) or str(val).strip().lower() in ("nan", "null", ""):
            return ""
        val_str = str(val).strip()
        if val_str.endswith(".0"):
            val_str = val_str[:-2]
        return val_str

    # Process each row inside a try-except to isolate row-specific errors
    for index, row in df.iterrows():
        row_num = index + 2  # 1-based index + 1 for header row
        
        try:
            full_name = clean_value(row.get("full_name"))
            cnic = clean_value(row.get("cnic"))
            phone = clean_value(row.get("phone"))
            constituency = clean_value(row.get("constituency"))
            
            # Resolve has_voted (defaulting to false)
            raw_has_voted = row.get("has_voted")
            has_voted = False
            if pd.notna(raw_has_voted):
                val_hv = str(raw_has_voted).strip().lower()
                if val_hv in ("true", "1", "yes", "y", "voted"):
                    has_voted = True

            # 1. Skip rows with missing mandatory values
            missing_fields = []
            if not full_name: missing_fields.append("full_name")
            if not cnic: missing_fields.append("cnic")
            if not phone: missing_fields.append("phone")
            if not constituency: missing_fields.append("constituency")
            
            if missing_fields:
                error_list.append({
                    "row": row_num,
                    "reason": f"Missing required field(s): {', '.join(missing_fields)}"
                })
                skipped_count += 1
                continue

            # 2. Clean and validate CNIC (must be exactly 13 digits numeric)
            clean_cnic = cnic.replace("-", "").replace(" ", "")
            if not clean_cnic.isdigit() or len(clean_cnic) != 13:
                error_list.append({
                    "row": row_num,
                    "reason": "CNIC must be exactly 13 digits long"
                })
                skipped_count += 1
                continue

            # 3. Check duplicate CNIC in same file
            if clean_cnic in processed_cnics:
                error_list.append({
                    "row": row_num,
                    "reason": "Duplicate CNIC in the same Excel file"
                })
                skipped_count += 1
                continue

            # 4. Check duplicate CNIC in database using helper
            existing_voter = await get_voter_by_cnic(db, clean_cnic)
            if existing_voter:
                error_list.append({
                    "row": row_num,
                    "reason": "Voter with this CNIC is already registered in the database"
                })
                skipped_count += 1
                continue

            # 5. Resolve district ID by constituency name
            district_uuid = await get_district_id_by_name(db, constituency)
            if not district_uuid:
                error_list.append({
                    "row": row_num,
                    "reason": f"Constituency/District '{constituency}' not found in the database"
                })
                skipped_count += 1
                continue

            # Add to processed set
            processed_cnics.add(clean_cnic)

            # Polling station ID resolution and validation
            raw_station_id = row.get("polling_station_id")
            polling_station_uuid = None
            if pd.notna(raw_station_id) and str(raw_station_id).strip() != "":
                try:
                    station_str = str(raw_station_id).strip()
                    polling_station_uuid = uuid.UUID(station_str)
                    
                    # Verify if this polling station exists in the database
                    res_ps = await db.execute(select(PollingStation).where(PollingStation.station_id == polling_station_uuid))
                    ps_obj = res_ps.scalars().first()
                    if not ps_obj:
                        error_list.append({
                            "row": row_num,
                            "reason": f"Polling station ID '{station_str}' does not exist in the database"
                        })
                        skipped_count += 1
                        continue
                    
                    # Verify district consistency
                    if ps_obj.district_id and ps_obj.district_id != district_uuid:
                        res_ps_dist = await db.execute(select(District).where(District.district_id == ps_obj.district_id))
                        ps_dist = res_ps_dist.scalars().first()
                        ps_dist_name = ps_dist.district_name if ps_dist else "Unknown"
                        error_list.append({
                            "row": row_num,
                            "reason": f"Polling station '{ps_obj.station_name}' belongs to district '{ps_dist_name}', but voter is registered in '{constituency}'"
                        })
                        skipped_count += 1
                        continue
                except ValueError:
                    error_list.append({
                        "row": row_num,
                        "reason": f"Invalid Polling station ID format: '{raw_station_id}'"
                    })
                    skipped_count += 1
                    continue

            # Insert new voter
            new_voter_id = uuid.uuid4()
            new_voter = Voter(
                voter_id=new_voter_id,
                full_name=full_name,
                cnic=clean_cnic,
                phone=phone,
                constituency=constituency,
                district=constituency,
                email=None,
                password="",
                polling_station_id=polling_station_uuid,
                district_id=district_uuid,
                has_voted=has_voted,
                is_verified=True,
                is_pending=False
            )

            new_voter.registration_hash = calculate_registration_hash(
                str(new_voter_id),
                clean_cnic,
                full_name
            )

            db.add(new_voter)
            imported_count += 1
            
        except Exception as row_exc:
            print(f"===== V2 IMPORT ROW {row_num} ERROR =====")
            print(repr(row_exc))
            traceback.print_exc()
            error_list.append({
                "row": row_num,
                "reason": f"Unexpected error: {str(row_exc)}"
            })
            skipped_count += 1
            continue

    if imported_count > 0:
        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database commit error: {str(e)}"
            )

    return {
        "imported": imported_count,
        "skipped": skipped_count,
        "errors": error_list
    }

