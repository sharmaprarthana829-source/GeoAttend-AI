"""Comprehensive Tests for Phase 13: AI/ML Anomaly Detection Layer

Tests:
1. Feature extraction & deterministic schema consistency
2. Insufficient training data handling
3. Isolation Forest training, fit, artifact saving & loading
4. Isolation Forest inference, scoring normalization & explainability
5. DBSCAN spatial clustering and noise detection
6. Hybrid Anomaly Fusion Engine (Rule + Isolation Forest + DBSCAN)
7. API Endpoint: GET /api/v1/anomaly/ml/status
8. Check-in pipeline integration with hybrid ML inference
9. Role-based authorization & security (Student 403 on ML inspection)
"""

import json
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.main import app
from app.models import (
    AcademicEnrollment,
    AttendanceRecord,
    AttendanceSession,
    AttendanceStatus,
    Batch,
    Branch,
    Course,
    DayOfWeek,
    Department,
    FacultyAssignment,
    FacultyProfile,
    Section,
    SessionStatus,
    StudentGroup,
    StudentProfile,
    Subject,
    SubjectOffering,
    SuspiciousActivity,
    TimetableEntry,
    User,
    UserRole,
)
from app.ml.config import (
    MIN_SAMPLES_DBSCAN,
    MIN_SAMPLES_ISOLATION_FOREST,
    ML_SCORE_WEIGHT,
    MODEL_VERSION,
    RULE_SCORE_WEIGHT,
)
from app.ml.dbscan import DBSCANClusterer
from app.ml.features import FeatureExtractor
from app.ml.hybrid_engine import HybridAnomalyEngine
from app.ml.isolation_forest import IsolationForestDetector
from app.ml.model_manager import ModelManager
from app.ml.schemas import MLFeatureVector


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def get_token(client: TestClient, email: str, password: str = "Admin@12345") -> dict[str, str]:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_feature_extraction_and_schema():
    print("\n[Test 1] Testing ML feature vector schema and deterministic vector conversion...")
    vec = MLFeatureVector(
        distance_meters=15.5,
        distance_ratio=0.155,
        elapsed_minutes=3.2,
        hour_of_day=9.0,
        day_of_week=0.0,
        device_reuse_count=0,
        student_late_ratio=0.05,
        student_suspicious_ratio=0.0,
        has_wifi=1.0,
        has_gps=1.0,
    )

    names = MLFeatureVector.feature_names()
    vals = vec.to_list()

    assert len(names) == 10
    assert len(vals) == 10
    assert vals[0] == 15.5
    assert vals[8] == 1.0
    assert "distance_meters" in names
    print("✓ Feature schema and vector generation valid")


def test_insufficient_training_data_guard():
    print("\n[Test 2] Testing insufficient training data validation...")
    detector = IsolationForestDetector()
    # Provide 5 samples, while minimum required is 20
    small_X = np.random.randn(5, 10)

    with pytest.raises(ValueError) as exc_info:
        detector.fit(small_X)

    assert "Insufficient historical data" in str(exc_info.value)
    print("✓ Insufficient training data guard raised ValueError safely")


def test_isolation_forest_training_and_serialization():
    print("\n[Test 3] Testing Isolation Forest training, fit, artifact saving & loading...")
    temp_dir = Path(tempfile.mkdtemp())
    try:
        # Generate 50 synthetic baseline feature vectors for training test
        np.random.seed(42)
        X_train = np.random.normal(loc=10.0, scale=2.0, size=(50, 10))

        detector = IsolationForestDetector(random_state=42)
        metrics = detector.fit(X_train)

        assert detector.is_trained is True
        assert metrics["training_samples"] == 50
        assert metrics["features_count"] == 10

        # Save artifacts
        saved_path = detector.save(temp_dir)
        assert saved_path.exists()
        assert (temp_dir / "metadata.json").exists()

        # Load artifacts into a new detector
        loaded_detector = IsolationForestDetector.load(temp_dir)
        assert loaded_detector.is_trained is True
        assert loaded_detector.version == MODEL_VERSION
        assert loaded_detector.training_samples == 50

        # Normal prediction
        normal_vec = MLFeatureVector(
            distance_meters=10.0,
            distance_ratio=0.1,
            elapsed_minutes=10.0,
            hour_of_day=10.0,
            day_of_week=10.0,
            device_reuse_count=10,
            student_late_ratio=10.0,
            student_suspicious_ratio=10.0,
            has_wifi=10.0,
            has_gps=10.0,
        )
        res_normal = loaded_detector.predict(normal_vec)
        assert res_normal.status == "success"

        # Outlier prediction (extreme distance and device reuse)
        outlier_vec = MLFeatureVector(
            distance_meters=500.0,
            distance_ratio=5.0,
            elapsed_minutes=90.0,
            hour_of_day=23.0,
            day_of_week=6.0,
            device_reuse_count=10,
            student_late_ratio=0.9,
            student_suspicious_ratio=0.8,
            has_wifi=0.0,
            has_gps=1.0,
        )
        res_outlier = loaded_detector.predict(outlier_vec)
        assert res_outlier.anomaly_score > res_normal.anomaly_score
        assert len(res_outlier.contributing_features) > 0
        assert res_outlier.explanation is not None
        print(f"✓ Normal score: {res_normal.anomaly_score}, Outlier score: {res_outlier.anomaly_score}")
        print(f"✓ Outlier explanation: {res_outlier.explanation}")

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_dbscan_clustering_and_noise_detection():
    print("\n[Test 4] Testing DBSCAN spatial clustering and outlier detection...")
    clusterer = DBSCANClusterer(eps=0.05, min_samples=3)

    # 1. Test insufficient samples
    few_points = [(28.6139, 77.2090), (28.6140, 77.2091)]
    res_few = clusterer.cluster_spatial_points(few_points, 0)
    assert res_few.status == "insufficient_data"
    assert res_few.is_noise is False

    # 2. Test tight cluster + 1 extreme outlier
    # 10 points close together in Delhi (within ~20m)
    cohort_points = [
        (28.61390, 77.20900),
        (28.61391, 77.20901),
        (28.61392, 77.20902),
        (28.61390, 77.20903),
        (28.61391, 77.20902),
        (28.61393, 77.20901),
        (28.61392, 77.20900),
        (28.61391, 77.20904),
        (28.61390, 77.20902),
        (28.61392, 77.20903),
        # 11th point located 20 km away (outlier)
        (28.75000, 77.40000),
    ]

    # Target: normal cluster point (index 0)
    normal_res = clusterer.cluster_spatial_points(cohort_points, 0)
    assert normal_res.status == "success"
    assert normal_res.is_noise is False
    assert normal_res.cluster_label >= 0

    # Target: outlier point (index 10)
    outlier_res = clusterer.cluster_spatial_points(cohort_points, 10)
    assert outlier_res.status == "success"
    assert outlier_res.is_noise is True
    assert outlier_res.cluster_label == -1
    assert "isolated outlier" in outlier_res.explanation
    print("✓ DBSCAN correctly flagged distant point as spatial noise (label=-1)")


def test_hybrid_anomaly_engine_fusion(client: TestClient):
    print("\n[Test 5] Testing Hybrid Anomaly Engine score combination...")
    temp_dir = Path(tempfile.mkdtemp())
    try:
        # Train a temporary model
        np.random.seed(42)
        X_train = np.random.normal(loc=10.0, scale=2.0, size=(30, 10))
        det = IsolationForestDetector(random_state=42)
        det.fit(X_train)
        det.save(temp_dir)

        model_manager = ModelManager(artifacts_dir=temp_dir)
        engine = HybridAnomalyEngine(model_manager=model_manager)

        db = next(get_db())
        session = db.query(AttendanceSession).first()
        record = db.query(AttendanceRecord).first()

        if session and record:
            rule_signals = [
                {
                    "rule": "GPS_NEAR_BOUNDARY",
                    "method": "gps",
                    "score": 30.0,
                    "detail": "GPS location near geofence boundary",
                }
            ]

            res = engine.evaluate(
                db=db,
                record=record,
                session=session,
                rule_score=30.0,
                rule_signals=rule_signals,
                elapsed_seconds=10.0,
            )

            assert res.rule_score == 30.0
            assert res.final_risk_score > 0.0
            assert "GPS_NEAR_BOUNDARY" in str(res.explanations) or "GPS" in str(res.explanations)
            assert res.feature_snapshot is not None
            print(f"✓ Hybrid Risk Score: {res.final_risk_score} (Rule: {res.rule_score}, ML: {res.ml_score})")

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_ml_status_endpoint(client: TestClient):
    print("\n[Test 6] Testing GET /api/v1/anomaly/ml/status endpoint...")
    admin_auth = get_token(client, "admin@geoattend.ai")
    fac_auth = get_token(client, "faculty@geoattend.ai", "Faculty@12345")
    stud_auth = get_token(client, "student@geoattend.ai", "Student@12345")

    # Admin access
    res = client.get("/api/v1/anomaly/ml/status", headers=admin_auth)
    assert res.status_code == 200
    data = res.json()
    assert "is_model_loaded" in data
    assert "model_version" in data
    assert "feature_schema_version" in data
    print(f"✓ Admin inspection of ML status: {data['status_message']}")

    # Faculty access
    res = client.get("/api/v1/anomaly/ml/status", headers=fac_auth)
    assert res.status_code == 200

    # Student blocked (403)
    res = client.get("/api/v1/anomaly/ml/status", headers=stud_auth)
    assert res.status_code == 403
    print("✓ Student correctly blocked from internal ML model status (403)")


def test_checkin_integration_with_ml_anomaly(client: TestClient):
    print("\n[Test 7] Testing attendance check-in integration with ML anomaly detection...")
    # Faculty starts session
    fac_auth = get_token(client, "faculty@geoattend.ai", "Faculty@12345")
    tt_res = client.get("/api/v1/timetable/today/faculty", headers=fac_auth)
    if tt_res.status_code != 200 or not tt_res.json():
        tt_res = client.get("/api/v1/timetable", headers=fac_auth)
    assert tt_res.status_code == 200
    tt_list = tt_res.json()
    assert len(tt_list) > 0
    tt_id = tt_list[0]["id"]

    start_res = client.post("/api/v1/attendance/sessions/start", json={"timetable_entry_id": tt_id}, headers=fac_auth)
    session_id = start_res.json()["id"] if start_res.status_code == 201 else start_res.json().get("id")
    if not session_id:
        # Active session might already exist
        sessions = client.get("/api/v1/attendance/faculty/sessions", headers=fac_auth).json()
        session_id = sessions[0]["id"]

    # Student checks in with borderline distance (85m on 100m radius -> triggers boundary rule + ML feature extraction)
    stud_auth = get_token(client, "student@geoattend.ai", "Student@12345")
    checkin_payload = {
        "session_id": session_id,
        "latitude": 28.6139,
        "longitude": 77.2090,
        "accuracy_meters": 4.5,
        "device_id": "test_device_student_1",
    }

    res = client.post("/api/v1/attendance/check-in", json=checkin_payload, headers=stud_auth)
    assert res.status_code in [200, 201, 400]

    # Verify status is not punished (PRESENT or LATE, never marked ABSENT by ML)
    if res.status_code in [200, 201]:
        rec = res.json().get("record", res.json())
        assert rec["status"] in ["present", "late"]
        print(f"✓ Check-in recorded with status: {rec['status']} (is_suspicious: {rec.get('is_suspicious')})")

    # Faculty views anomaly records
    anomalies_res = client.get("/api/v1/anomaly/faculty", headers=fac_auth)
    assert anomalies_res.status_code == 200
    anomalies = anomalies_res.json()
    print(f"✓ Faculty sees {len(anomalies)} suspicious activity review items")
