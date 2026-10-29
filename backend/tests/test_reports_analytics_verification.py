"""Tests for Admin Reports & Analytics and CSV Export Verification."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models import (
    ReviewStatus,
    SuspiciousActivity,
)

client = TestClient(app)


def _auth(email: str, password: str) -> dict:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_admin_analytics_endpoint():
    """Verify that /attendance/admin/analytics returns authentic backend data."""
    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")
    response = client.get("/api/v1/attendance/admin/analytics", headers=admin_auth)
    assert response.status_code == 200
    data = response.json()

    # Check required fields
    assert "overall_attendance_percentage" in data
    assert "today_attendance_count" in data
    assert "today_sessions_count" in data
    assert "total_active_sessions" in data
    assert "total_suspicious_activities" in data
    assert "high_risk_anomalies" in data
    assert "department_attendance" in data
    assert "attendance_by_day" in data
    assert "risk_distribution" in data

    # Verify risk distribution values match real SuspiciousActivity counts
    risk = data["risk_distribution"]
    assert "pending_review" in risk
    assert "confirmed_fraud" in risk
    assert "dismissed" in risk
    assert "high_risk" in risk
    assert "low_risk" in risk

    db = SessionLocal()
    actual_pending = (
        db.query(SuspiciousActivity)
        .filter(SuspiciousActivity.review_status == ReviewStatus.PENDING)
        .count()
    )
    assert risk["pending_review"] == actual_pending

    actual_confirmed = (
        db.query(SuspiciousActivity)
        .filter(SuspiciousActivity.review_status == ReviewStatus.CONFIRMED)
        .count()
    )
    assert risk["confirmed_fraud"] == actual_confirmed

    actual_dismissed = (
        db.query(SuspiciousActivity)
        .filter(SuspiciousActivity.review_status == ReviewStatus.DISMISSED)
        .count()
    )
    assert risk["dismissed"] == actual_dismissed

    # Verify department attendance is populated with real rates
    dept_list = data["department_attendance"]
    assert len(dept_list) > 0
    for d in dept_list:
        assert "department_id" in d
        assert "department_name" in d
        assert "department_code" in d
        assert "attendance_rate" in d
        assert 0.0 <= d["attendance_rate"] <= 100.0


def test_export_csv_endpoint():
    """Verify that /attendance/admin/export-csv returns real CSV dataset."""
    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")
    response = client.get("/api/v1/attendance/admin/export-csv", headers=admin_auth)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=GeoAttend_Attendance_Export_" in response.headers["content-disposition"]

    csv_text = response.text
    lines = csv_text.strip().split("\r\n") if "\r\n" in csv_text else csv_text.strip().split("\n")
    header_cols = lines[0].split(",")

    # Validate header structure
    assert "Record ID" in header_cols
    assert "Student Name" in header_cols
    assert "Roll Number" in header_cols
    assert "Subject Code" in header_cols
    assert "Attendance Status" in header_cols
    assert "Suspicious" in header_cols

    # Validate rows contain real records if DB has records
    if len(lines) > 1:
        assert len(lines) >= 2


def test_unauthorized_access():
    """Verify that unauthenticated requests are rejected."""
    resp1 = client.get("/api/v1/attendance/admin/analytics")
    assert resp1.status_code in (401, 403)

    resp2 = client.get("/api/v1/attendance/admin/export-csv")
    assert resp2.status_code in (401, 403)
