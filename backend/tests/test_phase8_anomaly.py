"""Phase 8 Tests: Suspicious Activity & Anomaly Detection Engine

Tests:
 1. Normal attendance creates no anomaly.
 2. Duplicate device creates anomaly.
 3. GPS anomaly is detected (boundary/near-edge location).
 4. Timing anomaly is detected (instantaneous / rapid check-in).
 5. Multiple signals increase risk score appropriately (MULTI_SIGNAL).
 6. Suspicious attendance is NOT automatically marked absent (status remains PRESENT/LATE).
 7. Faculty can see only their own suspicious cases.
 8. Faculty can review a suspicious case (mark as REVIEWED / CONFIRMED / DISMISSED with notes).
 9. Admin can see all suspicious cases and filter by parameters.
10. Student cannot access internal anomaly records (403 Forbidden).
11. Unauthorized users cannot modify reviews (faculty cannot review other faculty session; student blocked).
"""

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models import (
    AcademicEnrollment,
    AttendanceRecord,
    AttendanceSession,
    AttendanceStatus,
    FacultyProfile,
    QRSession,
    StudentProfile,
    SuspiciousActivity,
    TimetableEntry,
    User,
)
from scripts.seed import seed

client = TestClient(app)


def _auth(email: str, password: str) -> dict:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _cleanup_database():
    db = SessionLocal()
    db.query(SuspiciousActivity).delete(synchronize_session=False)
    db.query(AttendanceRecord).delete(synchronize_session=False)
    db.query(QRSession).delete(synchronize_session=False)
    db.query(AttendanceSession).delete(synchronize_session=False)

    # Ensure seed enrollments for student1 and student2 are active and current
    seed_enrollments = (
        db.query(AcademicEnrollment)
        .filter(
            AcademicEnrollment.section_id == 2,
            AcademicEnrollment.semester == 1,
        )
        .all()
    )
    for enr in seed_enrollments:
        enr.is_current = True
    db.commit()
    db.close()


def test_phase8_anomaly():
    print("=== Running Phase 8 Tests: Suspicious Activity & Anomaly Detection ===")

    seed()
    _cleanup_database()

    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")
    faculty1_auth = _auth("faculty@geoattend.ai", "Faculty@12345")
    faculty2_auth = _auth("faculty2@geoattend.ai", "Faculty@12345")
    student1_auth = _auth("student@geoattend.ai", "Student@12345")
    student2_auth = _auth("student2@geoattend.ai", "Student@12345")

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
    # Lab B2 entry (faculty 2)
    tt_lab_b2 = next(e for e in today_entries if e.student_group_id == 2)

    fac1 = db.query(FacultyProfile).join(User).filter(User.email == "faculty@geoattend.ai").first()
    fac2 = db.query(FacultyProfile).join(User).filter(User.email == "faculty2@geoattend.ai").first()
    student1 = db.query(StudentProfile).join(User).filter(User.email == "student@geoattend.ai").first()
    student2 = db.query(StudentProfile).join(User).filter(User.email == "student2@geoattend.ai").first()
    db.close()

    # Campus coordinates (from seed)
    CAMPUS_LAT = 18.5204
    CAMPUS_LON = 73.8567

    # ------------------------------------------------------------------
    # Start Session 1 (Faculty 1: Theory Class, 100m geofence)
    # ------------------------------------------------------------------
    print("\n[Setup] Faculty 1 starts Theory Session...")
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
    assert res.status_code == 201, f"Failed to start session: {res.text}"
    session1_id = res.json()["id"]

    # Age session1 slightly so elapsed time is > 5s (normal timing)
    db = SessionLocal()
    sess1 = db.query(AttendanceSession).filter(AttendanceSession.id == session1_id).first()
    sess1.started_at = datetime.now(timezone.utc) - timedelta(seconds=60)
    db.commit()
    db.close()

    # ------------------------------------------------------------------
    # Test 1: Normal attendance creates NO anomaly
    # ------------------------------------------------------------------
    print("\n[Test 1] Normal attendance creates no anomaly...")
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=student1_auth,
        json={
            "session_id": session1_id,
            "latitude": CAMPUS_LAT + 0.0001,  # ~15m from center, well inside 100m
            "longitude": CAMPUS_LON + 0.0001,
            "device_id": "DEVICE-STUDENT1-ORIGINAL",
        },
    )
    assert res.status_code == 201, f"Check-in failed: {res.text}"
    rec1 = res.json()
    assert rec1["status"] == "present"
    assert rec1["is_suspicious"] is False
    assert rec1["suspicion_reason"] is None

    # Verify no SuspiciousActivity row was created
    db = SessionLocal()
    anomalies = db.query(SuspiciousActivity).filter(SuspiciousActivity.attendance_record_id == rec1["id"]).all()
    assert len(anomalies) == 0
    db.close()
    print("✓ Normal check-in successful: is_suspicious=False, 0 anomalies created")

    # ------------------------------------------------------------------
    # Test 2: Duplicate device creates anomaly
    # ------------------------------------------------------------------
    print("\n[Test 2] Duplicate device creates anomaly...")
    # Student 2 checks in using the EXACT same device_id as Student 1
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=student2_auth,
        json={
            "session_id": session1_id,
            "latitude": CAMPUS_LAT + 0.0001,
            "longitude": CAMPUS_LON + 0.0001,
            "device_id": "DEVICE-STUDENT1-ORIGINAL",  # Duplicate device!
        },
    )
    assert res.status_code == 201, f"Check-in failed: {res.text}"
    rec2 = res.json()
    # Check-in is still accepted as PRESENT (NOT marked absent)
    assert rec2["status"] == "present"
    assert rec2["is_suspicious"] is True
    assert "Duplicate device" in rec2["suspicion_reason"]

    # Verify SuspiciousActivity record
    db = SessionLocal()
    dup_act = db.query(SuspiciousActivity).filter(SuspiciousActivity.attendance_record_id == rec2["id"]).first()
    assert dup_act is not None
    assert dup_act.detection_method.value in ["device", "multi_signal"]
    assert dup_act.risk_score >= 45.0
    assert dup_act.review_status.value == "pending"
    dup_activity_id = dup_act.id
    db.close()
    print(f"✓ Duplicate device correctly flagged: risk_score={dup_act.risk_score}, method={dup_act.detection_method.value}")

    # ------------------------------------------------------------------
    # Test 3: GPS anomaly is detected (boundary / near-edge location)
    # ------------------------------------------------------------------
    print("\n[Test 3] GPS boundary anomaly is detected...")
    # Start Session 2 (Faculty 1, with tighter 50m geofence)
    db = SessionLocal()
    monday_theory = (
        db.query(TimetableEntry)
        .filter(TimetableEntry.day_of_week == "monday", TimetableEntry.student_group_id.is_(None), TimetableEntry.is_active.is_(True))
        .first()
    )
    db.close()

    res = client.post(
        "/api/v1/attendance/sessions/start",
        headers=faculty1_auth,
        json={
            "timetable_entry_id": monday_theory.id,
            "geofence_latitude": CAMPUS_LAT,
            "geofence_longitude": CAMPUS_LON,
            "geofence_radius_meters": 50,
        },
    )
    assert res.status_code == 201
    session2_id = res.json()["id"]

    # Age session2 so elapsed time is > 10s (avoid rapid timing trigger)
    db = SessionLocal()
    sess2 = db.query(AttendanceSession).filter(AttendanceSession.id == session2_id).first()
    sess2.started_at = datetime.now(timezone.utc) - timedelta(seconds=120)
    db.commit()
    db.close()

    # Check-in near boundary (e.g. 43m away when radius is 50m -> 86% of radius)
    # 0.00039 deg lat ~= 43.3m
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=student1_auth,
        json={
            "session_id": session2_id,
            "latitude": CAMPUS_LAT + 0.00039,
            "longitude": CAMPUS_LON,
            "device_id": "DEVICE-STUDENT1-NEW",
        },
    )
    assert res.status_code == 201
    rec3 = res.json()
    assert rec3["status"] == "present"
    assert rec3["is_suspicious"] is True
    assert "boundary" in rec3["suspicion_reason"].lower() or "gps" in rec3["suspicion_reason"].lower()

    db = SessionLocal()
    gps_act = db.query(SuspiciousActivity).filter(SuspiciousActivity.attendance_record_id == rec3["id"]).first()
    assert gps_act is not None
    assert gps_act.detection_method.value == "gps"
    assert gps_act.risk_score >= 30.0
    db.close()
    print(f"✓ GPS boundary anomaly detected: risk_score={gps_act.risk_score}, method={gps_act.detection_method.value}")

    # ------------------------------------------------------------------
    # Test 4: Timing anomaly is detected (rapid check-in)
    # ------------------------------------------------------------------
    print("\n[Test 4] Timing anomaly is detected (rapid check-in within 1s)...")
    # Start Session 3 (Faculty 1)
    db = SessionLocal()
    friday_theory = (
        db.query(TimetableEntry)
        .filter(TimetableEntry.day_of_week == "friday", TimetableEntry.student_group_id.is_(None), TimetableEntry.is_active.is_(True))
        .first()
    )
    db.close()

    res = client.post(
        "/api/v1/attendance/sessions/start",
        headers=faculty1_auth,
        json={
            "timetable_entry_id": friday_theory.id,
            "geofence_latitude": CAMPUS_LAT,
            "geofence_longitude": CAMPUS_LON,
            "geofence_radius_meters": 100,
        },
    )
    assert res.status_code == 201
    session3_id = res.json()["id"]

    # Set started_at to NOW so check-in is instantaneous (< 2 seconds elapsed)
    db = SessionLocal()
    sess3 = db.query(AttendanceSession).filter(AttendanceSession.id == session3_id).first()
    sess3.started_at = datetime.now(timezone.utc) - timedelta(seconds=2)
    db.commit()
    db.close()

    # Immediate check-in with a brand new device
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=student1_auth,
        json={
            "session_id": session3_id,
            "latitude": CAMPUS_LAT + 0.0001,
            "longitude": CAMPUS_LON + 0.0001,
            "device_id": "DEVICE-TIMING-TEST-001",
        },
    )
    assert res.status_code == 201
    rec4 = res.json()
    assert rec4["status"] == "present"
    assert rec4["is_suspicious"] is True
    assert "Rapid" in rec4["suspicion_reason"] or "check-in" in rec4["suspicion_reason"].lower()

    db = SessionLocal()
    timing_act = db.query(SuspiciousActivity).filter(SuspiciousActivity.attendance_record_id == rec4["id"]).first()
    assert timing_act is not None
    assert timing_act.detection_method.value == "timing"
    assert timing_act.risk_score >= 25.0
    db.close()
    print(f"✓ Rapid timing anomaly detected: risk_score={timing_act.risk_score}, method={timing_act.detection_method.value}")

    # ------------------------------------------------------------------
    # Test 5: Multiple signals increase risk appropriately (MULTI_SIGNAL)
    # ------------------------------------------------------------------
    print("\n[Test 5] Multiple signals increase risk score (MULTI_SIGNAL)...")
    # In session3 (which started 0s ago), Student 2 checks in using DUPLICATE device + RAPID timing
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=student2_auth,
        json={
            "session_id": session3_id,
            "latitude": CAMPUS_LAT + 0.0001,
            "longitude": CAMPUS_LON + 0.0001,
            "device_id": "DEVICE-TIMING-TEST-001",  # Same device used by student 1!
        },
    )
    assert res.status_code == 201
    rec5 = res.json()
    assert rec5["status"] == "present"
    assert rec5["is_suspicious"] is True

    db = SessionLocal()
    multi_act = db.query(SuspiciousActivity).filter(SuspiciousActivity.attendance_record_id == rec5["id"]).first()
    assert multi_act is not None
    assert multi_act.detection_method.value == "multi_signal"
    # Duplicate device (+45) + Rapid checkin (+25) = 70.0
    assert multi_act.risk_score >= 70.0
    multi_activity_id = multi_act.id
    db.close()
    print(f"✓ Multi-signal anomaly aggregated: risk_score={multi_act.risk_score}, method={multi_act.detection_method.value}")

    # ------------------------------------------------------------------
    # Test 6: Suspicious attendance is NOT automatically marked absent
    # ------------------------------------------------------------------
    print("\n[Test 6] Verification that suspicious records remain PRESENT...")
    db = SessionLocal()
    suspicious_records = db.query(AttendanceRecord).filter(AttendanceRecord.is_suspicious.is_(True)).all()
    assert len(suspicious_records) >= 4
    for r in suspicious_records:
        assert r.status in [AttendanceStatus.PRESENT, AttendanceStatus.LATE], (
            f"Record {r.id} status was erroneously changed to {r.status}"
        )
    db.close()
    print(f"✓ All {len(suspicious_records)} flagged records correctly retained their PRESENT/LATE status")

    # ------------------------------------------------------------------
    # Test 7: Faculty can see only their own suspicious cases
    # ------------------------------------------------------------------
    print("\n[Test 7] Faculty can see only their own suspicious cases...")
    # Faculty 1 lists anomalies
    res = client.get("/api/v1/anomaly/faculty", headers=faculty1_auth)
    assert res.status_code == 200, f"Failed: {res.text}"
    fac1_anomalies = res.json()
    assert len(fac1_anomalies) >= 4
    for item in fac1_anomalies:
        assert item["faculty_name"] == "Dr. Priya Sharma"
    print(f"✓ Faculty 1 sees {len(fac1_anomalies)} anomalies (all from her own sessions)")

    # Faculty 2 lists anomalies (should be 0 because Faculty 2 has no suspicious sessions yet)
    res = client.get("/api/v1/anomaly/faculty", headers=faculty2_auth)
    assert res.status_code == 200
    fac2_anomalies = res.json()
    assert len(fac2_anomalies) == 0
    print(f"✓ Faculty 2 sees {len(fac2_anomalies)} anomalies (0 from others' sessions)")

    # ------------------------------------------------------------------
    # Test 8: Faculty can review a suspicious case
    # ------------------------------------------------------------------
    print("\n[Test 8] Faculty reviews a suspicious case...")
    res = client.post(
        f"/api/v1/anomaly/{dup_activity_id}/review",
        headers=faculty1_auth,
        json={
            "review_status": "confirmed",
            "reviewer_notes": "Student verified to have used classmate device. Flagged as proxy.",
        },
    )
    assert res.status_code == 200, f"Review failed: {res.text}"
    reviewed_data = res.json()
    assert reviewed_data["review_status"] == "confirmed"
    assert "proxy" in reviewed_data["reviewer_notes"]
    assert reviewed_data["reviewer_name"] == "Dr. Priya Sharma"
    print(f"✓ Faculty 1 successfully reviewed activity ID={dup_activity_id} (status=confirmed)")

    # ------------------------------------------------------------------
    # Test 9: Admin can see all suspicious cases and filter
    # ------------------------------------------------------------------
    print("\n[Test 9] Admin can see all suspicious cases with filters...")
    res = client.get("/api/v1/anomaly/admin", headers=admin_auth)
    assert res.status_code == 200
    admin_all = res.json()
    assert len(admin_all) >= 4
    print(f"✓ Admin sees total {len(admin_all)} suspicious cases across all faculty")

    # Filter by review_status='confirmed'
    res = client.get("/api/v1/anomaly/admin?review_status=confirmed", headers=admin_auth)
    assert res.status_code == 200
    confirmed_items = res.json()
    assert len(confirmed_items) >= 1
    assert all(i["review_status"] == "confirmed" for i in confirmed_items)
    print(f"✓ Admin filter review_status=confirmed returned {len(confirmed_items)} item(s)")

    # Filter by detection_method='multi_signal'
    res = client.get("/api/v1/anomaly/admin?detection_method=multi_signal", headers=admin_auth)
    assert res.status_code == 200
    multi_items = res.json()
    assert len(multi_items) >= 1
    assert all(i["detection_method"] == "multi_signal" for i in multi_items)
    print(f"✓ Admin filter detection_method=multi_signal returned {len(multi_items)} item(s)")

    # Admin reviews multi-signal activity to 'dismissed'
    res = client.post(
        f"/api/v1/anomaly/{multi_activity_id}/review",
        headers=admin_auth,
        json={
            "review_status": "dismissed",
            "reviewer_notes": "Device sharing permitted by admin exception.",
        },
    )
    assert res.status_code == 200
    assert res.json()["review_status"] == "dismissed"
    print(f"✓ Admin successfully reviewed activity ID={multi_activity_id} (status=dismissed)")

    # ------------------------------------------------------------------
    # Test 10: Student cannot access internal anomaly records
    # ------------------------------------------------------------------
    print("\n[Test 10] Student cannot access internal anomaly records...")
    res = client.get("/api/v1/anomaly/faculty", headers=student1_auth)
    assert res.status_code == 403
    res = client.get("/api/v1/anomaly/admin", headers=student1_auth)
    assert res.status_code == 403
    res = client.get(f"/api/v1/anomaly/{dup_activity_id}", headers=student1_auth)
    assert res.status_code == 403
    res = client.post(
        f"/api/v1/anomaly/{dup_activity_id}/review",
        headers=student1_auth,
        json={"review_status": "dismissed"},
    )
    assert res.status_code == 403
    print("✓ Student blocked from all anomaly management APIs with 403 Forbidden")

    # ------------------------------------------------------------------
    # Test 11: Unauthorized users cannot modify reviews
    # ------------------------------------------------------------------
    print("\n[Test 11] Faculty cannot review other faculty's session anomalies...")
    # Faculty 2 tries to review Faculty 1's anomaly
    res = client.post(
        f"/api/v1/anomaly/{dup_activity_id}/review",
        headers=faculty2_auth,
        json={"review_status": "dismissed", "reviewer_notes": "Attempted unauthorized edit"},
    )
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    print("✓ Faculty 2 blocked with 403 Forbidden on Faculty 1's anomaly")

    # Faculty 2 tries to view detail of Faculty 1's anomaly
    res = client.get(f"/api/v1/anomaly/{dup_activity_id}", headers=faculty2_auth)
    assert res.status_code == 403
    print("✓ Faculty 2 blocked from viewing detail of Faculty 1's anomaly")

    print("\n========================================================")
    print("🎉 ALL PHASE 8 SUSPICIOUS ACTIVITY TESTS PASSED 100%!")
    print("========================================================")


if __name__ == "__main__":
    test_phase8_anomaly()
