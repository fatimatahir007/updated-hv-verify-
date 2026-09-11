import asyncio
import uuid
import json
import base64
import numpy as np
import cv2

from app.database import AsyncSessionLocal
from app.models import Voter
from app.face_service import extract_embedding, find_duplicate_face, match_faces, MATCH_THRESHOLD
from app.routes.face_routes import LIVENESS_SESSIONS, cleanup_expired_sessions


def generate_mock_face_b64(seed=42):
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.circle(img, (320, 240), 100, (255, 255, 255), -1)
    cv2.circle(img, (280, 200), 15, (0, 0, 0), -1)
    cv2.circle(img, (360, 200), 15, (0, 0, 0), -1)
    _, buf = cv2.imencode(".jpg", img)
    return base64.b64encode(buf).decode("utf-8")


async def test_face_liveness_session_lifecycle():
    # 1. Start liveness session
    from app.routes.face_routes import start_liveness_session, StartLivenessSessionSchema
    res = await start_liveness_session(StartLivenessSessionSchema(voter_id="test-123"))
    
    assert res["success"] is True
    assert "session_id" in res
    assert len(res["challenges"]) in [2, 3]
    assert res["expires_in"] == 60

    session_id = res["session_id"]
    assert session_id in LIVENESS_SESSIONS
    assert LIVENESS_SESSIONS[session_id]["verified"] is False


async def test_duplicate_face_detection_logic():
    # Generate 128-dim normalized embedding
    emb1 = np.ones(128, dtype=np.float32)
    emb1 = (emb1 / np.linalg.norm(emb1)).tolist()

    # Create slightly modified vector with high similarity (> 0.95)
    emb2 = np.array(emb1, dtype=np.float32) + 0.01
    emb2 = (emb2 / np.linalg.norm(emb2)).tolist()

    existing_db_records = [
        ("voter-uuid-1", json.dumps(emb1))
    ]

    # Run 1-to-many duplicate search
    dup_res = find_duplicate_face(emb2, existing_db_records, threshold=0.88)
    assert dup_res["is_duplicate"] is True
    assert dup_res["matched_voter_id"] == "voter-uuid-1"
    assert dup_res["similarity"] >= 0.88

    # Test distinct face (< 0.50 similarity)
    distinct_emb = np.zeros(128, dtype=np.float32)
    distinct_emb[0] = 1.0
    distinct_emb = distinct_emb.tolist()

    unique_res = find_duplicate_face(distinct_emb, existing_db_records, threshold=0.88)
    assert unique_res["is_duplicate"] is False
    assert unique_res["matched_voter_id"] is None
