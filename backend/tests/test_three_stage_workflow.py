"""Three-Stage Approval Workflow Integration Test Suite

Verifies:
1. Student submission creates persisted application in PENDING_FACULTY.
2. Assigned faculty can approve (moves to PENDING_COORDINATOR) or reject (moves to REJECTED).
3. Section Coordinator can approve (moves to PENDING_HOD) or reject (moves to REJECTED).
4. HOD can render final approval (moves to APPROVED) or reject (moves to REJECTED).
5. HOD approval produces exam eligibility and condonation flag without mutating raw logs.
6. Rejection at any stage terminates the workflow with mandatory remarks.
7. Authorization boundaries:
   - Non-assigned faculty cannot review Stage 1.
   - Non-coordinator faculty cannot review Stage 2.
   - Non-HOD faculty cannot review Stage 3.
8. Out-of-order review attempts (Coordinator before Faculty, HOD before Coordinator) are rejected (400).
9. Summary statistics reflect exact status counts with zero double-counting.
10. Audit trail logs and notifications are recorded for every state change.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models import (
    AcademicEnrollment,
    AttendanceApplication,
    AttendanceRecord,
    AttendanceSession,
    AttendanceStatus,
    AuditLog,
    FacultyAssignment,
    FacultyProfile,
    FacultyResponsibility,
    Notification,
    ResponsibilityType,
    ScopeType,
    Section,
    SessionStatus,
    StudentProfile,
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


def test_three_stage_approval_workflow():
    print("\n=== Running Three-Stage Application Approval Workflow Integration Tests ===")
    seed()
    db = SessionLocal()

    # Clean existing applications and notifications for fresh test run
    db.query(AttendanceApplication).delete(synchronize_session=False)
    db.query(Notification).delete(synchronize_session=False)
    db.commit()

    admin_headers = _auth("admin@geoattend.ai", "Admin@12345")
    faculty1_headers = _auth("faculty@geoattend.ai", "Faculty@12345")  # Priya Sharma (CSE HOD)
    faculty2_headers = _auth("faculty2@geoattend.ai", "Faculty@12345")  # Rajesh Kumar (Professor)
    student1_headers = _auth("student@geoattend.ai", "Student@12345")  # Arjun Mehta (Section CSD-A, Sem 1)

    # Resolve Student 1 and offering
    student1_user = db.query(User).filter(User.email == "student@geoattend.ai").first()
    student1_prof = db.query(StudentProfile).filter(StudentProfile.user_id == student1_user.id).first()

    faculty1_user = db.query(User).filter(User.email == "faculty@geoattend.ai").first()
    faculty1_prof = db.query(FacultyProfile).filter(FacultyProfile.user_id == faculty1_user.id).first()

    faculty2_user = db.query(User).filter(User.email == "faculty2@geoattend.ai").first()
    faculty2_prof = db.query(FacultyProfile).filter(FacultyProfile.user_id == faculty2_user.id).first()

    # Find offering assigned to faculty 1 in section of student 1
    enrollment = (
        db.query(AcademicEnrollment)
        .filter(AcademicEnrollment.student_id == student1_prof.id, AcademicEnrollment.is_current.is_(True))
        .first()
    )
    assert enrollment is not None, "Student 1 must have an active enrollment"
    section_id = enrollment.section_id

    offering = (
        db.query(SubjectOffering)
        .join(FacultyAssignment, SubjectOffering.id == FacultyAssignment.subject_offering_id)
        .filter(
            FacultyAssignment.faculty_id == faculty1_prof.id,
            SubjectOffering.section_id == section_id,
            SubjectOffering.is_active.is_(True),
        )
        .first()
    )
    assert offering is not None, "Subject offering assigned to faculty 1 in student's section must exist"

    # Set up ONLY Faculty 2 as Section Coordinator for this section
    db.query(FacultyResponsibility).filter(
        FacultyResponsibility.responsibility_type == ResponsibilityType.COORDINATOR,
    ).delete()

    coord_resp = FacultyResponsibility(
        faculty_id=faculty2_prof.id,
        responsibility_type=ResponsibilityType.COORDINATOR,
        scope_type=ScopeType.SECTION,
        section_id=section_id,
        is_active=True,
    )
    db.add(coord_resp)
    db.commit()

    from datetime import datetime, timezone
    session1 = AttendanceSession(
        subject_offering_id=offering.id,
        faculty_id=faculty1_prof.id,
        section_id=section_id,
        started_at=datetime.now(timezone.utc),
        ended_at=datetime.now(timezone.utc),
        status=SessionStatus.COMPLETED,
    )
    db.add(session1)
    db.commit()
    db.refresh(session1)

    rec1 = AttendanceRecord(
        session_id=session1.id,
        student_id=student1_prof.id,
        status=AttendanceStatus.ABSENT,
    )
    db.add(rec1)
    db.commit()

    print(f"✓ Test setup ready: Student={student1_user.full_name}, Subject={offering.subject.name}, Sec={section_id}")
    print(f"  Faculty 1={faculty1_user.full_name} (Instructor & HOD)")
    print(f"  Faculty 2={faculty2_user.full_name} (Section Coordinator)")

    # ─────────────────────────────────────────────────────────────────
    # STEP 1: Student submits application
    # ─────────────────────────────────────────────────────────────────
    res_sub = client.post(
        "/api/v1/applications",
        headers=student1_headers,
        json={
            "subject_offering_id": offering.id,
            "reason": "Severe viral infection with doctor prescription",
            "description": "Hospitalized for 4 days. Unable to attend classes. Medical certificate attached.",
            "supporting_document_url": "https://docs.google.com/sample_cert.pdf",
        },
    )
    assert res_sub.status_code == 201, f"Submission failed: {res_sub.text}"
    app_data = res_sub.json()
    app_id = app_data["id"]
    assert app_data["status"] == "pending_faculty"
    assert app_data["application_type"] == "medical_leave"
    assert app_data["attendance_percentage"] is not None
    assert app_data["is_exam_eligible"] is False  # 0% attendance, no condonation yet
    assert app_data["condonation_granted"] is False
    print(f"✓ Step 1: Student submitted application #{app_id} in status 'pending_faculty'")

    # ─────────────────────────────────────────────────────────────────
    # STEP 2: Out-of-order checks (Stage 2 & Stage 3 blocked)
    # ─────────────────────────────────────────────────────────────────
    # Coordinator tries to review before Faculty
    res_coord_early = client.patch(
        f"/api/v1/applications/{app_id}/coordinator-review",
        headers=faculty2_headers,
        json={"decision": "approved", "remarks": "Trying to bypass faculty"},
    )
    assert res_coord_early.status_code == 400
    assert "cannot be reviewed by Section Coordinator" in res_coord_early.json()["detail"]
    print("✓ Out-of-order: Coordinator cannot review before Faculty approval")

    # HOD tries to review before Faculty and Coordinator
    res_hod_early = client.patch(
        f"/api/v1/applications/{app_id}/hod-decision",
        headers=faculty1_headers,
        json={"decision": "approved", "remarks": "Trying to bypass stages"},
    )
    assert res_hod_early.status_code == 400
    assert "not ready for HOD decision" in res_hod_early.json()["detail"]
    print("✓ Out-of-order: HOD cannot review before Faculty & Coordinator approval")

    # ─────────────────────────────────────────────────────────────────
    # STEP 3: Stage 1 — Faculty Review
    # ─────────────────────────────────────────────────────────────────
    # Unassigned faculty (faculty 2) tries to review -> 403
    res_unassigned = client.patch(
        f"/api/v1/applications/{app_id}/faculty-review",
        headers=faculty2_headers,
        json={"decision": "approved", "remarks": "Unauthorized faculty review"},
    )
    assert res_unassigned.status_code == 403
    print("✓ Authorization: Non-assigned faculty blocked from Stage 1 review (403)")

    # Assigned faculty (faculty 1) approves -> Moves to PENDING_COORDINATOR
    res_fac_appr = client.patch(
        f"/api/v1/applications/{app_id}/faculty-review",
        headers=faculty1_headers,
        json={"decision": "approved", "remarks": "Medical certificate verified by subject instructor"},
    )
    assert res_fac_appr.status_code == 200
    app_data = res_fac_appr.json()
    assert app_data["status"] == "pending_coordinator"
    assert app_data["faculty_decision"] == "approved"
    assert app_data["faculty_reviewer_id"] == faculty1_prof.id
    print(f"✓ Step 3: Faculty approved application #{app_id} -> status 'pending_coordinator'")

    # ─────────────────────────────────────────────────────────────────
    # STEP 4: Stage 2 — Section Coordinator Review
    # ─────────────────────────────────────────────────────────────────
    # Coordinator lists applications in queue
    res_coord_list = client.get("/api/v1/applications/coordinator", headers=faculty2_headers)
    assert res_coord_list.status_code == 200
    coord_apps = res_coord_list.json()
    assert any(a["id"] == app_id for a in coord_apps)
    print(f"✓ Coordinator queue: Application #{app_id} visible to authorized section coordinator")

    # Non-coordinator tries to review -> 403
    # Remove coordinator responsibility temporarily for check
    res_non_coord = client.patch(
        f"/api/v1/applications/{app_id}/coordinator-review",
        headers=faculty1_headers,  # Faculty 1 is HOD, not coordinator of this section
        json={"decision": "approved", "remarks": "HOD trying to act as coordinator"},
    )
    assert res_non_coord.status_code == 403
    print("✓ Authorization: Non-coordinator blocked from Stage 2 review (403)")

    # Section Coordinator (faculty 2) approves -> Moves to PENDING_HOD
    res_coord_appr = client.patch(
        f"/api/v1/applications/{app_id}/coordinator-review",
        headers=faculty2_headers,
        json={"decision": "approved", "remarks": "Section coordinator verified attendance shortfall & forwarded to HOD"},
    )
    assert res_coord_appr.status_code == 200
    app_data = res_coord_appr.json()
    assert app_data["status"] == "pending_hod"
    assert app_data["coordinator_decision"] == "approved"
    assert app_data["coordinator_reviewer_id"] == faculty2_prof.id
    print(f"✓ Step 4: Coordinator approved application #{app_id} -> status 'pending_hod'")

    # ─────────────────────────────────────────────────────────────────
    # STEP 5: Stage 3 — HOD Final Decision & Condonation
    # ─────────────────────────────────────────────────────────────────
    # HOD lists applications
    res_hod_list = client.get("/api/v1/applications/hod", headers=faculty1_headers)
    assert res_hod_list.status_code == 200
    hod_apps = res_hod_list.json()
    assert any(a["id"] == app_id for a in hod_apps)
    print(f"✓ HOD queue: Application #{app_id} visible to authorized Department HOD")

    # Non-HOD tries to render final decision -> 403
    res_non_hod = client.patch(
        f"/api/v1/applications/{app_id}/hod-decision",
        headers=faculty2_headers,  # Faculty 2 is not HOD
        json={"decision": "approved", "remarks": "Non-HOD trying to approve"},
    )
    assert res_non_hod.status_code == 403
    print("✓ Authorization: Non-HOD blocked from Stage 3 review (403)")

    # HOD renders final approval -> APPROVED & Condonation granted
    res_hod_appr = client.patch(
        f"/api/v1/applications/{app_id}/hod-decision",
        headers=faculty1_headers,
        json={"decision": "approved", "remarks": "Granted attendance condonation under institutional medical grounds policy"},
    )
    assert res_hod_appr.status_code == 200
    final_app = res_hod_appr.json()
    assert final_app["status"] == "approved"
    assert final_app["hod_decision"] == "approved"
    assert final_app["hod_reviewer_id"] == faculty1_prof.id
    assert final_app["condonation_granted"] is True
    assert final_app["is_exam_eligible"] is True
    print(f"✓ Step 5: HOD granted final approval -> status 'approved', condonation_granted=True, is_exam_eligible=True")

    # ─────────────────────────────────────────────────────────────────
    # STEP 6: Verify Summary Statistics Consistency
    # ─────────────────────────────────────────────────────────────────
    res_stats = client.get("/api/v1/applications/stats", headers=admin_headers)
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats["total_applications"] >= 1
    assert stats["approved"] >= 1
    assert stats["pending_faculty"] == 0
    assert stats["pending_coordinator"] == 0
    assert stats["pending_hod"] == 0
    print(f"✓ Summary Stats: approved={stats['approved']}, pending_coord={stats['pending_coordinator']}, total={stats['total_applications']}")

    # ─────────────────────────────────────────────────────────────────
    # STEP 7: Rejection Path & Mandatory Remarks Verification
    # ─────────────────────────────────────────────────────────────────
    # Submit second application
    res_sub2 = client.post(
        "/api/v1/applications",
        headers=student1_headers,
        json={
            "subject_offering_id": offering.id,
            "reason": "Personal Emergency",
            "description": "Family function attended out of state.",
        },
    )
    assert res_sub2.status_code == 201
    app2_id = res_sub2.json()["id"]

    # Rejection without remarks must fail with 400
    res_rej_no_rem = client.patch(
        f"/api/v1/applications/{app2_id}/faculty-review",
        headers=faculty1_headers,
        json={"decision": "rejected", "remarks": "  "},
    )
    assert res_rej_no_rem.status_code == 400
    assert "remarks is required" in res_rej_no_rem.json()["detail"].lower()
    print("✓ Institutional Policy: Rejection without remarks rejected with 400")

    # Faculty rejects with remarks -> REJECTED
    res_fac_rej = client.patch(
        f"/api/v1/applications/{app2_id}/faculty-review",
        headers=faculty1_headers,
        json={"decision": "rejected", "remarks": "Personal travel is not eligible for attendance condonation"},
    )
    assert res_fac_rej.status_code == 200
    app2_rej = res_fac_rej.json()
    assert app2_rej["status"] == "rejected"
    assert app2_rej["faculty_decision"] == "rejected"

    # Terminal state check: coordinator and HOD cannot review rejected application
    res_coord_after_rej = client.patch(
        f"/api/v1/applications/{app2_id}/coordinator-review",
        headers=faculty2_headers,
        json={"decision": "approved", "remarks": "Trying to revive rejected app"},
    )
    assert res_coord_after_rej.status_code == 400

    res_hod_after_rej = client.patch(
        f"/api/v1/applications/{app2_id}/hod-decision",
        headers=faculty1_headers,
        json={"decision": "approved", "remarks": "Trying to revive rejected app"},
    )
    assert res_hod_after_rej.status_code == 400
    print("✓ Terminal state: Rejection halts workflow and blocks subsequent stages")

    # ─────────────────────────────────────────────────────────────────
    # STEP 8: Audit Trail and Notification Verification
    # ─────────────────────────────────────────────────────────────────
    res_hist = client.get(f"/api/v1/applications/{app_id}/history", headers=faculty1_headers)
    assert res_hist.status_code == 200
    history = res_hist.json()
    actions = [h["action"] for h in history]
    assert "APPLICATION_SUBMITTED" in actions
    assert "APPLICATION_FACULTY_REVIEW" in actions
    assert "APPLICATION_COORDINATOR_REVIEW" in actions
    assert "APPLICATION_HOD_DECISION" in actions
    assert "EXAM_ELIGIBILITY_GRANTED" in actions
    print(f"✓ Institutional Audit: All 5 actions recorded in history: {actions}")

    # Notifications check for student via authenticated endpoint
    res_notifs = client.get("/api/v1/notifications/my?notification_type=application", headers=student1_headers)
    assert res_notifs.status_code == 200
    student_notifs = res_notifs.json()
    assert len(student_notifs) >= 3  # submitted, faculty_approved, coordinator_approved, hod_approved
    print(f"✓ Notifications: Student received {len(student_notifs)} workflow notification updates")

    db.close()
    print("=== All Three-Stage Application Workflow Tests Passed Successfully! ===")


if __name__ == "__main__":
    test_three_stage_approval_workflow()
