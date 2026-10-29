import csv
from datetime import datetime, timezone
import io
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require_faculty_responsibility, require_roles
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models import (
    AcademicEnrollment,
    AttendanceApplication,
    AttendanceRecord,
    AttendanceSession,
    AttendanceStatus,
    AuditLog,
    Branch,
    College,
    Course,
    Department,
    EnrollmentStatus,
    FacultyAssignment,
    FacultyProfile,
    FacultyResponsibility,
    Notice,
    Notification,
    QRSession,
    ResponsibilityType,
    Section,
    SessionStatus,
    StudentProfile,
    Subject,
    SubjectOffering,
    SuspiciousActivity,
    SystemSetting,
    TimetableEntry,
    User,
    UserRole,
)
from app.schemas import (
    CoordinatorDeskSummary,
    CoordinatorMatrixResponse,
    CoordinatorStudentRow,
    CoordinatorSubjectAttendance,
    CoordinatorSubjectHeader,
    FacultyClassRead,
    FacultyCreate,
    FacultyDetailRead,
    FacultyProfileRead,
    FacultyResponsibilityCreate,
    FacultyResponsibilityRead,
    FacultyUpdate,
    MessageResponse,
    StudentDetailRead,
)
from app.services.attendance import AttendanceService, get_eligible_students
from app.services.audit import AuditService
from app.services.auth import FacultyResponsibilityService
from app.services.system_config import SystemConfigService

router = APIRouter(prefix="/faculty", tags=["faculty"])


def _build_faculty_detail(profile: FacultyProfile, db: Session | None = None) -> FacultyDetailRead:
    user = profile.user
    dept = profile.department

    subjects = []
    sections = []
    if profile.assignments:
        for a in profile.assignments:
            if a.subject_offering:
                off = a.subject_offering
                if off.subject and off.subject.name not in subjects:
                    subjects.append(off.subject.name)
                if off.section and off.section.name not in sections:
                    sections.append(off.section.name)

    todays_count = 0
    if profile.sessions:
        try:
            today_date = datetime.now(timezone.utc).date()
            todays_count = sum(1 for s in profile.sessions if s.start_time and s.start_time.date() == today_date)
        except Exception:
            todays_count = len(profile.sessions)

    return FacultyDetailRead(
        id=profile.id,
        user_id=profile.user_id,
        department_id=profile.department_id,
        department_name=dept.name if dept else None,
        employee_id=profile.employee_id,
        designation=profile.designation,
        full_name=user.full_name if user else f"Faculty ({profile.employee_id})",
        email=user.email if user else "",
        phone=user.phone if user else None,
        is_active=user.is_active if user else True,
        responsibilities=[FacultyResponsibilityRead.model_validate(r) for r in (profile.responsibilities or [])],
        subjects=subjects,
        sections_assigned=sections,
        todays_sessions=todays_count,
        total_sessions=len(profile.sessions) if profile.sessions else 0,
        created_at=profile.created_at,
    )


@router.get("/me", response_model=FacultyProfileRead)
@router.get("/me/profile", response_model=FacultyProfileRead)
def get_my_faculty_profile(
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
):
    if not current_user.faculty_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")
    return current_user.faculty_profile


# ── Faculty: My Assigned Classes ─────────────────────────────────────
@router.get("/my-classes", response_model=list[FacultyClassRead])
def get_my_assigned_classes(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
):
    if not current_user.faculty_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")

    assignments = (
        db.query(FacultyAssignment)
        .options(
            joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.subject),
            joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.course),
            joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.branch),
            joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.section),
            joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.student_group),
        )
        .filter(
            FacultyAssignment.faculty_id == current_user.faculty_profile.id,
            FacultyAssignment.is_active.is_(True),
        )
        .all()
    )

    results = []
    for a in assignments:
        off = a.subject_offering
        if not off:
            continue

        # Count total sessions conducted by this faculty for this offering
        sessions_count = (
            db.query(func.count(AttendanceSession.id))
            .filter(
                AttendanceSession.faculty_assignment_id == a.id,
                AttendanceSession.status == "completed",
            )
            .scalar()
            or 0
        )

        # Count eligible students
        enrolled_count = (
            db.query(func.count(AcademicEnrollment.id))
            .filter(
                AcademicEnrollment.is_current.is_(True),
                AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
                AcademicEnrollment.course_id == off.course_id,
                AcademicEnrollment.branch_id == off.branch_id,
                AcademicEnrollment.semester == off.semester,
                AcademicEnrollment.section_id == off.section_id,
            )
        )
        if off.student_group_id is not None:
            enrolled_count = enrolled_count.filter(AcademicEnrollment.student_group_id == off.student_group_id)

        results.append(
            FacultyClassRead(
                assignment_id=a.id,
                subject_offering_id=off.id,
                subject_id=off.subject_id,
                subject_name=off.subject.name,
                subject_code=off.subject.code,
                credits=off.subject.credits,
                course_name=off.course.name,
                branch_name=off.branch.name,
                semester=off.semester,
                section_id=off.section_id,
                section_name=off.section.name,
                student_group_id=off.student_group_id,
                student_group_name=off.student_group.name if off.student_group else None,
                class_type=off.class_type,
                total_enrolled=enrolled_count.scalar() or 0,
                total_sessions_conducted=sessions_count,
            )
        )
    return results


@router.get("/profiles", response_model=list[FacultyDetailRead])
@router.get("", response_model=list[FacultyDetailRead])
def list_faculty_profiles(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))],
    department_id: int | None = Query(None),
    query: str | None = Query(None),
):
    q = (
        db.query(FacultyProfile)
        .join(FacultyProfile.user)
        .options(
            joinedload(FacultyProfile.user),
            joinedload(FacultyProfile.department),
            joinedload(FacultyProfile.responsibilities),
            joinedload(FacultyProfile.assignments).joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.subject),
            joinedload(FacultyProfile.assignments).joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.section),
            joinedload(FacultyProfile.sessions),
        )
    )
    if department_id:
        q = q.filter(FacultyProfile.department_id == department_id)
    if query:
        term = f"%{query.strip()}%"
        q = q.filter(
            or_(
                User.full_name.ilike(term),
                User.email.ilike(term),
                FacultyProfile.employee_id.ilike(term),
                FacultyProfile.designation.ilike(term),
            )
        )
    profiles = q.order_by(FacultyProfile.id.desc()).all()
    return [_build_faculty_detail(p, db) for p in profiles]


@router.get("/profiles/{faculty_id}", response_model=FacultyDetailRead)
@router.get("/{faculty_id}", response_model=FacultyDetailRead)
def get_faculty_profile(
    faculty_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))],
):
    profile = (
        db.query(FacultyProfile)
        .options(
            joinedload(FacultyProfile.user),
            joinedload(FacultyProfile.department),
            joinedload(FacultyProfile.responsibilities),
            joinedload(FacultyProfile.assignments).joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.subject),
            joinedload(FacultyProfile.assignments).joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.section),
            joinedload(FacultyProfile.sessions),
        )
        .filter(FacultyProfile.id == faculty_id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")
    return _build_faculty_detail(profile, db)


@router.post("/profiles", response_model=FacultyDetailRead, status_code=status.HTTP_201_CREATED)
@router.post("", response_model=FacultyDetailRead, status_code=status.HTTP_201_CREATED)
def create_faculty(
    payload: FacultyCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User email already registered")

    existing_emp = db.query(FacultyProfile).filter(FacultyProfile.employee_id == payload.employee_id).first()
    if existing_emp:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Employee ID '{payload.employee_id}' already registered")

    # Resolve department
    dept_id = payload.department_id
    if not dept_id and payload.department:
        clean_dept = payload.department.strip()
        dept_match = db.query(Department).filter(
            or_(Department.name.ilike(f"%{clean_dept}%"), Department.code.ilike(f"%{clean_dept}%"))
        ).first()
        if dept_match:
            dept_id = dept_match.id
        else:
            first_col = db.query(College).first()
            if first_col:
                dept_code = "".join(w[0] for w in clean_dept.split() if w).upper()[:6] or "DEPT"
                if db.query(Department).filter(Department.code == dept_code).first():
                    dept_code = f"{dept_code}{db.query(Department).count() + 1}"
                new_dept = Department(
                    college_id=first_col.id,
                    name=clean_dept,
                    code=dept_code,
                    is_active=True,
                )
                db.add(new_dept)
                db.flush()
                dept_id = new_dept.id

    if not dept_id:
        first_dept = db.query(Department).first()
        if first_dept:
            dept_id = first_dept.id
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No academic department found. Please create a department first.")

    target_dept = db.query(Department).filter(Department.id == dept_id).first()
    college_id = payload.college_id or (target_dept.college_id if target_dept else None)
    if not college_id:
        first_col = db.query(College).first()
        if first_col:
            college_id = first_col.id

    user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=UserRole.FACULTY,
        college_id=college_id,
        is_active=True,
    )
    db.add(user)
    db.flush()

    profile = FacultyProfile(
        user_id=user.id,
        department_id=dept_id,
        employee_id=payload.employee_id,
        designation=payload.designation,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    db.refresh(user)

    AuditService.log_action(
        db=db,
        user=current_user,
        action="CREATE_FACULTY",
        entity_type="FACULTY",
        entity_id=profile.id,
        metadata={"email": user.email, "employee_id": profile.employee_id, "full_name": user.full_name},
        reason=f"Created faculty profile for {user.full_name}",
    )

    return _build_faculty_detail(profile, db)


@router.put("/profiles/{faculty_id}", response_model=FacultyDetailRead)
@router.put("/{faculty_id}", response_model=FacultyDetailRead)
def update_faculty(
    faculty_id: int,
    payload: FacultyUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    profile = (
        db.query(FacultyProfile)
        .options(joinedload(FacultyProfile.user), joinedload(FacultyProfile.department))
        .filter(FacultyProfile.id == faculty_id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")

    user = profile.user
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.is_active is not None:
        user.is_active = payload.is_active

    if payload.employee_id is not None and payload.employee_id != profile.employee_id:
        dup = db.query(FacultyProfile).filter(FacultyProfile.employee_id == payload.employee_id, FacultyProfile.id != profile.id).first()
        if dup:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Employee ID already exists")
        profile.employee_id = payload.employee_id

    if payload.designation is not None:
        profile.designation = payload.designation

    if payload.department_id is not None:
        profile.department_id = payload.department_id

    db.commit()
    db.refresh(profile)
    db.refresh(user)

    AuditService.log_action(
        db=db,
        user=current_user,
        action="UPDATE_FACULTY",
        entity_type="FACULTY",
        entity_id=profile.id,
        metadata={"employee_id": profile.employee_id, "full_name": user.full_name},
        reason=f"Updated faculty profile for {user.full_name}",
    )

    return _build_faculty_detail(profile, db)


@router.delete("/profiles/{faculty_id}", response_model=MessageResponse)
@router.delete("/{faculty_id}", response_model=MessageResponse)
def delete_faculty(
    faculty_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
    force: bool = Query(False, description="Force delete faculty and all associated records"),
):
    profile = (
        db.query(FacultyProfile)
        .options(
            joinedload(FacultyProfile.user),
            joinedload(FacultyProfile.sessions),
            joinedload(FacultyProfile.assignments),
            joinedload(FacultyProfile.responsibilities),
        )
        .filter(FacultyProfile.id == faculty_id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")

    user = profile.user
    emp_id = profile.employee_id
    name = user.full_name if user else "Faculty"

    # Clear application reviewer references pointing to this faculty
    db.query(AttendanceApplication).filter(AttendanceApplication.faculty_reviewer_id == faculty_id).update({AttendanceApplication.faculty_reviewer_id: None})
    db.query(AttendanceApplication).filter(AttendanceApplication.coordinator_reviewer_id == faculty_id).update({AttendanceApplication.coordinator_reviewer_id: None})
    db.query(AttendanceApplication).filter(AttendanceApplication.hod_reviewer_id == faculty_id).update({AttendanceApplication.hod_reviewer_id: None})

    # If faculty has historical attendance sessions and not force-deleting, deactivate
    session_count = len(profile.sessions) if profile.sessions else 0
    if session_count > 0 and not force:
        if user:
            user.is_active = False
        db.commit()
        AuditService.log_action(
            db=db,
            user=current_user,
            action="DEACTIVATE_FACULTY",
            entity_type="FACULTY",
            entity_id=profile.id,
            metadata={"employee_id": profile.employee_id, "sessions_count": session_count},
            reason="Faculty deactivated to preserve historical attendance sessions",
        )
        return MessageResponse(
            message=f"Faculty {profile.employee_id} ({name}) has {session_count} historical attendance session(s). Account has been deactivated to preserve academic records."
        )

    # If force-deleting sessions
    if profile.sessions and len(profile.sessions) > 0 and force:
        for sess in list(profile.sessions):
            db.query(SuspiciousActivity).filter(SuspiciousActivity.session_id == sess.id).delete()
            db.query(AttendanceRecord).filter(AttendanceRecord.session_id == sess.id).delete()
            db.query(QRSession).filter(QRSession.attendance_session_id == sess.id).delete()
            db.delete(sess)
        db.flush()

    # Clean up timetable entries pointing to faculty assignments if any
    for asgn in list(profile.assignments):
        db.query(TimetableEntry).filter(TimetableEntry.faculty_assignment_id == asgn.id).delete()
    db.flush()

    # Clean up user foreign keys & child rows to avoid MySQL 1451 IntegrityError
    if user:
        db.query(AuditLog).filter(AuditLog.user_id == user.id).update({AuditLog.user_id: None})
        db.query(SuspiciousActivity).filter(SuspiciousActivity.reviewed_by == user.id).update({SuspiciousActivity.reviewed_by: None})
        db.query(SystemSetting).filter(SystemSetting.updated_by_id == user.id).update({SystemSetting.updated_by_id: None})
        db.query(AttendanceRecord).filter(AttendanceRecord.adjusted_by_user_id == user.id).update({AttendanceRecord.adjusted_by_user_id: None})
        db.query(Notification).filter(Notification.user_id == user.id).delete()
        db.query(Notice).filter(Notice.created_by == user.id).delete()

    # Delete profile (cascades to assignments & responsibilities) and user
    db.delete(profile)
    if user:
        db.delete(user)
    db.commit()

    AuditService.log_action(
        db=db,
        user=current_user,
        action="DELETE_FACULTY",
        entity_type="FACULTY",
        entity_id=faculty_id,
        metadata={"employee_id": emp_id, "full_name": name, "forced": force},
        reason=f"Permanently deleted faculty profile {emp_id} (forced={force})",
    )

    return MessageResponse(message=f"Faculty {emp_id} ({name}) permanently deleted.")


@router.post("/responsibilities", response_model=FacultyResponsibilityRead, status_code=status.HTTP_201_CREATED)
def assign_responsibility_direct(
    payload: FacultyResponsibilityCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    if not payload.faculty_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="faculty_id is required")
    try:
        return FacultyResponsibilityService.assign(db, payload.faculty_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{faculty_id}/responsibilities", response_model=FacultyResponsibilityRead, status_code=status.HTTP_201_CREATED)
def assign_responsibility(
    faculty_id: int,
    payload: FacultyResponsibilityCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return FacultyResponsibilityService.assign(db, faculty_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{faculty_id}/responsibilities", response_model=list[FacultyResponsibilityRead])
def list_faculty_responsibilities(
    faculty_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))],
):
    return FacultyResponsibilityService.list_by_faculty(db, faculty_id)


@router.patch("/responsibilities/{responsibility_id}/deactivate", response_model=FacultyResponsibilityRead)
@router.delete("/responsibilities/{responsibility_id}", response_model=FacultyResponsibilityRead)
def deactivate_responsibility(
    responsibility_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return FacultyResponsibilityService.deactivate(db, responsibility_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ── Coordinator Desk Endpoints (Strict Section Scope) ────────────────
def _get_active_coordinator_section(
    db: Session,
    faculty_profile_id: int,
    section_id: int | None = None,
) -> Section | None:
    query = (
        db.query(FacultyResponsibility)
        .filter(
            FacultyResponsibility.faculty_id == faculty_profile_id,
            FacultyResponsibility.responsibility_type == ResponsibilityType.COORDINATOR,
            FacultyResponsibility.is_active.is_(True),
        )
    )
    if section_id is not None:
        resp = query.filter(FacultyResponsibility.section_id == section_id).first()
        if not resp:
            # Check if coordinator has department scope covering this section
            sec = db.query(Section).filter(Section.id == section_id).first()
            if sec and sec.batch and sec.batch.branch:
                dept_resp = query.filter(FacultyResponsibility.department_id == sec.batch.branch.department_id).first()
                if dept_resp:
                    return sec
            return None
        return db.query(Section).filter(Section.id == section_id).first()

    resp = query.order_by(FacultyResponsibility.id.desc()).first()
    if not resp or not resp.section_id:
        if resp and resp.department_id:
            sec = db.query(Section).first()
            return sec
        return None
    return db.query(Section).filter(Section.id == resp.section_id).first()


@router.get("/coordinator/desk", response_model=CoordinatorDeskSummary)
def get_coordinator_desk_summary(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
    section_id: int | None = None,
):
    if not current_user.faculty_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")

    section = _get_active_coordinator_section(db, current_user.faculty_profile.id, section_id=section_id)
    if not section:
        return CoordinatorDeskSummary(has_coordinator_role=False)

    threshold = float(SystemConfigService.get_setting(db, "minimum_attendance_percentage", default=75.0))

    # Load active enrolled students in this section
    enrollments = (
        db.query(AcademicEnrollment)
        .options(joinedload(AcademicEnrollment.student))
        .filter(
            AcademicEnrollment.section_id == section.id,
            AcademicEnrollment.is_current.is_(True),
            AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
        )
        .all()
    )

    total_students = len(enrollments)
    if total_students == 0:
        return CoordinatorDeskSummary(
            has_coordinator_role=True,
            section_id=section.id,
            section_name=section.name,
            branch_name=section.batch.branch.name if (section.batch and section.batch.branch) else "N/A",
            course_name=section.batch.branch.course.name if (section.batch and section.batch.branch and section.batch.branch.course) else "N/A",
            semester=1,
            total_students=0,
            average_section_attendance=0.0,
            short_attendance_count=0,
            attendance_threshold=threshold,
        )

    valid_session_statuses = [SessionStatus.ACTIVE, SessionStatus.COMPLETED, SessionStatus.CLOSED]
    valid_att_statuses = [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED]

    # Pre-fetch all conducted sessions for this section
    sessions = (
        db.query(AttendanceSession)
        .filter(
            AttendanceSession.section_id == section.id,
            AttendanceSession.status.in_(valid_session_statuses),
        )
        .all()
    )

    total_section_attended = 0
    total_section_eligible = 0
    short_attendance_count = 0
    student_group_map = {e.student_id: e.student_group_id for e in enrollments}

    for enr in enrollments:
        grp_id = student_group_map.get(enr.student_id)
        # Sessions this student was eligible to attend
        eligible_sessions = [
            s for s in sessions
            if s.student_group_id is None or s.student_group_id == grp_id
        ]
        total_eligible = len(eligible_sessions)
        eligible_ids = [s.id for s in eligible_sessions]

        attended = 0
        if eligible_ids:
            attended = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.session_id.in_(eligible_ids),
                    AttendanceRecord.student_id == enr.student_id,
                    AttendanceRecord.status.in_(valid_att_statuses),
                )
                .count()
            )

        if total_eligible > 0:
            overall_pct = (attended / total_eligible) * 100
            total_section_attended += attended
            total_section_eligible += total_eligible
            if overall_pct < threshold:
                short_attendance_count += 1

    sec_avg = round((total_section_attended / total_section_eligible) * 100, 1) if total_section_eligible > 0 else 0.0

    return CoordinatorDeskSummary(
        has_coordinator_role=True,
        section_id=section.id,
        section_name=section.name,
        branch_name=section.batch.branch.name if (section.batch and section.batch.branch) else "N/A",
        course_name=section.batch.branch.course.name if (section.batch and section.batch.branch and section.batch.branch.course) else "N/A",
        semester=enrollments[0].semester if enrollments else 1,
        total_students=total_students,
        average_section_attendance=sec_avg,
        short_attendance_count=short_attendance_count,
        attendance_threshold=threshold,
    )


@router.get("/coordinator/students", response_model=list[StudentDetailRead])
def get_coordinator_section_students(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_faculty_responsibility(ResponsibilityType.COORDINATOR))],
    section_id: int | None = None,
):
    if not current_user.faculty_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")

    section = _get_active_coordinator_section(db, current_user.faculty_profile.id, section_id=section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active coordinator section assigned or unauthorized")

    students = (
        db.query(StudentProfile)
        .join(StudentProfile.user)
        .options(
            joinedload(StudentProfile.user),
            joinedload(StudentProfile.section),
            joinedload(StudentProfile.current_group),
        )
        .filter(StudentProfile.section_id == section.id)
        .order_by(StudentProfile.roll_number)
        .all()
    )

    return [
        StudentDetailRead(
            id=s.id,
            user_id=s.user_id,
            full_name=s.user.full_name,
            email=s.user.email,
            phone=s.user.phone,
            roll_number=s.roll_number,
            enrollment_number=s.enrollment_number,
            section_id=s.section_id,
            section_name=section.name,
            current_group_id=s.current_group_id,
            current_group_name=s.current_group.name if s.current_group else None,
            device_id=s.device_id,
            device_registered_at=s.device_registered_at,
            is_active=s.user.is_active,
            created_at=s.created_at,
        )
        for s in students
    ]


@router.get("/coordinator/matrix", response_model=CoordinatorMatrixResponse)
def get_coordinator_attendance_matrix(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_faculty_responsibility(ResponsibilityType.COORDINATOR))],
    section_id: int | None = None,
):
    if not current_user.faculty_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")

    section = _get_active_coordinator_section(db, current_user.faculty_profile.id, section_id=section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active coordinator section assigned or unauthorized")

    threshold = float(SystemConfigService.get_setting(db, "minimum_attendance_percentage", default=75.0))

    # Get subject offerings for this section
    offerings = (
        db.query(SubjectOffering)
        .options(joinedload(SubjectOffering.subject))
        .filter(SubjectOffering.section_id == section.id, SubjectOffering.is_active.is_(True))
        .all()
    )

    # Group into distinct subjects to eliminate duplicate columns for multi-group offerings
    distinct_subjects: dict[str, dict] = {}
    for off in offerings:
        code = off.subject.code
        if code not in distinct_subjects:
            distinct_subjects[code] = {
                "subject_code": code,
                "subject_name": off.subject.name,
                "code": code,
                "name": off.subject.name,
                "offering_ids": [],
                "class_types": set(),
            }
        distinct_subjects[code]["offering_ids"].append(off.id)
        if hasattr(off.class_type, "value"):
            distinct_subjects[code]["class_types"].add(off.class_type.value)
        elif off.class_type:
            distinct_subjects[code]["class_types"].add(str(off.class_type))

    valid_session_statuses = [SessionStatus.ACTIVE, SessionStatus.COMPLETED, SessionStatus.CLOSED]
    valid_att_statuses = [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED]

    # Pre-fetch all non-cancelled sessions for this section
    sessions = (
        db.query(AttendanceSession)
        .filter(
            AttendanceSession.section_id == section.id,
            AttendanceSession.status.in_(valid_session_statuses),
        )
        .all()
    )

    # Build subjects_header
    subjects_header: list[CoordinatorSubjectHeader] = []
    for code, sdata in distinct_subjects.items():
        type_str = "/".join(sorted(sdata["class_types"])) if sdata["class_types"] else "theory"
        subj_sessions = [s for s in sessions if s.subject_offering_id in sdata["offering_ids"]]
        subjects_header.append(
            CoordinatorSubjectHeader(
                subject_code=code,
                subject_name=sdata["subject_name"],
                code=code,
                name=sdata["subject_name"],
                class_type=type_str.upper(),
                total_conducted=len(subj_sessions),
            )
        )

    # Enrolled students in section
    enrollments = (
        db.query(AcademicEnrollment)
        .filter(
            AcademicEnrollment.section_id == section.id,
            AcademicEnrollment.is_current.is_(True),
            AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
        )
        .all()
    )
    student_ids = [e.student_id for e in enrollments]
    student_group_map = {e.student_id: e.student_group_id for e in enrollments}

    students = (
        db.query(StudentProfile)
        .join(StudentProfile.user)
        .options(joinedload(StudentProfile.user))
        .filter(StudentProfile.id.in_(student_ids))
        .order_by(StudentProfile.roll_number)
        .all()
    )

    student_rows = []
    for s in students:
        grp_id = student_group_map.get(s.id)
        tot_all_sessions = 0
        tot_all_attended = 0
        subj_records = []

        for code, sdata in distinct_subjects.items():
            # Eligible sessions for this student in this subject
            eligible_sessions = [
                sess for sess in sessions
                if sess.subject_offering_id in sdata["offering_ids"]
                and (sess.student_group_id is None or sess.student_group_id == grp_id)
            ]
            total_eligible = len(eligible_sessions)
            eligible_ids = [sess.id for sess in eligible_sessions]

            attended = 0
            if eligible_ids:
                attended = (
                    db.query(AttendanceRecord)
                    .filter(
                        AttendanceRecord.session_id.in_(eligible_ids),
                        AttendanceRecord.student_id == s.id,
                        AttendanceRecord.status.in_(valid_att_statuses),
                    )
                    .count()
                )

            perc = round((attended / total_eligible) * 100, 1) if total_eligible > 0 else None
            tot_all_sessions += total_eligible
            tot_all_attended += attended

            type_str = "/".join(sorted(sdata["class_types"])) if sdata["class_types"] else "theory"
            subj_records.append(
                CoordinatorSubjectAttendance(
                    subject_code=code,
                    subject_name=sdata["subject_name"],
                    class_type=type_str.upper(),
                    attended=attended,
                    total=total_eligible,
                    percentage=perc,
                )
            )

        overall = round((tot_all_attended / tot_all_sessions * 100), 1) if tot_all_sessions > 0 else None
        is_short = (overall < threshold) if overall is not None else False

        student_rows.append(
            CoordinatorStudentRow(
                student_id=s.id,
                user_id=s.user_id,
                full_name=s.user.full_name,
                roll_number=s.roll_number,
                email=s.user.email,
                total_attended=tot_all_attended,
                total_eligible=tot_all_sessions,
                overall_percentage=overall,
                is_short_attendance=is_short,
                subjects=subj_records,
            )
        )

    return CoordinatorMatrixResponse(
        section_id=section.id,
        section_name=section.name,
        attendance_threshold=threshold,
        subjects_header=subjects_header,
        students=student_rows,
    )


@router.get("/coordinator/export-csv")
def export_coordinator_attendance_csv(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_faculty_responsibility(ResponsibilityType.COORDINATOR))],
    section_id: int | None = None,
):
    if not current_user.faculty_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")

    section = _get_active_coordinator_section(db, current_user.faculty_profile.id, section_id=section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active coordinator section assigned or unauthorized")

    matrix = get_coordinator_attendance_matrix(db=db, current_user=current_user, section_id=section.id)

    output = io.StringIO()
    writer = csv.writer(output)

    # Metadata headers
    writer.writerow(["# GeoAttend AI - Section Attendance Matrix Export"])
    writer.writerow([f"# Section: {matrix.section_name}", f"Section ID: {matrix.section_id}"])
    writer.writerow([f"# Attendance Threshold: {matrix.attendance_threshold}%", f"Export Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"])
    writer.writerow([])

    # Table column headers
    headers = [
        "Roll Number",
        "Student Name",
        "Email",
        f"Overall Attendance (%)",
        f"Attendance Status (<{matrix.attendance_threshold}%)",
    ]
    for sh in matrix.subjects_header:
        headers.append(f"{sh.subject_code} - {sh.subject_name} ({sh.class_type or 'Theory'}) %")
        headers.append(f"{sh.subject_code} Attended / Eligible")

    writer.writerow(headers)

    for st in matrix.students:
        overall_str = f"{st.overall_percentage}%" if st.overall_percentage is not None else "N/A"
        status_str = "SHORT ATTENDANCE" if st.is_short_attendance else ("REGULAR" if st.overall_percentage is not None else "NO SESSIONS")
        row = [
            st.roll_number,
            st.full_name,
            st.email,
            overall_str,
            status_str,
        ]
        for sh in matrix.subjects_header:
            sub = next((s for s in st.subjects if s.subject_code == sh.subject_code), None)
            if sub and sub.total > 0 and sub.percentage is not None:
                row.append(f"{sub.percentage}%")
                row.append(f"{sub.attended}/{sub.total}")
            else:
                row.append("N/A")
                row.append("0/0")
        writer.writerow(row)

    output.seek(0)
    filename = f"GeoAttend_Section_{section.name}_Attendance_Matrix_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )






@router.get("/department/overview")
def get_department_overview_hod_only(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_faculty_responsibility(ResponsibilityType.HOD))],
):
    """
    Endpoint protected specifically for Faculty members holding active HOD responsibility
    (or Admin with system-wide oversight).
    """
    dept = None
    if current_user.faculty_profile:
        dept = db.query(Department).filter(Department.id == current_user.faculty_profile.department_id).first()

    return {
        "message": "Authorized as HOD",
        "hod_name": current_user.full_name,
        "department": dept.name if dept else "All Departments (Admin)",
        "status": "active",
    }
