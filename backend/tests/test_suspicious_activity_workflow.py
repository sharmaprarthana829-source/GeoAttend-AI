"""Test Suspicious Activity Workflow, Data Quality Handling, Stats, and Audit Trail."""

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models import (
    AttendanceRecord,
    AttendanceSession,
    DetectionMethod,
    ReviewStatus,
    StudentProfile,
    SuspiciousActivity,
    User,
)
from scripts.seed import seed

client = TestClient(app)


def _auth(email: str, password: str) -> dict:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_suspicious_activity_full_workflow():
    seed()
    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")
    student1_auth = _auth("student@geoattend.ai", "Student@12345")

    db = SessionLocal()
    student = db.query(StudentProfile).first()
    session = db.query(AttendanceSession).first()

    rec = db.query(AttendanceRecord).first()
    if not rec:
        rec = AttendanceRecord(
            session_id=session.id,
            student_id=student.id,
            status=ReviewStatus.PENDING,  # or AttendanceStatus.PRESENT
            device_id="TEST-DEV-001",
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)

    # Create a test suspicious activity with negative duration in reason
    # to simulate the data quality issue scenario
    dq_activity = SuspiciousActivity(
        attendance_record_id=rec.id,
        student_id=student.id,
        session_id=session.id,
        risk_score=25.0,
        detection_method=DetectionMethod.TIMING,
        reason="Rapid check-in within -19799.9s of session start",
        raw_signals='{"elapsed_seconds": -19799.9, "is_data_quality_issue": true}',
        review_status=ReviewStatus.PENDING,
    )
    db.add(dq_activity)
    db.commit()
    db.refresh(dq_activity)
    dq_id = dq_activity.id
    db.close()

    # 1. Test Stats endpoint
    res = client.get("/api/v1/anomaly/stats", headers=admin_auth)
    assert res.status_code == 200, res.text
    stats = res.json()
    assert "total_flagged" in stats
    assert "pending_reviews" in stats
    assert "data_quality_issues" in stats
    assert stats["data_quality_issues"] >= 1, "Data quality issue was not counted"

    # 2. Test Get Detail and verify data quality detection
    res = client.get(f"/api/v1/anomaly/{dq_id}", headers=admin_auth)
    assert res.status_code == 200, res.text
    detail = res.json()
    assert detail["is_data_quality_issue"] is True
    assert "Chronological" in detail["data_quality_reason"] or "Negative" in detail["data_quality_reason"]
    assert detail["severity"] == "low"

    # 3. Test Review workflow: Mark as Confirmed Violation
    review_payload = {
        "review_status": "confirmed",
        "reviewer_notes": "Reviewed security logs; confirmed suspicious proxy check-in.",
        "decision_reason": "Confirmed physical absence during session window.",
    }
    res = client.post(f"/api/v1/anomaly/{dq_id}/review", headers=admin_auth, json=review_payload)
    assert res.status_code == 200, res.text
    reviewed_detail = res.json()
    assert reviewed_detail["review_status"] == "confirmed"
    assert reviewed_detail["reviewer_notes"] == review_payload["reviewer_notes"]

    # 4. Test History audit trail endpoint
    res = client.get(f"/api/v1/anomaly/{dq_id}/history", headers=admin_auth)
    assert res.status_code == 200, res.text
    history = res.json()
    assert len(history) >= 1
    latest_hist = history[0]
    assert latest_hist["action"] == "SUSPICIOUS_ACTIVITY_REVIEW"
    assert latest_hist["new_status"] == "confirmed"

    # 5. Test Reopening / changing status to dismissed (False Positive)
    dismiss_payload = {
        "review_status": "dismissed",
        "reviewer_notes": "Student provided approved medical slip and manual attendance verified.",
        "decision_reason": "False alarm; timing discrepancy was due to network clock drift.",
    }
    res = client.post(f"/api/v1/anomaly/{dq_id}/review", headers=admin_auth, json=dismiss_payload)
    assert res.status_code == 200
    assert res.json()["review_status"] == "dismissed"

    # 6. Verify audit history has now 2 items
    res = client.get(f"/api/v1/anomaly/{dq_id}/history", headers=admin_auth)
    assert res.status_code == 200
    history = res.json()
    assert len(history) >= 2
    assert history[0]["new_status"] == "dismissed"
    assert history[1]["new_status"] == "confirmed"

    # 7. Student authorization barrier: Students cannot view stats or reviews
    res = client.get("/api/v1/anomaly/stats", headers=student1_auth)
    assert res.status_code == 403

    res = client.post(f"/api/v1/anomaly/{dq_id}/review", headers=student1_auth, json=dismiss_payload)
    assert res.status_code == 403

    # Clean up test activity
    db = SessionLocal()
    act = db.query(SuspiciousActivity).filter(SuspiciousActivity.id == dq_id).first()
    if act:
        db.delete(act)
        db.commit()
    db.close()
