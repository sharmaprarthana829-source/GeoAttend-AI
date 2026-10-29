import logging
from pathlib import Path

from app.ml.config import FEATURE_SCHEMA_VERSION, ML_ARTIFACTS_DIR, MODEL_VERSION
from app.ml.dbscan import DBSCANClusterer
from app.ml.isolation_forest import IsolationForestDetector
from app.ml.schemas import MLModelStatus

logger = logging.getLogger(__name__)


class ModelManager:
    _instance: "ModelManager | None" = None

    def __init__(self, artifacts_dir: Path | None = None):
        self.artifacts_dir = artifacts_dir or ML_ARTIFACTS_DIR
        self.isolation_forest: IsolationForestDetector = IsolationForestDetector()
        self.dbscan: DBSCANClusterer = DBSCANClusterer()
        self._is_loaded = False
        self._fallback_reason: str = "Initial startup: checking artifacts directory."
        self.load_models()

    @classmethod
    def get_instance(cls, artifacts_dir: Path | None = None) -> "ModelManager":
        if cls._instance is None:
            cls._instance = cls(artifacts_dir=artifacts_dir)
        return cls._instance

    def load_models(self) -> bool:
        """Attempts to load serialized model artifacts from disk with safe fallback."""
        try:
            self.isolation_forest = IsolationForestDetector.load(self.artifacts_dir)
            self._is_loaded = True
            self._fallback_reason = ""
            logger.info(
                f"[ModelManager] Loaded ML model v{self.isolation_forest.version} "
                f"({self.isolation_forest.training_samples} training samples) from {self.artifacts_dir}"
            )
            return True
        except FileNotFoundError:
            self.isolation_forest = IsolationForestDetector()
            self._is_loaded = False
            self._fallback_reason = "No model artifact file found on disk. Operating in rule-based fallback mode."
            logger.info(f"[ModelManager] {self._fallback_reason}")
            return False
        except Exception as exc:
            self.isolation_forest = IsolationForestDetector()
            self._is_loaded = False
            self._fallback_reason = f"Artifact loading bypassed due to validation/compatibility issue: {exc}"
            logger.warning(f"[ModelManager] {self._fallback_reason}")
            return False

    def reload(self) -> bool:
        return self.load_models()

    def get_status(self) -> MLModelStatus:
        if self._is_loaded and self.isolation_forest.is_trained:
            return MLModelStatus(
                is_model_loaded=True,
                model_version=self.isolation_forest.version,
                feature_schema_version=FEATURE_SCHEMA_VERSION,
                training_sample_count=self.isolation_forest.training_samples,
                trained_at=self.isolation_forest.trained_at,
                is_ready_for_inference=True,
                status_message="Isolation Forest model active and ready for inference.",
            )

        return MLModelStatus(
            is_model_loaded=False,
            model_version=MODEL_VERSION,
            feature_schema_version=FEATURE_SCHEMA_VERSION,
            training_sample_count=0,
            trained_at=None,
            is_ready_for_inference=False,
            status_message=self._fallback_reason or "No trained ML model artifacts found. Operating in rule-based fallback mode.",
        )

