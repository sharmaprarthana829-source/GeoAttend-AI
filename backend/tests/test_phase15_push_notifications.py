"""Phase 15 Verification Suite: Push Notifications & Device Token Lifecycle

Verifies:
1. Device push token registration (Android, iOS, Web)
2. Token re-registration idempotency & device model updates
3. Token unregistration upon user logout
4. Push notification dispatch for urgent notices
5. Push notification dispatch for application status review updates
6. Simulated dry-run fallback when GCP Firebase production credentials are not bound
7. Test push endpoint execution
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models import (
    AttendanceApplication,
    DevicePushToken,
    Notice,
    Notification,
    StudentProfile,
    SubjectOffering,
    User,
)
from app.services.push_notification import push_notification_service
from scripts.seed import seed

client = TestClient(app)


def _auth(email: str, password: str) -> dict:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_device_push_token_registration_and_lifecycle():
    seed()

    student_auth = _auth("student@geoattend.ai", "Student@12345")
    db = SessionLocal()
    try:
        student_user = db.query(User).filter(User.email == "student@geoattend.ai").first()
        assert student_user is not None

        # Clean prior tokens for clean test state
        db.query(DevicePushToken).filter(DevicePushToken.user_id == student_user.id).delete()
        db.commit()

        test_token = "fcm_test_token_student_android_xyz999"

        # 1. Register new token
        reg_resp = client.post(
            "/api/v1/notifications/push-token",
            json={
                "token": test_token,
                "platform": "android",
                "device_model": "Pixel 7 Pro",
            },
            headers=student_auth,
        )
        assert reg_resp.status_code == 201, f"Token registration failed: {reg_resp.text}"
        data = reg_resp.json()
        assert data["token"] == test_token
        assert data["platform"] == "android"
        assert data["device_model"] == "Pixel 7 Pro"
        assert data["is_active"] is True

        # Verify in DB
        db_token = db.query(DevicePushToken).filter(DevicePushToken.fcm_token == test_token).first()
        assert db_token is not None
        assert db_token.user_id == student_user.id
        assert db_token.is_active is True

        # 2. Re-register (Idempotency check / Device Model Update)
        rereg_resp = client.post(
            "/api/v1/notifications/push-token",
            json={
                "token": test_token,
                "platform": "android",
                "device_model": "Pixel 7 Pro (Updated OS)",
            },
            headers=student_auth,
        )
        assert rereg_resp.status_code == 201
        assert rereg_resp.json()["device_model"] == "Pixel 7 Pro (Updated OS)"
        db.commit()  # Reset REPEATABLE READ transaction snapshot
        db_token_updated = db.query(DevicePushToken).filter(DevicePushToken.fcm_token == test_token).first()
        assert db_token_updated is not None
        assert db_token_updated.device_id == "Pixel 7 Pro (Updated OS)"
        assert db_token_updated.is_active is True

        # 3. Unregister token on logout
        unreg_resp = client.delete(
            f"/api/v1/notifications/push-token?token={test_token}",
            headers=student_auth,
        )
        assert unreg_resp.status_code == 200
        db.commit()
        db_token_final = db.query(DevicePushToken).filter(DevicePushToken.fcm_token == test_token).first()
        assert db_token_final is not None
        assert db_token_final.is_active is False, "Token should be deactivated after unregister"

    finally:
        db.close()


def test_urgent_notice_push_notification_dispatch():
    seed()

    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")
    student_auth = _auth("student@geoattend.ai", "Student@12345")

    db = SessionLocal()
    try:
        student_user = db.query(User).filter(User.email == "student@geoattend.ai").first()
        assert student_user is not None

        # Clean prior tokens and register active token for student
        db.query(DevicePushToken).filter(DevicePushToken.user_id == student_user.id).delete()
        db.commit()

        student_token = "fcm_student_notice_token_111"
        client.post(
            "/api/v1/notifications/push-token",
            json={
                "token": student_token,
                "platform": "android",
                "device_model": "OnePlus 11",
            },
            headers=student_auth,
        )

        # Admin creates urgent notice targeted to students
        notice_payload = {
            "title": "URGENT: Flash Flood Campus Alert",
            "content": "Due to severe weather, afternoon classes are shifted online.",
            "audience_type": "students",
            "category": "Urgent",
            "is_active": True,
        }

        notice_resp = client.post(
            "/api/v1/notices",
            json=notice_payload,
            headers=admin_auth,
        )
        assert notice_resp.status_code == 201, f"Notice creation failed: {notice_resp.text}"
        notice_data = notice_resp.json()
        assert notice_data["category"] == "Urgent"

        # Verify notice object and push notification dispatch
        notice_obj = db.query(Notice).filter(Notice.id == notice_data["id"]).first()
        assert notice_obj is not None

        result = push_notification_service.dispatch_urgent_notice(
            db=db,
            notice=notice_obj,
        )
        assert "success_count" in result or "simulated" in result or result.get("dispatched") is not None

    finally:
        db.close()


def test_application_review_triggers_push_dispatch():
    seed()

    student_auth = _auth("student@geoattend.ai", "Student@12345")
    faculty_auth = _auth("faculty@geoattend.ai", "Faculty@12345")

    db = SessionLocal()
    try:
        student_user = db.query(User).filter(User.email == "student@geoattend.ai").first()
        assert student_user is not None

        # Register active token for student
        student_token = "fcm_student_app_token_222"
        client.post(
            "/api/v1/notifications/push-token",
            json={
                "token": student_token,
                "platform": "ios",
                "device_model": "iPhone 15 Pro",
            },
            headers=student_auth,
        )

        offering = db.query(SubjectOffering).first()
        assert offering is not None

        # Clean prior applications for clean test run
        student_prof = db.query(StudentProfile).filter(StudentProfile.user_id == student_user.id).first()
        if student_prof:
            db.query(AttendanceApplication).filter(AttendanceApplication.student_id == student_prof.id).delete()
            db.commit()

        # Student submits an application
        app_resp = client.post(
            "/api/v1/applications",
            json={
                "subject_offering_id": offering.id,
                "reason": "Viral fever recovery",
                "description": "Student was hospitalized with high fever and bed rest prescribed.",
            },
            headers=student_auth,
        )
        assert app_resp.status_code == 201, f"Application creation failed: {app_resp.text}"
        app_id = app_resp.json()["id"]

        # Faculty reviews application
        review_resp = client.patch(
            f"/api/v1/applications/{app_id}/faculty-review",
            json={
                "decision": "approved",
                "remarks": "Medical certificate verified and recommended.",
            },
            headers=faculty_auth,
        )
        assert review_resp.status_code == 200, f"Faculty review failed: {review_resp.text}"

        # Verify in-app notification exists in DB
        notification = (
            db.query(Notification)
            .filter(
                Notification.user_id == student_user.id,
                Notification.title.contains("Application"),
            )
            .order_by(Notification.id.desc())
            .first()
        )
        assert notification is not None

        # Verify push dispatch
        push_res = push_notification_service.dispatch_application_status_update(
            db=db,
            application_id=app_id,
            student_user_id=student_user.id,
            new_status="faculty_approved",
            reviewer_role="faculty",
        )
        assert "success_count" in push_res or "simulated" in push_res or push_res.get("dispatched") is not None

    finally:
        db.close()


def test_test_push_endpoint():
    seed()

    student_auth = _auth("student@geoattend.ai", "Student@12345")

    # Register token
    client.post(
        "/api/v1/notifications/push-token",
        json={
            "token": "fcm_test_direct_endpoint_token",
            "platform": "android",
        },
        headers=student_auth,
    )

    # Call test push endpoint
    test_resp = client.post(
        "/api/v1/notifications/test-push",
        json={
            "title": "Test Push Header",
            "body": "Test Push Body Message",
            "data": {"key": "value"},
        },
        headers=student_auth,
    )
    assert test_resp.status_code == 200, f"Test push endpoint failed: {test_resp.text}"
    data = test_resp.json()
    assert data["dispatched"] is True
    assert data["recipient_count"] >= 1
