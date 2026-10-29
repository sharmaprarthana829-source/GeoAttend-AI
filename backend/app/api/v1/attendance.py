"""Timetable-linked Attendance API — Phase 7

Faculty: start/close sessions, view live attendance
Student: view active sessions, check-in, attendance history
Admin: monitor sessions and records
"""

import csv
import io
from datetime import date, datetime, time, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import (
    AttendanceRecord,
    AttendanceSession,
    AttendanceStatus,
    College,
    FacultyAssignment,
    FacultyProfile,
    QRSession,
    SessionStatus,
    StudentProfile,
    SubjectOffering,
    User,
    UserRole,
)
from app.schemas import (
    AdminAnalyticsResponse,
    AttendanceMonitorStats,
    AttendanceOverrideRequest,
    AttendanceRecordDetailRead,
    AttendanceRecordRead,
    AttendanceSessionDetailRead,
    AttendanceSessionRead,
    CheckInRequest,
    DashboardStats,
    QRSessionRead,
    StartSessionRequest,
    StudentAttendanceSummary,
)
from app.services.attendance import AttendanceService

router = APIRouter(prefix="/attendance", tags=["attendance"])


# ── Dashboard ────────────────────────────────────────────────────────
@router.get("/dashboard/stats", response_model=DashboardStats)
def dashboard_stats(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    today = datetime.now(timezone.utc).date()
    today_start = datetime.combine(today, time.min).replace(tzinfo=timezone.utc)
    return DashboardStats(
        total_colleges=db.query(func.count(College.id)).scalar() or 0,
        total_students=db.query(func.count(StudentProfile.id)).scalar() or 0,
        total_faculty=db.query(func.count(FacultyProfile.id)).scalar() or 0,
        active_sessions=db.query(func.count(AttendanceSession.id))
        .filter(AttendanceSession.status == SessionStatus.ACTIVE)
        .scalar()
        or 0,
        today_attendance_count=db.query(func.count(AttendanceRecord.id))
        .filter(AttendanceRecord.marked_at >= today_start)
        .scalar()
        or 0,
    )


# ── Faculty: Start Session ───────────────────────────────────────────
@router.post("/sessions/start", response_model=AttendanceSessionRead, status_code=status.HTTP_201_CREATED)
def start_session(
    payload: StartSessionRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
):
    try:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        return AttendanceService.start_session(db, faculty, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ── Faculty: View Active Session Detail ──────────────────────────────
@router.get("/sessions/{session_id}", response_model=AttendanceSessionDetailRead)
def get_session(
    session_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    session = (
        db.query(AttendanceSession)
        .options(
            joinedload(AttendanceSession.subject_offering).joinedload(SubjectOffering.subject),
            joinedload(AttendanceSession.faculty_assignment).joinedload(FacultyAssignment.faculty).joinedload(FacultyProfile.user),
            joinedload(AttendanceSession.section),
            joinedload(AttendanceSession.student_group),
        )
        .filter(AttendanceSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Faculty can only see their own sessions
    if current_user.role == UserRole.FACULTY:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        if session.faculty_id != faculty.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your session")

    # Students can only see sessions they are eligible for
    if current_user.role == UserRole.STUDENT:
        from app.services.attendance import is_student_eligible
        student = AttendanceService.get_student_profile(db, current_user)
        if not is_student_eligible(db, student, session):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not eligible for this session")

    return AttendanceService.get_session_detail(db, session)


# ── Faculty: View Session Records ────────────────────────────────────
@router.get("/sessions/{session_id}/records", response_model=list[AttendanceRecordDetailRead])
def session_records(
    session_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN))],
):
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if current_user.role == UserRole.FACULTY:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        if session.faculty_id != faculty.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your session")

    return AttendanceService.get_session_records(db, session_id)


# ── Faculty: Rotate QR ──────────────────────────────────────────────
@router.post("/sessions/{session_id}/qr", response_model=QRSessionRead)
def rotate_qr(
    session_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
):
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.status != SessionStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is not active")

    faculty = AttendanceService.get_faculty_profile(db, current_user)
    if session.faculty_id != faculty.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your session")

    qr = AttendanceService.rotate_qr(db, session)
    db.commit()
    return QRSessionRead(
        id=qr.id,
        token=qr.token,
        expires_at=qr.expires_at,
        is_active=qr.is_active,
        qr_payload=f"geoattend://checkin?token={qr.token}&session={session.id}",
    )


# ── Faculty/Admin: Close Session ─────────────────────────────────────
@router.post("/sessions/{session_id}/close", response_model=AttendanceSessionRead)
def close_session(
    session_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN))],
):
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if current_user.role == UserRole.FACULTY:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        if session.faculty_id != faculty.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your session")

    if session.status != SessionStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is not active")

    result = AttendanceService.close_session(db, session)

    if current_user.role == UserRole.ADMIN:
        from app.services.audit import AuditService
        AuditService.log_action(
            db=db,
            user=current_user,
            action="SESSION_CLOSE_ADMIN",
            entity_type="ATTENDANCE_SESSION",
            entity_id=session.id,
            metadata={"session_id": session.id, "closed_by": "ADMIN"},
            reason="Session ended from Attendance Monitor dashboard",
        )

    return result


# ── Faculty: My Sessions History ─────────────────────────────────────
@router.get("/faculty/sessions", response_model=list[AttendanceSessionDetailRead])
def faculty_sessions(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
    status_filter: SessionStatus | None = None,
):
    faculty = AttendanceService.get_faculty_profile(db, current_user)
    return AttendanceService.get_faculty_sessions(db, faculty.id, status_filter)


# ── Student: Active Sessions ─────────────────────────────────────────
@router.get("/student/active-sessions", response_model=list[AttendanceSessionDetailRead])
def student_active_sessions(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.STUDENT))],
):
    student = AttendanceService.get_student_profile(db, current_user)
    return AttendanceService.get_active_sessions_for_student(db, student)


# ── Student: Check-In ────────────────────────────────────────────────
@router.post("/check-in", response_model=AttendanceRecordRead, status_code=status.HTTP_201_CREATED)
def check_in(
    payload: CheckInRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.STUDENT))],
):
    try:
        student = AttendanceService.get_student_profile(db, current_user)
        return AttendanceService.check_in(db, student, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ── Student: My Attendance History ───────────────────────────────────
@router.get("/student/history", response_model=list[AttendanceRecordRead])
def student_history(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.STUDENT))],
):
    student = AttendanceService.get_student_profile(db, current_user)
    return AttendanceService.get_student_attendance_history(db, student.id)


# ── Student: Subject-wise Summary ────────────────────────────────────
@router.get("/student/summary", response_model=list[StudentAttendanceSummary])
def student_summary(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.STUDENT))],
):
    student = AttendanceService.get_student_profile(db, current_user)
    return AttendanceService.get_student_summary(db, student.id)


# ── Admin: Attendance Monitor Dynamic Stats ─────────────────────────
@router.get("/admin/monitor-stats", response_model=AttendanceMonitorStats)
def admin_monitor_stats(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    return AttendanceService.get_monitor_stats(db)


# ── Admin: Monitor Active & Filtered Sessions ───────────────────────
@router.get("/admin/sessions", response_model=list[AttendanceSessionDetailRead])
def admin_sessions(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
    status: SessionStatus | None = None,
    status_filter: SessionStatus | None = None,
    department_id: int | None = None,
    session_date: date | None = None,
    query: str | None = None,
    faculty_id: int | None = None,
    section_id: int | None = None,
):
    effective_status = status if status is not None else status_filter
    return AttendanceService.list_admin_sessions(
        db=db,
        status=effective_status,
        department_id=department_id,
        session_date=session_date,
        query_str=query,
        faculty_id=faculty_id,
        section_id=section_id,
    )


# ── Admin: View Any Session Records ─────────────────────────────────
@router.get("/admin/sessions/{session_id}/records", response_model=list[AttendanceRecordDetailRead])
def admin_session_records(
    session_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return AttendanceService.get_session_records(db, session_id)


# ── Admin: Campus-wide Searchable Records ────────────────────────────
@router.get("/admin/records")
def admin_all_records(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
    student_id: int | None = None,
    session_id: int | None = None,
    section_id: int | None = None,
    department_id: int | None = None,
    status: str | None = None,
    status_filter: str | None = None,
    is_suspicious: bool | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    query: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    effective_status = status if status is not None else status_filter
    return AttendanceService.list_admin_records(
        db=db,
        student_id=student_id,
        session_id=session_id,
        section_id=section_id,
        department_id=department_id,
        status=effective_status,
        is_suspicious=is_suspicious,
        date_from=date_from,
        date_to=date_to,
        query_str=query,
        limit=limit,
        offset=offset,
    )


# ── Admin: Record Audit History ──────────────────────────────────────
@router.get("/records/{record_id}/history")
def record_audit_history(
    record_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    from app.models import AuditLog
    logs = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.user))
        .filter(
            AuditLog.entity_type == "ATTENDANCE_RECORD",
            AuditLog.entity_id == record_id,
        )
        .order_by(AuditLog.created_at.desc())
        .all()
    )
    history = []
    for log in logs:
        meta = {}
        if log.metadata_json:
            try:
                import json
                meta = json.loads(log.metadata_json)
            except Exception:
                pass
        history.append({
            "id": log.id,
            "action": log.action,
            "user_id": log.user_id,
            "user_name": log.user.full_name if log.user else "System",
            "user_email": log.user.email if log.user else None,
            "user_role": log.user.role.value if (log.user and hasattr(log.user.role, "value")) else str(log.user.role) if log.user else None,
            "reason": log.reason,
            "old_status": meta.get("old_status"),
            "new_status": meta.get("new_status"),
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return history


# ── Admin: Attendance Override ──────────────────────────────────────
@router.post("/records/{record_id}/override", response_model=AttendanceRecordRead)
def override_attendance_record(
    record_id: int,
    payload: AttendanceOverrideRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AttendanceService.override_attendance(
            db=db,
            record_id=record_id,
            new_status=payload.status,
            reason=payload.reason,
            admin_user=current_user,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ── Admin: Comprehensive Analytics ──────────────────────────────────
@router.get("/admin/analytics", response_model=AdminAnalyticsResponse)
def admin_analytics(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    from app.models import (
        AcademicEnrollment,
        AttendanceApplication,
        Branch,
        Course,
        Department,
        ReviewStatus,
        Subject,
        SuspiciousActivity,
    )

    today = datetime.now(timezone.utc).date()
    today_start = datetime.combine(today, time.min).replace(tzinfo=timezone.utc)
    today_end = datetime.combine(today, time.max).replace(tzinfo=timezone.utc)

    total_students = db.query(func.count(StudentProfile.id)).scalar() or 0
    total_faculty = db.query(func.count(FacultyProfile.id)).scalar() or 0
    total_departments = db.query(func.count(Department.id)).scalar() or 0
    total_courses = db.query(func.count(Course.id)).scalar() or 0
    total_subjects = db.query(func.count(Subject.id)).scalar() or 0

    total_active_sessions = (
        db.query(func.count(AttendanceSession.id))
        .filter(AttendanceSession.status == SessionStatus.ACTIVE)
        .scalar()
        or 0
    )

    today_sessions_count = (
        db.query(func.count(AttendanceSession.id))
        .filter(
            AttendanceSession.started_at >= today_start,
            AttendanceSession.started_at <= today_end,
        )
        .scalar()
        or 0
    )

    today_attendance_count = (
        db.query(func.count(AttendanceRecord.id))
        .filter(
            AttendanceRecord.marked_at >= today_start,
            AttendanceRecord.marked_at <= today_end,
        )
        .scalar()
        or 0
    )

    total_records = db.query(func.count(AttendanceRecord.id)).scalar() or 0
    present_records = (
        db.query(func.count(AttendanceRecord.id))
        .filter(AttendanceRecord.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE]))
        .scalar()
        or 0
    )
    overall_percentage = (
        round((present_records / total_records * 100), 1) if total_records > 0 else 0.0
    )

    pending_apps = (
        db.query(func.count(AttendanceApplication.id))
        .filter(AttendanceApplication.status.in_(["pending_faculty", "pending_hod"]))
        .scalar()
        or 0
    )

    total_suspicious = db.query(func.count(SuspiciousActivity.id)).scalar() or 0
    high_risk = (
        db.query(func.count(SuspiciousActivity.id))
        .filter(SuspiciousActivity.risk_score >= 70.0)
        .scalar()
        or 0
    )

    # Department breakdown calculated from real database relations
    dept_stats = []
    departments = (
        db.query(Department)
        .filter(Department.is_active.is_(True))
        .order_by(Department.name.asc())
        .all()
    )
    for d in departments:
        # Count distinct enrolled students in this department's branches
        st_count = (
            db.query(func.count(func.distinct(AcademicEnrollment.student_id)))
            .join(Branch, AcademicEnrollment.branch_id == Branch.id)
            .filter(Branch.department_id == d.id, AcademicEnrollment.is_current.is_(True))
            .scalar()
            or 0
        )

        # Department attendance: records for sessions linked to subjects in this department
        dept_total = (
            db.query(func.count(AttendanceRecord.id))
            .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
            .join(Subject, AttendanceSession.subject_id == Subject.id)
            .filter(Subject.department_id == d.id)
            .scalar()
            or 0
        )
        dept_present = (
            db.query(func.count(AttendanceRecord.id))
            .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
            .join(Subject, AttendanceSession.subject_id == Subject.id)
            .filter(
                Subject.department_id == d.id,
                AttendanceRecord.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE]),
            )
            .scalar()
            or 0
        )
        rate = round((dept_present / dept_total * 100), 1) if dept_total > 0 else 0.0

        dept_stats.append({
            "department_id": d.id,
            "department_name": d.name,
            "department_code": d.code,
            "student_count": st_count,
            "attendance_rate": rate,
        })

    # Real weekday attendance trend computed from AttendanceRecord.marked_at
    weekday_labels = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    weekday_totals = {i: 0 for i in range(5)}
    weekday_presents = {i: 0 for i in range(5)}

    marked_records = (
        db.query(AttendanceRecord.status, AttendanceRecord.marked_at)
        .filter(AttendanceRecord.marked_at.isnot(None))
        .all()
    )
    for rec_status, marked_at in marked_records:
        if marked_at:
            w_idx = marked_at.weekday()
            if 0 <= w_idx <= 4:
                weekday_totals[w_idx] += 1
                if rec_status in [AttendanceStatus.PRESENT, AttendanceStatus.LATE]:
                    weekday_presents[w_idx] += 1

    attendance_by_day = [
        {
            "day": weekday_labels[i],
            "rate": (
                round((weekday_presents[i] / weekday_totals[i] * 100), 1)
                if weekday_totals[i] > 0
                else 0.0
            ),
        }
        for i in range(5)
    ]

    pending_review_cnt = (
        db.query(func.count(SuspiciousActivity.id))
        .filter(SuspiciousActivity.review_status == ReviewStatus.PENDING)
        .scalar()
        or 0
    )
    dismissed_cnt = (
        db.query(func.count(SuspiciousActivity.id))
        .filter(SuspiciousActivity.review_status == ReviewStatus.DISMISSED)
        .scalar()
        or 0
    )
    confirmed_fraud_cnt = (
        db.query(func.count(SuspiciousActivity.id))
        .filter(SuspiciousActivity.review_status == ReviewStatus.CONFIRMED)
        .scalar()
        or 0
    )

    risk_dist = {
        "low_risk": max(0, total_suspicious - high_risk),
        "high_risk": high_risk,
        "pending_review": pending_review_cnt,
        "dismissed": dismissed_cnt,
        "confirmed_fraud": confirmed_fraud_cnt,
    }

    return AdminAnalyticsResponse(
        total_students=total_students,
        total_faculty=total_faculty,
        total_departments=total_departments,
        total_courses=total_courses,
        total_subjects=total_subjects,
        total_active_sessions=total_active_sessions,
        today_sessions_count=today_sessions_count,
        today_attendance_count=today_attendance_count,
        overall_attendance_percentage=overall_percentage,
        pending_applications=pending_apps,
        total_suspicious_activities=total_suspicious,
        high_risk_anomalies=high_risk,
        department_attendance=dept_stats,
        attendance_by_day=attendance_by_day,
        risk_distribution=risk_dist,
    )


# ── Admin: Export Authorized Attendance Records CSV ───────────────────
@router.get("/admin/export-csv")
def export_attendance_csv(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    """Export authorized attendance dataset as CSV for administrators."""
    from app.models import Subject

    records = (
        db.query(AttendanceRecord)
        .options(
            joinedload(AttendanceRecord.student).joinedload(StudentProfile.user),
            joinedload(AttendanceRecord.session).joinedload(AttendanceSession.subject),
        )
        .order_by(AttendanceRecord.marked_at.desc())
        .limit(5000)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Record ID",
        "Date",
        "Time (UTC)",
        "Student Name",
        "Roll Number",
        "Subject Code",
        "Subject Name",
        "Attendance Status",
        "Verification Status",
        "Suspicious",
        "Suspicion Reason",
        "Distance (m)",
    ])

    for r in records:
        marked_at = r.marked_at
        date_str = marked_at.strftime("%Y-%m-%d") if marked_at else "N/A"
        time_str = marked_at.strftime("%H:%M:%S") if marked_at else "N/A"
        student_name = r.student.user.full_name if r.student and r.student.user else "N/A"
        roll_number = r.student.roll_number if r.student else "N/A"
        subject_code = r.session.subject.code if r.session and r.session.subject else "N/A"
        subject_name = r.session.subject.name if r.session and r.session.subject else "N/A"
        status_val = r.status.value if hasattr(r.status, "value") else str(r.status)
        is_suspicious_val = "Yes" if r.is_suspicious else "No"
        suspicion_reason_val = r.suspicion_reason or "None"
        distance_val = f"{r.distance_meters:.1f}" if r.distance_meters is not None else "N/A"
        verif_status = "Manually Adjusted" if r.is_manually_adjusted else "Verified Check-in"

        writer.writerow([
            r.id,
            date_str,
            time_str,
            student_name,
            roll_number,
            subject_code,
            subject_name,
            status_val,
            verif_status,
            is_suspicious_val,
            suspicion_reason_val,
            distance_val,
        ])

    output.seek(0)
    filename = f"GeoAttend_Attendance_Export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )

