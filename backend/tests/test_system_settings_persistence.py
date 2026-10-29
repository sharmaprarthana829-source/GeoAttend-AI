"""Tests for System Settings Configuration Persistence, Validation, Authorization and Audit Trail."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models import AuditLog, SystemSetting

client = TestClient(app)


def _auth(email: str, password: str) -> dict:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_get_system_config_as_admin():
    """Verify admin can load all system settings."""
    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")
    res = client.get("/api/v1/system/config", headers=admin_auth)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 13

    # Check key categories exist
    categories = {s["category"] for s in data}
    assert "attendance" in categories
    assert "gps" in categories
    assert "qr" in categories
    assert "ml" in categories
    assert "device" in categories


def test_unauthorized_access_rejected():
    """Verify students or anonymous requests cannot access or modify system settings."""
    # Anonymous
    res_anon_get = client.get("/api/v1/system/config")
    assert res_anon_get.status_code in (401, 403)

    res_anon_put = client.put("/api/v1/system/config", json={"settings": {}, "reason": "hack"})
    assert res_anon_put.status_code in (401, 403)

    # Student
    student_auth = _auth("student@geoattend.ai", "Student@12345")
    res_stud_get = client.get("/api/v1/system/config", headers=student_auth)
    assert res_stud_get.status_code == 403

    res_stud_put = client.put(
        "/api/v1/system/config",
        json={"settings": {"attendance_grace_period_minutes": "5"}, "reason": "student edit"},
        headers=student_auth,
    )
    assert res_stud_put.status_code == 403


def test_update_settings_persistence_and_audit():
    """Verify saving settings updates database and creates audit log."""
    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")
    audit_reason = "Annual security review: Adjusted geofence radius and QR rotation"

    update_payload = {
        "settings": {
            "default_geofence_radius_meters": "135",
            "qr_rotation_interval_seconds": "45",
            "minimum_attendance_percentage": "78.5",
        },
        "reason": audit_reason,
    }

    res = client.put("/api/v1/system/config", json=update_payload, headers=admin_auth)
    assert res.status_code == 200
    data = res.json()

    # Verify response has updated values
    settings_dict = {s["key"]: s["value"] for s in data}
    assert settings_dict["default_geofence_radius_meters"] == "135"
    assert settings_dict["qr_rotation_interval_seconds"] == "45"
    assert settings_dict["minimum_attendance_percentage"] == "78.5"

    # Verify database persistence directly
    db = SessionLocal()
    db_geofence = db.query(SystemSetting).filter(SystemSetting.key == "default_geofence_radius_meters").first()
    assert db_geofence is not None
    assert db_geofence.value == "135"

    # Verify audit log entry
    latest_audit = (
        db.query(AuditLog)
        .filter(AuditLog.action == "UPDATE_SYSTEM_CONFIG")
        .order_by(AuditLog.id.desc())
        .first()
    )
    assert latest_audit is not None
    assert latest_audit.reason == audit_reason
    assert "135" in (latest_audit.metadata_json or "")


def test_validation_missing_reason_rejected():
    """Verify update is rejected if mandatory administrative reason is missing."""
    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")

    # Empty reason
    res1 = client.put(
        "/api/v1/system/config",
        json={"settings": {"qr_rotation_interval_seconds": "30"}, "reason": ""},
        headers=admin_auth,
    )
    assert res1.status_code == 400
    assert "reason" in res1.json()["detail"].lower()

    # None / whitespace reason
    res2 = client.put(
        "/api/v1/system/config",
        json={"settings": {"qr_rotation_interval_seconds": "30"}, "reason": "  "},
        headers=admin_auth,
    )
    assert res2.status_code == 400


def test_validation_negative_numbers_rejected():
    """Verify negative numbers are rejected for numeric settings."""
    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")

    # Negative grace period
    res = client.put(
        "/api/v1/system/config",
        json={"settings": {"attendance_grace_period_minutes": "-5"}, "reason": "Testing negative grace"},
        headers=admin_auth,
    )
    assert res.status_code == 400
    assert "negative" in res.json()["detail"].lower()

    # Negative geofence radius
    res2 = client.put(
        "/api/v1/system/config",
        json={"settings": {"default_geofence_radius_meters": "-100"}, "reason": "Testing negative radius"},
        headers=admin_auth,
    )
    assert res2.status_code == 400
    assert "negative" in res2.json()["detail"].lower() or "greater than 0" in res2.json()["detail"].lower()


def test_validation_out_of_range_floats_rejected():
    """Verify out-of-range floats are rejected."""
    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")

    # Percentage > 100
    res = client.put(
        "/api/v1/system/config",
        json={"settings": {"minimum_attendance_percentage": "105.0"}, "reason": "Testing invalid percentage"},
        headers=admin_auth,
    )
    assert res.status_code == 400
    assert "between 0.0 and 100.0" in res.json()["detail"]

    # Weight > 1.0
    res2 = client.put(
        "/api/v1/system/config",
        json={"settings": {"rule_score_weight": "1.5"}, "reason": "Testing invalid weight"},
        headers=admin_auth,
    )
    assert res2.status_code == 400
    assert "between 0.0 and 1.0" in res2.json()["detail"]


def test_validation_logical_relationship_rejected():
    """Verify late threshold cannot be less than grace period."""
    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")

    res = client.put(
        "/api/v1/system/config",
        json={
            "settings": {
                "attendance_grace_period_minutes": "15",
                "late_threshold_minutes": "10",
            },
            "reason": "Testing invalid logical relationship",
        },
        headers=admin_auth,
    )
    assert res.status_code == 400
    assert "cannot be less than" in res.json()["detail"]
