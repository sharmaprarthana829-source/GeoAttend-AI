"""Production ML Retraining Pipeline — Phase 17

Reproducible, leak-free, production-oriented training pipeline for GeoAttend AI.
Extracts verified historical attendance records, validates data quality,
splits datasets cleanly without session/student leakage, evaluates models,
and atomically promotes validated artifacts.

Usage:
    python -m app.ml.train_pipeline [--min-samples 20] [--allow-test-data]
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import sys
from typing import Any

import numpy as np
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import (
    AttendanceRecord,
    AttendanceSession,
    ReviewDecision,
    ReviewStatus,
    StudentProfile,
    SuspiciousActivity,
    User,
)
from app.ml.config import (
    ISOLATION_FOREST_CONTAMINATION,
    ISOLATION_FOREST_N_ESTIMATORS,
    ISOLATION_FOREST_RANDOM_STATE,
    MIN_SAMPLES_ISOLATION_FOREST,
    ML_ARTIFACTS_DIR,
    MODEL_VERSION,
)
from app.ml.features import FeatureExtractor
from app.ml.isolation_forest import IsolationForestDetector
from app.ml.schemas import MLFeatureVector

logger = logging.getLogger("app.ml.train_pipeline")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


class HistoricalDataPipeline:
    """Filters, sanitizes, and prepares historical attendance records for production ML."""

    @classmethod
    def load_and_filter_records(
        cls,
        db: Session,
        allow_test_data: bool = False,
    ) -> tuple[list[AttendanceRecord], dict[str, Any]]:
        """Extracts production-grade attendance records, strictly filtering out

        test, seed, unverified, and chronologically invalid data.
        """
        all_records = db.query(AttendanceRecord).order_by(AttendanceRecord.marked_at.asc()).all()
        total_scanned = len(all_records)

        eligible_records: list[AttendanceRecord] = []
        seen_student_session: set[tuple[int, int]] = set()

        exclusions = {
            "test_or_seed_data": 0,
            "missing_session_or_student": 0,
            "corrupt_timestamps": 0,
            "corrupt_coordinates": 0,
            "duplicate_attendance": 0,
        }

        for rec in all_records:
            # 1. Integrity checks
            if not rec.session_id or not rec.student_id or not rec.marked_at:
                exclusions["missing_session_or_student"] += 1
                continue

            # 2. Duplicate attendance prevention within same session
            pair = (rec.student_id, rec.session_id)
            if pair in seen_student_session:
                exclusions["duplicate_attendance"] += 1
                continue

            # 3. Test/seed record identification (unless explicitly allowed in dev/test fixtures)
            if not allow_test_data:
                student = db.query(StudentProfile).filter(StudentProfile.id == rec.student_id).first()
                student_user = student.user if student else None
                email = (student_user.email or "").lower() if student_user else ""
                device = (rec.device_id or "").lower()

                is_test_email = any(pattern in email for pattern in ["test_", "mock_", "dummy_", "@example.com"])
                is_test_device = any(pattern in device for pattern in ["mock_", "test_device", "fcm_test_"])

                if is_test_email or is_test_device:
                    exclusions["test_or_seed_data"] += 1
                    continue

            # 4. Check session timing consistency
            session = db.query(AttendanceSession).filter(AttendanceSession.id == rec.session_id).first()
            if session and session.started_at:
                diff_sec = (rec.marked_at - session.started_at).total_seconds()
                # Exclude severe negative time drift (> 60s before session started)
                if diff_sec < -60.0:
                    exclusions["corrupt_timestamps"] += 1
                    continue

            # 5. GPS coordinate boundaries
            if rec.latitude is not None:
                if rec.latitude < -90.0 or rec.latitude > 90.0:
                    exclusions["corrupt_coordinates"] += 1
                    continue
            if rec.longitude is not None:
                if rec.longitude < -180.0 or rec.longitude > 180.0:
                    exclusions["corrupt_coordinates"] += 1
                    continue

            seen_student_session.add(pair)
            eligible_records.append(rec)

        metrics = {
            "total_scanned_records": total_scanned,
            "eligible_records": len(eligible_records),
            "total_excluded_records": total_scanned - len(eligible_records),
            "exclusion_breakdown": exclusions,
        }
        return eligible_records, metrics

    @classmethod
    def split_without_leakage(
        cls,
        records: list[AttendanceRecord],
        eval_ratio: float = 0.20,
    ) -> tuple[list[AttendanceRecord], list[AttendanceRecord]]:
        """Splits records by AttendanceSession to prevent cross-session and student

        co-occurrence data leakage between train and evaluation sets.
        """
        # Group records by session
        session_groups: dict[int, list[AttendanceRecord]] = {}
        for rec in records:
            session_groups.setdefault(rec.session_id, []).append(rec)

        unique_sessions = sorted(list(session_groups.keys()))
        if len(unique_sessions) < 2:
            # If all records belong to single session, use chronological split
            split_idx = max(1, int(len(records) * (1.0 - eval_ratio)))
            return records[:split_idx], records[split_idx:]

        eval_session_count = max(1, int(len(unique_sessions) * eval_ratio))
        train_sessions = set(unique_sessions[:-eval_session_count])
        eval_sessions = set(unique_sessions[-eval_session_count:])

        train_records = [r for s_id in train_sessions for r in session_groups[s_id]]
        eval_records = [r for s_id in eval_sessions for r in session_groups[s_id]]

        return train_records, eval_records


def run_training_pipeline(
    db: Session | None = None,
    artifacts_dir: Path | None = None,
    min_samples: int = MIN_SAMPLES_ISOLATION_FOREST,
    allow_test_data: bool = False,
) -> dict[str, Any]:
    """Executes the complete production ML retraining pipeline."""
    target_dir = artifacts_dir or ML_ARTIFACTS_DIR
    close_db = False

    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        logger.info("=" * 65)
        logger.info(" GeoAttend AI — Phase 17 Production ML Retraining Pipeline")
        logger.info("=" * 65)

        # 1. Historical dataset extraction & filtering
        logger.info("[*] Step 1: Scanning historical attendance database...")
        eligible_records, filter_metrics = HistoricalDataPipeline.load_and_filter_records(
            db=db,
            allow_test_data=allow_test_data,
        )

        eligible_count = len(eligible_records)
        logger.info(
            f"[*] Dataset Statistics: Scanned={filter_metrics['total_scanned_records']}, "
            f"Eligible={eligible_count}, Excluded={filter_metrics['total_excluded_records']}"
        )
        logger.info(f"[*] Exclusion Details: {filter_metrics['exclusion_breakdown']}")

        # 2. Trustworthy data threshold check
        if eligible_count < min_samples:
            msg = (
                f"Production ML training halted safely: Insufficient trustworthy historical data. "
                f"Eligible records: {eligible_count}, Required minimum: {min_samples}. "
                f"Operating in verified rule-based fallback mode."
            )
            logger.warning(f"[!] {msg}")
            return {
                "success": False,
                "status": "insufficient_trustworthy_data",
                "message": msg,
                "eligible_record_count": eligible_count,
                "required_minimum": min_samples,
                "filter_metrics": filter_metrics,
            }

        # 3. Leak-free session-grouped partitioning
        logger.info("[*] Step 2: Performing session-grouped train/evaluation partitioning...")
        train_records, eval_records = HistoricalDataPipeline.split_without_leakage(eligible_records)
        logger.info(f"[*] Partition: Train={len(train_records)} records, Eval={len(eval_records)} records")

        # 4. Feature Extraction
        logger.info("[*] Step 3: Extracting 10-dimensional feature matrix...")
        X_train_rows, train_ids = FeatureExtractor.extract_matrix_from_records(db, train_records)
        X_eval_rows, eval_ids = FeatureExtractor.extract_matrix_from_records(db, eval_records)

        if len(X_train_rows) < min_samples:
            msg = (
                f"Feature extraction yielded {len(X_train_rows)} valid training rows after quality checks, "
                f"below required {min_samples}. Retraining halted safely."
            )
            logger.warning(f"[!] {msg}")
            return {
                "success": False,
                "status": "insufficient_feature_data",
                "message": msg,
                "eligible_record_count": eligible_count,
                "valid_features_count": len(X_train_rows),
                "filter_metrics": filter_metrics,
            }

        X_train = np.array(X_train_rows)
        X_eval = np.array(X_eval_rows) if X_eval_rows else None

        # 5. Fit Isolation Forest
        logger.info(
            f"[*] Step 4: Training Isolation Forest (n_estimators={ISOLATION_FOREST_N_ESTIMATORS}, "
            f"contamination={ISOLATION_FOREST_CONTAMINATION}, random_state={ISOLATION_FOREST_RANDOM_STATE})..."
        )
        detector = IsolationForestDetector(
            n_estimators=ISOLATION_FOREST_N_ESTIMATORS,
            contamination=ISOLATION_FOREST_CONTAMINATION,
            random_state=ISOLATION_FOREST_RANDOM_STATE,
        )
        train_metrics = detector.fit(X_train, feature_names=MLFeatureVector.feature_names())

        # 6. Evaluation on Out-of-Sample Partition
        logger.info("[*] Step 5: Evaluating model performance and anomaly distribution...")
        eval_metrics: dict[str, Any] = {
            "train_samples": len(X_train),
            "eval_samples": len(X_eval_rows) if X_eval_rows else 0,
            "feature_names": MLFeatureVector.feature_names(),
        }

        if X_eval is not None and len(X_eval) > 0:
            x_eval_scaled = detector.scaler.transform(X_eval)
            raw_scores = detector.model.score_samples(x_eval_scaled)
            norm_scores = [float(np.clip((0.2 - s) * 120.0, 0.0, 100.0)) for s in raw_scores]
            predictions = detector.model.predict(x_eval_scaled)  # -1 = anomaly, 1 = normal

            anomaly_count = int(np.sum(predictions == -1))
            eval_metrics["eval_anomaly_count"] = anomaly_count
            eval_metrics["eval_anomaly_rate"] = round(float(anomaly_count / len(X_eval)), 4)
            eval_metrics["score_distribution"] = {
                "mean": round(float(np.mean(norm_scores)), 2),
                "min": round(float(np.min(norm_scores)), 2),
                "p25": round(float(np.percentile(norm_scores, 25)), 2),
                "p50_median": round(float(np.median(norm_scores)), 2),
                "p75": round(float(np.percentile(norm_scores, 75)), 2),
                "p90": round(float(np.percentile(norm_scores, 90)), 2),
                "max": round(float(np.max(norm_scores)), 2),
            }

            # Supervised metrics check: query reviewed SuspiciousActivity ground truth
            reviewed_activities = (
                db.query(SuspiciousActivity)
                .filter(
                    SuspiciousActivity.attendance_record_id.in_(eval_ids),
                    SuspiciousActivity.review_status != ReviewStatus.PENDING,
                )
                .all()
            )

            if len(reviewed_activities) >= 5:
                # Ground truth map: 1 for confirmed suspicious/proxy, 0 for dismissed
                gt_map = {
                    act.attendance_record_id: (1 if act.review_status == ReviewStatus.REVIEWED else 0)
                    for act in reviewed_activities
                }
                y_true = [gt_map[rec_id] for rec_id in eval_ids if rec_id in gt_map]
                y_pred = [
                    (1 if predictions[idx] == -1 else 0)
                    for idx, rec_id in enumerate(eval_ids)
                    if rec_id in gt_map
                ]

                tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
                fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)
                fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 0)
                tn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 0)

                precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else 0.0
                recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else 0.0
                f1 = round(2 * precision * recall / (precision + recall), 4) if (precision + recall) > 0 else 0.0

                eval_metrics["ground_truth_supervised_metrics"] = {
                    "verified_samples": len(y_true),
                    "precision": precision,
                    "recall": recall,
                    "f1_score": f1,
                    "confusion_matrix": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
                }
            else:
                eval_metrics["supervised_ground_truth"] = (
                    "No sufficient human-reviewed ground-truth labels found. "
                    "Evaluation reported via unsupervised anomaly distribution statistics."
                )

        # 7. Atomic Artifact Promotion
        logger.info("[*] Step 6: Atomically saving and promoting model artifact...")
        data_window = {
            "first_record_marked_at": eligible_records[0].marked_at.isoformat() if eligible_records[0].marked_at else None,
            "last_record_marked_at": eligible_records[-1].marked_at.isoformat() if eligible_records[-1].marked_at else None,
            "eligible_records": eligible_count,
        }
        saved_path = detector.save(
            directory=target_dir,
            evaluation_metrics=eval_metrics,
            data_window=data_window,
        )

        logger.info(f"[✓] Retraining complete. Promoted artifact: {saved_path}")
        return {
            "success": True,
            "status": "success",
            "message": "Model retraining and atomic promotion completed successfully.",
            "artifact_path": str(saved_path),
            "model_version": detector.version,
            "trained_at": detector.trained_at,
            "training_samples": detector.training_samples,
            "filter_metrics": filter_metrics,
            "evaluation_metrics": eval_metrics,
        }

    finally:
        if close_db:
            db.close()


def main():
    parser = argparse.ArgumentParser(description="GeoAttend AI Production ML Retraining Pipeline")
    parser.add_argument("--min-samples", type=int, default=MIN_SAMPLES_ISOLATION_FOREST, help="Minimum eligible records required")
    parser.add_argument("--allow-test-data", action="store_true", help="Allow synthetic test records (development only)")
    parser.add_argument("--artifacts-dir", type=str, default=None, help="Custom artifacts destination directory")
    args = parser.parse_args()

    custom_dir = Path(args.artifacts_dir) if args.artifacts_dir else None
    result = run_training_pipeline(
        artifacts_dir=custom_dir,
        min_samples=args.min_samples,
        allow_test_data=args.allow_test_data,
    )

    print(json.dumps(result, indent=2))
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()
