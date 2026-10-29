"""Hybrid Anomaly Fusion Engine — Phase 13

Combines deterministic rules, Isolation Forest multidimensional scoring, and DBSCAN spatial clustering.
Never marks a student absent solely based on ML predictions.
"""

from typing import Any
from sqlalchemy.orm import Session

from app.models import AttendanceRecord, AttendanceSession
from app.ml.config import (
    DBSCAN_OUTLIER_PENALTY,
    HYBRID_RISK_THRESHOLD,
    ML_SCORE_WEIGHT,
    RULE_SCORE_WEIGHT,
)
from app.ml.features import FeatureExtractor
from app.ml.model_manager import ModelManager
from app.ml.schemas import HybridAnomalyResult, MLFeatureVector


class HybridAnomalyEngine:
    def __init__(self, model_manager: ModelManager | None = None):
        self.model_manager = model_manager or ModelManager.get_instance()

    def evaluate(
        self,
        db: Session,
        record: AttendanceRecord,
        session: AttendanceSession,
        rule_score: float,
        rule_signals: list[dict[str, Any]],
        elapsed_seconds: float,
    ) -> HybridAnomalyResult:
        """Evaluates a check-in event using hybrid rule-based and ML anomaly detection."""

        # 1. Extract deterministic feature vector
        feature_vector = FeatureExtractor.extract_from_checkin(
            db=db,
            record=record,
            session=session,
            elapsed_seconds=elapsed_seconds,
        )

        explanations: list[str] = [s["detail"] for s in rule_signals]
        detection_methods: list[str] = list(dict.fromkeys(s["method"].value if hasattr(s["method"], "value") else str(s["method"]) for s in rule_signals))

        # 2. Isolation Forest Inference
        iso_res = self.model_manager.isolation_forest.predict(feature_vector)
        iso_score = iso_res.anomaly_score

        if iso_res.is_anomaly and iso_res.explanation:
            explanations.append(f"AI/ML: {iso_res.explanation}")
            detection_methods.append("ml_isolation_forest")

        # 3. DBSCAN Spatial Outlier Detection (if GPS coordinates provided)
        dbscan_is_outlier = False
        if record.latitude is not None and record.longitude is not None:
            # Query session points
            session_records = (
                db.query(AttendanceRecord.latitude, AttendanceRecord.longitude)
                .filter(
                    AttendanceRecord.session_id == session.id,
                    AttendanceRecord.latitude.isnot(None),
                    AttendanceRecord.longitude.isnot(None),
                )
                .all()
            )

            if len(session_records) >= 10:
                points = [(float(r[0]), float(r[1])) for r in session_records]
                # Target is current record
                target_idx = len(points) - 1
                dbscan_res = self.model_manager.dbscan.cluster_spatial_points(points, target_idx)
                if dbscan_res.is_noise:
                    dbscan_is_outlier = True
                    if dbscan_res.explanation:
                        explanations.append(f"AI/ML (Spatial): {dbscan_res.explanation}")
                    detection_methods.append("ml_dbscan")

        # 4. Score Fusion
        ml_score = iso_score + (DBSCAN_OUTLIER_PENALTY if dbscan_is_outlier else 0.0)
        ml_score = min(100.0, ml_score)

        if self.model_manager.isolation_forest.is_trained:
            final_risk_score = (RULE_SCORE_WEIGHT * rule_score) + (ML_SCORE_WEIGHT * ml_score)
        else:
            # Fallback to rule score if ML model is not yet trained
            final_risk_score = rule_score

        final_risk_score = round(min(100.0, max(0.0, final_risk_score)), 2)
        is_suspicious = final_risk_score >= HYBRID_RISK_THRESHOLD

        return HybridAnomalyResult(
            rule_score=round(rule_score, 2),
            ml_score=round(ml_score, 2),
            isolation_forest_score=round(iso_score, 2),
            dbscan_is_outlier=dbscan_is_outlier,
            final_risk_score=final_risk_score,
            is_suspicious=is_suspicious,
            detection_methods=detection_methods or ["none"],
            explanations=explanations,
            model_version=self.model_manager.isolation_forest.version if self.model_manager.isolation_forest.is_trained else None,
            feature_snapshot=feature_vector.model_dump(),
        )
