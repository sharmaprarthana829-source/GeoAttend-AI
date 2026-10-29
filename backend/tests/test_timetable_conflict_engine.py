import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models import (
    AttendanceRecord,
    AttendanceSession,
    FacultyAssignment,
    FacultyProfile,
    QRSession,
    Section,
    StudentGroup,
    SubjectOffering,
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


def _get_context():
    db = SessionLocal()
    sec = db.query(Section).filter(Section.name == "CSD-A").first()
    b1 = db.query(StudentGroup).filter(StudentGroup.section_id == sec.id, StudentGroup.name == "B1").first()
    b2 = db.query(StudentGroup).filter(StudentGroup.section_id == sec.id, StudentGroup.name == "B2").first()
    fac1 = db.query(FacultyProfile).join(User).filter(User.email == "faculty@geoattend.ai").first()
    fac2 = db.query(FacultyProfile).join(User).filter(User.email == "faculty2@geoattend.ai").first()

    off_theory = db.query(SubjectOffering).filter(SubjectOffering.section_id == sec.id, SubjectOffering.student_group_id.is_(None)).first()
    off_b1 = db.query(SubjectOffering).filter(SubjectOffering.section_id == sec.id, SubjectOffering.student_group_id == b1.id).first()
    off_b2 = db.query(SubjectOffering).filter(SubjectOffering.section_id == sec.id, SubjectOffering.student_group_id == b2.id).first()

    asgn_theory = db.query(FacultyAssignment).filter(FacultyAssignment.faculty_id == fac1.id, FacultyAssignment.subject_offering_id == off_theory.id).first()
    asgn_b1 = db.query(FacultyAssignment).filter(FacultyAssignment.faculty_id == fac1.id, FacultyAssignment.subject_offering_id == off_b1.id).first()
    asgn_b2 = db.query(FacultyAssignment).filter(FacultyAssignment.faculty_id == fac2.id, FacultyAssignment.subject_offering_id == off_b2.id).first()

    ctx = {
        "sec_id": sec.id,
        "b1_id": b1.id,
        "b2_id": b2.id,
        "fac1_id": fac1.id,
        "fac2_id": fac2.id,
        "off_theory_id": off_theory.id,
        "off_b1_id": off_b1.id,
        "off_b2_id": off_b2.id,
        "asgn_theory_id": asgn_theory.id,
        "asgn_b1_id": asgn_b1.id,
        "asgn_b2_id": asgn_b2.id,
    }
    db.close()
    return ctx


def test_conflict_engine_and_summaries():
    seed()
    db = SessionLocal()
    # Clean up test days
    db.query(SuspiciousActivity).delete(synchronize_session=False)
    db.query(AttendanceRecord).delete(synchronize_session=False)
    db.query(QRSession).delete(synchronize_session=False)
    db.query(AttendanceSession).delete(synchronize_session=False)
    db.query(TimetableEntry).filter(TimetableEntry.day_of_week.in_(["thursday", "friday", "saturday"])).delete(synchronize_session=False)
    db.commit()
    db.close()

    admin_token = _auth("admin@geoattend.ai", "Admin@12345")
    ctx = _get_context()

    # 1. Test validate-conflicts for invalid interval
    res = client.post(
        "/api/v1/timetable/validate-conflicts",
        headers=admin_token,
        json={
            "day_of_week": "thursday",
            "start_time": "11:00:00",
            "end_time": "10:00:00",
            "room_number": "C-204",
            "subject_offering_id": ctx["off_theory_id"],
            "faculty_assignment_id": ctx["asgn_theory_id"],
        },
    )
    assert res.status_code == 200
    val_data = res.json()
    assert len(val_data["errors"]) > 0
    assert "start_time" in val_data["errors"][0]

    # 2. Create base entry for Thursday 09:00 - 10:00
    res = client.post(
        "/api/v1/timetable",
        headers=admin_token,
        json={
            "day_of_week": "thursday",
            "start_time": "09:00:00",
            "end_time": "10:00:00",
            "room_number": "C-204",
            "subject_offering_id": ctx["off_theory_id"],
            "faculty_assignment_id": ctx["asgn_theory_id"],
        },
    )
    assert res.status_code == 201
    base_id = res.json()["id"]

    # 3. Test validate-conflicts for prospective overlapping entry (Faculty Clash)
    res = client.post(
        "/api/v1/timetable/validate-conflicts",
        headers=admin_token,
        json={
            "day_of_week": "thursday",
            "start_time": "09:30:00",
            "end_time": "10:30:00",
            "room_number": "C-999",  # Different room
            "subject_offering_id": ctx["off_b1_id"],
            "faculty_assignment_id": ctx["asgn_b1_id"],  # Same faculty (Dr. Priya)
        },
    )
    assert res.status_code == 200
    val_data = res.json()
    assert val_data["has_conflict"] is True
    assert any(c["conflict_type"] == "faculty" for c in val_data["conflicts"])

    # 4. Test validate-conflicts for Room Clash
    res = client.post(
        "/api/v1/timetable/validate-conflicts",
        headers=admin_token,
        json={
            "day_of_week": "thursday",
            "start_time": "09:30:00",
            "end_time": "10:30:00",
            "room_number": "C-204",  # Same room!
            "subject_offering_id": ctx["off_b2_id"],
            "faculty_assignment_id": ctx["asgn_b2_id"],  # Different faculty (Rajesh)
        },
    )
    assert res.status_code == 200
    val_data = res.json()
    assert val_data["has_conflict"] is True
    assert any(c["conflict_type"] == "room" for c in val_data["conflicts"])

    # 5. Test Admin Override workflow
    res = client.post(
        "/api/v1/timetable",
        headers=admin_token,
        json={
            "day_of_week": "thursday",
            "start_time": "09:30:00",
            "end_time": "10:30:00",
            "room_number": "C-204",
            "subject_offering_id": ctx["off_b2_id"],
            "faculty_assignment_id": ctx["asgn_b2_id"],
            "allow_override": True,
            "override_reason": "Authorized lab dual demonstration session by Vice Principal",
        },
    )
    assert res.status_code == 201
    overridden_id = res.json()["id"]

    # 6. Test conflict summary endpoint
    res = client.get("/api/v1/timetable/conflict-summary", headers=admin_token)
    assert res.status_code == 200
    summary = res.json()
    assert summary["total_entries"] >= 2
    assert summary["room_conflicts"] >= 1
    assert summary["has_any_conflict"] is True

    # 7. Test listing with conflict analysis and search
    res = client.get("/api/v1/timetable?day_of_week=thursday", headers=admin_token)
    assert res.status_code == 200
    thurs_entries = res.json()
    assert len(thurs_entries) >= 2
    clashed = [e for e in thurs_entries if e["id"] in (base_id, overridden_id)]
    for e in clashed:
        assert e["has_conflict"] is True
        assert "room" in e["conflict_types"]
        assert len(e["conflicts"]) > 0

    # Search filter test
    res = client.get("/api/v1/timetable?query=C-204", headers=admin_token)
    assert res.status_code == 200
    assert all("C-204" in e["room_number"] for e in res.json())

    # 8. Test historical attendance retention upon deactivation
    db = SessionLocal()
    sess = AttendanceSession(
        timetable_entry_id=base_id,
        faculty_id=ctx["fac1_id"],
        section_id=ctx["sec_id"],
    )
    db.add(sess)
    db.commit()
    db.close()

    res = client.delete(f"/api/v1/timetable/{base_id}", headers=admin_token)
    assert res.status_code == 200
    assert res.json()["is_active"] is False

    # Ensure attendance session still exists and references base_id
    db = SessionLocal()
    att_sess = db.query(AttendanceSession).filter(AttendanceSession.timetable_entry_id == base_id).first()
    assert att_sess is not None
    db.delete(att_sess)
    db.commit()
    db.close()

    print("✓ All Timetable Conflict Engine & Override tests passed successfully!")
