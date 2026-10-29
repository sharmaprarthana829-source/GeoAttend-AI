"""Suspicious Activity & Anomaly Detection API — Phase 8

Provides role-based endpoints for Faculty and Admin to monitor, inspect,
and review suspicious attendance activities and risk scores.
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import (
    AttendanceSession,
    DetectionMethod,
    FacultyProfile,
    ReviewStatus,
    SuspiciousActivity,
    User,
    UserRole,
)
from app.schemas import (
    ReviewSuspiciousActivityRequest,
    SuspiciousActivityDetailRead,
    SuspiciousActivityHistoryItem,
    SuspiciousActivityStats,
)
from app.services.anomaly import AnomalyService
from app.services.attendance import AttendanceService

router = APIRouter(prefix="/anomaly", tags=["anomaly"])


# ── Shared: Summary Statistics for Dashboard KPI Cards ──────────────
@router.get("/stats", response_model=SuspiciousActivityStats)
def get_anomaly_stats(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN))],
):
    """Returns dynamic KPI counts for total, pending, high risk, confirmed, false positives, and data quality issues."""
    faculty_id = None
    if current_user.role == UserRole.FACULTY:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        faculty_id = faculty.id
    return AnomalyService.get_anomaly_stats(db=db, faculty_id=faculty_id)


# ── Faculty: List Own Suspicious Activities ──────────────────────────
@router.get("/faculty", response_model=list[SuspiciousActivityDetailRead])
def get_faculty_anomalies(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
    review_status: ReviewStatus | None = None,
    detection_method: DetectionMethod | None = None,
    session_id: int | None = None,
    student_id: int | None = None,
    query: str | None = None,
    severity: str | None = None,
):
    faculty = AttendanceService.get_faculty_profile(db, current_user)
    return AnomalyService.list_faculty_anomalies(
        db=db,
        faculty_id=faculty.id,
        review_status=review_status,
        detection_method=detection_method,
        session_id=session_id,
        student_id=student_id,
        query_str=query,
        severity=severity,
    )


# ── Admin: List All Suspicious Activities with Filters ───────────────
@router.get("/admin", response_model=list[SuspiciousActivityDetailRead])
def get_admin_anomalies(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
    student_id: int | None = None,
    faculty_id: int | None = None,
    department_id: int | None = None,
    session_id: int | None = None,
    review_status: ReviewStatus | None = None,
    detection_method: DetectionMethod | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    query: str | None = None,
    severity: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    limit: int = 100,
    offset: int = 0,
):
    return AnomalyService.list_admin_anomalies(
        db=db,
        student_id=student_id,
        faculty_id=faculty_id,
        department_id=department_id,
        session_id=session_id,
        review_status=review_status,
        detection_method=detection_method,
        start_date=start_date,
        end_date=end_date,
        query_str=query,
        severity=severity,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
    )


# ── ML: Inspection Status Endpoint (Phase 13) ───────────────────────
from app.ml.model_manager import ModelManager
from app.ml.schemas import MLModelStatus


@router.get("/ml/status", response_model=MLModelStatus)
def get_ml_status(
    _: Annotated[User, Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN))],
):
    """Exposes trained ML model status, version, and readiness metadata."""
    manager = ModelManager.get_instance()
    return manager.get_status()


# ── Shared: Get Specific Suspicious Activity Detail ─────────────────
@router.get("/{activity_id}", response_model=SuspiciousActivityDetailRead)
def get_anomaly_detail(
    activity_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN))],
):
    activity = db.query(SuspiciousActivity).filter(SuspiciousActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suspicious activity not found")

    # If faculty, verify ownership of the associated attendance session
    if current_user.role == UserRole.FACULTY:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        session = db.query(AttendanceSession).filter(AttendanceSession.id == activity.session_id).first()
        if not session or session.faculty_id != faculty.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view suspicious activities for another faculty's session",
            )

    return AnomalyService.get_activity_detail(db, activity)


# ── Shared: Get Audit Trail History for Suspicious Activity ──────────
@router.get("/{activity_id}/history", response_model=list[SuspiciousActivityHistoryItem])
def get_anomaly_history(
    activity_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN))],
):
    """Returns chronological audit trail of all review decisions and notes for this flag."""
    activity = db.query(SuspiciousActivity).filter(SuspiciousActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suspicious activity not found")

    if current_user.role == UserRole.FACULTY:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        session = db.query(AttendanceSession).filter(AttendanceSession.id == activity.session_id).first()
        if not session or session.faculty_id != faculty.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view review history for another faculty's session",
            )

    return AnomalyService.get_activity_history(db, activity_id)


# ── Shared: Review / Update Status of Suspicious Activity ────────────
@router.post("/{activity_id}/review", response_model=SuspiciousActivityDetailRead)
@router.patch("/{activity_id}/review", response_model=SuspiciousActivityDetailRead)
def review_anomaly(
    activity_id: int,
    payload: ReviewSuspiciousActivityRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN))],
):
    activity = db.query(SuspiciousActivity).filter(SuspiciousActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suspicious activity not found")

    # If faculty, verify ownership of the associated attendance session
    if current_user.role == UserRole.FACULTY:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        session = db.query(AttendanceSession).filter(AttendanceSession.id == activity.session_id).first()
        if not session or session.faculty_id != faculty.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to review suspicious activities for another faculty's session",
            )

    reviewed = AnomalyService.review_activity(
        db=db,
        activity=activity,
        reviewer_user=current_user,
        payload=payload,
    )
    return AnomalyService.get_activity_detail(db, reviewed)

