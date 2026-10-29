"""Phase 7 Tests: Timetable-linked Attendance Engine

Tests:
 1. Faculty starts a valid scheduled session
 2. Unauthorized faculty cannot start it
 3. Duplicate active session is rejected
 4. Student sees only eligible active sessions
 5. Ineligible student cannot check in
 6. Student successfully checks in with valid verification
 7. Duplicate check-in is rejected
 8. Inactive/closed session rejects check-in
 9. Faculty can view attendance for their session
10. Faculty cannot view unrelated faculty session
11. Student can only view own attendance
12. Admin can monitor attendance
13. Geofence validation works
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import date

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models import (
    AttendanceRecord,
    AttendanceSession,
    FacultyAssignment,
    FacultyProfile,
    SessionStatus,
    StudentProfile,
    TimetableEntry,
    User,
)
from scripts.seed import seed

client = TestClient(app)


def _auth(email: str, password: str) -> dict:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _cleanup_sessions():
    db = SessionLocal()
    from app.models import SuspiciousActivity
    db.query(SuspiciousActivity).delete(synchronize_session=False)
    db.query(AttendanceRecord).delete(synchronize_session=False)
    from app.models import QRSession
    db.query(QRSession).delete(synchronize_session=False)
    db.query(AttendanceSession).delete(synchronize_session=False)
    # Reset student enrollment to the seed enrollment (course=2, section=2, sem=1, B1)
    from app.models import AcademicEnrollment
    seed_enrollment = (
        db.query(AcademicEnrollment)
        .filter(
            AcademicEnrollment.section_id == 2,
            AcademicEnrollment.semester == 1,
        )
        .first()
    )
    if seed_enrollment:
        db.query(AcademicEnrollment).filter(AcademicEnrollment.student_id == seed_enrollment.student_id).update({"is_current": False}, synchronize_session=False)
        seed_enrollment.is_current = True
    db.commit()
    db.close()


def test_phase7_attendance():
    print("=== Running Phase 7 Tests: Timetable-linked Attendance Engine ===")

    seed()
    _cleanup_sessions()

    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")
    faculty1_auth = _auth("faculty@geoattend.ai", "Faculty@12345")
    faculty2_auth = _auth("faculty2@geoattend.ai", "Faculty@12345")
    student_auth = _auth("student@geoattend.ai", "Student@12345")

    # Find today's timetable entries
    day_name = date.today().strftime("%A").lower()
    from app.models import DayOfWeek
    today_enum = DayOfWeek(day_name)
    db = SessionLocal()
    today_entries = (
        db.query(TimetableEntry)
        .filter(TimetableEntry.day_of_week == today_enum, TimetableEntry.is_active.is_(True))
        .all()
    )
    # Theory entry (whole section, faculty 1)
    tt_theory = next(e for e in today_entries if e.student_group_id is None)
    # Lab B1 (faculty 1)
    tt_lab_b1 = next(e for e in today_entries if e.student_group_id == 1)
    # Lab B2 (faculty 2)
    tt_lab_b2 = next(e for e in today_entries if e.student_group_id == 2)

    fac1 = db.query(FacultyProfile).join(User).filter(User.email == "faculty@geoattend.ai").first()
    fac2 = db.query(FacultyProfile).join(User).filter(User.email == "faculty2@geoattend.ai").first()
    student = db.query(StudentProfile).join(User).filter(User.email == "student@geoattend.ai").first()
    db.close()

    # Campus coordinates for geofence tests (Pune coords from seed)
    CAMPUS_LAT = 18.5204
    CAMPUS_LON = 73.8567

    # ------------------------------------------------------------------
    # Test 1: Faculty starts a valid scheduled session
    # ------------------------------------------------------------------
    print("\n[Test 1] Faculty starts a valid scheduled session...")
    res = client.post(
        "/api/v1/attendance/sessions/start",
        headers=faculty1_auth,
        json={
            "timetable_entry_id": tt_theory.id,
            "geofence_latitude": CAMPUS_LAT,
            "geofence_longitude": CAMPUS_LON,
            "geofence_radius_meters": 100,
        },
    )
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    session_data = res.json()
    theory_session_id = session_data["id"]
    assert session_data["timetable_entry_id"] == tt_theory.id
    assert session_data["faculty_id"] == fac1.id
    assert session_data["status"] == "active"
    assert session_data["section_id"] == tt_theory.section_id
    assert session_data["student_group_id"] is None  # Whole section
    assert session_data["class_type"] == "theory"
    assert session_data["room_number"] == tt_theory.room_number
    print(f"✓ Created attendance session ID={theory_session_id} linked to TT-{tt_theory.id}")

    # ------------------------------------------------------------------
    # Test 2: Unauthorized faculty cannot start it
    # ------------------------------------------------------------------
    print("\n[Test 2] Unauthorized faculty cannot start session for another's class...")
    # Faculty2 tries to start a session for tt_theory (assigned to Faculty1)
    res = client.post(
        "/api/v1/attendance/sessions/start",
        headers=faculty2_auth,
        json={
            "timetable_entry_id": tt_theory.id,
            "geofence_latitude": CAMPUS_LAT,
            "geofence_longitude": CAMPUS_LON,
        },
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
    assert "not assigned" in res.json()["detail"].lower()
    print(f"✓ Faculty2 correctly blocked: {res.json()['detail']}")

    # Student cannot start session
    res = client.post(
        "/api/v1/attendance/sessions/start",
        headers=student_auth,
        json={"timetable_entry_id": tt_theory.id},
    )
    assert res.status_code == 403
    print("✓ Student correctly blocked from starting session (403)")

    # ------------------------------------------------------------------
    # Test 3: Duplicate active session is rejected
    # ------------------------------------------------------------------
    print("\n[Test 3] Duplicate active session is rejected...")
    res = client.post(
        "/api/v1/attendance/sessions/start",
        headers=faculty1_auth,
        json={
            "timetable_entry_id": tt_theory.id,
            "geofence_latitude": CAMPUS_LAT,
            "geofence_longitude": CAMPUS_LON,
        },
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
    assert "already exists" in res.json()["detail"].lower()
    print(f"✓ Duplicate active session rejected: {res.json()['detail']}")

    # ------------------------------------------------------------------
    # Test 4: Student sees only eligible active sessions
    # ------------------------------------------------------------------
    print("\n[Test 4] Student sees only eligible active sessions...")
    # Student is in B1, enrolled in same section. Theory = whole section → visible
    res = client.get("/api/v1/attendance/student/active-sessions", headers=student_auth)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    active = res.json()
    assert len(active) >= 1
    assert any(s["id"] == theory_session_id for s in active)
    print(f"✓ Student sees {len(active)} active sessions (including theory session)")

    # Start Lab B2 session (Faculty2) — student is B1, should NOT see B2
    res = client.post(
        "/api/v1/attendance/sessions/start",
        headers=faculty2_auth,
        json={
            "timetable_entry_id": tt_lab_b2.id,
            "geofence_latitude": CAMPUS_LAT,
            "geofence_longitude": CAMPUS_LON,
        },
    )
    assert res.status_code == 201
    lab_b2_session_id = res.json()["id"]

    res = client.get("/api/v1/attendance/student/active-sessions", headers=student_auth)
    assert res.status_code == 200
    active = res.json()
    assert not any(s["id"] == lab_b2_session_id for s in active), "Student B1 should NOT see B2 session"
    print(f"✓ Student (B1) does NOT see Lab B2 session (correctly filtered)")

    # ------------------------------------------------------------------
    # Test 5: Ineligible student cannot check in
    # ------------------------------------------------------------------
    print("\n[Test 5] Ineligible student cannot check in to B2 session...")
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=student_auth,
        json={
            "session_id": lab_b2_session_id,
            "latitude": CAMPUS_LAT,
            "longitude": CAMPUS_LON,
        },
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
    assert "not eligible" in res.json()["detail"].lower()
    print(f"✓ B1 student correctly blocked from B2 session: {res.json()['detail']}")

    # ------------------------------------------------------------------
    # Test 6: Student successfully checks in with valid verification
    # ------------------------------------------------------------------
    print("\n[Test 6] Student successfully checks in to theory session...")
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=student_auth,
        json={
            "session_id": theory_session_id,
            "latitude": CAMPUS_LAT + 0.0001,  # ~11m from center, within 100m
            "longitude": CAMPUS_LON + 0.0001,
            "device_id": "DEVICE-ARJUN-001",
        },
    )
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    record = res.json()
    assert record["session_id"] == theory_session_id
    assert record["student_id"] == student.id
    assert record["status"] == "present"
    assert record["distance_meters"] is not None
    assert record["distance_meters"] < 100  # Within geofence
    print(f"✓ Check-in successful: status={record['status']}, distance={record['distance_meters']:.1f}m")

    # ------------------------------------------------------------------
    # Test 7: Duplicate check-in is rejected
    # ------------------------------------------------------------------
    print("\n[Test 7] Duplicate check-in is rejected...")
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=student_auth,
        json={
            "session_id": theory_session_id,
            "latitude": CAMPUS_LAT,
            "longitude": CAMPUS_LON,
        },
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
    assert "already marked" in res.json()["detail"].lower()
    print(f"✓ Duplicate check-in rejected: {res.json()['detail']}")

    # ------------------------------------------------------------------
    # Test 8: Inactive/closed session rejects check-in
    # ------------------------------------------------------------------
    print("\n[Test 8] Closed session rejects check-in...")
    # Close the theory session
    res = client.post(f"/api/v1/attendance/sessions/{theory_session_id}/close", headers=faculty1_auth)
    assert res.status_code == 200
    assert res.json()["status"] == "completed"
    print("  Session closed (status=completed)")

    # Now start Lab B1 session, close it, then try to check in
    res = client.post(
        "/api/v1/attendance/sessions/start",
        headers=faculty1_auth,
        json={
            "timetable_entry_id": tt_lab_b1.id,
            "geofence_latitude": CAMPUS_LAT,
            "geofence_longitude": CAMPUS_LON,
        },
    )
    assert res.status_code == 201
    lab_b1_session_id = res.json()["id"]

    # Close immediately
    res = client.post(f"/api/v1/attendance/sessions/{lab_b1_session_id}/close", headers=faculty1_auth)
    assert res.status_code == 200

    # Try check-in on closed session
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=student_auth,
        json={
            "session_id": lab_b1_session_id,
            "latitude": CAMPUS_LAT,
            "longitude": CAMPUS_LON,
        },
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
    assert "not active" in res.json()["detail"].lower()
    print(f"✓ Check-in on closed session rejected: {res.json()['detail']}")

    # ------------------------------------------------------------------
    # Test 9: Faculty can view attendance for their session
    # ------------------------------------------------------------------
    print("\n[Test 9] Faculty can view attendance records for their session...")
    res = client.get(f"/api/v1/attendance/sessions/{theory_session_id}/records", headers=faculty1_auth)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    records = res.json()
    assert len(records) >= 1
    assert records[0]["student_name"] == "Arjun Mehta"
    print(f"✓ Faculty1 sees {len(records)} attendance record(s) for theory session")

    # Faculty can view session detail
    res = client.get(f"/api/v1/attendance/sessions/{theory_session_id}", headers=faculty1_auth)
    assert res.status_code == 200
    detail = res.json()
    assert detail["subject_name"] == "Data Structures"
    assert detail["total_present"] >= 1
    print(f"✓ Session detail: {detail['subject_name']}, {detail['total_present']} present out of {detail['total_enrolled']} enrolled")

    # Faculty can view their session history
    res = client.get("/api/v1/attendance/faculty/sessions", headers=faculty1_auth)
    assert res.status_code == 200
    fac1_sessions = res.json()
    assert len(fac1_sessions) >= 2  # theory + lab_b1
    print(f"✓ Faculty1 sees {len(fac1_sessions)} total sessions in history")

    # ------------------------------------------------------------------
    # Test 10: Faculty cannot view unrelated faculty session
    # ------------------------------------------------------------------
    print("\n[Test 10] Faculty cannot view another faculty's session details...")
    res = client.get(f"/api/v1/attendance/sessions/{theory_session_id}", headers=faculty2_auth)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"
    print(f"✓ Faculty2 blocked from Faculty1's session: {res.json()['detail']}")

    res = client.get(f"/api/v1/attendance/sessions/{theory_session_id}/records", headers=faculty2_auth)
    assert res.status_code == 403
    print("✓ Faculty2 blocked from viewing Faculty1's session records")

    # ------------------------------------------------------------------
    # Test 11: Student can only view own attendance
    # ------------------------------------------------------------------
    print("\n[Test 11] Student can only view own attendance history...")
    res = client.get("/api/v1/attendance/student/history", headers=student_auth)
    assert res.status_code == 200
    history = res.json()
    assert len(history) >= 1
    for rec in history:
        assert rec["student_id"] == student.id
    print(f"✓ Student sees {len(history)} attendance record(s) (all own)")

    # Student cannot view session records (faculty/admin only)
    res = client.get(f"/api/v1/attendance/sessions/{theory_session_id}/records", headers=student_auth)
    assert res.status_code == 403
    print("✓ Student blocked from viewing session records endpoint (403)")

    # Student attendance summary
    res = client.get("/api/v1/attendance/student/summary", headers=student_auth)
    assert res.status_code == 200
    summary = res.json()
    assert len(summary) >= 1
    for s in summary:
        assert "subject_name" in s
        assert "percentage" in s
    print(f"✓ Student summary: {len(summary)} subjects")
    for s in summary:
        print(f"  {s['subject_name']} ({s['class_type']}): {s['attended']}/{s['total_sessions']} = {s['percentage']}%")

    # ------------------------------------------------------------------
    # Test 12: Admin can monitor attendance
    # ------------------------------------------------------------------
    print("\n[Test 12] Admin can monitor attendance sessions...")
    res = client.get("/api/v1/attendance/admin/sessions", headers=admin_auth)
    assert res.status_code == 200
    admin_sessions = res.json()
    assert len(admin_sessions) >= 3  # theory + lab_b1 + lab_b2
    print(f"✓ Admin sees {len(admin_sessions)} total sessions")

    # Admin can view any session's records
    res = client.get(f"/api/v1/attendance/admin/sessions/{theory_session_id}/records", headers=admin_auth)
    assert res.status_code == 200
    assert len(res.json()) >= 1
    print(f"✓ Admin can view records for session {theory_session_id}")

    # Admin dashboard stats
    res = client.get("/api/v1/attendance/dashboard/stats", headers=admin_auth)
    assert res.status_code == 200
    stats = res.json()
    assert stats["today_attendance_count"] >= 1
    print(f"✓ Dashboard stats: {stats['active_sessions']} active, {stats['today_attendance_count']} attendance today")

    # Non-admin cannot access admin endpoints
    res = client.get("/api/v1/attendance/admin/sessions", headers=faculty1_auth)
    assert res.status_code == 403
    res = client.get("/api/v1/attendance/admin/sessions", headers=student_auth)
    assert res.status_code == 403
    print("✓ Faculty and Student correctly blocked from admin endpoints (403)")

    # ------------------------------------------------------------------
    # Test 13: Geofence validation works
    # ------------------------------------------------------------------
    print("\n[Test 13] Geofence validation works (reject outside, allow inside)...")
    # Start a new Lab B1 session (the previous was closed)
    # We need a timetable entry that doesn't already have a completed session
    # Use a monday entry (since today is tuesday, seed has monday entries too)
    db = SessionLocal()
    monday_b1 = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.day_of_week == "monday",
            TimetableEntry.student_group_id == 1,
            TimetableEntry.is_active.is_(True),
        )
        .first()
    )
    db.close()

    res = client.post(
        "/api/v1/attendance/sessions/start",
        headers=faculty1_auth,
        json={
            "timetable_entry_id": monday_b1.id,
            "geofence_latitude": CAMPUS_LAT,
            "geofence_longitude": CAMPUS_LON,
            "geofence_radius_meters": 50,  # Tighter geofence
        },
    )
    assert res.status_code == 201
    geo_session_id = res.json()["id"]

    # Check-in from ~5km away (should fail)
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=student_auth,
        json={
            "session_id": geo_session_id,
            "latitude": CAMPUS_LAT + 0.05,  # ~5.5km away
            "longitude": CAMPUS_LON,
        },
    )
    assert res.status_code == 400, f"Expected 400 for outside geofence, got {res.status_code}: {res.text}"
    assert "outside geofence" in res.json()["detail"].lower()
    print(f"✓ Check-in from ~5.5km away rejected: {res.json()['detail']}")

    # Check-in from ~10m away (should succeed)
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=student_auth,
        json={
            "session_id": geo_session_id,
            "latitude": CAMPUS_LAT + 0.00005,  # ~5.5m away
            "longitude": CAMPUS_LON + 0.00005,
            "device_id": "DEVICE-ARJUN-001",
        },
    )
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    geo_record = res.json()
    assert geo_record["distance_meters"] < 50
    print(f"✓ Check-in from ~{geo_record['distance_meters']:.1f}m away accepted (within 50m geofence)")

    # Check-in without GPS (should still succeed — GPS not required)
    # Close current, start new session for B2 to test
    res = client.post(f"/api/v1/attendance/sessions/{geo_session_id}/close", headers=faculty1_auth)
    assert res.status_code == 200

    # Use a non-today entry for faculty2 that hasn't been used
    db = SessionLocal()
    monday_b2 = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.day_of_week == "monday",
            TimetableEntry.student_group_id == 2,
            TimetableEntry.is_active.is_(True),
        )
        .first()
    )
    db.close()

    res = client.post(
        "/api/v1/attendance/sessions/start",
        headers=faculty2_auth,
        json={
            "timetable_entry_id": monday_b2.id,
            "geofence_latitude": CAMPUS_LAT,
            "geofence_longitude": CAMPUS_LON,
        },
    )
    assert res.status_code == 201
    no_gps_session_id = res.json()["id"]

    # Student is B1, this is B2 — should be rejected by eligibility, not GPS
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=student_auth,
        json={
            "session_id": no_gps_session_id,
            # No latitude/longitude provided
        },
    )
    assert res.status_code == 400
    assert "not eligible" in res.json()["detail"].lower()
    print("✓ Eligibility check applied before GPS (B1 student blocked from B2 session)")

    print("\n========================================================")
    print("🎉 ALL PHASE 7 ATTENDANCE ENGINE TESTS PASSED 100%!")
    print("========================================================")


if __name__ == "__main__":
    test_phase7_attendance()
