"""Isolation Forest Anomaly Detector — Phase 13

Uses scikit-learn's Isolation Forest with feature scaling for multidimensional check-in anomaly detection.
Normalizes anomaly scores to 0-100 and computes contributing feature deviations for transparent explainability.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from app.ml.config import (
    FEATURE_SCHEMA_VERSION,
    ISOLATION_FOREST_CONTAMINATION,
    ISOLATION_FOREST_N_ESTIMATORS,
    ISOLATION_FOREST_RANDOM_STATE,
    MIN_SAMPLES_ISOLATION_FOREST,
    ML_ARTIFACTS_DIR,
    MODEL_VERSION,
)
from app.ml.schemas import IsolationForestResult, MLFeatureVector


class IsolationForestDetector:
    def __init__(
        self,
        n_estimators: int = ISOLATION_FOREST_N_ESTIMATORS,
        contamination: float = ISOLATION_FOREST_CONTAMINATION,
        random_state: int = ISOLATION_FOREST_RANDOM_STATE,
    ):
        self.n_estimators = n_estimators
        self.contamination = contamination
        self.random_state = random_state

        self.model: IsolationForest | None = None
        self.scaler: StandardScaler | None = None
        self.feature_names: list[str] = MLFeatureVector.feature_names()
        self.training_means: np.ndarray | None = None
        self.training_stds: np.ndarray | None = None
        self.trained_at: str | None = None
        self.training_samples: int = 0
        self.version: str = MODEL_VERSION

    @property
    def is_trained(self) -> bool:
        return self.model is not None and self.scaler is not None

    def fit(self, X: np.ndarray, feature_names: list[str] | None = None) -> dict[str, Any]:
        """Trains the Isolation Forest model on historical feature data."""
        if X.shape[0] < MIN_SAMPLES_ISOLATION_FOREST:
            raise ValueError(
                f"Insufficient historical data: {X.shape[0]} samples provided, "
                f"minimum required is {MIN_SAMPLES_ISOLATION_FOREST}."
            )

        if feature_names:
            self.feature_names = feature_names

        # 1. Fit StandardScaler
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        self.training_means = self.scaler.mean_
        self.training_stds = np.sqrt(self.scaler.var_)

        # 2. Fit IsolationForest
        self.model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=self.random_state,
        )
        self.model.fit(X_scaled)

        self.training_samples = int(X.shape[0])
        self.trained_at = datetime.now(timezone.utc).isoformat()

        return {
            "training_samples": self.training_samples,
            "features_count": len(self.feature_names),
            "trained_at": self.trained_at,
            "version": self.version,
        }

    def predict(self, feature_vector: MLFeatureVector) -> IsolationForestResult:
        """Evaluates a single check-in feature vector against the trained model."""
        if not self.is_trained:
            return IsolationForestResult(
                is_anomaly=False,
                anomaly_score=0.0,
                raw_decision_score=0.0,
                contributing_features=[],
                explanation="Model not trained: insufficient historical data available.",
                status="model_not_loaded",
            )

        x = np.array([feature_vector.to_list()])
        x_scaled = self.scaler.transform(x)

        # Raw score from IsolationForest: negative scores are outliers
        raw_score = float(self.model.score_samples(x_scaled)[0])
        pred_label = int(self.model.predict(x_scaled)[0])  # -1 = anomaly, 1 = normal

        # Normalize raw score (-0.5 to 0.5) to [0.0, 100.0] risk scale
        # Lower raw score -> Higher anomaly score
        normalized_score = float(np.clip((0.2 - raw_score) * 120.0, 0.0, 100.0))
        is_anomaly = pred_label == -1 or normalized_score >= 35.0

        # Calculate contributing features based on z-score deviation
        contributing_features: list[str] = []
        feature_explanations: list[str] = []

        if self.training_means is not None and self.training_stds is not None:
            raw_vals = x[0]
            for i, name in enumerate(self.feature_names):
                std = self.training_stds[i] if self.training_stds[i] > 1e-6 else 1.0
                z_score = abs((raw_vals[i] - self.training_means[i]) / std)
                if z_score > 2.0:
                    contributing_features.append(name)
                    if name == "distance_meters" or name == "distance_ratio":
                        feature_explanations.append("Check-in distance deviates from historical class baseline")
                    elif name == "elapsed_minutes":
                        feature_explanations.append("Check-in timing is unusually rapid or delayed")
                    elif name == "device_reuse_count":
                        feature_explanations.append("Device hardware was detected on concurrent check-ins")
                    elif name == "student_suspicious_ratio":
                        feature_explanations.append("Historical student anomaly frequency elevated")

        explanation: str | None = None
        if is_anomaly:
            if feature_explanations:
                explanation = "; ".join(dict.fromkeys(feature_explanations))
            else:
                explanation = "Multi-dimensional check-in feature pattern deviates from standard distribution"

        return IsolationForestResult(
            is_anomaly=is_anomaly,
            anomaly_score=round(normalized_score, 2),
            raw_decision_score=round(raw_score, 4),
            contributing_features=contributing_features,
            explanation=explanation,
            status="success",
        )

    def save(
        self,
        directory: Path | None = None,
        evaluation_metrics: dict[str, Any] | None = None,
        data_window: dict[str, Any] | None = None,
    ) -> Path:
        """Atomically saves model artifacts and metadata to disk after validation.

        Preserves the last known-good model as a .bak file upon promotion.
        """
        import shutil
        import sys
        import uuid
        import sklearn

        if not self.is_trained:
            raise ValueError("Cannot save an untrained model.")

        save_dir = directory or ML_ARTIFACTS_DIR
        save_dir.mkdir(parents=True, exist_ok=True)

        model_path = save_dir / "isolation_forest.joblib"
        backup_path = save_dir / "isolation_forest.joblib.bak"
        meta_path = save_dir / "metadata.json"
        tmp_path = save_dir / f"tmp_isolation_forest_{uuid.uuid4().hex[:8]}.joblib"

        artifact = {
            "model_type": "IsolationForest",
            "model": self.model,
            "scaler": self.scaler,
            "feature_names": self.feature_names,
            "training_means": self.training_means,
            "training_stds": self.training_stds,
            "training_samples": self.training_samples,
            "trained_at": self.trained_at,
            "version": self.version,
            "feature_schema_version": FEATURE_SCHEMA_VERSION,
            "library_versions": {
                "scikit-learn": getattr(sklearn, "__version__", "unknown"),
                "joblib": getattr(joblib, "__version__", "unknown"),
                "numpy": getattr(np, "__version__", "unknown"),
                "python": sys.version.split()[0],
            },
        }

        # 1. Write to temporary file first
        try:
            joblib.dump(artifact, tmp_path)

            # 2. Validate artifact by test-loading and test-inference
            test_loaded = joblib.load(tmp_path)
            assert isinstance(test_loaded, dict), "Artifact must be a dictionary"
            assert "model" in test_loaded and "scaler" in test_loaded, "Missing required model keys"
            assert len(test_loaded["feature_names"]) == len(self.feature_names), "Feature dimension mismatch"

            # Test inference with zero vector
            test_vec = MLFeatureVector(
                distance_meters=0.0,
                distance_ratio=0.0,
                elapsed_minutes=0.0,
                hour_of_day=9.0,
                day_of_week=0.0,
                device_reuse_count=0,
                student_late_ratio=0.0,
                student_suspicious_ratio=0.0,
                has_wifi=1.0,
                has_gps=1.0,
            )
            x_test = np.array([test_vec.to_list()])
            _ = test_loaded["model"].score_samples(test_loaded["scaler"].transform(x_test))

        except Exception as exc:
            if tmp_path.exists():
                tmp_path.unlink()
            raise ValueError(f"Artifact self-validation failed: {exc}. Aborting promotion to protect production.") from exc

        # 3. Preserve last known-good model before overwriting
        if model_path.exists():
            try:
                shutil.copy2(model_path, backup_path)
            except Exception:
                pass

        # 4. Atomic promotion
        tmp_path.replace(model_path)

        # 5. Write metadata JSON
        metadata = {
            "model_type": "IsolationForest",
            "model_version": self.version,
            "feature_schema_version": FEATURE_SCHEMA_VERSION,
            "trained_at": self.trained_at,
            "training_samples": self.training_samples,
            "feature_names": self.feature_names,
            "feature_dimensions": len(self.feature_names),
            "data_window": data_window or {},
            "evaluation_metrics": evaluation_metrics or {},
            "hyperparameters": {
                "n_estimators": self.n_estimators,
                "contamination": self.contamination,
                "random_state": self.random_state,
            },
            "library_versions": artifact["library_versions"],
        }

        meta_path.write_text(json.dumps(metadata, indent=2))
        return model_path

    @classmethod
    def load(cls, directory: Path | None = None) -> "IsolationForestDetector":
        """Loads and validates model artifacts from disk with fallback to backup."""
        load_dir = directory or ML_ARTIFACTS_DIR
        model_path = load_dir / "isolation_forest.joblib"
        backup_path = load_dir / "isolation_forest.joblib.bak"

        target_file = None
        if model_path.exists():
            target_file = model_path
        elif backup_path.exists():
            target_file = backup_path

        if target_file is None:
            raise FileNotFoundError(f"Model artifact not found at {model_path} (or backup at {backup_path})")

        try:
            artifact = joblib.load(target_file)
            if not isinstance(artifact, dict) or "model" not in artifact or "scaler" not in artifact:
                raise ValueError("Corrupted or incompatible artifact structure")

            features = artifact.get("feature_names", [])
            if len(features) != 10:
                raise ValueError(f"Incompatible feature dimension: expected 10, found {len(features)}")

            detector = cls()
            detector.model = artifact["model"]
            detector.scaler = artifact["scaler"]
            detector.feature_names = features
            detector.training_means = artifact.get("training_means")
            detector.training_stds = artifact.get("training_stds")
            detector.training_samples = artifact.get("training_samples", 0)
            detector.trained_at = artifact.get("trained_at")
            detector.version = artifact.get("version", MODEL_VERSION)
            return detector

        except Exception as exc:
            # If primary was corrupted and backup exists, try backup
            if target_file == model_path and backup_path.exists():
                try:
                    artifact = joblib.load(backup_path)
                    detector = cls()
                    detector.model = artifact["model"]
                    detector.scaler = artifact["scaler"]
                    detector.feature_names = artifact.get("feature_names", [])
                    detector.training_means = artifact.get("training_means")
                    detector.training_stds = artifact.get("training_stds")
                    detector.training_samples = artifact.get("training_samples", 0)
                    detector.trained_at = artifact.get("trained_at")
                    detector.version = artifact.get("version", MODEL_VERSION)
                    return detector
                except Exception:
                    pass
            raise ValueError(f"Failed to load valid model artifact from {target_file}: {exc}") from exc

