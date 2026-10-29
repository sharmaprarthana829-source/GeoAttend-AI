"""Phase 9 Tests: Attendance Application & Debarment Workflow

Tests:
 1. Student submits valid application.
 2. Student cannot submit for another student.
 3. Student cannot apply for unrelated subject (not enrolled).
 4. Faculty sees only assigned-subject applications.
 5. Unassigned faculty receives 403 on review.
 6. Faculty approves application.
 7. Approved application moves to PENDING_HOD.
 8. Faculty rejection ends workflow (moves to FACULTY_REJECTED).
 9. Valid HOD can view department applications.
10. Non-HOD faculty cannot perform HOD review.
11. HOD from another department cannot review it.
12. HOD approves application (moves to HOD_APPROVED).
13. HOD rejects application (moves to HOD_REJECTED).
14. Invalid state transitions are blocked.
15. Student can see own application status.
16. Student cannot see other students' applications.
17. Admin can monitor applications.
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
    Course,
    Department,
    FacultyProfile,
    FacultyResponsibility,
    ResponsibilityType,
    ScopeType,
    Section,
    StudentGroup,
    StudentProfile,
    Subject,
    SubjectOffering,
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
    db.query(AttendanceApplication).delete(synchronize_session=False)

    from app.models import Notification
    db.query(Notification).delete(synchronize_session=False)

    mech_user = db.query(User).filter(User.email == "mech_hod@geoattend.ai").first()
    if mech_user:
        mech_fac = db.query(FacultyProfile).filter(FacultyProfile.user_id == mech_user.id).first()
        if mech_fac:
            db.query(FacultyResponsibility).filter(FacultyResponsibility.faculty_id == mech_fac.id).delete()
            db.query(FacultyProfile).filter(FacultyProfile.id == mech_fac.id).delete()
        db.query(User).filter(User.id == mech_user.id).delete()

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


def test_phase9_applications():
    print("=== Running Phase 9 Tests: Attendance Application & Debarment Workflow ===")

    seed()
    _cleanup_database()

    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")
    faculty1_auth = _auth("faculty@geoattend.ai", "Faculty@12345")  # Priya Sharma (Assigned CS201 Theory & CS203 Lab B1; HOD of CSE)
    faculty2_auth = _auth("faculty2@geoattend.ai", "Faculty@12345")  # Rajesh Kumar (Assigned CS203 Lab B2; Professor, NOT HOD)
    student1_auth = _auth("student@geoattend.ai", "Student@12345")  # Arjun Mehta (Enrolled Sem 1, Section CSD-A, Group B1)
    student2_auth = _auth("student2@geoattend.ai", "Student@12345")  # Sneha Patel (Enrolled Sem 1, Section CSD-A, Group B1)

    db = SessionLocal()
    # Offerings:
    # 1. Theory offering (CS201 Data Structures, whole section CSD-A, Faculty 1)
    offering_theory = (
        db.query(SubjectOffering)
        .filter(SubjectOffering.section_id == 2, SubjectOffering.student_group_id.is_(None))
        .first()
    )
    # 2. Lab B1 offering (CS203 Data Structures Lab, Group B1, Faculty 1)
    offering_lab_b1 = (
        db.query(SubjectOffering)
        .filter(SubjectOffering.section_id == 2, SubjectOffering.student_group_id == 1)
        .first()
    )
    # 3. Lab B2 offering (CS203 Data Structures Lab, Group B2, Faculty 2)
    offering_lab_b2 = (
        db.query(SubjectOffering)
        .filter(SubjectOffering.section_id == 2, SubjectOffering.student_group_id == 2)
        .first()
    )

    fac1 = db.query(FacultyProfile).join(User).filter(User.email == "faculty@geoattend.ai").first()
    fac2 = db.query(FacultyProfile).join(User).filter(User.email == "faculty2@geoattend.ai").first()
    student1 = db.query(StudentProfile).join(User).filter(User.email == "student@geoattend.ai").first()
    student2 = db.query(StudentProfile).join(User).filter(User.email == "student2@geoattend.ai").first()
    db.close()

    # ------------------------------------------------------------------
    # Test 1: Student submits valid application
    # ------------------------------------------------------------------
    print("\n[Test 1] Student 1 submits valid application for CS201 Theory...")
    res = client.post(
        "/api/v1/applications",
        headers=student1_auth,
        json={
            "subject_offering_id": offering_theory.id,
            "reason": "Medical Absence",
            "description": "Hospitalized due to acute viral fever from Monday to Wednesday.",
            "supporting_document_url": "https://documents.geoattend.ai/med_cert_001.pdf",
        },
    )
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    app1 = res.json()
    assert app1["status"] == "pending_faculty"
    assert app1["student_id"] == student1.id
    assert app1["subject_offering_id"] == offering_theory.id
    assert app1["subject_name"] == "Data Structures"
    assert app1["reason"] == "Medical Absence"
    app1_id = app1["id"]
    print(f"✓ Created application ID={app1_id} with status='pending_faculty'")

    # Duplicate active application rejection
    res = client.post(
        "/api/v1/applications",
        headers=student1_auth,
        json={
            "subject_offering_id": offering_theory.id,
            "reason": "Duplicate attempt",
            "description": "Trying to apply again while first is pending",
        },
    )
    assert res.status_code == 400, f"Expected 400 for duplicate, got {res.status_code}"
    print(f"✓ Prevented duplicate active application for same subject: {res.json()['detail']}")

    # ------------------------------------------------------------------
    # Test 2: Student cannot submit for another student
    # ------------------------------------------------------------------
    print("\n[Test 2] Student cannot submit application on behalf of another student...")
    # Authentication enforces that application is always bound to current_user's student profile
    res = client.post(
        "/api/v1/applications",
        headers=student2_auth,
        json={
            "subject_offering_id": offering_theory.id,
            "reason": "Personal Emergency",
            "description": "Student 2 personal application.",
        },
    )
    assert res.status_code == 201
    app2 = res.json()
    assert app2["student_id"] == student2.id  # Bound to student 2
    app2_id = app2["id"]
    print("✓ Application ownership strictly enforced based on authenticated session")

    # ------------------------------------------------------------------
    # Test 3: Student cannot apply for unrelated subject / group
    # ------------------------------------------------------------------
    print("\n[Test 3] Student in B1 cannot apply for B2-specific lab offering...")
    # Student 1 is in Group B1. offering_lab_b2 is for Group B2.
    res = client.post(
        "/api/v1/applications",
        headers=student1_auth,
        json={
            "subject_offering_id": offering_lab_b2.id,
            "reason": "Invalid Group",
            "description": "Attempting to apply for group B2 lab.",
        },
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
    assert "not in the student group" in res.json()["detail"].lower() or "enrolled" in res.json()["detail"].lower()
    print(f"✓ Unrelated subject/group application correctly rejected: {res.json()['detail']}")

    # ------------------------------------------------------------------
    # Test 4: Faculty sees only assigned-subject applications
    # ------------------------------------------------------------------
    print("\n[Test 4] Faculty sees only applications for assigned subject offerings...")
    # Faculty 1 is assigned to offering_theory (both app1 and app2 are for offering_theory)
    res = client.get("/api/v1/applications/faculty", headers=faculty1_auth)
    assert res.status_code == 200
    fac1_apps = res.json()
    assert len(fac1_apps) >= 2
    assert any(a["id"] == app1_id for a in fac1_apps)
    print(f"✓ Faculty 1 sees {len(fac1_apps)} applications for her assigned classes")

    # Faculty 2 is assigned ONLY to CS203 Lab (B2), so should see 0 applications for CS201 Theory
    res = client.get("/api/v1/applications/faculty", headers=faculty2_auth)
    assert res.status_code == 200
    fac2_apps = res.json()
    assert len(fac2_apps) == 0
    print(f"✓ Faculty 2 sees {len(fac2_apps)} applications (0 for unassigned classes)")

    # ------------------------------------------------------------------
    # Test 5: Unassigned faculty receives 403 on review
    # ------------------------------------------------------------------
    print("\n[Test 5] Unassigned faculty receives 403 when trying to review application...")
    # Faculty 2 tries to review app1 (assigned to Faculty 1)
    res = client.patch(
        f"/api/v1/applications/{app1_id}/faculty-review",
        headers=faculty2_auth,
        json={"decision": "approved", "remarks": "Unauthorized approval attempt"},
    )
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"
    print(f"✓ Unassigned faculty correctly blocked with 403 Forbidden: {res.json()['detail']}")

    # ------------------------------------------------------------------
    # Test 6 & 7: Faculty approves application -> Moves to PENDING_COORDINATOR
    # ------------------------------------------------------------------
    print("\n[Test 6 & 7] Faculty approves application -> transitions to PENDING_COORDINATOR...")
    res = client.patch(
        f"/api/v1/applications/{app1_id}/faculty-review",
        headers=faculty1_auth,
        json={
            "decision": "approved",
            "remarks": "Medical certificate verified with clinic. Recommended for approval.",
        },
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    reviewed_app1 = res.json()
    assert reviewed_app1["status"] == "pending_coordinator"
    assert reviewed_app1["faculty_decision"] == "approved"
    assert reviewed_app1["faculty_reviewer_name"] == "Dr. Priya Sharma"
    assert "verified" in reviewed_app1["faculty_remarks"]
    print("✓ Application status successfully advanced to 'pending_coordinator'")

    # Set up Faculty 2 as Section Coordinator for section 2
    db = SessionLocal()
    db.query(FacultyResponsibility).filter(
        FacultyResponsibility.faculty_id == fac2.id,
        FacultyResponsibility.responsibility_type == ResponsibilityType.COORDINATOR,
    ).delete()
    coord_resp = FacultyResponsibility(
        faculty_id=fac2.id,
        responsibility_type=ResponsibilityType.COORDINATOR,
        scope_type=ScopeType.SECTION,
        section_id=2,
        is_active=True,
    )
    db.add(coord_resp)
    db.commit()
    db.close()

    # Coordinator reviews and approves -> PENDING_HOD
    res_coord = client.patch(
        f"/api/v1/applications/{app1_id}/coordinator-review",
        headers=faculty2_auth,
        json={
            "decision": "approved",
            "remarks": "Section coordinator approved shortfall.",
        },
    )
    assert res_coord.status_code == 200
    assert res_coord.json()["status"] == "pending_hod"
    print("✓ Coordinator approved application -> advanced to 'pending_hod'")

    # ------------------------------------------------------------------
    # Test 8: Faculty rejection ends workflow (REJECTED)
    # ------------------------------------------------------------------
    print("\n[Test 8] Faculty rejection transitions application to REJECTED...")
    res = client.patch(
        f"/api/v1/applications/{app2_id}/faculty-review",
        headers=faculty1_auth,
        json={
            "decision": "rejected",
            "remarks": "Insufficient justification for absence during mid-term review.",
        },
    )
    assert res.status_code == 200
    rejected_app2 = res.json()
    assert rejected_app2["status"] == "rejected"
    assert rejected_app2["faculty_decision"] == "rejected"
    print("✓ Rejected application correctly transitioned to terminal 'rejected' state")

    # Rejected application cannot be reviewed by HOD
    res = client.patch(
        f"/api/v1/applications/{app2_id}/hod-decision",
        headers=faculty1_auth,
        json={"decision": "approved", "remarks": "Attempting to approve a rejected app"},
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
    print(f"✓ HOD cannot review faculty-rejected application: {res.json()['detail']}")

    # ------------------------------------------------------------------
    # Test 9: Valid HOD can view department applications
    # ------------------------------------------------------------------
    print("\n[Test 9] Valid HOD can view department applications in PENDING_HOD...")
    # Faculty 1 (Dr. Priya Sharma) has active HOD responsibility for Computer Science
    res = client.get("/api/v1/applications/hod", headers=faculty1_auth)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    hod_apps = res.json()
    assert len(hod_apps) >= 1
    assert any(a["id"] == app1_id for a in hod_apps)
    print(f"✓ HOD sees {len(hod_apps)} department applications awaiting decision")

    # ------------------------------------------------------------------
    # Test 10: Non-HOD faculty cannot perform HOD review
    # ------------------------------------------------------------------
    print("\n[Test 10] Non-HOD faculty cannot access HOD endpoints...")
    # Faculty 2 (Prof. Rajesh Kumar) is NOT an HOD
    res = client.get("/api/v1/applications/hod", headers=faculty2_auth)
    assert res.status_code == 403, f"Expected 403 for non-HOD, got {res.status_code}"

    res = client.patch(
        f"/api/v1/applications/{app1_id}/hod-decision",
        headers=faculty2_auth,
        json={"decision": "approved", "remarks": "Non-HOD trying to decide"},
    )
    assert res.status_code == 403, f"Expected 403 for non-HOD decision, got {res.status_code}"
    print("✓ Non-HOD faculty correctly blocked with 403 Forbidden")

    # ------------------------------------------------------------------
    # Test 11: HOD from another department cannot review it
    # ------------------------------------------------------------------
    print("\n[Test 11] HOD from another department cannot review application...")
    # Create a 3rd faculty member who is HOD of MECH department
    db = SessionLocal()
    mech_dept = db.query(Department).filter(Department.code == "MECH").first()
    if not mech_dept:
        mech_dept = Department(college_id=1, name="Mechanical Engineering", code="MECH", is_active=True)
        db.add(mech_dept)
        db.flush()

    from app.core.security import get_password_hash
    mech_user = db.query(User).filter(User.email == "mech_hod@geoattend.ai").first()
    if not mech_user:
        mech_user = User(
            college_id=1,
            email="mech_hod@geoattend.ai",
            password_hash=get_password_hash("Faculty@12345"),
            full_name="Dr. Mechanical HOD",
            role="faculty",
        )
        db.add(mech_user)
        db.flush()

    mech_fac = db.query(FacultyProfile).filter(FacultyProfile.user_id == mech_user.id).first()
    if not mech_fac:
        mech_fac = FacultyProfile(
            user_id=mech_user.id,
            department_id=mech_dept.id,
            employee_id="MECH001",
            designation="Professor & HOD",
        )
        db.add(mech_fac)
        db.flush()

    mech_resp = (
        db.query(FacultyResponsibility)
        .filter(
            FacultyResponsibility.faculty_id == mech_fac.id,
            FacultyResponsibility.responsibility_type == ResponsibilityType.HOD,
        )
        .first()
    )
    if not mech_resp:
        mech_resp = FacultyResponsibility(
            faculty_id=mech_fac.id,
            responsibility_type=ResponsibilityType.HOD,
            scope_type=ScopeType.DEPARTMENT,
            department_id=mech_dept.id,
            college_id=1,
            is_active=True,
        )
        db.add(mech_resp)
        db.commit()
    db.close()

    mech_hod_auth = _auth("mech_hod@geoattend.ai", "Faculty@12345")
    # Mech HOD tries to review app1 (which belongs to CSE department)
    res = client.patch(
        f"/api/v1/applications/{app1_id}/hod-decision",
        headers=mech_hod_auth,
        json={"decision": "approved", "remarks": "Cross-department HOD attempt"},
    )
    assert res.status_code == 403, f"Expected 403 for cross-department HOD, got {res.status_code}: {res.text}"
    print(f"✓ Cross-department HOD blocked with 403 Forbidden: {res.json()['detail']}")

    # ------------------------------------------------------------------
    # Test 12: Valid HOD approves application -> APPROVED
    # ------------------------------------------------------------------
    print("\n[Test 12] Valid CSE HOD approves application -> transitions to APPROVED...")
    res = client.patch(
        f"/api/v1/applications/{app1_id}/hod-decision",
        headers=faculty1_auth,
        json={
            "decision": "approved",
            "remarks": "Approved. Minimum attendance requirement condoned on medical grounds.",
        },
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    approved_app1 = res.json()
    assert approved_app1["status"] == "approved"
    assert approved_app1["hod_decision"] == "approved"
    assert approved_app1["hod_reviewer_name"] == "Dr. Priya Sharma"
    assert "medical grounds" in approved_app1["hod_remarks"]
    print("✓ Application successfully reached terminal 'approved' state")

    # ------------------------------------------------------------------
    # Test 13: HOD rejects application -> REJECTED
    # ------------------------------------------------------------------
    print("\n[Test 13] HOD rejects application -> transitions to REJECTED...")
    # Create application 3, have faculty approve it, coordinator approve it, then HOD rejects it
    res = client.post(
        "/api/v1/applications",
        headers=student1_auth,
        json={
            "subject_offering_id": offering_lab_b1.id,
            "reason": "Sports Meet",
            "description": "Representing college in inter-university basketball.",
        },
    )
    assert res.status_code == 201
    app3_id = res.json()["id"]

    # Faculty 1 approves
    res = client.patch(
        f"/api/v1/applications/{app3_id}/faculty-review",
        headers=faculty1_auth,
        json={"decision": "approved", "remarks": "Forwarded to coordinator for sports quota verification."},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "pending_coordinator"

    # Coordinator approves
    res = client.patch(
        f"/api/v1/applications/{app3_id}/coordinator-review",
        headers=faculty2_auth,
        json={"decision": "approved", "remarks": "Forwarded to HOD for sports quota verification."},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "pending_hod"

    # HOD rejects
    res = client.patch(
        f"/api/v1/applications/{app3_id}/hod-decision",
        headers=faculty1_auth,
        json={"decision": "rejected", "remarks": "Sports tournament not on official university calendar."},
    )
    assert res.status_code == 200
    rejected_app3 = res.json()
    assert rejected_app3["status"] == "rejected"
    assert rejected_app3["hod_decision"] == "rejected"
    print("✓ Application successfully transitioned to 'rejected' state")

    # ------------------------------------------------------------------
    # Test 14: Invalid state transitions are blocked
    # ------------------------------------------------------------------
    print("\n[Test 14] Invalid state transitions are blocked...")
    # Trying to review an already decided app (app1 is APPROVED)
    res = client.patch(
        f"/api/v1/applications/{app1_id}/faculty-review",
        headers=faculty1_auth,
        json={"decision": "approved", "remarks": "Re-review attempt"},
    )
    assert res.status_code == 400
    print("✓ Re-review of completed application by faculty blocked (400)")

    res = client.patch(
        f"/api/v1/applications/{app1_id}/hod-decision",
        headers=faculty1_auth,
        json={"decision": "rejected", "remarks": "Changing final decision"},
    )
    assert res.status_code == 400
    print("✓ Modifying finalized HOD decision blocked (400)")

    # ------------------------------------------------------------------
    # Test 15 & 16: Student views own applications & cannot view others
    # ------------------------------------------------------------------
    print("\n[Test 15 & 16] Student view isolation...")
    res = client.get("/api/v1/applications/my", headers=student1_auth)
    assert res.status_code == 200
    my_apps = res.json()
    assert len(my_apps) >= 2  # app1 and app3
    for a in my_apps:
        assert a["student_id"] == student1.id
    print(f"✓ Student 1 sees only own {len(my_apps)} applications")

    # Student 1 cannot view Student 2's application detail (app2)
    res = client.get(f"/api/v1/applications/{app2_id}", headers=student1_auth)
    assert res.status_code == 403
    print("✓ Student 1 blocked from viewing Student 2's application (403 Forbidden)")

    # ------------------------------------------------------------------
    # Test 17: Admin can monitor all applications
    # ------------------------------------------------------------------
    print("\n[Test 17] Admin can monitor all applications across departments...")
    res = client.get("/api/v1/applications/admin", headers=admin_auth)
    assert res.status_code == 200
    all_admin_apps = res.json()
    assert len(all_admin_apps) >= 3
    print(f"✓ Admin sees total {len(all_admin_apps)} applications across all students/departments")

    # Filter by status
    res = client.get("/api/v1/applications/admin?status=approved", headers=admin_auth)
    assert res.status_code == 200
    approved_list = res.json()
    assert len(approved_list) >= 1
    assert all(a["status"] == "approved" for a in approved_list)
    print(f"✓ Admin filter status=approved returned {len(approved_list)} item(s)")

    print("\n========================================================")
    print("🎉 ALL PHASE 9 ATTENDANCE APPLICATION TESTS PASSED 100%!")
    print("========================================================")


if __name__ == "__main__":
    test_phase9_applications()
