"""Tests for Attendance Monitor Admin Features:
- Monitor dynamic stats
- Admin session listings and filters
- Admin session termination
- Admin records with verification data
- Attendance manual override and audit history
- Role-based access control
"""

import sys
from pathlib import Path
from datetime import date

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models import (
    AttendanceRecord,
    AttendanceSession,
    AttendanceStatus,
    DayOfWeek,
    FacultyAssignment,
    FacultyProfile,
    SessionStatus,
    StudentProfile,
    TimetableEntry,
    User,
    UserRole,
)
from scripts.seed import seed

client = TestClient(app)


def _auth(email: str, password: str) -> dict:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _cleanup_sessions():
    db = SessionLocal()
    from app.models import SuspiciousActivity, QRSession
    db.query(SuspiciousActivity).delete(synchronize_session=False)
    db.query(AttendanceRecord).delete(synchronize_session=False)
    db.query(QRSession).delete(synchronize_session=False)
    db.query(AttendanceSession).delete(synchronize_session=False)
    db.commit()
    db.close()


def test_attendance_monitor_admin_flow():
    seed()
    _cleanup_sessions()

    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")
    faculty_auth = _auth("faculty@geoattend.ai", "Faculty@12345")
    student_auth = _auth("student@geoattend.ai", "Student@12345")

    # 1. Admin Monitor Stats
    res_stats = client.get("/api/v1/attendance/admin/monitor-stats", headers=admin_auth)
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert "active_sessions" in stats
    assert "scheduled_today" in stats
    assert "completed_today" in stats
    assert "students_present" in stats
    assert "late_checkins" in stats
    assert "suspicious_checkins" in stats
    assert "total_records" in stats
    assert stats["scheduled_today"] >= 1

    # Non-admin cannot access monitor stats
    res_forbidden = client.get("/api/v1/attendance/admin/monitor-stats", headers=student_auth)
    assert res_forbidden.status_code == 403

    # 2. Start a session as faculty
    db = SessionLocal()
    day_name = date.today().strftime("%A").lower()
    today_enum = DayOfWeek(day_name)
    tt_entry = (
        db.query(TimetableEntry)
        .filter(TimetableEntry.day_of_week == today_enum, TimetableEntry.is_active.is_(True))
        .first()
    )
    assert tt_entry is not None, "Need at least one timetable entry for today"
    tt_id = tt_entry.id
    db.close()

    res_start = client.post(
        "/api/v1/attendance/sessions/start",
        json={"timetable_entry_id": tt_id},
        headers=faculty_auth,
    )
    assert res_start.status_code == 201
    session_data = res_start.json()
    session_id = session_data["id"]

    # 3. Verify Admin sees the active session with filters
    res_sessions = client.get(
        "/api/v1/attendance/admin/sessions?status=active",
        headers=admin_auth,
    )
    assert res_sessions.status_code == 200
    sess_list = res_sessions.json()
    assert any(s["id"] == session_id for s in sess_list)
    found_sess = next(s for s in sess_list if s["id"] == session_id)
    assert found_sess["faculty_name"] is not None
    assert found_sess["subject_name"] is not None

    # Search filter works
    res_search = client.get(
        f"/api/v1/attendance/admin/sessions?query={found_sess['subject_code'][:3]}",
        headers=admin_auth,
    )
    assert res_search.status_code == 200
    assert any(s["id"] == session_id for s in res_search.json())

    # 4. Student check-in to generate a record
    res_qr = client.get(f"/api/v1/attendance/sessions/{session_id}/qr", headers=faculty_auth)
    qr_token = res_qr.json()["token"] if res_qr.status_code == 200 else None

    res_checkin = client.post(
        "/api/v1/attendance/check-in",
        json={
            "session_id": session_id,
            "qr_token": qr_token,
            "latitude": 28.6139,
            "longitude": 77.2090,
            "accuracy_meters": 10.0,
            "device_id": "STU_DEV_001",
        },
        headers=student_auth,
    )
    assert res_checkin.status_code == 201
    rec_id = res_checkin.json()["id"]

    # 5. Admin lists records
    res_records = client.get("/api/v1/attendance/admin/records", headers=admin_auth)
    assert res_records.status_code == 200
    records = res_records.json()
    assert any(r["id"] == rec_id for r in records)
    rec_item = next(r for r in records if r["id"] == rec_id)
    assert rec_item["student_name"] != "Unknown"
    assert "gps_status" in rec_item
    assert "device_status" in rec_item

    # 6. Admin attendance manual override
    res_override = client.post(
        f"/api/v1/attendance/records/{rec_id}/override",
        json={"status": "excused", "reason": "Medical leave verified by dean"},
        headers=admin_auth,
    )
    assert res_override.status_code == 200
    assert res_override.json()["status"] == "excused"
    assert res_override.json()["is_manually_adjusted"] is True

    # Student cannot override
    res_override_denied = client.post(
        f"/api/v1/attendance/records/{rec_id}/override",
        json={"status": "present", "reason": "Self-override attempt"},
        headers=student_auth,
    )
    assert res_override_denied.status_code == 403

    # 7. Admin views audit history for record
    res_history = client.get(f"/api/v1/attendance/records/{rec_id}/history", headers=admin_auth)
    assert res_history.status_code == 200
    history = res_history.json()
    assert len(history) >= 1
    assert history[0]["action"] == "ATTENDANCE_OVERRIDE"
    assert history[0]["new_status"] == "excused"
    assert "Medical leave" in history[0]["reason"]

    # 8. Admin closes active session
    res_close = client.post(f"/api/v1/attendance/sessions/{session_id}/close", headers=admin_auth)
    assert res_close.status_code == 200
    assert res_close.json()["status"] in ["closed", "completed"]
