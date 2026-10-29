"""ML Schemas & Data Transfer Objects — Phase 13"""

from typing import Any
from pydantic import BaseModel, Field


class MLFeatureVector(BaseModel):
    """Deterministic feature vector extracted from check-in events."""

    distance_meters: float = Field(..., description="GPS distance to classroom in meters")
    distance_ratio: float = Field(..., description="Distance divided by geofence radius")
    elapsed_minutes: float = Field(..., description="Minutes from session start")
    hour_of_day: float = Field(..., description="Hour of the day (0-23)")
    day_of_week: float = Field(..., description="Day of week index (0=Monday, 6=Sunday)")
    device_reuse_count: int = Field(..., description="Duplicate device count in same session")
    student_late_ratio: float = Field(..., description="Student's historical late check-in ratio")
    student_suspicious_ratio: float = Field(..., description="Student's historical suspicious flag ratio")
    has_wifi: float = Field(..., description="1.0 if Wi-Fi BSSID present else 0.0")
    has_gps: float = Field(..., description="1.0 if valid GPS coordinates present else 0.0")

    def to_list(self) -> list[float]:
        return [
            float(self.distance_meters),
            float(self.distance_ratio),
            float(self.elapsed_minutes),
            float(self.hour_of_day),
            float(self.day_of_week),
            float(self.device_reuse_count),
            float(self.student_late_ratio),
            float(self.student_suspicious_ratio),
            float(self.has_wifi),
            float(self.has_gps),
        ]

    @classmethod
    def feature_names(cls) -> list[str]:
        return [
            "distance_meters",
            "distance_ratio",
            "elapsed_minutes",
            "hour_of_day",
            "day_of_week",
            "device_reuse_count",
            "student_late_ratio",
            "student_suspicious_ratio",
            "has_wifi",
            "has_gps",
        ]


class IsolationForestResult(BaseModel):
    is_anomaly: bool
    anomaly_score: float = Field(..., description="Normalized score 0-100")
    raw_decision_score: float
    contributing_features: list[str] = Field(default_factory=list)
    explanation: str | None = None
    status: str = "success"  # "success" or "insufficient_data" or "model_not_loaded"


class DBSCANResult(BaseModel):
    is_noise: bool
    cluster_label: int = -1
    explanation: str | None = None
    status: str = "success"  # "success" or "insufficient_data"


class HybridAnomalyResult(BaseModel):
    rule_score: float
    ml_score: float
    isolation_forest_score: float
    dbscan_is_outlier: bool
    final_risk_score: float
    is_suspicious: bool
    detection_methods: list[str]
    explanations: list[str]
    model_version: str | None
    feature_snapshot: dict[str, Any]


class MLModelStatus(BaseModel):
    is_model_loaded: bool
    model_version: str
    feature_schema_version: str
    training_sample_count: int
    trained_at: str | None
    is_ready_for_inference: bool
    status_message: str


class MLRetrainRequest(BaseModel):
    min_samples: int | None = Field(default=None, ge=10, le=10000, description="Minimum eligible historical records required")
    allow_test_data: bool = Field(default=False, description="Allow test records (development/test environments only)")
    run_async: bool = Field(default=False, description="Run retraining asynchronously in background")


class MLRetrainResponse(BaseModel):
    status: str
    message: str
    job_id: str | None = None
    details: dict[str, Any] | None = None


class MLRetrainStatusResponse(BaseModel):
    is_retraining: bool
    last_job_id: str | None = None
    last_status: str | None = None
    last_run_at: str | None = None
    last_result: dict[str, Any] | None = None

