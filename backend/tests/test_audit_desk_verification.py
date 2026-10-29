"""Tests for Administrative Audit Log Desk API Verification, Filtering, Pagination, and Immutability."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models import AuditLog

client = TestClient(app)


def _auth(email: str, password: str) -> dict:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_get_audit_logs_real_database_records():
    """Verify admin can fetch authentic audit records with total count header."""
    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")
    res = client.get("/api/v1/audit/logs?limit=25&offset=0", headers=admin_auth)
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)
    assert len(logs) > 0

    # Verify X-Total-Count header matches database count
    db = SessionLocal()
    db_total = db.query(AuditLog).count()
    assert "x-total-count" in res.headers
    assert int(res.headers["x-total-count"]) == db_total

    # Verify log entry fields
    first = logs[0]
    assert "id" in first
    assert "action" in first
    assert "entity_type" in first
    assert "created_at" in first
    assert "user_name" in first


def test_audit_logs_filtering():
    """Verify action, entity_type, role, and text search filters operate accurately."""
    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")

    # Filter by action
    res_act = client.get("/api/v1/audit/logs?action=UPDATE_SYSTEM_CONFIG", headers=admin_auth)
    assert res_act.status_code == 200
    act_logs = res_act.json()
    assert all("CONFIG" in l["action"] for l in act_logs)

    # Filter by entity_type
    res_ent = client.get("/api/v1/audit/logs?entity_type=SYSTEM_SETTING", headers=admin_auth)
    assert res_ent.status_code == 200
    ent_logs = res_ent.json()
    assert all("SYSTEM_SETTING" in l["entity_type"] for l in ent_logs)

    # Filter by role
    res_role = client.get("/api/v1/audit/logs?role=admin", headers=admin_auth)
    assert res_role.status_code == 200
    role_logs = res_role.json()
    assert all(l["user_role"] == "admin" for l in role_logs if l["user_role"])

    # Search query
    res_q = client.get("/api/v1/audit/logs?query=security", headers=admin_auth)
    assert res_q.status_code == 200


def test_audit_logs_pagination():
    """Verify limit and offset pagination work properly."""
    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")

    res_page1 = client.get("/api/v1/audit/logs?limit=5&offset=0", headers=admin_auth)
    assert res_page1.status_code == 200
    page1 = res_page1.json()
    assert len(page1) <= 5

    res_page2 = client.get("/api/v1/audit/logs?limit=5&offset=5", headers=admin_auth)
    assert res_page2.status_code == 200
    page2 = res_page2.json()

    if len(page1) > 0 and len(page2) > 0:
        # Verify page 2 has different records from page 1
        page1_ids = {l["id"] for l in page1}
        page2_ids = {l["id"] for l in page2}
        assert page1_ids.isdisjoint(page2_ids)


def test_audit_logs_unauthorized_access():
    """Verify non-admin users cannot access audit logs."""
    # Anonymous
    res_anon = client.get("/api/v1/audit/logs")
    assert res_anon.status_code in (401, 403)

    # Student
    student_auth = _auth("student@geoattend.ai", "Student@12345")
    res_stud = client.get("/api/v1/audit/logs", headers=student_auth)
    assert res_stud.status_code == 403


def test_audit_logs_immutability():
    """Verify audit logs cannot be modified or deleted via API."""
    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")

    # PUT/DELETE on /audit/logs should not exist (405 Method Not Allowed)
    res_del = client.delete("/api/v1/audit/logs", headers=admin_auth)
    assert res_del.status_code in (404, 405)

    res_put = client.put("/api/v1/audit/logs", json={"action": "HACK"}, headers=admin_auth)
    assert res_put.status_code in (404, 405)

    res_del_item = client.delete("/api/v1/audit/logs/1", headers=admin_auth)
    assert res_del_item.status_code in (404, 405)
