import os
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models import (
    Course,
    Department,
    Branch,
    Batch,
    Section,
    StudentGroup,
    Subject,
    SubjectOffering,
    FacultyAssignment,
    FacultyProfile,
    User,
    UserRole,
    ClassType,
)
from scripts.seed import seed

client = TestClient(app)


def test_phase5_subjects_offerings_and_assignments():
    print("=== Running Phase 5 Tests: Subject Master, Subject Offering & Faculty Assignment ===")

    # 1. Initialize seed data
    seed()

    # Authenticate Admin
    res = client.post("/api/v1/auth/login", json={"email": "admin@geoattend.ai", "password": "Admin@12345"})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    admin_auth = {"Authorization": f"Bearer {res.json()['access_token']}"}

    # Authenticate Student
    res = client.post("/api/v1/auth/login", json={"email": "student@geoattend.ai", "password": "Student@12345"})
    assert res.status_code == 200, f"Student login failed: {res.text}"
    student_auth = {"Authorization": f"Bearer {res.json()['access_token']}"}

    # Authenticate Faculty 1 (Dr. Priya Sharma)
    res = client.post("/api/v1/auth/login", json={"email": "faculty@geoattend.ai", "password": "Faculty@12345"})
    assert res.status_code == 200, f"Faculty login failed: {res.text}"
    faculty1_auth = {"Authorization": f"Bearer {res.json()['access_token']}"}

    # Authenticate Faculty 2 (Prof. Rajesh Kumar)
    res = client.post("/api/v1/auth/login", json={"email": "faculty2@geoattend.ai", "password": "Faculty@12345"})
    assert res.status_code == 200, f"Faculty2 login failed: {res.text}"
    faculty2_auth = {"Authorization": f"Bearer {res.json()['access_token']}"}

    # -------------------------------------------------------------
    # Test 1 & 8 & 9: Authorization Checks
    # -------------------------------------------------------------
    print("\n[Test 1] Testing Role Authorization for Subjects, Offerings & Assignments...")
    # Student cannot create subject
    res = client.post("/api/v1/subjects", headers=student_auth, json={"name": "Hacking", "code": "HACK101"})
    assert res.status_code == 403, f"Expected 403 for student, got {res.status_code}"
    # Faculty cannot create subject
    res = client.post("/api/v1/subjects", headers=faculty1_auth, json={"name": "Hacking", "code": "HACK101"})
    assert res.status_code == 403, f"Expected 403 for faculty, got {res.status_code}"
    # Student cannot create subject offering
    res = client.post("/api/v1/subject-offerings", headers=student_auth, json={"subject_id": 1, "course_id": 1, "semester": 1, "branch_id": 1, "section_id": 1})
    assert res.status_code == 403, f"Expected 403 for student on offerings, got {res.status_code}"
    # Faculty cannot assign faculty
    res = client.post("/api/v1/faculty-assignments", headers=faculty1_auth, json={"faculty_id": 1, "subject_offering_id": 1})
    assert res.status_code == 403, f"Expected 403 for faculty on assignments, got {res.status_code}"
    print("✓ Students and Faculty correctly restricted from mutating Subjects, Offerings, and Assignments (403 Forbidden)")

    # -------------------------------------------------------------
    # Test 2: Admin Creates Master Subject & Duplicate Rejection
    # -------------------------------------------------------------
    print("\n[Test 2] Testing Subject Master Creation & Duplicate Code Rejection...")
    # Clean up test subject if exists
    db = SessionLocal()
    existing_sub = db.query(Subject).filter(Subject.code == "CS301").first()
    if existing_sub:
        db.query(FacultyAssignment).filter(
            FacultyAssignment.subject_offering_id.in_(
                db.query(SubjectOffering.id).filter(SubjectOffering.subject_id == existing_sub.id)
            )
        ).delete(synchronize_session=False)
        db.query(SubjectOffering).filter(SubjectOffering.subject_id == existing_sub.id).delete()
        db.query(Subject).filter(Subject.id == existing_sub.id).delete()
        db.commit()

    # Get department ID
    cse_dept = db.query(Department).filter(Department.code == "CSE").first()
    dept_id = cse_dept.id if cse_dept else None
    db.close()

    res = client.post(
        "/api/v1/subjects",
        headers=admin_auth,
        json={
            "name": "Operating Systems",
            "code": "CS301",
            "description": "Processes, Memory, Storage, Concurrency",
            "credits": 4,
            "department_id": dept_id,
        },
    )
    assert res.status_code == 201, f"Create subject failed: {res.text}"
    os_subject = res.json()
    os_subject_id = os_subject["id"]
    print(f"✓ Admin created Master Subject: {os_subject['name']} ({os_subject['code']}, ID: {os_subject_id})")

    # Duplicate code rejection
    res = client.post(
        "/api/v1/subjects",
        headers=admin_auth,
        json={"name": "Operating Systems Duplicate", "code": "CS301"},
    )
    assert res.status_code == 400, f"Expected 400 on duplicate subject code, got {res.status_code}"
    print("✓ Duplicate subject code correctly rejected with 400 Bad Request")

    # -------------------------------------------------------------
    # Test 3 & 4: Admin Creates Subject Offering & Academic Validation
    # -------------------------------------------------------------
    print("\n[Test 3 & 4] Testing Subject Offering Creation & Academic Integrity Validation...")
    db = SessionLocal()
    course = db.query(Course).filter(Course.code == "BTECH").first()
    branch = db.query(Branch).filter(Branch.code == "CSD").first()
    section = db.query(Section).filter(Section.name == "CSD-A").first()
    group_b1 = db.query(StudentGroup).filter(StudentGroup.section_id == section.id, StudentGroup.name == "B1").first()
    group_b2 = db.query(StudentGroup).filter(StudentGroup.section_id == section.id, StudentGroup.name == "B2").first()
    faculty1_profile = db.query(FacultyProfile).join(User).filter(User.email == "faculty@geoattend.ai").first()
    faculty2_profile = db.query(FacultyProfile).join(User).filter(User.email == "faculty2@geoattend.ai").first()

    course_id = course.id
    branch_id = branch.id
    section_id = section.id
    b1_id = group_b1.id
    b2_id = group_b2.id
    fac1_id = faculty1_profile.id
    fac2_id = faculty2_profile.id
    db.close()

    # 4a. Invalid academic mapping: semester exceeds total semesters
    res = client.post(
        "/api/v1/subject-offerings",
        headers=admin_auth,
        json={
            "subject_id": os_subject_id,
            "course_id": course_id,
            "semester": 15,  # Exceeds total semesters (8)
            "branch_id": branch_id,
            "section_id": section_id,
            "class_type": "theory",
        },
    )
    assert res.status_code == 400, f"Expected 400 for invalid semester, got {res.status_code}"
    print("✓ Prevented invalid subject offering (semester > course total semesters) with 400 Bad Request")

    # 3a. Create Theory Offering for whole section CSD-A
    res = client.post(
        "/api/v1/subject-offerings",
        headers=admin_auth,
        json={
            "subject_id": os_subject_id,
            "course_id": course_id,
            "semester": 3,
            "branch_id": branch_id,
            "section_id": section_id,
            "student_group_id": None,
            "class_type": "theory",
        },
    )
    assert res.status_code == 201, f"Create theory offering failed: {res.text}"
    os_theory_offering = res.json()
    os_theory_offering_id = os_theory_offering["id"]
    print(f"✓ Created Subject Offering: OS Theory (Whole Section CSD-A, Sem 3, ID: {os_theory_offering_id})")

    # 3b. Create Lab Offering for Group B1
    res = client.post(
        "/api/v1/subject-offerings",
        headers=admin_auth,
        json={
            "subject_id": os_subject_id,
            "course_id": course_id,
            "semester": 3,
            "branch_id": branch_id,
            "section_id": section_id,
            "student_group_id": b1_id,
            "class_type": "lab",
        },
    )
    assert res.status_code == 201, f"Create lab offering B1 failed: {res.text}"
    os_lab_b1_offering = res.json()
    os_lab_b1_id = os_lab_b1_offering["id"]

    # 3c. Create Lab Offering for Group B2
    res = client.post(
        "/api/v1/subject-offerings",
        headers=admin_auth,
        json={
            "subject_id": os_subject_id,
            "course_id": course_id,
            "semester": 3,
            "branch_id": branch_id,
            "section_id": section_id,
            "student_group_id": b2_id,
            "class_type": "lab",
        },
    )
    assert res.status_code == 201, f"Create lab offering B2 failed: {res.text}"
    os_lab_b2_offering = res.json()
    os_lab_b2_id = os_lab_b2_offering["id"]
    print(f"✓ Created Subject Offerings for Lab: OS Lab B1 (ID: {os_lab_b1_id}) & OS Lab B2 (ID: {os_lab_b2_id})")

    # -------------------------------------------------------------
    # Test 5, 6, 7: Faculty Assignments (Theory vs Lab, Different Faculty for B1 & B2)
    # -------------------------------------------------------------
    print("\n[Test 5, 6, 7] Testing Faculty Assignments (Theory/Lab & B1/B2 Subgroups)...")

    # Assign Dr. Priya Sharma to OS Theory
    res = client.post(
        "/api/v1/faculty-assignments",
        headers=admin_auth,
        json={"faculty_id": fac1_id, "subject_offering_id": os_theory_offering_id},
    )
    assert res.status_code == 201, f"Assign Priya to OS Theory failed: {res.text}"
    print("✓ Assigned Dr. Priya Sharma to OS Theory (Whole Section)")

    # Assign Dr. Priya Sharma to OS Lab Group B1
    res = client.post(
        "/api/v1/faculty-assignments",
        headers=admin_auth,
        json={"faculty_id": fac1_id, "subject_offering_id": os_lab_b1_id},
    )
    assert res.status_code == 201, f"Assign Priya to OS Lab B1 failed: {res.text}"
    print("✓ Assigned Dr. Priya Sharma to OS Lab (Group B1)")

    # Assign Prof. Rajesh Kumar to OS Lab Group B2 (Different Faculty for B2!)
    res = client.post(
        "/api/v1/faculty-assignments",
        headers=admin_auth,
        json={"faculty_id": fac2_id, "subject_offering_id": os_lab_b2_id},
    )
    assert res.status_code == 201, f"Assign Rajesh to OS Lab B2 failed: {res.text}"
    print("✓ Assigned Prof. Rajesh Kumar to OS Lab (Group B2 - Different Faculty verified)")

    # -------------------------------------------------------------
    # Test 10: Faculty can view their assigned classes / subjects
    # -------------------------------------------------------------
    print("\n[Test 10] Testing Faculty Retrieving Their Assigned Classes...")
    # Faculty 1 (Dr. Priya Sharma) views her assignments
    res = client.get("/api/v1/faculty-assignments/my", headers=faculty1_auth)
    assert res.status_code == 200, f"Faculty 1 get my assignments failed: {res.text}"
    fac1_assignments = res.json()
    assert len(fac1_assignments) >= 2
    assigned_names = [a["subject_name"] + " (" + a["class_type"] + (f" - {a['student_group_name']}" if a['student_group_name'] else "") + ")" for a in fac1_assignments]
    print(f"✓ Dr. Priya Sharma retrieved active assignments: {assigned_names}")

    # Faculty 2 (Prof. Rajesh Kumar) views his assignments
    res = client.get("/api/v1/faculty-assignments/my", headers=faculty2_auth)
    assert res.status_code == 200, f"Faculty 2 get my assignments failed: {res.text}"
    fac2_assignments = res.json()
    assert len(fac2_assignments) >= 1
    fac2_assigned_names = [a["subject_name"] + " (" + a["class_type"] + f" - {a['student_group_name']})" for a in fac2_assignments]
    print(f"✓ Prof. Rajesh Kumar retrieved active assignments: {fac2_assigned_names}")

    print("\n========================================================")
    print("🎉 ALL PHASE 5 SUBJECT & FACULTY ASSIGNMENT TESTS PASSED 100%!")
    print("========================================================")


if __name__ == "__main__":
    test_phase5_subjects_offerings_and_assignments()
