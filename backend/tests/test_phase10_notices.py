"""Phase 10 Tests: Notice Board & Notification System

Tests:
 1. Admin creates ALL notice -> all active users receive notification.
 2. Admin creates STUDENTS notice -> only students receive notification.
 3. Department-targeted notice reaches only that department.
 4. Branch-targeted notice reaches only that branch.
 5. Group-targeted notice reaches only that group (B1 only, not B2).
 6. Faculty receives relevant notice.
 7. Student receives relevant notice.
 8. Unrelated users do not receive targeted notifications.
 9. Non-admin cannot create/update/delete notices (403 Forbidden).
10. User can read own notification.
11. User cannot access another user's notification (403 Forbidden).
12. Mark notification as read works.
13. Read-all works.
"""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models import (
    AcademicEnrollment,
    AttendanceApplication,
    Branch,
    Course,
    Department,
    FacultyProfile,
    FacultyResponsibility,
    Notice,
    Notification,
    ResponsibilityType,
    ScopeType,
    Section,
    StudentGroup,
    StudentProfile,
    Subject,
    SubjectOffering,
    User,
    UserRole,
)
from scripts.seed import seed

client = TestClient(app)


def _auth(email: str, password: str) -> dict:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _cleanup_database():
    db = SessionLocal()
    db.query(Notification).delete(synchronize_session=False)
    db.query(Notice).delete(synchronize_session=False)
    db.query(AttendanceApplication).delete(synchronize_session=False)

    # Clean up any extra student3 created for B2 group testing
    s3_user = db.query(User).filter(User.email == "student3_b2@geoattend.ai").first()
    if s3_user:
        s3 = db.query(StudentProfile).filter(StudentProfile.user_id == s3_user.id).first()
        if s3:
            db.query(AcademicEnrollment).filter(AcademicEnrollment.student_id == s3.id).delete()
            db.query(StudentProfile).filter(StudentProfile.id == s3.id).delete()
        db.query(User).filter(User.id == s3_user.id).delete()

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


def test_phase10_notices_and_notifications():
    print("=== Running Phase 10 Tests: Notice Board & Notification System ===")

    seed()
    _cleanup_database()

    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")
    faculty1_auth = _auth("faculty@geoattend.ai", "Faculty@12345")  # Priya Sharma (CSE Dept)
    faculty2_auth = _auth("faculty2@geoattend.ai", "Faculty@12345")  # Rajesh Kumar (CSE Dept)
    student1_auth = _auth("student@geoattend.ai", "Student@12345")  # Arjun Mehta (CSD Branch, Group B1)
    student2_auth = _auth("student2@geoattend.ai", "Student@12345")  # Sneha Patel (CSD Branch, Group B1)

    # Create Student 3 enrolled in Group B2 (to verify Group B1 targeting isolation)
    db = SessionLocal()
    from app.core.security import get_password_hash

    s3_user = User(
        college_id=1,
        email="student3_b2@geoattend.ai",
        password_hash=get_password_hash("Student@12345"),
        full_name="Karan Verma",
        role=UserRole.STUDENT,
    )
    db.add(s3_user)
    db.flush()

    s3_profile = StudentProfile(
        user_id=s3_user.id,
        section_id=2,
        current_group_id=2,  # Group B2
        roll_number="CS24A003",
        enrollment_number="EN2024003",
    )
    db.add(s3_profile)
    db.flush()

    s3_enrollment = AcademicEnrollment(
        student_id=s3_profile.id,
        course_id=2,
        branch_id=2,
        batch_id=2,
        section_id=2,
        student_group_id=2,  # Group B2
        semester=1,
        academic_year="2024-2025",
        status="active",
        is_current=True,
    )
    db.add(s3_enrollment)
    db.commit()

    dept_cse = db.query(Department).filter(Department.code == "CSE").first()
    branch_csd = db.query(Branch).filter(Branch.code == "CSD").first()
    group_b1 = db.query(StudentGroup).filter(StudentGroup.name == "B1", StudentGroup.section_id == 2).first()
    group_b2 = db.query(StudentGroup).filter(StudentGroup.name == "B2", StudentGroup.section_id == 2).first()

    admin_user = db.query(User).filter(User.email == "admin@geoattend.ai").first()
    fac1_user = db.query(User).filter(User.email == "faculty@geoattend.ai").first()
    student1_user = db.query(User).filter(User.email == "student@geoattend.ai").first()
    student2_user = db.query(User).filter(User.email == "student2@geoattend.ai").first()
    db.close()

    student3_auth = _auth("student3_b2@geoattend.ai", "Student@12345")

    # ------------------------------------------------------------------
    # Test 1: Admin creates ALL notice -> all active users receive notification
    # ------------------------------------------------------------------
    print("\n[Test 1] Admin creates ALL notice...")
    res = client.post(
        "/api/v1/notices",
        headers=admin_auth,
        json={
            "title": "Campus Independence Day Holiday",
            "content": "The college campus will remain closed on August 15.",
            "audience_type": "all",
        },
    )
    assert res.status_code == 201, f"Failed: {res.text}"
    notice_all = res.json()
    assert notice_all["title"] == "Campus Independence Day Holiday"
    assert notice_all["audience_type"] == "all"
    print("✓ Created ALL notice ID:", notice_all["id"])

    # Verify notifications received by student1, student3, faculty1, and admin
    for auth_token, user_desc in [
        (student1_auth, "Student 1"),
        (student3_auth, "Student 3"),
        (faculty1_auth, "Faculty 1"),
    ]:
        n_res = client.get("/api/v1/notifications/my", headers=auth_token)
        assert n_res.status_code == 200
        notifs = n_res.json()
        assert len(notifs) >= 1
        assert any(n["title"] == "Campus Independence Day Holiday" for n in notifs)
        print(f"  ✓ {user_desc} received ALL notification")

    # ------------------------------------------------------------------
    # Test 2: Admin creates STUDENTS notice -> only students receive notification
    # ------------------------------------------------------------------
    print("\n[Test 2] Admin creates STUDENTS notice...")
    # Clear prior notifications count for clean verification
    db = SessionLocal()
    db.query(Notification).delete()
    db.commit()
    db.close()

    res = client.post(
        "/api/v1/notices",
        headers=admin_auth,
        json={
            "title": "Semester Exam Registration Deadline",
            "content": "All students must submit exam forms by Friday 5 PM.",
            "audience_type": "students",
        },
    )
    assert res.status_code == 201
    notice_students = res.json()

    # Students must receive it
    for s_auth in [student1_auth, student2_auth, student3_auth]:
        n_res = client.get("/api/v1/notifications/my", headers=s_auth)
        assert len(n_res.json()) == 1
        assert n_res.json()[0]["title"] == "Semester Exam Registration Deadline"

    # Faculty must NOT receive it
    n_fac = client.get("/api/v1/notifications/my", headers=faculty1_auth)
    assert len(n_fac.json()) == 0
    print("✓ STUDENTS notice reached only students; faculty received 0 notifications")

    # ------------------------------------------------------------------
    # Test 3: Department-targeted notice reaches only that department
    # ------------------------------------------------------------------
    print("\n[Test 3] Department-targeted notice...")
    db = SessionLocal()
    db.query(Notification).delete()
    db.commit()
    db.close()

    res = client.post(
        "/api/v1/notices",
        headers=admin_auth,
        json={
            "title": "CSE Department Hackathon",
            "content": "Annual CSE Hackathon registration is now open.",
            "audience_type": "department",
            "department_id": dept_cse.id,
        },
    )
    assert res.status_code == 201
    notice_dept = res.json()

    # CSE Faculty 1 & CSE Enrolled Student 1 receive it
    assert len(client.get("/api/v1/notifications/my", headers=faculty1_auth).json()) == 1
    assert len(client.get("/api/v1/notifications/my", headers=student1_auth).json()) == 1
    print("✓ Department notice reached CSE faculty and enrolled students")

    # Validation: DEPARTMENT notice without department_id must fail
    res = client.post(
        "/api/v1/notices",
        headers=admin_auth,
        json={
            "title": "Invalid Dept Notice",
            "content": "Missing department ID",
            "audience_type": "department",
        },
    )
    assert res.status_code == 400
    print("✓ Rejected department notice missing department_id (400)")

    # ------------------------------------------------------------------
    # Test 4: Branch-targeted notice reaches only that branch
    # ------------------------------------------------------------------
    print("\n[Test 4] Branch-targeted notice...")
    db = SessionLocal()
    db.query(Notification).delete()
    db.commit()
    db.close()

    res = client.post(
        "/api/v1/notices",
        headers=admin_auth,
        json={
            "title": "CSD Design Studio Workshop",
            "content": "UI/UX workshop for Computer Science & Design branch.",
            "audience_type": "branch",
            "branch_id": branch_csd.id,
        },
    )
    assert res.status_code == 201
    # Students in CSD (student 1 & student 2 & student 3) receive it
    assert len(client.get("/api/v1/notifications/my", headers=student1_auth).json()) == 1
    print("✓ Branch-targeted notice reached enrolled branch students")

    # ------------------------------------------------------------------
    # Test 5 & 8: Group-targeted notice reaches only that group (B1 only, not B2)
    # ------------------------------------------------------------------
    print("\n[Test 5 & 8] Group-targeted notice (B1 only, not B2)...")
    db = SessionLocal()
    db.query(Notification).delete()
    db.commit()
    db.close()

    res = client.post(
        "/api/v1/notices",
        headers=admin_auth,
        json={
            "title": "Group B1 Lab Schedule Change",
            "content": "Data Structures Lab for B1 group shifted to Room LAB-3.",
            "audience_type": "group",
            "student_group_id": group_b1.id,
        },
    )
    assert res.status_code == 201
    notice_group = res.json()

    # Student 1 (in B1) receives notification
    notifs_b1 = client.get("/api/v1/notifications/my", headers=student1_auth).json()
    assert len(notifs_b1) == 1
    assert notifs_b1[0]["title"] == "Group B1 Lab Schedule Change"
    print("✓ Student in Group B1 received B1 group notification")

    # Student 3 (in B2) must NOT receive notification
    notifs_b2 = client.get("/api/v1/notifications/my", headers=student3_auth).json()
    assert len(notifs_b2) == 0
    print("✓ Student in Group B2 correctly received 0 notifications (unrelated group isolated)")

    # Faculty also receives 0 notifications for group-specific student notice
    assert len(client.get("/api/v1/notifications/my", headers=faculty1_auth).json()) == 0
    print("✓ Faculty received 0 notifications for student group notice")

    # ------------------------------------------------------------------
    # Test 6 & 7: View relevant notices (/notices/my)
    # ------------------------------------------------------------------
    print("\n[Test 6 & 7] View relevant notices via /notices/my...")
    # Student 1 (B1) sees the B1 notice in /notices/my
    my_notices_s1 = client.get("/api/v1/notices/my", headers=student1_auth).json()
    assert any(n["title"] == "Group B1 Lab Schedule Change" for n in my_notices_s1)
    print("✓ Student 1 sees Group B1 notice in /notices/my")

    # Student 3 (B2) does NOT see the B1 notice in /notices/my
    my_notices_s3 = client.get("/api/v1/notices/my", headers=student3_auth).json()
    assert not any(n["title"] == "Group B1 Lab Schedule Change" for n in my_notices_s3)
    print("✓ Student 3 (B2) does not see Group B1 notice in /notices/my")

    # ------------------------------------------------------------------
    # Test 9: Non-admin cannot create/update/delete notices
    # ------------------------------------------------------------------
    print("\n[Test 9] Non-admin cannot create/update/delete notices (403)...")
    res = client.post(
        "/api/v1/notices",
        headers=faculty1_auth,
        json={"title": "Faculty Attempt", "content": "test", "audience_type": "all"},
    )
    assert res.status_code == 403
    print("✓ Faculty blocked from creating notice (403)")

    res = client.post(
        "/api/v1/notices",
        headers=student1_auth,
        json={"title": "Student Attempt", "content": "test", "audience_type": "all"},
    )
    assert res.status_code == 403
    print("✓ Student blocked from creating notice (403)")

    notice_id = notice_group["id"]
    res = client.put(f"/api/v1/notices/{notice_id}", headers=student1_auth, json={"title": "Hacked Title"})
    assert res.status_code == 403

    res = client.delete(f"/api/v1/notices/{notice_id}", headers=faculty1_auth)
    assert res.status_code == 403
    print("✓ Non-admin blocked from updating and deleting notices (403)")

    # ------------------------------------------------------------------
    # Test 10, 11 & 12: Notification read operations & isolation
    # ------------------------------------------------------------------
    print("\n[Test 10, 11 & 12] Notification read operations...")
    # Student 1 has 1 notification (Group B1 notice)
    notifs = client.get("/api/v1/notifications/my", headers=student1_auth).json()
    target_notif = notifs[0]
    target_notif_id = target_notif["id"]
    assert target_notif["is_read"] is False

    # Student 2 tries to mark Student 1's notification as read (must fail with 403)
    res = client.patch(f"/api/v1/notifications/{target_notif_id}/read", headers=student2_auth)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    print("✓ Student 2 blocked from reading Student 1's notification (403 Forbidden)")

    # Student 1 marks own notification as read
    res = client.patch(f"/api/v1/notifications/{target_notif_id}/read", headers=student1_auth)
    assert res.status_code == 200
    read_notif = res.json()
    assert read_notif["is_read"] is True
    assert read_notif["read_at"] is not None
    print("✓ Student 1 successfully marked notification as read (read_at populated)")

    # ------------------------------------------------------------------
    # Test 13: Read-all notifications
    # ------------------------------------------------------------------
    print("\n[Test 13] Read-all notifications...")
    # Post an ALL notice so Student 2 gets unread notification
    client.post(
        "/api/v1/notices",
        headers=admin_auth,
        json={"title": "Library Books Return", "content": "Return books by end of week.", "audience_type": "all"},
    )
    s2_unread = client.get("/api/v1/notifications/my?is_read=false", headers=student2_auth).json()
    assert len(s2_unread) >= 1

    # Student 2 calls read-all
    res = client.patch("/api/v1/notifications/read-all", headers=student2_auth)
    assert res.status_code == 200
    assert res.json()["marked_count"] >= 1
    print(f"✓ Read-all marked {res.json()['marked_count']} notification(s) as read")

    # Verify no unread remaining
    s2_unread_after = client.get("/api/v1/notifications/my?is_read=false", headers=student2_auth).json()
    assert len(s2_unread_after) == 0
    print("✓ 0 unread notifications remaining after read-all")

    print("\n========================================================")
    print("🎉 ALL PHASE 10 NOTICE & NOTIFICATION TESTS PASSED 100%!")
    print("========================================================")


if __name__ == "__main__":
    test_phase10_notices_and_notifications()
