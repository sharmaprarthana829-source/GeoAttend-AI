"""Attendance Application & Debarment Workflow API — Phase 9

Endpoints:
- Student: submit application, view my applications
- Faculty: view assigned applications, review (approve/reject -> PENDING_HOD)
- HOD (Faculty with HOD responsibility): view department applications, final decision (approve/reject)
- Admin: monitor all applications across departments
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import (
    ApplicationStatus,
    AttendanceApplication,
    FacultyAssignment,
    FacultyProfile,
    StudentProfile,
    SubjectOffering,
    User,
    UserRole,
)
from app.schemas import (
    ApplicationCreate,
    ApplicationDetailRead,
    ApplicationHistoryItem,
    ApplicationRead,
    ApplicationStats,
    CoordinatorReviewRequest,
    FacultyReviewRequest,
    HODReviewRequest,
)
from app.services.application import ApplicationService
from app.services.attendance import AttendanceService

router = APIRouter(prefix="/applications", tags=["applications"])


# ── Shared: Summary Statistics ───────────────────────────────────────
@router.get("/stats", response_model=ApplicationStats)
def get_application_stats(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    faculty_id = None
    student_id = None
    is_admin = current_user.role == UserRole.ADMIN

    if current_user.role == UserRole.FACULTY:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        faculty_id = faculty.id
    elif current_user.role == UserRole.STUDENT:
        student = AttendanceService.get_student_profile(db, current_user)
        student_id = student.id

    return ApplicationService.get_application_stats(
        db=db,
        faculty_id=faculty_id,
        is_admin=is_admin,
        student_id=student_id,
    )


# ── Student: Submit Application ──────────────────────────────────────
@router.post("", response_model=ApplicationDetailRead, status_code=status.HTTP_201_CREATED)
def submit_application(
    payload: ApplicationCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.STUDENT))],
):
    try:
        student = AttendanceService.get_student_profile(db, current_user)
        app = ApplicationService.submit_application(db, student, payload)
        return ApplicationService.get_application_detail(db, app)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ── Student: My Applications ─────────────────────────────────────────
@router.get("/my", response_model=list[ApplicationDetailRead])
def get_my_applications(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.STUDENT))],
    status_filter: ApplicationStatus | None = Query(default=None, alias="status"),
    application_type: str | None = None,
    query: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = 100,
    offset: int = 0,
):
    student = AttendanceService.get_student_profile(db, current_user)
    return ApplicationService.list_student_applications(
        db=db,
        student_id=student.id,
        status=status_filter,
        application_type=application_type,
        query_str=query,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )


# ── Faculty: View Assigned Applications ──────────────────────────────
@router.get("/faculty", response_model=list[ApplicationDetailRead])
def get_faculty_applications(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
    status_filter: ApplicationStatus | None = Query(default=None, alias="status"),
    application_type: str | None = None,
    query: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = 100,
    offset: int = 0,
):
    faculty = AttendanceService.get_faculty_profile(db, current_user)
    return ApplicationService.list_faculty_applications(
        db=db,
        faculty_id=faculty.id,
        status=status_filter,
        application_type=application_type,
        query_str=query,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )


# ── Faculty: Review Application (Approve -> PENDING_HOD / Reject) ───
@router.patch("/{application_id}/faculty-review", response_model=ApplicationDetailRead)
@router.put("/{application_id}/faculty-review", response_model=ApplicationDetailRead)
def review_faculty_application(
    application_id: int,
    payload: FacultyReviewRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
):
    try:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        app = ApplicationService.review_faculty_application(db, application_id, faculty, payload)
        return ApplicationService.get_application_detail(db, app)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ── Section Coordinator: View Section Applications ───────────────────
@router.get("/coordinator", response_model=list[ApplicationDetailRead])
def get_coordinator_applications(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
    status_filter: ApplicationStatus | None = Query(default=None, alias="status"),
    application_type: str | None = None,
    query: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = 100,
    offset: int = 0,
):
    try:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        return ApplicationService.list_coordinator_applications(
            db=db,
            faculty_id=faculty.id,
            status=status_filter,
            application_type=application_type,
            query_str=query,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            offset=offset,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ── Section Coordinator: Review Application (Approve -> PENDING_HOD / Reject) ──
@router.patch("/{application_id}/coordinator-review", response_model=ApplicationDetailRead)
@router.put("/{application_id}/coordinator-review", response_model=ApplicationDetailRead)
def review_coordinator_application(
    application_id: int,
    payload: CoordinatorReviewRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
):
    try:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        app = ApplicationService.review_coordinator_application(db, application_id, faculty, payload)
        return ApplicationService.get_application_detail(db, app)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ── HOD: View Department Applications ────────────────────────────────
@router.get("/hod", response_model=list[ApplicationDetailRead])
def get_hod_applications(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
    status_filter: ApplicationStatus | None = Query(default=None, alias="status"),
    application_type: str | None = None,
    query: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = 100,
    offset: int = 0,
):
    try:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        return ApplicationService.list_hod_applications(
            db=db,
            faculty_id=faculty.id,
            status=status_filter,
            application_type=application_type,
            query_str=query,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            offset=offset,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ── HOD: Final Decision ──────────────────────────────────────────────
@router.patch("/{application_id}/hod-decision", response_model=ApplicationDetailRead)
@router.put("/{application_id}/hod-decision", response_model=ApplicationDetailRead)
def review_hod_decision(
    application_id: int,
    payload: HODReviewRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
):
    try:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        app = ApplicationService.review_hod_application(db, application_id, faculty, payload)
        return ApplicationService.get_application_detail(db, app)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ── Admin: Monitor Applications ──────────────────────────────────────
@router.get("/admin", response_model=list[ApplicationDetailRead])
def get_admin_applications(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
    student_id: int | None = None,
    department_id: int | None = None,
    status_filter: ApplicationStatus | None = Query(default=None, alias="status"),
    application_type: str | None = None,
    query: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = 100,
    offset: int = 0,
):
    return ApplicationService.list_admin_applications(
        db=db,
        student_id=student_id,
        department_id=department_id,
        status=status_filter,
        application_type=application_type,
        query_str=query,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )


# ── Shared: View Application Audit History ───────────────────────────
@router.get("/{application_id}/history", response_model=list[ApplicationHistoryItem])
def get_application_history(
    application_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    app = db.query(AttendanceApplication).filter(AttendanceApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if current_user.role == UserRole.STUDENT:
        student = AttendanceService.get_student_profile(db, current_user)
        if app.student_id != student.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your application")
    elif current_user.role == UserRole.FACULTY:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        is_assigned = (
            db.query(FacultyAssignment)
            .filter(
                FacultyAssignment.faculty_id == faculty.id,
                FacultyAssignment.subject_offering_id == app.subject_offering_id,
                FacultyAssignment.is_active.is_(True),
            )
            .first()
        )
        coord_secs = ApplicationService.get_coordinator_sections(db, faculty.id)
        offering = db.query(SubjectOffering).filter(SubjectOffering.id == app.subject_offering_id).first()
        is_coordinator = bool(offering and offering.section_id in coord_secs)

        is_hod = False
        try:
            hod_resp = ApplicationService.get_hod_responsibility(db, faculty.id)
            if offering and offering.branch and offering.branch.department_id == hod_resp.department_id:
                is_hod = True
        except Exception:
            is_hod = False

        if not is_assigned and not is_coordinator and not is_hod:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view history for this application",
            )

    return ApplicationService.get_application_history(db, application_id)


# ── Shared: View Single Application Detail ───────────────────────────
@router.get("/{application_id}", response_model=ApplicationDetailRead)
def get_application(
    application_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    app = db.query(AttendanceApplication).filter(AttendanceApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    # Strict authorization:
    if current_user.role == UserRole.STUDENT:
        student = AttendanceService.get_student_profile(db, current_user)
        if app.student_id != student.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your application")

    elif current_user.role == UserRole.FACULTY:
        faculty = AttendanceService.get_faculty_profile(db, current_user)
        is_assigned = (
            db.query(FacultyAssignment)
            .filter(
                FacultyAssignment.faculty_id == faculty.id,
                FacultyAssignment.subject_offering_id == app.subject_offering_id,
                FacultyAssignment.is_active.is_(True),
            )
            .first()
        )
        coord_secs = ApplicationService.get_coordinator_sections(db, faculty.id)
        offering = db.query(SubjectOffering).filter(SubjectOffering.id == app.subject_offering_id).first()
        is_coordinator = bool(offering and offering.section_id in coord_secs)

        is_hod = False
        try:
            hod_resp = ApplicationService.get_hod_responsibility(db, faculty.id)
            if offering and offering.branch and offering.branch.department_id == hod_resp.department_id:
                is_hod = True
        except Exception:
            is_hod = False

        if not is_assigned and not is_coordinator and not is_hod:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this application",
            )

    return ApplicationService.get_application_detail(db, app)

