import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models import (
    AttendanceRecord,
    AttendanceSession,
    FacultyProfile,
    FacultyResponsibility,
    ResponsibilityType,
    ScopeType,
    Section,
    SessionStatus,
    StudentProfile,
    TimetableEntry,
    User,
    UserRole,
)
from scripts.seed import seed

client = TestClient(app)


def test_faculty_and_coordinator_suite():
    seed()
    db = SessionLocal()

    # Clean any stale active sessions
    db.query(AttendanceSession).filter(AttendanceSession.status.in_([SessionStatus.ACTIVE, SessionStatus.SCHEDULED])).update({"status": SessionStatus.COMPLETED})
    db.commit()

    # 1. Login Admin
    res_admin = client.post("/api/v1/auth/login", json={"email": "admin@geoattend.ai", "password": "Admin@12345"})
    assert res_admin.status_code == 200
    admin_token = res_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Login Faculty
    res_faculty = client.post("/api/v1/auth/login", json={"email": "faculty@geoattend.ai", "password": "Faculty@12345"})
    assert res_faculty.status_code == 200
    faculty_token = res_faculty.json()["access_token"]
    faculty_headers = {"Authorization": f"Bearer {faculty_token}"}

    # 3. Login Student
    res_student = client.post("/api/v1/auth/login", json={"email": "student@geoattend.ai", "password": "Student@12345"})
    assert res_student.status_code == 200
    student_token = res_student.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # ─────────────────────────────────────────────────────────────────────────────
    # PART 1: Faculty Profile & Classes API
    # ─────────────────────────────────────────────────────────────────────────────

    # Auth Me with Faculty Profile
    res_me = client.get("/api/v1/auth/me", headers=faculty_headers)
    assert res_me.status_code == 200
    me_data = res_me.json()
    assert me_data["faculty_profile"] is not None
    assert me_data["faculty_profile"]["department_name"] == "Computer Science"
    assert me_data["faculty_profile"]["designation"] == "Assistant Professor"
    assert me_data["faculty_profile"]["employee_id"] == "FAC001"

    # Faculty Profile
    res_prof = client.get("/api/v1/faculty/me/profile", headers=faculty_headers)
    assert res_prof.status_code == 200
    prof_data = res_prof.json()
    assert prof_data["employee_id"] == "FAC001"
    assert prof_data["department_name"] == "Computer Science"
    assert prof_data["designation"] == "Assistant Professor"

    # Faculty My Classes
    res_classes = client.get("/api/v1/faculty/my-classes", headers=faculty_headers)
    assert res_classes.status_code == 200
    classes = res_classes.json()
    assert len(classes) > 0
    assert "subject_name" in classes[0]
    assert "section_name" in classes[0]
    assert "total_enrolled" in classes[0]
    distinct_subjects = set(c["subject_id"] for c in classes)
    assert len(distinct_subjects) >= 2

    # Student RBAC Check: Student cannot access /my-classes
    res_student_classes = client.get("/api/v1/faculty/my-classes", headers=student_headers)
    assert res_student_classes.status_code == 403

    # ─────────────────────────────────────────────────────────────────────────────
    # PART 2: Faculty Timetable & Session Lifecycle
    # ─────────────────────────────────────────────────────────────────────────────

    # Get Today's Classes for Faculty
    res_tt = client.get("/api/v1/timetable/today/faculty", headers=faculty_headers)
    assert res_tt.status_code == 200
    entries = res_tt.json()
    assert len(entries) > 0

    timetable_entry_id = entries[0]["id"]

    # Start Session
    res_start = client.post(
        "/api/v1/attendance/sessions/start",
        json={"timetable_entry_id": timetable_entry_id},
        headers=faculty_headers,
    )
    assert res_start.status_code == 201, f"Failed: {res_start.status_code} {res_start.text}"
    session_data = res_start.json()
    session_id = session_data["id"]
    assert session_data["status"] == "active"

    # Test QR Token generation / rotation
    res_qr = client.post(f"/api/v1/attendance/sessions/{session_id}/qr", headers=faculty_headers)
    assert res_qr.status_code == 200
    qr_data = res_qr.json()
    assert qr_data["token"] is not None
    assert qr_data["qr_payload"] is not None

    # Get Live Records
    res_recs = client.get(f"/api/v1/attendance/sessions/{session_id}/records", headers=faculty_headers)
    assert res_recs.status_code == 200

    # End Session
    res_close = client.post(f"/api/v1/attendance/sessions/{session_id}/close", headers=faculty_headers)
    assert res_close.status_code == 200
    assert res_close.json()["status"] == "completed"

    # ─────────────────────────────────────────────────────────────────────────────
    # PART 3: Coordinator Responsibility & Desk
    # ─────────────────────────────────────────────────────────────────────────────

    faculty_user = db.query(User).filter(User.email == "faculty@geoattend.ai").first()
    faculty_profile = db.query(FacultyProfile).filter(FacultyProfile.user_id == faculty_user.id).first()
    student_prof = db.query(StudentProfile).first()
    assert student_prof is not None
    section = db.query(Section).filter(Section.id == student_prof.section_id).first()
    assert section is not None

    # Deactivate any previous coordinator responsibilities
    db.query(FacultyResponsibility).filter(
        FacultyResponsibility.faculty_id == faculty_profile.id,
        FacultyResponsibility.responsibility_type == ResponsibilityType.COORDINATOR,
    ).update({"is_active": False})
    db.commit()

    # Assign Coordinator responsibility for section
    resp_payload = {
        "faculty_id": faculty_profile.id,
        "responsibility_type": "coordinator",
        "scope_type": "section",
        "section_id": section.id,
    }
    res_assign = client.post("/api/v1/faculty/responsibilities", json=resp_payload, headers=admin_headers)
    assert res_assign.status_code == 201
    assigned = res_assign.json()
    assert assigned["responsibility_type"] == "coordinator"
    assert assigned["section_id"] == section.id

    # Re-login or use faculty headers to access Coordinator Desk
    res_desk = client.get("/api/v1/faculty/coordinator/desk", headers=faculty_headers)
    assert res_desk.status_code == 200
    desk_data = res_desk.json()
    assert desk_data["has_coordinator_role"] is True
    assert desk_data["section_id"] == section.id
    assert desk_data["section_name"] is not None
    assert desk_data["total_students"] >= 0
    assert "attendance_threshold" in desk_data
    assert "short_attendance_count" in desk_data
    assert "average_section_attendance" in desk_data

    # Get Coordinator Section Students Roster
    res_studs = client.get("/api/v1/faculty/coordinator/students", headers=faculty_headers)
    assert res_studs.status_code == 200
    studs_list = res_studs.json()
    assert len(studs_list) > 0
    # Every student returned must belong to the assigned section
    for s in studs_list:
        assert s["section_id"] == section.id

    # Get Coordinator Multi-Subject Attendance Matrix
    res_matrix = client.get("/api/v1/faculty/coordinator/matrix", headers=faculty_headers)
    assert res_matrix.status_code == 200
    matrix_data = res_matrix.json()
    assert matrix_data["section_id"] == section.id
    assert "attendance_threshold" in matrix_data
    assert "subjects_header" in matrix_data
    assert "students" in matrix_data
    assert len(matrix_data["students"]) > 0

    # Verify no duplicate subject codes in header
    header_codes = [sh["subject_code"] for sh in matrix_data["subjects_header"]]
    assert len(header_codes) == len(set(header_codes)), f"Duplicate subjects in header: {header_codes}"

    first_student = matrix_data["students"][0]
    assert "roll_number" in first_student
    assert "overall_percentage" in first_student
    assert "is_short_attendance" in first_student
    assert "subjects" in first_student
    assert "total_attended" in first_student
    assert "total_eligible" in first_student

    # Verify that subjects with 0 sessions return percentage = None (N/A)
    for sub in first_student["subjects"]:
        if sub["total"] == 0:
            assert sub["percentage"] is None, f"Expected None for 0 conducted sessions, got {sub['percentage']}"

    # Export Matrix CSV Endpoint Verification
    res_csv = client.get("/api/v1/faculty/coordinator/export-csv", headers=faculty_headers)
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers.get("content-type", "")
    csv_text = res_csv.text
    assert "GeoAttend AI - Section Attendance Matrix Export" in csv_text
    assert f"Section: {section.name}" in csv_text
    assert first_student["roll_number"] in csv_text

    # Cross-Section Access Protection: accessing an unassigned section must return 403
    unassigned_section_id = 99999
    res_unauth_desk = client.get(f"/api/v1/faculty/coordinator/desk?section_id={unassigned_section_id}", headers=faculty_headers)
    assert res_unauth_desk.status_code == 200
    assert res_unauth_desk.json()["has_coordinator_role"] is False

    res_unauth_matrix = client.get(f"/api/v1/faculty/coordinator/matrix?section_id={unassigned_section_id}", headers=faculty_headers)
    assert res_unauth_matrix.status_code == 403

    res_unauth_csv = client.get(f"/api/v1/faculty/coordinator/export-csv?section_id={unassigned_section_id}", headers=faculty_headers)
    assert res_unauth_csv.status_code == 403

    # Student RBAC Check: Student cannot access Coordinator Desk or Export CSV
    res_student_desk = client.get("/api/v1/faculty/coordinator/desk", headers=student_headers)
    assert res_student_desk.status_code == 403

    res_student_matrix = client.get("/api/v1/faculty/coordinator/matrix", headers=student_headers)
    assert res_student_matrix.status_code == 403

    res_student_csv = client.get("/api/v1/faculty/coordinator/export-csv", headers=student_headers)
    assert res_student_csv.status_code == 403

    db.close()
