"""Tests for Applications Desk Search, Filtering, Stats, and Audit History."""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models import (
    ApplicationStatus,
    AttendanceApplication,
    FacultyProfile,
    StudentProfile,
    SubjectOffering,
    User,
)
from scripts.seed import seed

client = TestClient(app)


def _auth(email: str, password: str) -> dict:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_applications_desk_full_search_workflow():
    seed()
    admin_auth = _auth("admin@geoattend.ai", "Admin@12345")
    faculty1_auth = _auth("faculty@geoattend.ai", "Faculty@12345")
    student1_auth = _auth("student@geoattend.ai", "Student@12345")

    # 1. Test Stats Endpoint
    res = client.get("/api/v1/applications/stats", headers=admin_auth)
    assert res.status_code == 200, res.text
    stats = res.json()
    assert "total_applications" in stats
    assert "pending_faculty" in stats
    assert "approved" in stats
    assert "rejected" in stats

    # 2. Test Student Submit Application with Medical Reason
    db = SessionLocal()
    offering = db.query(SubjectOffering).filter(SubjectOffering.is_active.is_(True)).first()
    db.close()

    res = client.post(
        "/api/v1/applications",
        headers=student1_auth,
        json={
            "subject_offering_id": offering.id,
            "reason": "Severe viral fever and medical recovery",
            "description": "Admitted to hospital for 3 days; medical prescription attached.",
            "supporting_document_url": "https://example.com/medical_slip.pdf",
        },
    )
    # Could be 201 or 400 if already existing active
    if res.status_code == 201:
        app_id = res.json()["id"]
        assert res.json()["application_type"] == "medical_leave"
    else:
        # Fetch existing student application
        res2 = client.get("/api/v1/applications/my", headers=student1_auth)
        assert res2.status_code == 200
        app_id = res2.json()[0]["id"]

    # 3. Test Search by student name
    res = client.get("/api/v1/applications/admin?query=Arjun", headers=admin_auth)
    assert res.status_code == 200
    apps = res.json()
    assert len(apps) >= 1
    assert any("Arjun" in a["student_name"] for a in apps)

    # 4. Test Search by roll number
    res = client.get("/api/v1/applications/admin?query=CS24A001", headers=admin_auth)
    assert res.status_code == 200
    apps = res.json()
    assert len(apps) >= 1
    assert any(a["student_roll_number"] == "CS24A001" for a in apps)

    # 5. Test Search by application ID
    res = client.get(f"/api/v1/applications/admin?query=#{app_id}", headers=admin_auth)
    assert res.status_code == 200
    apps = res.json()
    assert len(apps) >= 1
    assert any(a["id"] == app_id for a in apps)

    # 6. Test Search by subject name / code
    res = client.get("/api/v1/applications/admin?query=Data", headers=admin_auth)
    assert res.status_code == 200
    apps = res.json()
    assert len(apps) >= 1

    # 7. Test Filter by application_type
    res = client.get("/api/v1/applications/admin?application_type=medical_leave", headers=admin_auth)
    assert res.status_code == 200

    # 8. Test Audit History Endpoint
    res = client.get(f"/api/v1/applications/{app_id}/history", headers=admin_auth)
    assert res.status_code == 200
    history = res.json()
    assert isinstance(history, list)
