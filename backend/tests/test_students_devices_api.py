from pathlib import Path
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.db.session import SessionLocal
from app.models import (
    AttendanceRecord,
    AttendanceSession,
    AttendanceStatus,
    ClassType,
    College,
    Course,
    Department,
    Branch,
    Batch,
    Notification,
    Section,
    StudentProfile,
    User,
    UserRole,
)
from scripts.seed import seed

client = TestClient(app)


@pytest.fixture(scope="module")
def setup_data():
    seed()
    db = SessionLocal()
    # Clean up any leftover test students
    for email in ["test_student_crud1@geoattend.ai", "test_student_crud2@geoattend.ai", "test_student_crud3@geoattend.ai"]:
        user = db.query(User).filter(User.email == email).first()
        if user:
            student = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
            if student:
                db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student.id).delete()
                for en in list(student.enrollments):
                    db.delete(en)
                db.delete(student)
            db.query(Notification).filter(Notification.user_id == user.id).delete()
            db.delete(user)
    db.commit()
    db.close()


def test_students_and_devices_complete_flow(setup_data):
    # 1. Admin login
    res = client.post("/api/v1/auth/login", json={"email": "admin@geoattend.ai", "password": "Admin@12345"})
    assert res.status_code == 200
    admin_auth = {"Authorization": f"Bearer {res.json()['access_token']}"}

    # Student login (for RBAC test)
    res = client.post("/api/v1/auth/login", json={"email": "student@geoattend.ai", "password": "Student@12345"})
    assert res.status_code == 200
    student_auth = {"Authorization": f"Bearer {res.json()['access_token']}"}

    # Faculty login
    res = client.post("/api/v1/auth/login", json={"email": "faculty@geoattend.ai", "password": "Faculty@12345"})
    assert res.status_code == 200
    faculty_auth = {"Authorization": f"Bearer {res.json()['access_token']}"}

    # 2. Get an existing section for linking
    db = SessionLocal()
    sec = db.query(Section).first()
    assert sec is not None
    sec_id = sec.id
    db.close()

    # 3. RBAC: Student cannot create a student
    create_payload = {
        "email": "test_student_crud1@geoattend.ai",
        "password": "Password@123",
        "full_name": "Test Student CRUD 1",
        "roll_number": "ROLL-TEST-001",
        "section_id": sec_id,
        "device_id": "DEVICE-TEST-UUID-001",
    }
    forbidden_res = client.post("/api/v1/students", headers=student_auth, json=create_payload)
    assert forbidden_res.status_code == 403

    # 4. Admin creates student with section and initial device
    create_res = client.post("/api/v1/students", headers=admin_auth, json=create_payload)
    assert create_res.status_code == 201
    s1_data = create_res.json()
    s1_id = s1_data["id"]
    assert s1_data["roll_number"] == "ROLL-TEST-001"
    assert s1_data["device_id"] == "DEVICE-TEST-UUID-001"
    assert s1_data["section_id"] == sec_id
    assert s1_data["course_name"] is not None
    assert s1_data["enrollment_status"] == "Active"

    # 5. Duplicate roll number and email checks
    dup_res1 = client.post("/api/v1/students", headers=admin_auth, json=create_payload)
    assert dup_res1.status_code == 409  # Email exists

    create_payload2 = {
        "email": "test_student_crud2@geoattend.ai",
        "password": "Password@123",
        "full_name": "Test Student CRUD 2",
        "roll_number": "ROLL-TEST-001",  # Same roll number
        "section_id": sec_id,
    }
    dup_res2 = client.post("/api/v1/students", headers=admin_auth, json=create_payload2)
    assert dup_res2.status_code == 409  # Roll exists

    # 6. Device uniqueness check on student creation
    create_payload_dup_dev = {
        "email": "test_student_crud2@geoattend.ai",
        "password": "Password@123",
        "full_name": "Test Student CRUD 2",
        "roll_number": "ROLL-TEST-002",
        "section_id": sec_id,
        "device_id": "DEVICE-TEST-UUID-001",  # Already bound to student 1!
    }
    dev_conflict_res = client.post("/api/v1/students", headers=admin_auth, json=create_payload_dup_dev)
    assert dev_conflict_res.status_code == 409
    assert "already bound" in dev_conflict_res.json()["detail"]

    # Now create student 2 without device
    create_payload_dup_dev["device_id"] = None
    create_res2 = client.post("/api/v1/students", headers=admin_auth, json=create_payload_dup_dev)
    assert create_res2.status_code == 201
    s2_id = create_res2.json()["id"]

    # 7. Device binding endpoint test:
    # 7a. Device ID validation (< 6 chars)
    short_dev = client.post(
        f"/api/v1/students/{s2_id}/bind-device",
        headers=admin_auth,
        json={"device_id": "123"},
    )
    assert short_dev.status_code in [422, 400]

    # 7b. Attempt to bind device already bound to student 1
    conflict_bind = client.post(
        f"/api/v1/students/{s2_id}/bind-device",
        headers=admin_auth,
        json={"device_id": "DEVICE-TEST-UUID-001"},
    )
    assert conflict_bind.status_code == 409

    # 7c. Bind unique device to student 2
    bind_res = client.post(
        f"/api/v1/students/{s2_id}/bind-device",
        headers=admin_auth,
        json={"device_id": "DEVICE-TEST-UUID-002", "platform": "Android", "model": "Pixel 8"},
    )
    assert bind_res.status_code == 200
    assert bind_res.json()["device_id"] == "DEVICE-TEST-UUID-002"

    # 8. Unbind/Reset Device
    unbind_res = client.post(
        f"/api/v1/students/{s2_id}/reset-device",
        headers=admin_auth,
        json={"reason": "Student got a new phone"},
    )
    assert unbind_res.status_code == 200

    # Verify device is now null in student details
    get_s2 = client.get(f"/api/v1/students/{s2_id}", headers=admin_auth)
    assert get_s2.status_code == 200
    assert get_s2.json()["device_id"] is None

    # Faculty can view student details
    fac_view = client.get(f"/api/v1/students/{s2_id}", headers=faculty_auth)
    assert fac_view.status_code == 200

    # 9. List and search students
    list_res = client.get("/api/v1/students?query=ROLL-TEST", headers=admin_auth)
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 2
    rolls = [s["roll_number"] for s in items]
    assert "ROLL-TEST-001" in rolls
    assert "ROLL-TEST-002" in rolls

    # Filter has_device=true
    bound_list = client.get("/api/v1/students?has_device=true", headers=admin_auth)
    assert bound_list.status_code == 200
    for s in bound_list.json():
        assert s["device_id"] is not None

    # 10. Update student
    up_res = client.put(
        f"/api/v1/students/{s1_id}",
        headers=admin_auth,
        json={"full_name": "Updated Student One", "phone": "+919876543210"},
    )
    assert up_res.status_code == 200
    assert up_res.json()["full_name"] == "Updated Student One"
    assert up_res.json()["phone"] == "+919876543210"

    # 11. Delete student & Attendance record protection
    # 11a. Add attendance record for student 1
    db = SessionLocal()
    sess = db.query(AttendanceSession).first()
    if not sess:
        sess = AttendanceSession(
            timetable_entry_id=1,
            subject_offering_id=4,
            faculty_assignment_id=1,
            faculty_id=1,
            section_id=sec_id,
            class_type=ClassType.THEORY,
            room_number="C-204",
            status="active",
        )
        db.add(sess)
        db.flush()

    att_rec = AttendanceRecord(
        session_id=sess.id,
        student_id=s1_id,
        status=AttendanceStatus.PRESENT,
    )
    db.add(att_rec)
    db.commit()
    db.close()

    # Attempt to delete student 1 -> Should be blocked to protect historical attendance
    del_blocked = client.delete(f"/api/v1/students/{s1_id}", headers=admin_auth)
    assert del_blocked.status_code == 400
    assert "historical attendance" in del_blocked.json()["detail"].lower()

    # Instead, deactivate student 1
    deact_res = client.patch(f"/api/v1/students/{s1_id}/toggle-status", headers=admin_auth)
    assert deact_res.status_code == 200
    check_s1 = client.get(f"/api/v1/students/{s1_id}", headers=admin_auth)
    assert check_s1.json()["is_active"] is False

    # 11b. Delete student 2 (no attendance records) -> Should delete cleanly
    del_s2 = client.delete(f"/api/v1/students/{s2_id}", headers=admin_auth)
    assert del_s2.status_code == 200

    # Verify student 2 is deleted
    get_del = client.get(f"/api/v1/students/{s2_id}", headers=admin_auth)
    assert get_del.status_code == 404

    # Cleanup student 1
    db = SessionLocal()
    db.query(AttendanceRecord).filter(AttendanceRecord.student_id == s1_id).delete()
    db.commit()
    db.close()
    del_s1_final = client.delete(f"/api/v1/students/{s1_id}", headers=admin_auth)
    assert del_s1_final.status_code == 200
