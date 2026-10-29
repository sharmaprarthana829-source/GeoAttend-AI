import pytest
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


@pytest.fixture(scope="module")
def setup_data():
    seed()
    db = SessionLocal()
    # Ensure clean state for test hierarchy
    test_course = db.query(Course).filter(Course.code == "TEST_HIER").first()
    if test_course:
        db.query(AcademicEnrollment).filter(AcademicEnrollment.course_id == test_course.id).delete()
        for branch in db.query(Branch).filter(Branch.course_id == test_course.id).all():
            for batch in db.query(Batch).filter(Batch.branch_id == branch.id).all():
                for sec in db.query(Section).filter(Section.batch_id == batch.id).all():
                    db.query(StudentGroup).filter(StudentGroup.section_id == sec.id).delete()
                    db.query(Section).filter(Section.id == sec.id).delete()
                db.query(Batch).filter(Batch.id == batch.id).delete()
            db.query(Branch).filter(Branch.id == branch.id).delete()
        db.query(Department).filter(Department.course_id == test_course.id).delete()
        db.query(Course).filter(Course.id == test_course.id).delete()
        db.commit()
    db.close()


def test_hierarchical_academic_full_flow(setup_data):
    # 1. Login as Admin
    res = client.post("/api/v1/auth/login", json={"email": "admin@geoattend.ai", "password": "Admin@12345"})
    assert res.status_code == 200
    admin_auth = {"Authorization": f"Bearer {res.json()['access_token']}"}

    # Login as Student
    res = client.post("/api/v1/auth/login", json={"email": "student@geoattend.ai", "password": "Student@12345"})
    assert res.status_code == 200
    student_auth = {"Authorization": f"Bearer {res.json()['access_token']}"}

    # 2. Level 1: Create Course & Verify Enriched Properties
    c_res = client.post(
        "/api/v1/academic/courses",
        headers=admin_auth,
        json={"name": "Hierarchy Test Degree", "code": "TEST_HIER", "total_semesters": 8, "duration_years": 4},
    )
    assert c_res.status_code == 201
    course_id = c_res.json()["id"]

    # Verify Course Read Schema includes department_count
    courses_res = client.get("/api/v1/academic/courses", headers=admin_auth)
    assert courses_res.status_code == 200
    c_item = next(c for c in courses_res.json() if c["id"] == course_id)
    assert "department_count" in c_item
    assert c_item["department_count"] == 0

    # 3. Level 2: Create Department belonging to this Course
    d_res = client.post(
        "/api/v1/academic/departments",
        headers=admin_auth,
        json={"course_id": course_id, "name": "Hierarchy Test Dept", "code": "HT_DEPT"},
    )
    assert d_res.status_code == 201
    dept_id = d_res.json()["id"]

    # Verify course.department_count updated
    courses_res = client.get("/api/v1/academic/courses", headers=admin_auth)
    c_item = next(c for c in courses_res.json() if c["id"] == course_id)
    assert c_item["department_count"] == 1

    # Verify department filtered by course_id
    depts_res = client.get(f"/api/v1/academic/departments?course_id={course_id}", headers=admin_auth)
    assert depts_res.status_code == 200
    assert len(depts_res.json()) == 1
    assert depts_res.json()[0]["id"] == dept_id
    assert depts_res.json()[0]["branch_count"] == 0

    # 4. Dependency Check: Deleting Course with active Department should fail
    del_c_fail = client.delete(f"/api/v1/academic/courses/{course_id}", headers=admin_auth)
    assert del_c_fail.status_code == 400
    assert "active department" in del_c_fail.json()["detail"].lower()

    # 5. Level 3: Create Branch belonging to Department
    br_res = client.post(
        "/api/v1/academic/branches",
        headers=admin_auth,
        json={"department_id": dept_id, "course_id": course_id, "name": "Hierarchy Test Branch", "code": "HT_BR"},
    )
    assert br_res.status_code == 201
    branch_id = br_res.json()["id"]

    # 6. Dependency Check: Deleting Department with active Branch should fail
    del_d_fail = client.delete(f"/api/v1/academic/departments/{dept_id}", headers=admin_auth)
    assert del_d_fail.status_code == 400
    assert "active branch" in del_d_fail.json()["detail"].lower()

    # 7. Level 4: Create Batch belonging to Branch
    b_res = client.post(
        "/api/v1/academic/batches",
        headers=admin_auth,
        json={"branch_id": branch_id, "start_year": 2026, "end_year": 2030, "name": "Batch 2026-2030"},
    )
    assert b_res.status_code == 201
    batch_id = b_res.json()["id"]

    # 8. Dependency Check: Deleting Branch with active Batch should fail
    del_br_fail = client.delete(f"/api/v1/academic/branches/{branch_id}", headers=admin_auth)
    assert del_br_fail.status_code == 400
    assert "active batch" in del_br_fail.json()["detail"].lower()

    # 9. Level 5: Create Section belonging to Batch
    s_res = client.post(
        "/api/v1/academic/sections",
        headers=admin_auth,
        json={"batch_id": batch_id, "name": "Section Alpha", "capacity": 60},
    )
    assert s_res.status_code == 201
    section_id = s_res.json()["id"]

    # 10. Dependency Check: Deleting Batch with active Section should fail
    del_b_fail = client.delete(f"/api/v1/academic/batches/{batch_id}", headers=admin_auth)
    assert del_b_fail.status_code == 400
    assert "active section" in del_b_fail.json()["detail"].lower()

    # 11. Level 6: Create Student Groups belonging to Section (B1, B2)
    g1_res = client.post(
        "/api/v1/academic/groups",
        headers=admin_auth,
        json={"section_id": section_id, "name": "B1", "description": "Lab Group 1"},
    )
    assert g1_res.status_code == 201
    group_b1_id = g1_res.json()["id"]

    # Verify section group_count
    sec_res = client.get(f"/api/v1/academic/sections?batch_id={batch_id}", headers=admin_auth)
    assert sec_res.status_code == 200
    assert sec_res.json()[0]["group_count"] == 1

    # 12. Level 7: Create Enrollment for a student into this Section and Group
    # Fetch a real student profile
    db = SessionLocal()
    student_profile = db.query(StudentProfile).first()
    student_id = student_profile.id
    student_name = student_profile.user.full_name
    student_email = student_profile.user.email
    db.close()

    enr_res = client.post(
        "/api/v1/academic/enrollments",
        headers=admin_auth,
        json={
            "student_id": student_id,
            "course_id": course_id,
            "branch_id": branch_id,
            "batch_id": batch_id,
            "section_id": section_id,
            "student_group_id": group_b1_id,
            "semester": 1,
            "academic_year": "2030-2031",
            "is_current": True,
        },
    )
    assert enr_res.status_code == 201
    enrollment_id = enr_res.json()["id"]

    # Verify Enrollment returns enriched student info
    enr_list = client.get(
        f"/api/v1/academic/enrollments?section_id={section_id}&student_group_id={group_b1_id}",
        headers=admin_auth,
    )
    assert enr_list.status_code == 200
    enr_item = next(e for e in enr_list.json() if e["id"] == enrollment_id)
    assert enr_item["student_name"] == student_name
    assert enr_item["student_email"] == student_email
    assert enr_item["section_name"] == "Section Alpha"
    assert enr_item["student_group_name"] == "B1"

    # 13. Dependency Check: Deleting Section with active enrollment should fail
    del_s_fail = client.delete(f"/api/v1/academic/sections/{section_id}", headers=admin_auth)
    assert del_s_fail.status_code == 400
    assert "active group" in del_s_fail.json()["detail"].lower() or "dependent" in del_s_fail.json()["detail"].lower()

    # 14. RBAC: Student cannot delete enrollment
    stud_del = client.delete(f"/api/v1/academic/enrollments/{enrollment_id}", headers=student_auth)
    assert stud_del.status_code == 403

    # 15. Admin can delete enrollment (no attendance records -> hard delete)
    adm_del = client.delete(f"/api/v1/academic/enrollments/{enrollment_id}", headers=admin_auth)
    assert adm_del.status_code == 200

    # 16. Clean tear down of the test hierarchy in correct order (leaf to root)
    assert client.delete(f"/api/v1/academic/groups/{group_b1_id}", headers=admin_auth).status_code == 200
    assert client.delete(f"/api/v1/academic/sections/{section_id}", headers=admin_auth).status_code == 200
    assert client.delete(f"/api/v1/academic/batches/{batch_id}", headers=admin_auth).status_code == 200
    assert client.delete(f"/api/v1/academic/branches/{branch_id}", headers=admin_auth).status_code == 200
    assert client.delete(f"/api/v1/academic/departments/{dept_id}", headers=admin_auth).status_code == 200
    assert client.delete(f"/api/v1/academic/courses/{course_id}", headers=admin_auth).status_code == 200
