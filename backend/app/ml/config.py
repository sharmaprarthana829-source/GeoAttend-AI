"""ML Configuration Constants & Thresholds — Phase 13"""

import os
from pathlib import Path

# Minimum sample requirements for reliable ML training and inference
MIN_SAMPLES_ISOLATION_FOREST = 20
MIN_SAMPLES_DBSCAN = 10

# Isolation Forest Hyperparameters
ISOLATION_FOREST_N_ESTIMATORS = 100
ISOLATION_FOREST_CONTAMINATION = 0.05
ISOLATION_FOREST_RANDOM_STATE = 42

# DBSCAN Spatial / Behavioral Hyperparameters
# eps in kilometers for Haversine or normalized units (~50 meters)
DBSCAN_EPS = 0.05
DBSCAN_MIN_SAMPLES = 3

# Hybrid Score Fusion Weights
# final_score = min(100.0, (RULE_SCORE_WEIGHT * rule_score) + (ML_SCORE_WEIGHT * ml_score) + dbscan_penalty)
RULE_SCORE_WEIGHT = 0.60
ML_SCORE_WEIGHT = 0.40
DBSCAN_OUTLIER_PENALTY = 15.0

# Anomaly Flag Threshold
# If hybrid risk score >= 25.0, check-in is flagged for human review
HYBRID_RISK_THRESHOLD = 25.0

# Artifact Storage Directory
ML_ARTIFACTS_DIR = Path(os.getenv("GEOATTEND_ML_DIR", Path(__file__).resolve().parent / "artifacts"))
MODEL_VERSION = "1.0.0"
FEATURE_SCHEMA_VERSION = "1.0"
