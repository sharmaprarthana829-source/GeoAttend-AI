"""Offline ML Training Pipeline — Phase 13

Loads real historical attendance records from the database, extracts deterministic feature vectors,
fits the Isolation Forest detector, and serializes model artifacts.
"""

import sys
import numpy as np
from app.db.session import SessionLocal
from app.models import AttendanceRecord
from app.ml.config import MIN_SAMPLES_ISOLATION_FOREST, ML_ARTIFACTS_DIR
from app.ml.features import FeatureExtractor
from app.ml.isolation_forest import IsolationForestDetector
from app.ml.schemas import MLFeatureVector


def train_models() -> bool:
    print("=" * 60)
    print(" GeoAttend AI — ML Model Training Pipeline (Phase 13)")
    print("=" * 60)

    db = SessionLocal()
    try:
        # 1. Fetch real historical records from database
        records = db.query(AttendanceRecord).all()
        sample_count = len(records)
        print(f"[*] Found {sample_count} historical attendance records in database.")

        if sample_count < MIN_SAMPLES_ISOLATION_FOREST:
            print(
                f"[!] Insufficient historical data for reliable ML training.\n"
                f"    Required: >= {MIN_SAMPLES_ISOLATION_FOREST} records, Found: {sample_count} records.\n"
                f"    Inference will safely operate in rule-based fallback mode."
            )
            return False

        # 2. Extract feature matrix
        print(f"[*] Extracting {len(MLFeatureVector.feature_names())} features across {sample_count} samples...")
        feature_rows: list[list[float]] = []
        for rec in records:
            vec = FeatureExtractor.extract_from_historical_record(db, rec)
            feature_rows.append(vec.to_list())

        X = np.array(feature_rows)

        # 3. Fit Isolation Forest
        detector = IsolationForestDetector()
        metrics = detector.fit(X, feature_names=MLFeatureVector.feature_names())

        # 4. Save artifacts to disk
        model_path = detector.save(ML_ARTIFACTS_DIR)

        print(f"[✓] Isolation Forest model successfully trained and saved:")
        print(f"    - Artifact: {model_path}")
        print(f"    - Model Version: {metrics['version']}")
        print(f"    - Training Samples: {metrics['training_samples']}")
        print(f"    - Feature Count: {metrics['features_count']}")
        print(f"    - Timestamp: {metrics['trained_at']}")
        return True

    finally:
        db.close()


if __name__ == "__main__":
    success = train_models()
    sys.exit(0 if success else 1)
