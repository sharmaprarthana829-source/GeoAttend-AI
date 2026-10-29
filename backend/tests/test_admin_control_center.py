import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models import (
    AttendanceRecord,
    AttendanceSession,
    AuditLog,
    Campus,
    Room,
    StudentProfile,
    SystemSetting,
    User,
    UserRole,
)
from scripts.seed import seed

client = TestClient(app)


def test_admin_control_center_suite():
    seed()
    db = SessionLocal()

    # Login Admin
    res_admin = client.post("/api/v1/auth/login", json={"email": "admin@geoattend.ai", "password": "Admin@12345"})
    assert res_admin.status_code == 200
    admin_token = res_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Login Student
    res_student = client.post("/api/v1/auth/login", json={"email": "student@geoattend.ai", "password": "Student@12345"})
    assert res_student.status_code == 200
    student_token = res_student.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 1. Test System Config GET & UPDATE
    res_cfg = client.get("/api/v1/system/config", headers=admin_headers)
    assert res_cfg.status_code == 200
    configs = res_cfg.json()
    assert len(configs) > 0
    assert any(c["key"] == "default_geofence_radius_meters" for c in configs)

    # Update system config
    update_payload = {
        "settings": {"default_geofence_radius_meters": "120"},
        "reason": "Expanding campus perimeter for sports ground",
    }
    res_upd_cfg = client.put("/api/v1/system/config", json=update_payload, headers=admin_headers)
    assert res_upd_cfg.status_code == 200

    # Verify student is rejected from system config (RBAC check)
    res_forbidden = client.get("/api/v1/system/config", headers=student_headers)
    assert res_forbidden.status_code == 403

    # 2. Test Audit Log API
    res_audit = client.get("/api/v1/audit/logs", headers=admin_headers)
    assert res_audit.status_code == 200
    logs = res_audit.json()
    assert len(logs) > 0
    assert any(log["action"] == "UPDATE_SYSTEM_CONFIG" for log in logs)

    # 3. Test Room / Classroom Geofence Management
    campus = db.query(Campus).first()
    assert campus is not None
    room_payload = {
        "campus_id": campus.id,
        "name": f"Admin Test Lab {campus.id}",
        "building": "Engineering Block B",
        "latitude": 28.5355,
        "longitude": 77.3910,
        "geofence_radius_meters": 80,
        "gps_accuracy_threshold": 40.0,
        "capacity": 75,
        "is_active": True,
    }
    res_room = client.post("/api/v1/rooms", json=room_payload, headers=admin_headers)
    assert res_room.status_code in (201, 409)  # 201 created or 409 if exists

    # 4. Test Student List and Device Reset
    student = db.query(StudentProfile).first()
    assert student is not None
    student.device_id = "HARDWARE-UUID-TEST-999"
    db.commit()

    reset_payload = {"reason": "Student purchased new smartphone"}
    res_reset = client.post(f"/api/v1/students/{student.id}/reset-device", json=reset_payload, headers=admin_headers)
    assert res_reset.status_code == 200
    assert "successful" in res_reset.json()["message"]

    db.commit()
    refreshed_student = db.query(StudentProfile).filter(StudentProfile.id == student.id).first()
    assert refreshed_student.device_id is None

    # 5. Test Attendance Override
    record = db.query(AttendanceRecord).first()
    if record:
        override_payload = {
            "status": "present",
            "reason": "Student attended medical camp with Dean approval",
        }
        res_override = client.post(f"/api/v1/attendance/records/{record.id}/override", json=override_payload, headers=admin_headers)
        assert res_override.status_code == 200
        assert res_override.json()["status"] == "present"

    # 6. Test Admin Analytics
    res_analytics = client.get("/api/v1/attendance/admin/analytics", headers=admin_headers)
    assert res_analytics.status_code == 200
    analytics_data = res_analytics.json()
    assert "total_students" in analytics_data
    assert "department_attendance" in analytics_data
    db.close()
