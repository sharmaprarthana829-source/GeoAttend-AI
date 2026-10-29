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
    AcademicEnrollment,
    StudentProfile,
    User,
    UserRole,
)
from scripts.seed import seed

client = TestClient(app)


def test_phase4_academic_structure_and_enrollment():
    print("=== Running Phase 4 Tests: Academic Structure & Student Enrollment ===")

    # 1. Ensure seed data
    seed()

    # Clean up any leftover test records from previous runs
    db = SessionLocal()
    mtech = db.query(Course).filter(Course.code == "MTECH").first()
    if mtech:
        db.query(AcademicEnrollment).filter(AcademicEnrollment.course_id == mtech.id).delete()
        for branch in db.query(Branch).filter(Branch.course_id == mtech.id).all():
            for batch in db.query(Batch).filter(Batch.branch_id == branch.id).all():
                for sec in db.query(Section).filter(Section.batch_id == batch.id).all():
                    db.query(StudentGroup).filter(StudentGroup.section_id == sec.id).delete()
                    db.query(Section).filter(Section.id == sec.id).delete()
                db.query(Batch).filter(Batch.id == batch.id).delete()
            db.query(Branch).filter(Branch.id == branch.id).delete()
        for dept in db.query(Department).filter(Department.course_id == mtech.id).all():
            from app.models import FacultyProfile, FacultyResponsibility
            for fac in db.query(FacultyProfile).filter(FacultyProfile.department_id == dept.id).all():
                db.query(FacultyResponsibility).filter(FacultyResponsibility.faculty_id == fac.id).delete()
                db.query(FacultyProfile).filter(FacultyProfile.id == fac.id).delete()
            db.query(Department).filter(Department.id == dept.id).delete()
        db.query(Course).filter(Course.id == mtech.id).delete()
        db.commit()
    db.close()

    # Authenticate Admin
    res = client.post("/api/v1/auth/login", json={"email": "admin@geoattend.ai", "password": "Admin@12345"})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    admin_token = res.json()["access_token"]
    admin_auth = {"Authorization": f"Bearer {admin_token}"}

    # Authenticate Student
    res = client.post("/api/v1/auth/login", json={"email": "student@geoattend.ai", "password": "Student@12345"})
    assert res.status_code == 200, f"Student login failed: {res.text}"
    student_token = res.json()["access_token"]
    student_auth = {"Authorization": f"Bearer {student_token}"}

    # Authenticate Faculty
    res = client.post("/api/v1/auth/login", json={"email": "faculty@geoattend.ai", "password": "Faculty@12345"})
    assert res.status_code == 200, f"Faculty login failed: {res.text}"
    faculty_token = res.json()["access_token"]
    faculty_auth = {"Authorization": f"Bearer {faculty_token}"}

    # -------------------------------------------------------------
    # Test 1: Authorization checks on Academic APIs
    # -------------------------------------------------------------
    print("\n[Test 1] Testing Student/Faculty access restrictions...")
    # Student cannot create course
    res = client.post("/api/v1/academic/courses", headers=student_auth, json={"name": "Hacking 101", "code": "HACK"})
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    # Faculty cannot create course
    res = client.post("/api/v1/academic/courses", headers=faculty_auth, json={"name": "Hacking 101", "code": "HACK"})
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    print("✓ Student and Faculty correctly blocked from administrative Academic APIs with 403 Forbidden")

    # -------------------------------------------------------------
    # Test 2: Create complete Academic Hierarchy (Course -> Department -> Branch -> Batch -> Section -> StudentGroup)
    # -------------------------------------------------------------
    print("\n[Test 2] Testing Complete Academic Hierarchy Creation...")
    
    # 2a. Course
    res = client.post(
        "/api/v1/academic/courses",
        headers=admin_auth,
        json={"name": "Master of Technology", "code": "MTECH", "duration_years": 2, "total_semesters": 4},
    )
    assert res.status_code == 201, f"Create course failed: {res.text}"
    course_data = res.json()
    course_id = course_data["id"]
    print(f"✓ Created Course: {course_data['name']} (ID: {course_id}, Code: {course_data['code']})")

    # 2b. Department
    res = client.post(
        "/api/v1/academic/departments",
        headers=admin_auth,
        json={"name": "Mechanical & Mechatronics", "code": "MECH", "course_id": course_id},
    )
    assert res.status_code == 201, f"Create department failed: {res.text}"
    dept_data = res.json()
    dept_id = dept_data["id"]
    print(f"✓ Created Department: {dept_data['name']} (ID: {dept_id}, Code: {dept_data['code']})")

    # 2c. Branch
    res = client.post(
        "/api/v1/academic/branches",
        headers=admin_auth,
        json={"name": "Robotics & Automation", "code": "ROBO", "department_id": dept_id, "course_id": course_id},
    )
    assert res.status_code == 201, f"Create branch failed: {res.text}"
    branch_data = res.json()
    branch_id = branch_data["id"]
    print(f"✓ Created Branch: {branch_data['name']} (ID: {branch_id}, Code: {branch_data['code']})")

    # 2d. Batch
    res = client.post(
        "/api/v1/academic/batches",
        headers=admin_auth,
        json={"name": "2024-2026", "start_year": 2024, "end_year": 2026, "branch_id": branch_id},
    )
    assert res.status_code == 201, f"Create batch failed: {res.text}"
    batch_data = res.json()
    batch_id = batch_data["id"]
    print(f"✓ Created Batch: {batch_data['name']} (ID: {batch_id})")

    # 2e. Section
    res = client.post(
        "/api/v1/academic/sections",
        headers=admin_auth,
        json={"name": "ROBO-A", "capacity": 30, "batch_id": batch_id},
    )
    assert res.status_code == 201, f"Create section failed: {res.text}"
    section_data = res.json()
    section_id = section_data["id"]
    print(f"✓ Created Section: {section_data['name']} (ID: {section_id})")

    # 2f. Student Groups (B1, B2)
    res = client.post(
        "/api/v1/academic/groups",
        headers=admin_auth,
        json={"name": "B1", "description": "Lab Subgroup 1", "section_id": section_id},
    )
    assert res.status_code == 201, f"Create group B1 failed: {res.text}"
    group_b1 = res.json()
    group_b1_id = group_b1["id"]

    res = client.post(
        "/api/v1/academic/groups",
        headers=admin_auth,
        json={"name": "B2", "description": "Lab Subgroup 2", "section_id": section_id},
    )
    assert res.status_code == 201, f"Create group B2 failed: {res.text}"
    group_b2 = res.json()
    group_b2_id = group_b2["id"]
    print(f"✓ Created Student Groups: {group_b1['name']} (ID: {group_b1_id}) & {group_b2['name']} (ID: {group_b2_id})")

    # -------------------------------------------------------------
    # Test 3: Validation & Edge Case Handling
    # -------------------------------------------------------------
    print("\n[Test 3] Testing Validation Rules & Duplicate Constraints...")

    # 3a. Prevent duplicate Course code
    res = client.post(
        "/api/v1/academic/courses",
        headers=admin_auth,
        json={"name": "Master of Technology Duplicate", "code": "MTECH"},
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}"
    print("✓ Prevented duplicate Course code with 400 Bad Request")

    # 3b. Prevent duplicate Branch code in same department
    res = client.post(
        "/api/v1/academic/branches",
        headers=admin_auth,
        json={"name": "Robotics Duplicate", "code": "ROBO", "department_id": dept_id},
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}"
    print("✓ Prevented duplicate Branch code in department with 400 Bad Request")

    # 3c. Prevent invalid Batch start_year >= end_year
    res = client.post(
        "/api/v1/academic/batches",
        headers=admin_auth,
        json={"name": "Invalid Batch", "start_year": 2026, "end_year": 2024, "branch_id": branch_id},
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}"
    print("✓ Prevented invalid Batch years (start_year >= end_year) with 400 Bad Request")

    # 3d. Prevent duplicate Student Group in same section
    res = client.post(
        "/api/v1/academic/groups",
        headers=admin_auth,
        json={"name": "B1", "description": "Duplicate B1", "section_id": section_id},
    )
    assert res.status_code == 400, f"Expected 400, got {res.status_code}"
    print("✓ Prevented duplicate Student Group ('B1') within same section with 400 Bad Request")

    # -------------------------------------------------------------
    # Test 4: Dynamic Student Academic Enrollment
    # -------------------------------------------------------------
    print("\n[Test 4] Testing Student Academic Enrollment...")
    db = SessionLocal()
    student_profile = db.query(StudentProfile).join(User).filter(User.email == "student@geoattend.ai").first()
    student_profile_id = student_profile.id
    db.close()

    # 4a. Prevent inconsistent enrollment (Section not in Batch)
    res = client.post(
        "/api/v1/academic/enrollments",
        headers=admin_auth,
        json={
            "student_id": student_profile_id,
            "course_id": course_id,
            "branch_id": branch_id,
            "batch_id": 99999,  # Inconsistent batch
            "section_id": section_id,
            "student_group_id": group_b1_id,
            "semester": 1,
            "academic_year": "2024-2025",
        },
    )
    assert res.status_code in [400, 404], f"Expected 400/404 on inconsistent hierarchy, got {res.status_code}"
    print("✓ Prevented inconsistent academic enrollment hierarchy with 400 Bad Request")

    # 4b. Enroll student in M.Tech Semester 1
    res = client.post(
        "/api/v1/academic/enrollments",
        headers=admin_auth,
        json={
            "student_id": student_profile_id,
            "course_id": course_id,
            "branch_id": branch_id,
            "batch_id": batch_id,
            "section_id": section_id,
            "student_group_id": group_b1_id,
            "semester": 2,
            "academic_year": "2024-2025",
        },
    )
    assert res.status_code == 201, f"Enroll student failed: {res.text}"
    enroll_data = res.json()
    enroll_id = enroll_data["id"]
    assert enroll_data["is_current"] is True
    assert enroll_data["student_group_id"] == group_b1_id
    print(f"✓ Enrolled Student ID {student_profile_id} into Course {course_id}, Sem 2, Group B1 (Enrollment ID: {enroll_id})")

    # 4c. Prevent duplicate active enrollment in same semester + academic year
    res = client.post(
        "/api/v1/academic/enrollments",
        headers=admin_auth,
        json={
            "student_id": student_profile_id,
            "course_id": course_id,
            "branch_id": branch_id,
            "batch_id": batch_id,
            "section_id": section_id,
            "student_group_id": group_b2_id,
            "semester": 2,
            "academic_year": "2024-2025",
        },
    )
    assert res.status_code == 400, f"Expected 400 for duplicate enrollment, got {res.status_code}"
    print("✓ Prevented duplicate active enrollment for same student in same semester and academic year")

    # 4d. Update enrollment (switch to Group B2)
    res = client.put(
        f"/api/v1/academic/enrollments/{enroll_id}",
        headers=admin_auth,
        json={"student_group_id": group_b2_id},
    )
    assert res.status_code == 200, f"Update enrollment failed: {res.text}"
    updated_enroll = res.json()
    assert updated_enroll["student_group_id"] == group_b2_id
    print(f"✓ Updated Student Enrollment ID {enroll_id} to Group B2 (ID: {group_b2_id})")

    # 4e. Fetch current student enrollment endpoint
    res = client.get(
        f"/api/v1/academic/students/{student_profile_id}/current-enrollment",
        headers=student_auth,
    )
    assert res.status_code == 200
    cur_enroll = res.json()
    assert cur_enroll is not None
    assert cur_enroll["id"] == enroll_id
    assert cur_enroll["semester"] == 2
    assert cur_enroll["student_group_id"] == group_b2_id
    print(f"✓ Verified current student enrollment endpoint: Sem {cur_enroll['semester']}, Group B2")

    # -------------------------------------------------------------
    # Test 5: Listing & Filtering Academic Entities
    # -------------------------------------------------------------
    print("\n[Test 5] Testing Query & List Endpoints with Filters...")
    # List courses
    res = client.get("/api/v1/academic/courses", headers=student_auth)
    assert res.status_code == 200
    courses = res.json()
    assert len(courses) >= 2
    print(f"✓ Listed {len(courses)} Courses")

    # List branches by department
    res = client.get(f"/api/v1/academic/branches?department_id={dept_id}", headers=student_auth)
    assert res.status_code == 200
    branches = res.json()
    assert len(branches) >= 1
    assert branches[0]["code"] == "ROBO"
    print(f"✓ Listed Branches for Department {dept_id}: {[b['name'] for b in branches]}")

    # List groups by section
    res = client.get(f"/api/v1/academic/groups?section_id={section_id}", headers=student_auth)
    assert res.status_code == 200
    groups = res.json()
    assert len(groups) == 2
    print(f"✓ Listed Groups for Section {section_id}: {[g['name'] for g in groups]}")

    # List enrollments
    res = client.get(f"/api/v1/academic/enrollments?branch_id={branch_id}&semester=2", headers=admin_auth)
    assert res.status_code == 200
    enrollments = res.json()
    assert len(enrollments) >= 1
    print(f"✓ Filtered Enrollments: Found {len(enrollments)} active enrollments")

    print("\n========================================================")
    print("🎉 ALL PHASE 4 ACADEMIC STRUCTURE & ENROLLMENT TESTS PASSED 100%!")
    print("========================================================")


if __name__ == "__main__":
    test_phase4_academic_structure_and_enrollment()
