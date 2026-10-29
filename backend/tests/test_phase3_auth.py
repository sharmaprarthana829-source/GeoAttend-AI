import os
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models import User, UserRole, FacultyProfile, FacultyResponsibility, ResponsibilityType, ScopeType
from app.core.security import get_password_hash
from scripts.seed import seed

client = TestClient(app)


def test_phase3_auth_and_roles():
    print("=== Running Phase 3 Tests: Authentication & User Role Architecture ===")

    # 1. Ensure seed data is present
    seed()

    # -------------------------------------------------------------
    # Test 1: Invalid Login
    # -------------------------------------------------------------
    print("\n[Test 1] Testing Invalid Login...")
    res = client.post("/api/v1/auth/login", json={"email": "admin@geoattend.ai", "password": "WrongPassword123"})
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"
    print("✓ Invalid login rejected with 401 Unauthorized")

    # -------------------------------------------------------------
    # Test 2: Admin Login
    # -------------------------------------------------------------
    print("\n[Test 2] Testing Admin Login...")
    res = client.post("/api/v1/auth/login", json={"email": "admin@geoattend.ai", "password": "Admin@12345"})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    admin_tokens = res.json()
    assert admin_tokens["role"] == "admin", f"Expected admin role, got {admin_tokens['role']}"
    assert "access_token" in admin_tokens
    admin_auth = {"Authorization": f"Bearer {admin_tokens['access_token']}"}
    print("✓ Admin login successful with role='admin'")

    # -------------------------------------------------------------
    # Test 3: Faculty (with HOD & Professor) Login
    # -------------------------------------------------------------
    print("\n[Test 3] Testing Faculty Login (with HOD responsibility)...")
    res = client.post("/api/v1/auth/login", json={"email": "faculty@geoattend.ai", "password": "Faculty@12345"})
    assert res.status_code == 200, f"Faculty login failed: {res.text}"
    faculty_tokens = res.json()
    assert faculty_tokens["role"] == "faculty"
    assert "hod" in faculty_tokens["responsibilities"]
    assert "professor" in faculty_tokens["responsibilities"]
    faculty_hod_auth = {"Authorization": f"Bearer {faculty_tokens['access_token']}"}
    print(f"✓ Faculty login successful with role='faculty', responsibilities={faculty_tokens['responsibilities']}")

    # -------------------------------------------------------------
    # Test 4: Faculty (Professor only, NO HOD) Login
    # -------------------------------------------------------------
    print("\n[Test 4] Testing Faculty Login (Professor only, no HOD)...")
    res = client.post("/api/v1/auth/login", json={"email": "faculty2@geoattend.ai", "password": "Faculty@12345"})
    assert res.status_code == 200, f"Faculty2 login failed: {res.text}"
    faculty2_tokens = res.json()
    assert faculty2_tokens["role"] == "faculty"
    assert "hod" not in faculty2_tokens["responsibilities"]
    assert "professor" in faculty2_tokens["responsibilities"]
    faculty_regular_auth = {"Authorization": f"Bearer {faculty2_tokens['access_token']}"}
    print(f"✓ Faculty2 login successful with role='faculty', responsibilities={faculty2_tokens['responsibilities']}")

    # -------------------------------------------------------------
    # Test 5: Student Login
    # -------------------------------------------------------------
    print("\n[Test 5] Testing Student Login...")
    res = client.post("/api/v1/auth/login", json={"email": "student@geoattend.ai", "password": "Student@12345"})
    assert res.status_code == 200, f"Student login failed: {res.text}"
    student_tokens = res.json()
    assert student_tokens["role"] == "student"
    student_auth = {"Authorization": f"Bearer {student_tokens['access_token']}"}
    print("✓ Student login successful with role='student'")

    # -------------------------------------------------------------
    # Test 6: Student cannot access Admin APIs
    # -------------------------------------------------------------
    print("\n[Test 6] Testing Student cannot access Admin APIs...")
    res = client.post("/api/v1/colleges", headers=student_auth, json={"name": "Test Col", "code": "TC001"})
    assert res.status_code == 403, f"Expected 403 Forbidden, got {res.status_code}"
    res = client.get("/api/v1/attendance/dashboard/stats", headers=student_auth)
    assert res.status_code == 403, f"Expected 403 Forbidden, got {res.status_code}"
    print("✓ Student blocked with 403 Forbidden on Admin APIs")

    # -------------------------------------------------------------
    # Test 7: Faculty cannot access Admin APIs
    # -------------------------------------------------------------
    print("\n[Test 7] Testing Faculty cannot access Admin APIs...")
    res = client.post("/api/v1/colleges", headers=faculty_hod_auth, json={"name": "Test Col", "code": "TC002"})
    assert res.status_code == 403, f"Expected 403 Forbidden, got {res.status_code}"
    res = client.get("/api/v1/attendance/dashboard/stats", headers=faculty_hod_auth)
    assert res.status_code == 403, f"Expected 403 Forbidden, got {res.status_code}"
    print("✓ Faculty blocked with 403 Forbidden on Admin APIs")

    # -------------------------------------------------------------
    # Test 8: Faculty WITH HOD responsibility can access HOD endpoint
    # -------------------------------------------------------------
    print("\n[Test 8] Testing Faculty WITH HOD responsibility accessing HOD endpoint...")
    res = client.get("/api/v1/faculty/department/overview", headers=faculty_hod_auth)
    assert res.status_code == 200, f"Expected 200 OK for HOD faculty, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["message"] == "Authorized as HOD"
    print(f"✓ Faculty with HOD granted access: {data}")

    # -------------------------------------------------------------
    # Test 9: Faculty WITHOUT HOD responsibility CANNOT access HOD endpoint
    # -------------------------------------------------------------
    print("\n[Test 9] Testing Faculty WITHOUT HOD responsibility accessing HOD endpoint...")
    res = client.get("/api/v1/faculty/department/overview", headers=faculty_regular_auth)
    assert res.status_code == 403, f"Expected 403 Forbidden for non-HOD faculty, got {res.status_code}: {res.text}"
    print("✓ Faculty without HOD correctly blocked with 403 Forbidden")

    # -------------------------------------------------------------
    # Test 10: Admin dynamically assigning HOD responsibility to Faculty2
    # -------------------------------------------------------------
    print("\n[Test 10] Testing Admin assigning HOD responsibility to Faculty2...")
    db = SessionLocal()
    faculty2_profile = db.query(FacultyProfile).join(User).filter(User.email == "faculty2@geoattend.ai").first()
    faculty2_id = faculty2_profile.id
    db.close()

    res = client.post(
        f"/api/v1/faculty/{faculty2_id}/responsibilities",
        headers=admin_auth,
        json={
            "responsibility_type": "hod",
            "scope_type": "department",
        },
    )
    assert res.status_code == 201, f"Failed to assign responsibility: {res.text}"
    new_resp = res.json()
    resp_id = new_resp["id"]
    print(f"✓ Admin assigned HOD responsibility ID {resp_id} to faculty ID {faculty2_id}")

    # Verify Faculty2 can now access HOD endpoint
    res = client.get("/api/v1/faculty/department/overview", headers=faculty_regular_auth)
    assert res.status_code == 200, f"Expected 200 OK after assigning HOD, got {res.status_code}"
    print("✓ Faculty2 now granted access to HOD endpoint!")

    # -------------------------------------------------------------
    # Test 11: Admin revoking HOD responsibility from Faculty2
    # -------------------------------------------------------------
    print("\n[Test 11] Testing Admin deactivating HOD responsibility from Faculty2...")
    res = client.delete(f"/api/v1/faculty/responsibilities/{resp_id}", headers=admin_auth)
    assert res.status_code == 200, f"Failed to deactivate responsibility: {res.text}"
    assert res.json()["is_active"] is False
    print("✓ Responsibility deactivated successfully")

    # Verify Faculty2 is now blocked from HOD endpoint again
    res = client.get("/api/v1/faculty/department/overview", headers=faculty_regular_auth)
    assert res.status_code == 403, f"Expected 403 Forbidden after revoking HOD, got {res.status_code}"
    print("✓ Faculty2 immediately blocked with 403 Forbidden after responsibility revocation!")

    # -------------------------------------------------------------
    # Test 12: /auth/me returns profile with active responsibilities
    # -------------------------------------------------------------
    print("\n[Test 12] Testing GET /auth/me payload structure...")
    res = client.get("/api/v1/auth/me", headers=faculty_hod_auth)
    assert res.status_code == 200
    user_me = res.json()
    assert user_me["role"] == "faculty"
    assert user_me["faculty_profile"] is not None
    assert len(user_me["faculty_profile"]["responsibilities"]) >= 2
    print(f"✓ /auth/me verified: {user_me['full_name']} with {len(user_me['faculty_profile']['responsibilities'])} responsibilities")

    print("\n========================================================")
    print("🎉 ALL PHASE 3 AUTHENTICATION & ROLE TESTS PASSED 100%!")
    print("========================================================")


if __name__ == "__main__":
    test_phase3_auth_and_roles()
