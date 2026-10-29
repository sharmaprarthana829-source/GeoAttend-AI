import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models import (
    FacultyAssignment,
    FacultyProfile,
    Section,
    StudentGroup,
    SubjectOffering,
    TimetableEntry,
    User,
)
from scripts.seed import seed

client = TestClient(app)


def _auth(email: str, password: str) -> dict:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _get_ids():
    """Return commonly needed IDs from seed data."""
    db = SessionLocal()
    section = db.query(Section).filter(Section.name == "CSD-A").first()
    b1 = db.query(StudentGroup).filter(StudentGroup.section_id == section.id, StudentGroup.name == "B1").first()
    b2 = db.query(StudentGroup).filter(StudentGroup.section_id == section.id, StudentGroup.name == "B2").first()

    fac1 = db.query(FacultyProfile).join(User).filter(User.email == "faculty@geoattend.ai").first()
    fac2 = db.query(FacultyProfile).join(User).filter(User.email == "faculty2@geoattend.ai").first()

    # Theory offering (whole section, CS201)
    offering_theory = (
        db.query(SubjectOffering)
        .filter(SubjectOffering.section_id == section.id, SubjectOffering.student_group_id.is_(None))
        .first()
    )
    # Lab offering B1 (CS203)
    offering_lab_b1 = (
        db.query(SubjectOffering)
        .filter(SubjectOffering.section_id == section.id, SubjectOffering.student_group_id == b1.id)
        .first()
    )
    # Lab offering B2 (CS203)
    offering_lab_b2 = (
        db.query(SubjectOffering)
        .filter(SubjectOffering.section_id == section.id, SubjectOffering.student_group_id == b2.id)
        .first()
    )

    # Faculty assignments
    asgn_priya_theory = (
        db.query(FacultyAssignment)
        .filter(FacultyAssignment.faculty_id == fac1.id, FacultyAssignment.subject_offering_id == offering_theory.id)
        .first()
    )
    asgn_priya_lab_b1 = (
        db.query(FacultyAssignment)
        .filter(FacultyAssignment.faculty_id == fac1.id, FacultyAssignment.subject_offering_id == offering_lab_b1.id)
        .first()
    )
    asgn_rajesh_lab_b2 = (
        db.query(FacultyAssignment)
        .filter(FacultyAssignment.faculty_id == fac2.id, FacultyAssignment.subject_offering_id == offering_lab_b2.id)
        .first()
    )

    ids = {
        "section_id": section.id,
        "b1_id": b1.id,
        "b2_id": b2.id,
        "fac1_id": fac1.id,
        "fac2_id": fac2.id,
        "offering_theory_id": offering_theory.id,
        "offering_lab_b1_id": offering_lab_b1.id,
        "offering_lab_b2_id": offering_lab_b2.id,
        "asgn_priya_theory_id": asgn_priya_theory.id,
        "asgn_priya_lab_b1_id": asgn_priya_lab_b1.id,
        "asgn_rajesh_lab_b2_id": asgn_rajesh_lab_b2.id,
    }
    db.close()
    return ids


def _cleanup_test_entries():
    """Remove timetable entries created by tests (on wednesday/thursday/friday) to keep tests idempotent."""
    db = SessionLocal()
    from app.models import AttendanceRecord, AttendanceSession, QRSession, SuspiciousActivity
    db.query(SuspiciousActivity).delete(synchronize_session=False)
    db.query(AttendanceRecord).delete(synchronize_session=False)
    db.query(QRSession).delete(synchronize_session=False)
    db.query(AttendanceSession).delete(synchronize_session=False)
    db.query(TimetableEntry).filter(
        TimetableEntry.day_of_week.in_(["wednesday", "thursday", "friday"])
    ).delete(synchronize_session=False)
    db.commit()
    db.close()


def test_phase6_timetable():
    print("=== Running Phase 6 Tests: Timetable Engine & Conflict Validation ===")

    seed()
    _cleanup_test_entries()

    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")
    faculty1_auth = _auth("faculty@geoattend.ai", "Faculty@12345")
    faculty2_auth = _auth("faculty2@geoattend.ai", "Faculty@12345")
    student_auth = _auth("student@geoattend.ai", "Student@12345")
    ids = _get_ids()

    # ------------------------------------------------------------------
    # Test 1: Admin creates a valid timetable entry
    # ------------------------------------------------------------------
    print("\n[Test 1] Admin creates a valid timetable entry...")
    res = client.post(
        "/api/v1/timetable",
        headers=admin_auth,
        json={
            "subject_offering_id": ids["offering_theory_id"],
            "faculty_assignment_id": ids["asgn_priya_theory_id"],
            "day_of_week": "wednesday",
            "start_time": "09:00:00",
            "end_time": "10:00:00",
            "room_number": "C-204",
        },
    )
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    entry = res.json()
    wed_theory_id = entry["id"]
    assert entry["day_of_week"] == "wednesday"
    assert entry["start_time"] == "09:00:00"
    assert entry["end_time"] == "10:00:00"
    assert entry["room_number"] == "C-204"
    assert entry["class_type"] == "theory"
    assert entry["section_id"] == ids["section_id"]
    assert entry["student_group_id"] is None  # Whole section
    print(f"✓ Created timetable entry ID={wed_theory_id}: Wednesday 09:00-10:00 Theory, Room C-204")

    # ------------------------------------------------------------------
    # Test 2: Invalid time rejected (end_time before start_time)
    # ------------------------------------------------------------------
    print("\n[Test 2] Invalid time rejected (end_time <= start_time)...")
    res = client.post(
        "/api/v1/timetable",
        headers=admin_auth,
        json={
            "subject_offering_id": ids["offering_lab_b1_id"],
            "faculty_assignment_id": ids["asgn_priya_lab_b1_id"],
            "day_of_week": "thursday",
            "start_time": "11:00:00",
            "end_time": "10:00:00",
            "room_number": "LAB-1",
        },
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
    print("✓ Invalid time interval (11:00 > 10:00) correctly rejected with 400")

    # ------------------------------------------------------------------
    # Test 3: Faculty conflict rejected (same faculty, overlapping time, same day)
    # ------------------------------------------------------------------
    print("\n[Test 3] Faculty conflict rejected (same faculty, overlapping time, same day)...")
    # Dr. Priya Sharma is already scheduled Wednesday 09:00-10:00
    # Try to schedule her for Wednesday 09:30-10:30 (overlaps!)
    res = client.post(
        "/api/v1/timetable",
        headers=admin_auth,
        json={
            "subject_offering_id": ids["offering_lab_b1_id"],
            "faculty_assignment_id": ids["asgn_priya_lab_b1_id"],
            "day_of_week": "wednesday",
            "start_time": "09:30:00",
            "end_time": "10:30:00",
            "room_number": "LAB-1",
        },
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
    assert "conflict" in res.json()["detail"].lower() or "Faculty" in res.json()["detail"]
    print(f"✓ Faculty conflict correctly detected: {res.json()['detail']}")

    # ------------------------------------------------------------------
    # Test 4: Room conflict rejected (same room, overlapping time, same day)
    # ------------------------------------------------------------------
    print("\n[Test 4] Room conflict rejected (same room, overlapping time, same day)...")
    # Room C-204 is occupied Wednesday 09:00-10:00
    # Try to schedule Rajesh in same room at overlapping time
    res = client.post(
        "/api/v1/timetable",
        headers=admin_auth,
        json={
            "subject_offering_id": ids["offering_lab_b2_id"],
            "faculty_assignment_id": ids["asgn_rajesh_lab_b2_id"],
            "day_of_week": "wednesday",
            "start_time": "09:30:00",
            "end_time": "10:30:00",
            "room_number": "C-204",  # Same room!
        },
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
    assert "room" in res.json()["detail"].lower() or "Room" in res.json()["detail"]
    print(f"✓ Room conflict correctly detected: {res.json()['detail']}")

    # ------------------------------------------------------------------
    # Test 5: Student group conflict rejected (same section, overlapping time)
    # ------------------------------------------------------------------
    print("\n[Test 5] Student group/class overlap rejected...")
    # Wednesday 09:00-10:00 has whole-section Theory class.
    # Try to add a Lab for Group B2 at overlapping time -> should conflict
    # because whole-section overlaps with any group
    res = client.post(
        "/api/v1/timetable",
        headers=admin_auth,
        json={
            "subject_offering_id": ids["offering_lab_b2_id"],
            "faculty_assignment_id": ids["asgn_rajesh_lab_b2_id"],
            "day_of_week": "wednesday",
            "start_time": "09:00:00",
            "end_time": "10:00:00",
            "room_number": "LAB-2",  # Different room, different faculty
        },
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
    assert "conflict" in res.json()["detail"].lower() or "Section" in res.json()["detail"] or "Student" in res.json()["detail"]
    print(f"✓ Student group overlap correctly detected: {res.json()['detail']}")

    # ------------------------------------------------------------------
    # Test 6: Adjacent non-overlapping classes are allowed
    # ------------------------------------------------------------------
    print("\n[Test 6] Adjacent non-overlapping classes are allowed...")
    # Wednesday 10:00-11:00 for Lab B1 (adjacent to 09:00-10:00 Theory) — should succeed
    res = client.post(
        "/api/v1/timetable",
        headers=admin_auth,
        json={
            "subject_offering_id": ids["offering_lab_b1_id"],
            "faculty_assignment_id": ids["asgn_priya_lab_b1_id"],
            "day_of_week": "wednesday",
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "room_number": "LAB-1",
        },
    )
    assert res.status_code == 201, f"Expected 201 for adjacent non-overlapping, got {res.status_code}: {res.text}"
    wed_lab_b1_id = res.json()["id"]
    print(f"✓ Adjacent class (10:00-11:00 after 09:00-10:00) created successfully ID={wed_lab_b1_id}")

    # Also add Lab B2 at same time (different group, different room, different faculty) — should succeed
    res = client.post(
        "/api/v1/timetable",
        headers=admin_auth,
        json={
            "subject_offering_id": ids["offering_lab_b2_id"],
            "faculty_assignment_id": ids["asgn_rajesh_lab_b2_id"],
            "day_of_week": "wednesday",
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "room_number": "LAB-2",
        },
    )
    assert res.status_code == 201, f"Expected 201 for B2 parallel lab, got {res.status_code}: {res.text}"
    print(f"✓ Parallel Lab B2 at same time (different group/room/faculty) created successfully")

    # ------------------------------------------------------------------
    # Test 7: Faculty sees only their timetable
    # ------------------------------------------------------------------
    print("\n[Test 7] Faculty sees only their timetable...")
    # Faculty 1 (Dr. Priya Sharma) queries her schedule
    res = client.get("/api/v1/timetable/today/faculty", headers=faculty1_auth)
    assert res.status_code == 200, f"Faculty today schedule failed: {res.text}"
    fac1_schedule = res.json()
    # She should see today's entries only for herself
    for entry in fac1_schedule:
        assert entry["faculty_id"] == ids["fac1_id"], f"Faculty 1 sees entry for faculty {entry['faculty_id']}"
    print(f"✓ Dr. Priya Sharma sees {len(fac1_schedule)} entries today (all her own)")

    # Faculty 2 (Prof. Rajesh Kumar) queries his schedule
    res = client.get("/api/v1/timetable/today/student", headers=faculty2_auth)
    # Faculty shouldn't be able to access student endpoint
    assert res.status_code == 403, f"Expected 403 for faculty on student endpoint, got {res.status_code}"

    res = client.get("/api/v1/timetable/today/faculty", headers=faculty2_auth)
    assert res.status_code == 200
    fac2_schedule = res.json()
    for entry in fac2_schedule:
        assert entry["faculty_id"] == ids["fac2_id"], f"Faculty 2 sees entry for faculty {entry['faculty_id']}"
    print(f"✓ Prof. Rajesh Kumar sees {len(fac2_schedule)} entries today (all his own)")

    # Verify filtered by faculty ID
    res = client.get(f"/api/v1/timetable/faculty/{ids['fac1_id']}", headers=faculty1_auth)
    assert res.status_code == 200
    fac1_all = res.json()
    for e in fac1_all:
        assert e["faculty_id"] == ids["fac1_id"]
    print(f"✓ Faculty filter by ID returns {len(fac1_all)} entries for Dr. Priya Sharma (all days)")

    # ------------------------------------------------------------------
    # Test 8: Student sees only relevant timetable
    # ------------------------------------------------------------------
    print("\n[Test 8] Student sees only relevant timetable based on enrollment...")
    res = client.get("/api/v1/timetable/today/student", headers=student_auth)
    assert res.status_code == 200, f"Student today schedule failed: {res.text}"
    student_schedule = res.json()
    # Student is in B1, should see whole-section classes AND B1 classes, NOT B2 classes
    for entry in student_schedule:
        assert entry["student_group_id"] is None or entry["student_group_id"] == ids["b1_id"], (
            f"Student in B1 sees entry for group {entry.get('student_group_name', entry['student_group_id'])}"
        )
    print(f"✓ Student (B1) sees {len(student_schedule)} entries today (whole-section + B1 only, no B2)")

    # Section filter
    res = client.get(f"/api/v1/timetable/section/{ids['section_id']}", headers=student_auth)
    assert res.status_code == 200
    section_schedule = res.json()
    print(f"✓ Section schedule filter returns {len(section_schedule)} entries for CSD-A")

    # ------------------------------------------------------------------
    # Test 9: Non-admin cannot mutate timetable
    # ------------------------------------------------------------------
    print("\n[Test 9] Non-admin cannot create/update/delete timetable entries...")
    # Student cannot create
    res = client.post(
        "/api/v1/timetable",
        headers=student_auth,
        json={
            "subject_offering_id": ids["offering_theory_id"],
            "faculty_assignment_id": ids["asgn_priya_theory_id"],
            "day_of_week": "friday",
            "start_time": "14:00:00",
            "end_time": "15:00:00",
            "room_number": "X-100",
        },
    )
    assert res.status_code == 403, f"Expected 403 for student create, got {res.status_code}"

    # Faculty cannot create
    res = client.post(
        "/api/v1/timetable",
        headers=faculty1_auth,
        json={
            "subject_offering_id": ids["offering_theory_id"],
            "faculty_assignment_id": ids["asgn_priya_theory_id"],
            "day_of_week": "friday",
            "start_time": "14:00:00",
            "end_time": "15:00:00",
            "room_number": "X-100",
        },
    )
    assert res.status_code == 403, f"Expected 403 for faculty create, got {res.status_code}"

    # Faculty cannot delete
    res = client.delete(f"/api/v1/timetable/{wed_theory_id}", headers=faculty1_auth)
    assert res.status_code == 403, f"Expected 403 for faculty delete, got {res.status_code}"

    # Student cannot update
    res = client.put(f"/api/v1/timetable/{wed_theory_id}", headers=student_auth, json={"room_number": "HACKED"})
    assert res.status_code == 403, f"Expected 403 for student update, got {res.status_code}"

    print("✓ Students and Faculty correctly blocked from creating/updating/deleting timetable (403)")

    # ------------------------------------------------------------------
    # Test 10: CSV upload works
    # ------------------------------------------------------------------
    print("\n[Test 10] CSV upload works for valid data...")
    csv_data = (
        "subject_code,section_name,student_group_name,faculty_email,class_type,day_of_week,start_time,end_time,room_number\n"
        "CS201,CSD-A,,faculty@geoattend.ai,theory,friday,09:00,10:00,C-301\n"
        "CS203,CSD-A,B1,faculty@geoattend.ai,lab,friday,10:00,11:00,LAB-3\n"
        "CS203,CSD-A,B2,faculty2@geoattend.ai,lab,friday,10:00,11:00,LAB-4\n"
    )
    res = client.post(
        "/api/v1/timetable/upload",
        headers=admin_auth,
        json={"csv_data": csv_data},
    )
    assert res.status_code == 200, f"CSV upload failed: {res.text}"
    upload_result = res.json()
    assert upload_result["rows_processed"] == 3
    assert upload_result["created_count"] == 3
    assert len(upload_result["errors"]) == 0
    print(f"✓ CSV upload: {upload_result['rows_processed']} rows processed, {upload_result['created_count']} created, 0 errors")

    # ------------------------------------------------------------------
    # Test 11: Invalid CSV rows are rejected safely (atomic — no partial)
    # ------------------------------------------------------------------
    print("\n[Test 11] Invalid CSV rows rejected safely (atomic batch)...")
    csv_bad = (
        "subject_code,section_name,student_group_name,faculty_email,class_type,day_of_week,start_time,end_time,room_number\n"
        "CS201,CSD-A,,faculty@geoattend.ai,theory,thursday,08:00,09:00,C-301\n"
        "FAKE999,CSD-A,,faculty@geoattend.ai,theory,thursday,11:00,12:00,C-999\n"
    )
    res = client.post(
        "/api/v1/timetable/upload",
        headers=admin_auth,
        json={"csv_data": csv_bad},
    )
    assert res.status_code == 400, f"Expected 400 for invalid CSV, got {res.status_code}"
    error_detail = res.json()["detail"]
    assert "errors" in error_detail
    assert any("FAKE999" in e for e in error_detail["errors"])
    print(f"✓ Invalid CSV batch rejected atomically: {error_detail['errors']}")

    # Verify the valid row from the bad batch was NOT created (atomic rejection)
    db = SessionLocal()
    leaked = (
        db.query(TimetableEntry)
        .filter(TimetableEntry.day_of_week == "thursday", TimetableEntry.start_time.between("08:00:00", "08:59:59"))
        .first()
    )
    db.close()
    assert leaked is None, "Atomic rejection failed: valid row from bad CSV batch was partially created"
    print("✓ Atomic validation: No partial rows created from rejected CSV batch")

    # Also verify non-admin cannot upload
    res = client.post("/api/v1/timetable/upload", headers=faculty1_auth, json={"csv_data": csv_data})
    assert res.status_code == 403
    print("✓ Non-admin cannot upload CSV (403)")

    # ------------------------------------------------------------------
    # Test: Read single entry with detail
    # ------------------------------------------------------------------
    print("\n[Test Extra] Read single timetable entry with full details...")
    res = client.get(f"/api/v1/timetable/{wed_theory_id}", headers=admin_auth)
    assert res.status_code == 200
    detail = res.json()
    assert detail["subject_name"] == "Data Structures"
    assert detail["faculty_name"] == "Dr. Priya Sharma"
    assert detail["section_name"] == "CSD-A"
    assert detail["day_of_week"] == "wednesday"
    print(f"✓ Detail read: {detail['subject_name']} by {detail['faculty_name']} at {detail['section_name']}")

    # ------------------------------------------------------------------
    # Test: Update and Delete
    # ------------------------------------------------------------------
    print("\n[Test Extra] Admin updates and deletes timetable entry...")
    res = client.put(
        f"/api/v1/timetable/{wed_theory_id}",
        headers=admin_auth,
        json={"room_number": "C-205"},
    )
    assert res.status_code == 200
    assert res.json()["room_number"] == "C-205"
    print(f"✓ Updated entry {wed_theory_id}: room changed to C-205")

    res = client.delete(f"/api/v1/timetable/{wed_theory_id}", headers=admin_auth)
    assert res.status_code == 200
    assert res.json()["is_active"] is False
    print(f"✓ Deactivated entry {wed_theory_id}")

    print("\n========================================================")
    print("🎉 ALL PHASE 6 TIMETABLE ENGINE & CONFLICT TESTS PASSED 100%!")
    print("========================================================")


if __name__ == "__main__":
    test_phase6_timetable()
