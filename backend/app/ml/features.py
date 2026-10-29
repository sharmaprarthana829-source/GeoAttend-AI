"""Feature Extraction Pipeline — Phase 13

Deterministically extracts features from check-in events and historical database records.
Uses only real, available database attributes without fabricating data.
"""

from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models import AttendanceRecord, AttendanceSession, AttendanceStatus
from app.ml.schemas import MLFeatureVector


class FeatureExtractor:
    @staticmethod
    def extract_from_checkin(
        db: Session,
        record: AttendanceRecord,
        session: AttendanceSession,
        elapsed_seconds: float,
    ) -> MLFeatureVector:
        """Extract a deterministic feature vector for a live attendance check-in event."""

        # 1. Spatial features
        radius = float(session.geofence_radius_meters or 100.0)
        dist = float(record.distance_meters or 0.0)
        dist_ratio = dist / max(1.0, radius)

        # 2. Temporal features
        elapsed_min = max(0.0, elapsed_seconds / 60.0)
        now_utc = datetime.now(timezone.utc)
        hour = float(now_utc.hour)
        day_of_week = float(now_utc.weekday())

        # 3. Device reuse count in this session
        device_reuse = 0
        if record.device_id:
            device_reuse = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.session_id == session.id,
                    AttendanceRecord.device_id == record.device_id,
                    AttendanceRecord.student_id != record.student_id,
                )
                .count()
            )

        # 4. Student's historical behavior baseline
        hist_total = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.student_id == record.student_id,
                AttendanceRecord.id != record.id,
            )
            .count()
        )

        hist_late = 0
        hist_suspicious = 0
        if hist_total > 0:
            hist_late = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.student_id == record.student_id,
                    AttendanceRecord.id != record.id,
                    AttendanceRecord.status == AttendanceStatus.LATE,
                )
                .count()
            )
            hist_suspicious = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.student_id == record.student_id,
                    AttendanceRecord.id != record.id,
                    AttendanceRecord.is_suspicious.is_(True),
                )
                .count()
            )

        late_ratio = float(hist_late / hist_total) if hist_total > 0 else 0.0
        suspicious_ratio = float(hist_suspicious / hist_total) if hist_total > 0 else 0.0

        # 5. Network and sensor presence
        has_wifi = 1.0 if (record.verification_json and "wifi" in record.verification_json.lower()) else 0.0
        has_gps = 1.0 if (record.latitude is not None and record.longitude is not None) else 0.0

        return MLFeatureVector(
            distance_meters=round(dist, 2),
            distance_ratio=round(dist_ratio, 4),
            elapsed_minutes=round(elapsed_min, 2),
            hour_of_day=hour,
            day_of_week=day_of_week,
            device_reuse_count=device_reuse,
            student_late_ratio=round(late_ratio, 4),
            student_suspicious_ratio=round(suspicious_ratio, 4),
            has_wifi=has_wifi,
            has_gps=has_gps,
        )

    @staticmethod
    def extract_from_historical_record(
        db: Session,
        record: AttendanceRecord,
    ) -> MLFeatureVector:
        """Extracts features for a stored historical attendance record during batch training."""
        session = db.query(AttendanceSession).filter(AttendanceSession.id == record.session_id).first()
        radius = float(session.geofence_radius_meters or 100.0) if session else 100.0
        dist = float(record.distance_meters or 0.0)
        dist_ratio = dist / max(1.0, radius)

        # Elapsed time from marked_at
        elapsed_min = 5.0
        hour = 9.0
        day_of_week = 0.0
        if record.marked_at:
            hour = float(record.marked_at.hour)
            day_of_week = float(record.marked_at.weekday())
            if session and session.started_at and record.marked_at >= session.started_at:
                diff_sec = (record.marked_at - session.started_at).total_seconds()
                elapsed_min = max(0.0, diff_sec / 60.0)

        device_reuse = 0
        if record.device_id:
            device_reuse = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.session_id == record.session_id,
                    AttendanceRecord.device_id == record.device_id,
                    AttendanceRecord.student_id != record.student_id,
                )
                .count()
            )

        hist_total = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.student_id == record.student_id,
                AttendanceRecord.id != record.id,
            )
            .count()
        )

        hist_late = 0
        hist_suspicious = 0
        if hist_total > 0:
            hist_late = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.student_id == record.student_id,
                    AttendanceRecord.id != record.id,
                    AttendanceRecord.status == AttendanceStatus.LATE,
                )
                .count()
            )
            hist_suspicious = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.student_id == record.student_id,
                    AttendanceRecord.id != record.id,
                    AttendanceRecord.is_suspicious.is_(True),
                )
                .count()
            )

        late_ratio = float(hist_late / hist_total) if hist_total > 0 else 0.0
        suspicious_ratio = float(hist_suspicious / hist_total) if hist_total > 0 else 0.0

        has_wifi = 1.0 if (record.verification_json and "wifi" in record.verification_json.lower()) else 0.0
        has_gps = 1.0 if (record.latitude is not None and record.longitude is not None) else 0.0

        return MLFeatureVector(
            distance_meters=round(dist, 2),
            distance_ratio=round(dist_ratio, 4),
            elapsed_minutes=round(elapsed_min, 2),
            hour_of_day=hour,
            day_of_week=day_of_week,
            device_reuse_count=device_reuse,
            student_late_ratio=round(late_ratio, 4),
            student_suspicious_ratio=round(suspicious_ratio, 4),
            has_wifi=has_wifi,
            has_gps=has_gps,
        )

    @classmethod
    def extract_matrix_from_records(
        cls,
        db: Session,
        records: list[AttendanceRecord],
    ) -> tuple[list[list[float]], list[int]]:
        """Extracts a validated numerical matrix and matching record IDs from attendance records.

        Filters out any row that contains non-finite or corrupt features.
        """
        rows: list[list[float]] = []
        valid_ids: list[int] = []

        for rec in records:
            try:
                vec = cls.extract_from_historical_record(db, rec)
                row = vec.to_list()
                if len(row) == 10 and all(isinstance(v, (int, float)) and v == v and abs(v) != float("inf") for v in row):
                    rows.append(row)
                    valid_ids.append(rec.id)
            except Exception:
                continue

        return rows, valid_ids

