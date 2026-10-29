import json
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models import (
    AcademicEnrollment,
    AttendanceRecord,
    AttendanceSession,
    AttendanceStatus,
    AuditLog,
    Branch,
    Department,
    DetectionMethod,
    FacultyAssignment,
    FacultyProfile,
    ReviewStatus,
    Section,
    StudentProfile,
    Subject,
    SubjectOffering,
    SuspiciousActivity,
    TimetableEntry,
    User,
)
from app.schemas import (
    ReviewSuspiciousActivityRequest,
    SuspiciousActivityDetailRead,
    SuspiciousActivityHistoryItem,
    SuspiciousActivityStats,
)


def get_severity_label(risk_score: float) -> str:
    """Return standardized severity tier: low, medium, high, critical."""
    if risk_score >= 90.0:
        return "critical"
    elif risk_score >= 70.0:
        return "high"
    elif risk_score >= 40.0:
        return "medium"
    return "low"


def check_data_quality_issue(reason: str | None, raw_signals: str | None) -> tuple[bool, str | None]:
    """Inspect reason string and raw payload for negative durations or data quality flags."""
    if reason:
        r_lower = reason.lower()
        if "-" in reason and ("-19799" in reason or "within -" in reason or "negative interval" in r_lower):
            return True, "Chronological inconsistency: Negative elapsed time between session start and check-in (clock skew or timezone discrepancy)."
        if "data_quality" in r_lower or "clock skew" in r_lower or "chronological" in r_lower:
            return True, reason

    if raw_signals:
        try:
            parsed = json.loads(raw_signals) if isinstance(raw_signals, str) else raw_signals
            if isinstance(parsed, dict):
                if parsed.get("is_data_quality_issue"):
                    notes = parsed.get("data_quality_notes", [])
                    return True, notes[0] if notes else "Data quality issue recorded in raw signals."
                elapsed = parsed.get("elapsed_seconds")
                if elapsed is not None and elapsed < 0:
                    return True, f"Negative duration detected ({elapsed}s) between session start and check-in."
        except Exception:
            pass

    return False, None


class AnomalyService:
    @staticmethod
    def evaluate_checkin(
        db: Session,
        record: AttendanceRecord,
        session: AttendanceSession,
        verifications: list[dict[str, Any]],
        elapsed_seconds: float,
    ) -> SuspiciousActivity | None:
        """Evaluate a check-in against deterministic anomaly detection rules.

        Returns a SuspiciousActivity instance if risk threshold is met, else None.
        Does NOT change record status to ABSENT.
        """
        signals: list[dict[str, Any]] = []

        # ── Rule 1: Duplicate Device Detection ───────────────────────────
        if record.device_id:
            duplicate_record = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.session_id == session.id,
                    AttendanceRecord.device_id == record.device_id,
                    AttendanceRecord.student_id != record.student_id,
                )
                .first()
            )
            if duplicate_record:
                signals.append(
                    {
                        "rule": "DUPLICATE_DEVICE",
                        "method": DetectionMethod.DEVICE,
                        "score": 45.0,
                        "detail": f"Duplicate device ID '{record.device_id}' used by multiple students in this session",
                    }
                )

        # ── Rule 2: GPS Boundary / Missing Signal Anomaly ────────────────
        if session.geofence_latitude is not None and session.geofence_longitude is not None:
            radius = session.geofence_radius_meters or 100
            if record.distance_meters is not None:
                # Borderline distance (> 80% of allowed radius)
                if record.distance_meters > (0.80 * radius):
                    signals.append(
                        {
                            "rule": "GPS_NEAR_BOUNDARY",
                            "method": DetectionMethod.GPS,
                            "score": 30.0,
                            "detail": f"GPS location near geofence boundary ({record.distance_meters:.1f}m / {radius}m radius)",
                        }
                    )
            else:
                # Geofence configured on session but GPS was not provided
                signals.append(
                    {
                        "rule": "GPS_MISSING",
                        "method": DetectionMethod.GPS,
                        "score": 35.0,
                        "detail": "GPS location signal missing for a session with active geofence",
                    }
                )
            # Check if indoor GPS attenuation was compensated by Wi-Fi or accuracy slack
            for v in verifications:
                if isinstance(v, dict) and v.get("status") == "indoor_compensated":
                    fb_reason = v.get("fallback_reason") or "Indoor GPS drift compensated by verified campus Wi-Fi"
                    signals.append(
                        {
                            "rule": "INDOOR_GPS_COMPENSATED",
                            "method": DetectionMethod.WIFI,
                            "score": 30.0,
                            "detail": fb_reason,
                        }
                    )

        # ── Rule 3: Timing Anomaly & Chronological Validation ────────────
        # Validate chronological consistency first before calculating timing-based risk
        if elapsed_seconds is None:
            signals.append(
                {
                    "rule": "TIMESTAMP_MISSING",
                    "method": DetectionMethod.TIMING,
                    "score": 5.0,
                    "detail": "Session start or check-in timestamp is missing; timing evidence unreliable",
                    "is_data_quality": True,
                }
            )
        elif elapsed_seconds < 0.0:
            # Chronological inconsistency: check-in marked before session start
            # Negative duration indicates clock drift, timezone mismatch, or asynchronous clock skew
            # Never treat as bot rapid check-in; flag as data quality anomaly
            signals.append(
                {
                    "rule": "DATA_QUALITY_TIMESTAMP",
                    "method": DetectionMethod.TIMING,
                    "score": 5.0,
                    "detail": f"Chronological inconsistency: Check-in timestamp is {elapsed_seconds:.1f}s relative to session start (negative interval indicates clock skew or timezone mismatch)",
                    "is_data_quality": True,
                }
            )
        elif 0.0 <= elapsed_seconds < 10.0:
            # Genuine rapid check-in (automated script or bot)
            signals.append(
                {
                    "rule": "RAPID_CHECKIN",
                    "method": DetectionMethod.TIMING,
                    "score": 25.0,
                    "detail": f"Rapid check-in within {elapsed_seconds:.1f}s of session start",
                }
            )
        elif elapsed_seconds > 900.0:  # > 15 minutes
            signals.append(
                {
                    "rule": "LATE_CHECKIN",
                    "method": DetectionMethod.TIMING,
                    "score": 15.0,
                    "detail": f"Check-in occurred {elapsed_seconds / 60:.1f} minutes after session start",
                }
            )

        # ── Deterministic Rule Risk Scoring ──────────────────────────────
        rule_score = min(100.0, sum(s["score"] for s in signals)) if signals else 0.0

        # ── AI/ML Hybrid Engine Fusion (Phase 13) ────────────────────────
        from app.ml.hybrid_engine import HybridAnomalyEngine

        hybrid_engine = HybridAnomalyEngine()
        hybrid_res = hybrid_engine.evaluate(
            db=db,
            record=record,
            session=session,
            rule_score=rule_score,
            rule_signals=signals,
            elapsed_seconds=elapsed_seconds,
        )

        # If not suspicious under both rule and ML thresholds, return None
        if not hybrid_res.is_suspicious:
            return None

        # Determine detection method
        distinct_methods = set(hybrid_res.detection_methods)
        if len(distinct_methods) > 1:
            detection_method = DetectionMethod.MULTI_SIGNAL
        elif "device" in distinct_methods:
            detection_method = DetectionMethod.DEVICE
        elif "timing" in distinct_methods:
            detection_method = DetectionMethod.TIMING
        elif "gps" in distinct_methods:
            detection_method = DetectionMethod.GPS
        else:
            detection_method = DetectionMethod.MULTI_SIGNAL

        summary_reason = "; ".join(hybrid_res.explanations) if hybrid_res.explanations else "Anomalous attendance pattern detected"

        is_dq = any(s.get("is_data_quality") for s in signals)
        raw_payload = {
            "risk_score": hybrid_res.final_risk_score,
            "rule_score": hybrid_res.rule_score,
            "ml_score": hybrid_res.ml_score,
            "isolation_forest_score": hybrid_res.isolation_forest_score,
            "dbscan_is_outlier": hybrid_res.dbscan_is_outlier,
            "model_version": hybrid_res.model_version,
            "signals": signals,
            "explanations": hybrid_res.explanations,
            "feature_snapshot": hybrid_res.feature_snapshot,
            "verification_data": verifications,
            "elapsed_seconds": round(elapsed_seconds, 2) if elapsed_seconds is not None else None,
            "is_data_quality_issue": is_dq,
            "data_quality_notes": [s["detail"] for s in signals if s.get("is_data_quality")],
        }

        record.is_suspicious = True
        record.suspicion_reason = summary_reason

        existing_activity = (
            db.query(SuspiciousActivity)
            .filter(SuspiciousActivity.attendance_record_id == record.id)
            .first()
        )
        if existing_activity:
            existing_activity.risk_score = hybrid_res.final_risk_score
            existing_activity.detection_method = detection_method
            existing_activity.reason = summary_reason
            existing_activity.raw_signals = json.dumps(raw_payload)
            db.flush()
            activity = existing_activity
        else:
            activity = SuspiciousActivity(
                attendance_record_id=record.id,
                student_id=record.student_id,
                session_id=session.id,
                risk_score=hybrid_res.final_risk_score,
                detection_method=detection_method,
                reason=summary_reason,
                raw_signals=json.dumps(raw_payload),
                review_status=ReviewStatus.PENDING,
            )
            db.add(activity)
            db.flush()

        if activity.risk_score >= 30.0:
            try:
                from app.services.notification import NotificationService
                NotificationService.dispatch_security_alert_notification(db, activity.id)
            except Exception:
                pass

        return activity

    @staticmethod
    def get_activity_detail(
        db: Session, activity: SuspiciousActivity
    ) -> SuspiciousActivityDetailRead:
        student = db.query(StudentProfile).filter(StudentProfile.id == activity.student_id).first()
        student_user = student.user if student else None

        session = (
            db.query(AttendanceSession)
            .options(
                joinedload(AttendanceSession.subject_offering).joinedload(SubjectOffering.subject),
                joinedload(AttendanceSession.faculty_assignment).joinedload(FacultyAssignment.faculty).joinedload(FacultyProfile.user),
                joinedload(AttendanceSession.section),
                joinedload(AttendanceSession.timetable_entry),
            )
            .filter(AttendanceSession.id == activity.session_id)
            .first()
        )

        subject_name = (
            session.subject_offering.subject.name
            if session and session.subject_offering and session.subject_offering.subject
            else "Unknown"
        )
        subject_code = (
            session.subject_offering.subject.code
            if session and session.subject_offering and session.subject_offering.subject
            else None
        )
        faculty_name = (
            session.faculty_assignment.faculty.user.full_name
            if session and session.faculty_assignment and session.faculty_assignment.faculty and session.faculty_assignment.faculty.user
            else "Unknown"
        )
        section_name = session.section.name if session and session.section else None
        room_number = session.timetable_entry.room_number if session and session.timetable_entry else None

        reviewer = db.query(User).filter(User.id == activity.reviewed_by).first() if activity.reviewed_by else None
        record = db.query(AttendanceRecord).filter(AttendanceRecord.id == activity.attendance_record_id).first()

        is_dq, dq_reason = check_data_quality_issue(activity.reason, activity.raw_signals)
        severity = get_severity_label(activity.risk_score)

        related_count = (
            db.query(SuspiciousActivity)
            .filter(
                SuspiciousActivity.student_id == activity.student_id,
                SuspiciousActivity.id != activity.id,
            )
            .count()
        )

        return SuspiciousActivityDetailRead(
            id=activity.id,
            attendance_record_id=activity.attendance_record_id,
            student_id=activity.student_id,
            student_name=student_user.full_name if student_user else "Unknown",
            student_roll_number=student.roll_number if student else "N/A",
            session_id=activity.session_id,
            subject_name=subject_name,
            subject_code=subject_code,
            section_name=section_name,
            room_number=room_number,
            faculty_name=faculty_name,
            risk_score=activity.risk_score,
            severity=severity,
            detection_method=activity.detection_method,
            reason=activity.reason,
            raw_signals=activity.raw_signals,
            review_status=activity.review_status,
            reviewed_by=activity.reviewed_by,
            reviewer_name=reviewer.full_name if reviewer else None,
            reviewed_at=activity.reviewed_at,
            reviewer_notes=activity.reviewer_notes,
            marked_at=record.marked_at if record else activity.created_at,
            session_started_at=session.started_at if session else None,
            distance_meters=record.distance_meters if record else None,
            device_id=record.device_id if record else None,
            attendance_status=record.status if record else AttendanceStatus.PRESENT,
            is_data_quality_issue=is_dq,
            data_quality_reason=dq_reason,
            related_activities_count=related_count,
            created_at=activity.created_at,
        )

    @staticmethod
    def get_anomaly_stats(db: Session, faculty_id: int | None = None) -> SuspiciousActivityStats:
        query = db.query(SuspiciousActivity)
        if faculty_id is not None:
            query = query.join(AttendanceSession, SuspiciousActivity.session_id == AttendanceSession.id).filter(
                AttendanceSession.faculty_id == faculty_id
            )

        all_activities = query.all()
        total_flagged = len(all_activities)
        pending_reviews = sum(1 for a in all_activities if a.review_status == ReviewStatus.PENDING)
        high_risk = sum(1 for a in all_activities if a.risk_score >= 70.0)
        confirmed_violations = sum(1 for a in all_activities if a.review_status == ReviewStatus.CONFIRMED)
        false_positives = sum(1 for a in all_activities if a.review_status == ReviewStatus.DISMISSED)

        data_quality_issues = 0
        for a in all_activities:
            is_dq, _ = check_data_quality_issue(a.reason, a.raw_signals)
            if is_dq:
                data_quality_issues += 1

        return SuspiciousActivityStats(
            total_flagged=total_flagged,
            pending_reviews=pending_reviews,
            high_risk=high_risk,
            confirmed_violations=confirmed_violations,
            false_positives=false_positives,
            data_quality_issues=data_quality_issues,
        )

    @staticmethod
    def list_faculty_anomalies(
        db: Session,
        faculty_id: int,
        review_status: ReviewStatus | None = None,
        detection_method: DetectionMethod | None = None,
        session_id: int | None = None,
        student_id: int | None = None,
        query_str: str | None = None,
        severity: str | None = None,
    ) -> list[SuspiciousActivityDetailRead]:
        query = (
            db.query(SuspiciousActivity)
            .join(AttendanceSession, SuspiciousActivity.session_id == AttendanceSession.id)
            .filter(AttendanceSession.faculty_id == faculty_id)
        )

        if review_status is not None:
            query = query.filter(SuspiciousActivity.review_status == review_status)
        if detection_method is not None:
            query = query.filter(SuspiciousActivity.detection_method == detection_method)
        if session_id is not None:
            query = query.filter(SuspiciousActivity.session_id == session_id)
        if student_id is not None:
            query = query.filter(SuspiciousActivity.student_id == student_id)

        if severity is not None:
            sev = severity.lower()
            if sev == "critical":
                query = query.filter(SuspiciousActivity.risk_score >= 90.0)
            elif sev == "high":
                query = query.filter(SuspiciousActivity.risk_score >= 70.0, SuspiciousActivity.risk_score < 90.0)
            elif sev == "medium":
                query = query.filter(SuspiciousActivity.risk_score >= 40.0, SuspiciousActivity.risk_score < 70.0)
            elif sev == "low":
                query = query.filter(SuspiciousActivity.risk_score < 40.0)

        if query_str:
            q = query_str.strip()
            num_val = int(q.lstrip("#")) if (q.lstrip("#").isdigit()) else None
            student_profile_sub = (
                db.query(StudentProfile.id)
                .join(User, StudentProfile.user_id == User.id)
                .filter(or_(User.full_name.ilike(f"%{q}%"), StudentProfile.roll_number.ilike(f"%{q}%")))
            )
            conditions = [
                SuspiciousActivity.student_id.in_(student_profile_sub),
                SuspiciousActivity.reason.ilike(f"%{q}%"),
            ]
            if num_val is not None:
                conditions.append(SuspiciousActivity.id == num_val)
                conditions.append(SuspiciousActivity.session_id == num_val)
            query = query.filter(or_(*conditions))

        activities = query.order_by(SuspiciousActivity.created_at.desc()).all()
        return [AnomalyService.get_activity_detail(db, act) for act in activities]

    @staticmethod
    def list_admin_anomalies(
        db: Session,
        student_id: int | None = None,
        faculty_id: int | None = None,
        department_id: int | None = None,
        session_id: int | None = None,
        review_status: ReviewStatus | None = None,
        detection_method: DetectionMethod | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        query_str: str | None = None,
        severity: str | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        limit: int = 100,
        offset: int = 0,
    ) -> list[SuspiciousActivityDetailRead]:
        query = db.query(SuspiciousActivity).join(
            AttendanceSession, SuspiciousActivity.session_id == AttendanceSession.id
        )

        if student_id is not None:
            query = query.filter(SuspiciousActivity.student_id == student_id)
        if faculty_id is not None:
            query = query.filter(AttendanceSession.faculty_id == faculty_id)
        if session_id is not None:
            query = query.filter(SuspiciousActivity.session_id == session_id)
        if review_status is not None:
            query = query.filter(SuspiciousActivity.review_status == review_status)
        if detection_method is not None:
            query = query.filter(SuspiciousActivity.detection_method == detection_method)
        if start_date is not None:
            query = query.filter(func.date(SuspiciousActivity.created_at) >= start_date)
        if end_date is not None:
            query = query.filter(func.date(SuspiciousActivity.created_at) <= end_date)

        if department_id is not None:
            query = (
                query.join(Section, AttendanceSession.section_id == Section.id)
                .join(Branch, Section.branch_id == Branch.id)
                .filter(Branch.department_id == department_id)
            )

        if severity is not None:
            sev = severity.lower()
            if sev == "critical":
                query = query.filter(SuspiciousActivity.risk_score >= 90.0)
            elif sev == "high":
                query = query.filter(SuspiciousActivity.risk_score >= 70.0, SuspiciousActivity.risk_score < 90.0)
            elif sev == "medium":
                query = query.filter(SuspiciousActivity.risk_score >= 40.0, SuspiciousActivity.risk_score < 70.0)
            elif sev == "low":
                query = query.filter(SuspiciousActivity.risk_score < 40.0)

        if query_str:
            q = query_str.strip()
            num_val = int(q.lstrip("#")) if (q.lstrip("#").isdigit()) else None
            student_profile_sub = (
                db.query(StudentProfile.id)
                .join(User, StudentProfile.user_id == User.id)
                .filter(or_(User.full_name.ilike(f"%{q}%"), StudentProfile.roll_number.ilike(f"%{q}%")))
            )
            conditions = [
                SuspiciousActivity.student_id.in_(student_profile_sub),
                SuspiciousActivity.reason.ilike(f"%{q}%"),
            ]
            if num_val is not None:
                conditions.append(SuspiciousActivity.id == num_val)
                conditions.append(SuspiciousActivity.session_id == num_val)
            query = query.filter(or_(*conditions))

        # Sorting
        order_col = SuspiciousActivity.created_at
        if sort_by == "risk_score":
            order_col = SuspiciousActivity.risk_score
        elif sort_by == "id":
            order_col = SuspiciousActivity.id

        if sort_order.lower() == "asc":
            query = query.order_by(order_col.asc())
        else:
            query = query.order_by(order_col.desc())

        activities = query.offset(offset).limit(limit).all()
        return [AnomalyService.get_activity_detail(db, act) for act in activities]

    @staticmethod
    def review_activity(
        db: Session,
        activity: SuspiciousActivity,
        reviewer_user: User,
        payload: ReviewSuspiciousActivityRequest,
    ) -> SuspiciousActivity:
        from app.services.audit import AuditService

        old_status = activity.review_status.value if activity.review_status else "unknown"
        new_status = payload.review_status.value

        activity.review_status = payload.review_status
        activity.reviewed_by = reviewer_user.id
        activity.reviewed_at = datetime.now(timezone.utc)
        if payload.reviewer_notes is not None:
            activity.reviewer_notes = payload.reviewer_notes

        db.commit()
        db.refresh(activity)

        # Audit trail logging
        AuditService.log_action(
            db=db,
            user=reviewer_user,
            action="SUSPICIOUS_ACTIVITY_REVIEW",
            entity_type="SUSPICIOUS_ACTIVITY",
            entity_id=activity.id,
            reason=payload.decision_reason or payload.reviewer_notes,
            metadata={
                "activity_id": activity.id,
                "student_id": activity.student_id,
                "session_id": activity.session_id,
                "old_status": old_status,
                "new_status": new_status,
                "reviewer_notes": payload.reviewer_notes,
                "decision_reason": payload.decision_reason,
                "reviewer_email": reviewer_user.email,
                "reviewer_role": reviewer_user.role.value if hasattr(reviewer_user.role, "value") else str(reviewer_user.role),
            },
        )

        return activity

    @staticmethod
    def get_activity_history(db: Session, activity_id: int) -> list[SuspiciousActivityHistoryItem]:
        logs = (
            db.query(AuditLog)
            .options(joinedload(AuditLog.user))
            .filter(
                AuditLog.entity_type == "SUSPICIOUS_ACTIVITY",
                AuditLog.entity_id == activity_id,
            )
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .all()
        )
        history: list[SuspiciousActivityHistoryItem] = []
        for log in logs:
            meta: dict[str, Any] = {}
            if log.metadata_json:
                try:
                    meta = json.loads(log.metadata_json)
                except Exception:
                    pass
            history.append(
                SuspiciousActivityHistoryItem(
                    id=log.id,
                    action=log.action,
                    user_id=log.user_id,
                    user_name=log.user.full_name if log.user else "System",
                    user_role=meta.get("reviewer_role") or (log.user.role.value if log.user and hasattr(log.user.role, "value") else "unknown"),
                    old_status=meta.get("old_status"),
                    new_status=meta.get("new_status"),
                    reason=log.reason,
                    created_at=log.created_at.isoformat() if log.created_at else None,
                )
            )
        return history

