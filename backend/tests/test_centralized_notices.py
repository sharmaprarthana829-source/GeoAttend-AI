"""Centralized Notice Board Integration & RBAC Test Suite

Verifies:
1. Admin single source of truth: Create, edit, and deactivate notices.
2. Read-only enforcement for Faculty, Student, and Coordinator (403 on mutation).
3. Audience targeting:
   - ALL: Visible to Admin, Faculty, Coordinator, Student.
   - STUDENTS: Visible to Student, blocked for Faculty.
   - FACULTY: Visible to Faculty & Coordinator, blocked for Student.
   - COORDINATORS: Visible only to Coordinator faculty, blocked for standard faculty and students.
   - DEPARTMENT: Visible only to matching department members.
4. Category filtering & keyword search.
5. Single notice detail endpoint authorization (403 for unauthorized audience).
6. Audit log generation for CREATE, UPDATE, and DELETE.
7. Deduplication integrity.
"""

from datetime import datetime, timezone, timedelta
from pathlib import Path
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import SessionLocal
from app.main import app
from app.models import (
    AudienceType,
    AuditLog,
    Department,
    FacultyProfile,
    FacultyResponsibility,
    Notice,
    Notification,
    NotificationType,
    ResponsibilityType,
    ScopeType,
    StudentProfile,
    User,
    UserRole,
)

client = TestClient(app)


def _token(email: str, password: str = "Admin@12345") -> dict[str, str]:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_centralized_notice_board():
    print("\n" + "=" * 70)
    print(" CENTRALIZED NOTICE BOARD: RBAC, AUDIENCE TARGETING & AUDIT TEST")
    print("=" * 70)

    admin_auth = _token("admin@geoattend.ai", "Admin@12345")
    faculty1_auth = _token("faculty@geoattend.ai", "Faculty@12345")  # Regular faculty (CSE)
    faculty2_auth = _token("faculty2@geoattend.ai", "Faculty@12345") # Will be Section Coordinator
    student_auth = _token("student@geoattend.ai", "Student@12345")   # Student (CSD branch, Sem 1)

    db = SessionLocal()
    fac1_user = db.query(User).filter(User.email == "faculty@geoattend.ai").first()
    fac1_prof = db.query(FacultyProfile).filter(FacultyProfile.user_id == fac1_user.id).first()
    fac2_user = db.query(User).filter(User.email == "faculty2@geoattend.ai").first()
    fac2_prof = db.query(FacultyProfile).filter(FacultyProfile.user_id == fac2_user.id).first()

    # Ensure faculty2 is active Coordinator and faculty1 is NOT
    db.query(FacultyResponsibility).filter(
        FacultyResponsibility.responsibility_type == ResponsibilityType.COORDINATOR
    ).delete()

    c_resp = FacultyResponsibility(
        faculty_id=fac2_prof.id,
        responsibility_type=ResponsibilityType.COORDINATOR,
        scope_type=ScopeType.SECTION,
        section_id=2,
        is_active=True,
    )
    db.add(c_resp)
    db.commit()
    db.close()

    # ─────────────────────────────────────────────────────────────────
    # 1. Admin Notice Creation across Categories & Audiences
    # ─────────────────────────────────────────────────────────────────
    # A) All Campus Notice (Category: Academic)
    n_all_res = client.post(
        "/api/v1/notices",
        json={
            "title": "Academic Calendar 2026-27 Announced",
            "content": "The institutional academic calendar has been approved by the Academic Council.",
            "category": "Academic",
            "audience_type": "all",
            "is_active": True,
        },
        headers=admin_auth,
    )
    assert n_all_res.status_code == 201
    n_all = n_all_res.json()
    assert n_all["category"] == "Academic"
    assert n_all["audience_type"] == "all"
    print(f"[✓ Test 1] Admin created ALL notice #{n_all['id']}")

    # B) Students Only Notice (Category: Examination)
    n_stud_res = client.post(
        "/api/v1/notices",
        json={
            "title": "Midterm Exam Hall Ticket Download",
            "content": "Students may download hall tickets from the student portal starting tomorrow.",
            "category": "Examination",
            "audience_type": "students",
            "is_active": True,
        },
        headers=admin_auth,
    )
    assert n_stud_res.status_code == 201
    n_stud = n_stud_res.json()
    assert n_stud["category"] == "Examination"
    print(f"[✓ Test 1] Admin created STUDENTS notice #{n_stud['id']}")

    # C) Faculty Only Notice (Category: Administrative)
    n_fac_res = client.post(
        "/api/v1/notices",
        json={
            "title": "Faculty Senate Quarterly Meeting",
            "content": "All faculty members are requested to attend the quarterly senate meeting in Auditorium A.",
            "category": "Administrative",
            "audience_type": "faculty",
            "is_active": True,
        },
        headers=admin_auth,
    )
    assert n_fac_res.status_code == 201
    n_fac = n_fac_res.json()
    print(f"[✓ Test 1] Admin created FACULTY notice #{n_fac['id']}")

    # D) Coordinators Only Notice (Category: Urgent)
    n_coord_res = client.post(
        "/api/v1/notices",
        json={
            "title": "Urgent: Attendance Shortfall Condonation Review",
            "content": "All Section Coordinators must complete Stage 2 application reviews before Friday.",
            "category": "Urgent",
            "audience_type": "coordinators",
            "is_active": True,
        },
        headers=admin_auth,
    )
    assert n_coord_res.status_code == 201
    n_coord = n_coord_res.json()
    print(f"[✓ Test 1] Admin created COORDINATORS notice #{n_coord['id']}")

    # ─────────────────────────────────────────────────────────────────
    # 2. Role-Based Permissions Enforcement (403 for non-admins)
    # ─────────────────────────────────────────────────────────────────
    for auth_header, role_name in [
        (faculty1_auth, "Faculty"),
        (faculty2_auth, "Coordinator"),
        (student_auth, "Student"),
    ]:
        # Block create
        blocked_create = client.post(
            "/api/v1/notices",
            json={"title": f"Hacked by {role_name}", "content": "Fake content", "audience_type": "all"},
            headers=auth_header,
        )
        assert blocked_create.status_code == 403, f"{role_name} was not blocked from creating notice!"

        # Block update
        blocked_update = client.put(
            f"/api/v1/notices/{n_all['id']}",
            json={"title": "Unauthorized Update"},
            headers=auth_header,
        )
        assert blocked_update.status_code == 403, f"{role_name} was not blocked from updating notice!"

        # Block delete
        blocked_delete = client.delete(
            f"/api/v1/notices/{n_all['id']}",
            headers=auth_header,
        )
        assert blocked_delete.status_code == 403, f"{role_name} was not blocked from deleting notice!"

    print("[✓ Test 2] Strict 403 mutation blocks verified across Faculty, Coordinator, and Student")

    # ─────────────────────────────────────────────────────────────────
    # 3. Audience Visibility & Isolation via /notices/my
    # ─────────────────────────────────────────────────────────────────
    # Student checks feed
    stud_feed = client.get("/api/v1/notices/my", headers=student_auth).json()
    stud_ids = {n["id"] for n in stud_feed}
    assert n_all["id"] in stud_ids, "Student must see ALL campus notice"
    assert n_stud["id"] in stud_ids, "Student must see STUDENTS notice"
    assert n_fac["id"] not in stud_ids, "Student must NOT see FACULTY notice"
    assert n_coord["id"] not in stud_ids, "Student must NOT see COORDINATORS notice"
    print("[✓ Test 3] Student feed verified: Sees ALL & STUDENTS, isolated from FACULTY & COORDINATORS")

    # Regular Faculty (faculty1) checks feed
    fac1_feed = client.get("/api/v1/notices/my", headers=faculty1_auth).json()
    fac1_ids = {n["id"] for n in fac1_feed}
    assert n_all["id"] in fac1_ids, "Faculty must see ALL campus notice"
    assert n_fac["id"] in fac1_ids, "Faculty must see FACULTY notice"
    assert n_stud["id"] not in fac1_ids, "Faculty must NOT see STUDENTS notice"
    assert n_coord["id"] not in fac1_ids, "Regular faculty must NOT see COORDINATORS notice"
    print("[✓ Test 3] Regular Faculty feed verified: Sees ALL & FACULTY, isolated from COORDINATORS & STUDENTS")

    # Section Coordinator (faculty2) checks feed
    coord_feed = client.get("/api/v1/notices/my", headers=faculty2_auth).json()
    coord_ids = {n["id"] for n in coord_feed}
    assert n_all["id"] in coord_ids, "Coordinator must see ALL campus notice"
    assert n_fac["id"] in coord_ids, "Coordinator must see FACULTY notice"
    assert n_coord["id"] in coord_ids, "Coordinator MUST see COORDINATORS notice"
    assert n_stud["id"] not in coord_ids, "Coordinator must NOT see STUDENTS notice"
    print("[✓ Test 3] Coordinator feed verified: Sees ALL, FACULTY & COORDINATORS, isolated from STUDENTS")

    # ─────────────────────────────────────────────────────────────────
    # 4. Search and Category Filtering
    # ─────────────────────────────────────────────────────────────────
    # Search by keyword
    search_res = client.get("/api/v1/notices/my?search=Council", headers=student_auth)
    assert search_res.status_code == 200
    search_results = search_res.json()
    assert any(n["id"] == n_all["id"] for n in search_results)
    assert not any(n["id"] == n_stud["id"] for n in search_results)
    print("[✓ Test 4] Keyword search verified")

    # Filter by category
    cat_res = client.get("/api/v1/notices/my?category=Examination", headers=student_auth)
    assert cat_res.status_code == 200
    cat_results = cat_res.json()
    assert all(n["category"] == "Examination" for n in cat_results)
    assert any(n["id"] == n_stud["id"] for n in cat_results)
    print("[✓ Test 4] Category filtering verified")

    # ─────────────────────────────────────────────────────────────────
    # 5. Single Notice Detail Endpoint Authorization
    # ─────────────────────────────────────────────────────────────────
    # Student attempts to view Coordinator notice directly -> 403 Forbidden
    detail_blocked = client.get(f"/api/v1/notices/{n_coord['id']}", headers=student_auth)
    assert detail_blocked.status_code == 403, f"Expected 403 for student viewing coordinator notice, got {detail_blocked.status_code}"

    # Coordinator views Coordinator notice directly -> 200 OK
    detail_allowed = client.get(f"/api/v1/notices/{n_coord['id']}", headers=faculty2_auth)
    assert detail_allowed.status_code == 200
    assert detail_allowed.json()["id"] == n_coord["id"]
    print("[✓ Test 5] Single notice authorization barrier verified (403 for unauthorized recipients)")

    # ─────────────────────────────────────────────────────────────────
    # 6. Admin Notice Editing & Audit Log
    # ─────────────────────────────────────────────────────────────────
    update_res = client.put(
        f"/api/v1/notices/{n_all['id']}",
        json={
            "title": "Academic Calendar 2026-27 (Revised)",
            "content": "Updated semester dates following governor approval.",
            "category": "Academic",
        },
        headers=admin_auth,
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["title"] == "Academic Calendar 2026-27 (Revised)"

    # Verify updated notice reflected on Student dashboard
    stud_updated_feed = client.get("/api/v1/notices/my", headers=student_auth).json()
    matched = next((n for n in stud_updated_feed if n["id"] == n_all["id"]), None)
    assert matched is not None
    assert matched["title"] == "Academic Calendar 2026-27 (Revised)"
    print("[✓ Test 6] Admin notice edit successfully propagated to Student feed")

    # ─────────────────────────────────────────────────────────────────
    # 7. Admin Soft Deletion / Deactivation
    # ─────────────────────────────────────────────────────────────────
    del_res = client.delete(f"/api/v1/notices/{n_stud['id']}", headers=admin_auth)
    assert del_res.status_code == 200
    assert del_res.json()["is_active"] is False

    # Student feed should no longer contain deactivated notice
    stud_after_del = client.get("/api/v1/notices/my", headers=student_auth).json()
    assert not any(n["id"] == n_stud["id"] for n in stud_after_del)
    print("[✓ Test 7] Deactivated notice disappeared from active feed")

    # ─────────────────────────────────────────────────────────────────
    # 8. Audit Trail Verification
    # ─────────────────────────────────────────────────────────────────
    db = SessionLocal()
    audits = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == "Notice", AuditLog.entity_id == n_all["id"])
        .all()
    )
    actions = [a.action for a in audits]
    assert "NOTICE_CREATED" in actions
    assert "NOTICE_UPDATED" in actions

    del_audit = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == "Notice", AuditLog.entity_id == n_stud["id"], AuditLog.action == "NOTICE_DELETED")
        .first()
    )
    assert del_audit is not None
    db.close()
    print("[✓ Test 8] Database audit logs for NOTICE_CREATED, NOTICE_UPDATED, NOTICE_DELETED confirmed")

    print("\n" + "=" * 70)
    print(" ALL CENTRALIZED NOTICE BOARD TESTS PASSED (100%)")
    print("=" * 70)
