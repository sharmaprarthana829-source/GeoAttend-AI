"""GeoAttend AI — Machine Learning Anomaly Detection Package (Phase 13)"""

from app.ml.config import (
    DBSCAN_EPS,
    DBSCAN_MIN_SAMPLES,
    ISOLATION_FOREST_CONTAMINATION,
    MIN_SAMPLES_DBSCAN,
    MIN_SAMPLES_ISOLATION_FOREST,
    ML_ARTIFACTS_DIR,
    ML_SCORE_WEIGHT,
    MODEL_VERSION,
    RULE_SCORE_WEIGHT,
)
from app.ml.dbscan import DBSCANClusterer
from app.ml.features import FeatureExtractor
from app.ml.hybrid_engine import HybridAnomalyEngine
from app.ml.isolation_forest import IsolationForestDetector
from app.ml.model_manager import ModelManager
from app.ml.schemas import (
    DBSCANResult,
    HybridAnomalyResult,
    IsolationForestResult,
    MLFeatureVector,
    MLModelStatus,
    MLRetrainRequest,
    MLRetrainResponse,
    MLRetrainStatusResponse,
)
def __getattr__(name: str):
    if name in ("HistoricalDataPipeline", "run_training_pipeline"):
        from app.ml.train_pipeline import HistoricalDataPipeline, run_training_pipeline
        if name == "HistoricalDataPipeline":
            return HistoricalDataPipeline
        return run_training_pipeline
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

__all__ = [
    "DBSCANClusterer",
    "DBSCANResult",
    "DBSCAN_EPS",
    "DBSCAN_MIN_SAMPLES",
    "FeatureExtractor",
    "HistoricalDataPipeline",
    "HybridAnomalyEngine",
    "HybridAnomalyResult",
    "ISOLATION_FOREST_CONTAMINATION",
    "IsolationForestDetector",
    "IsolationForestResult",
    "MIN_SAMPLES_DBSCAN",
    "MIN_SAMPLES_ISOLATION_FOREST",
    "MLFeatureVector",
    "MLModelStatus",
    "MLRetrainRequest",
    "MLRetrainResponse",
    "MLRetrainStatusResponse",
    "ML_ARTIFACTS_DIR",
    "ML_SCORE_WEIGHT",
    "MODEL_VERSION",
    "ModelManager",
    "RULE_SCORE_WEIGHT",
    "run_training_pipeline",
]
