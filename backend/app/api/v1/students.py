from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_db, require_roles
from app.core.security import get_password_hash
from app.models import (
    AcademicEnrollment,
    AttendanceApplication,
    AttendanceRecord,
    AuditLog,
    Batch,
    Branch,
    Course,
    EnrollmentStatus,
    Notification,
    Section,
    StudentGroup,
    StudentProfile,
    SubjectOffering,
    SuspiciousActivity,
    User,
    UserRole,
)
from app.schemas import (
    MessageResponse,
    StudentCreate,
    StudentDetailRead,
    StudentDeviceBindRequest,
    StudentDeviceResetRequest,
    StudentUpdate,
)
from app.services.attendance import AttendanceService
from app.services.audit import AuditService

router = APIRouter(prefix="/students", tags=["students"])


class PasswordResetRequest(BaseModel):
    new_password: str


def _build_student_detail(student: StudentProfile, db: Session | None = None) -> StudentDetailRead:
    active_enrollment = None
    if student.enrollments:
        for en in student.enrollments:
            is_curr = getattr(en, "is_current", True)
            st = getattr(en, "status", None)
            st_val = st.value if hasattr(st, "value") else str(st or "active")
            if is_curr and st_val.lower() == "active":
                active_enrollment = en
                break
        if not active_enrollment and len(student.enrollments) > 0:
            active_enrollment = student.enrollments[0]

    course_name = None
    department_name = None
    branch_name = None
    batch_name = None
    enrollment_status = "Unenrolled"

    if active_enrollment:
        st_raw = (
            active_enrollment.status.value
            if hasattr(active_enrollment.status, "value")
            else str(active_enrollment.status or "active")
        )
        enrollment_status = st_raw.capitalize() if st_raw else "Active"
        if active_enrollment.course:
            course_name = active_enrollment.course.name
        if active_enrollment.branch:
            branch_name = active_enrollment.branch.name
            if active_enrollment.branch.department:
                department_name = active_enrollment.branch.department.name
        if active_enrollment.batch:
            batch_name = active_enrollment.batch.name
    elif student.section:
        sec = student.section
        enrollment_status = "Active"
        if sec.batch:
            batch_name = sec.batch.name
            if sec.batch.branch:
                branch_name = sec.batch.branch.name
                if sec.batch.branch.department:
                    department_name = sec.batch.branch.department.name
                if sec.batch.branch.course:
                    course_name = sec.batch.branch.course.name

    att_count = 0
    if student.attendance_records is not None:
        try:
            att_count = len(student.attendance_records)
        except Exception:
            if db:
                att_count = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student.id).count()
    elif db:
        att_count = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student.id).count()

    return StudentDetailRead(
        id=student.id,
        user_id=student.user_id,
        full_name=student.user.full_name if student.user else "Unknown",
        email=student.user.email if student.user else "",
        phone=student.user.phone if student.user else None,
        roll_number=student.roll_number,
        enrollment_number=student.enrollment_number,
        section_id=student.section_id,
        section_name=student.section.name if student.section else None,
        current_group_id=student.current_group_id,
        current_group_name=student.current_group.name if student.current_group else None,
        device_id=student.device_id,
        device_registered_at=student.device_registered_at,
        is_active=student.user.is_active if student.user else True,
        created_at=student.created_at,
        course_name=course_name,
        department_name=department_name,
        branch_name=branch_name,
        batch_name=batch_name,
        enrollment_status=enrollment_status,
        attendance_count=att_count,
    )


@router.get("", response_model=list[StudentDetailRead])
def list_students(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))],
    query: str | None = Query(None, description="Search by name, email, roll number, or device UUID"),
    section_id: int | None = Query(None),
    is_active: bool | None = Query(None),
    has_device: bool | None = Query(None),
):
    q = (
        db.query(StudentProfile)
        .join(StudentProfile.user)
        .options(
            joinedload(StudentProfile.user),
            joinedload(StudentProfile.section).joinedload(Section.batch).joinedload(Batch.branch).joinedload(Branch.department),
            joinedload(StudentProfile.section).joinedload(Section.batch).joinedload(Batch.branch).joinedload(Branch.course),
            joinedload(StudentProfile.current_group),
            joinedload(StudentProfile.enrollments).joinedload(AcademicEnrollment.course),
            joinedload(StudentProfile.enrollments).joinedload(AcademicEnrollment.branch).joinedload(Branch.department),
            joinedload(StudentProfile.enrollments).joinedload(AcademicEnrollment.batch),
            joinedload(StudentProfile.attendance_records),
        )
    )

    if query:
        term = f"%{query.strip()}%"
        q = q.filter(
            or_(
                User.full_name.ilike(term),
                User.email.ilike(term),
                StudentProfile.roll_number.ilike(term),
                StudentProfile.enrollment_number.ilike(term),
                StudentProfile.device_id.ilike(term),
            )
        )

    if section_id is not None:
        q = q.filter(StudentProfile.section_id == section_id)

    if is_active is not None:
        q = q.filter(User.is_active == is_active)

    if has_device is not None:
        if has_device:
            q = q.filter(StudentProfile.device_id.isnot(None))
        else:
            q = q.filter(StudentProfile.device_id.is_(None))

    students = q.order_by(StudentProfile.roll_number).all()

    return [_build_student_detail(s, db) for s in students]


@router.get("/{student_id}", response_model=StudentDetailRead)
def get_student(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))],
):
    student = (
        db.query(StudentProfile)
        .options(
            joinedload(StudentProfile.user),
            joinedload(StudentProfile.section).joinedload(Section.batch).joinedload(Batch.branch).joinedload(Branch.department),
            joinedload(StudentProfile.section).joinedload(Section.batch).joinedload(Batch.branch).joinedload(Branch.course),
            joinedload(StudentProfile.current_group),
            joinedload(StudentProfile.enrollments).joinedload(AcademicEnrollment.course),
            joinedload(StudentProfile.enrollments).joinedload(AcademicEnrollment.branch).joinedload(Branch.department),
            joinedload(StudentProfile.enrollments).joinedload(AcademicEnrollment.batch),
            joinedload(StudentProfile.attendance_records),
        )
        .filter(StudentProfile.id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    return _build_student_detail(student, db)


@router.post("", response_model=StudentDetailRead, status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User email already registered")

    existing_roll = db.query(StudentProfile).filter(StudentProfile.roll_number == payload.roll_number).first()
    if existing_roll:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Student roll number already exists")

    dev_id = payload.device_id.strip() if payload.device_id else None
    if dev_id:
        if len(dev_id) < 6:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Device ID must be at least 6 characters.")
        conflict_device = db.query(StudentProfile).filter(StudentProfile.device_id == dev_id).first()
        if conflict_device:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Device identifier '{dev_id}' is already bound to student {conflict_device.roll_number}.",
            )

    user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=UserRole.STUDENT,
        college_id=payload.college_id,
        is_active=True,
    )
    db.add(user)
    db.flush()

    student = StudentProfile(
        user_id=user.id,
        roll_number=payload.roll_number,
        enrollment_number=payload.enrollment_number,
        section_id=payload.section_id,
        current_group_id=payload.current_group_id,
        device_id=dev_id,
        device_registered_at=datetime.now(timezone.utc) if dev_id else None,
    )
    db.add(student)
    db.flush()

    # Link academic enrollment if section is provided
    if payload.section_id:
        sec = (
            db.query(Section)
            .options(
                joinedload(Section.batch).joinedload(Batch.branch).joinedload(Branch.course),
            )
            .filter(Section.id == payload.section_id)
            .first()
        )
        if sec:
            batch_id = payload.batch_id or sec.batch_id
            branch_id = payload.branch_id or (sec.batch.branch_id if sec.batch else None)
            course_id = payload.course_id or (sec.batch.branch.course_id if sec.batch and sec.batch.branch else None)

            if course_id and branch_id and batch_id:
                academic_year = f"{sec.batch.start_year}-{sec.batch.start_year + 1}" if (sec.batch and sec.batch.start_year) else "2024-2025"
                sem = payload.semester
                if not sem:
                    first_off = db.query(SubjectOffering).filter(SubjectOffering.section_id == sec.id).first()
                    sem = first_off.semester if first_off else 1

                enrollment = AcademicEnrollment(
                    student_id=student.id,
                    course_id=course_id,
                    branch_id=branch_id,
                    batch_id=batch_id,
                    section_id=sec.id,
                    student_group_id=payload.current_group_id,
                    semester=sem,
                    academic_year=academic_year,
                    is_current=True,
                    status=EnrollmentStatus.ACTIVE,
                )
                db.add(enrollment)

    db.commit()
    db.refresh(student)
    db.refresh(user)

    AuditService.log_action(
        db=db,
        user=current_user,
        action="CREATE_STUDENT",
        entity_type="STUDENT",
        entity_id=student.id,
        metadata={"email": user.email, "roll_number": student.roll_number, "full_name": user.full_name, "device_id": dev_id},
        reason=f"Created student profile for {user.full_name}",
    )

    return _build_student_detail(student, db)


@router.put("/{student_id}", response_model=StudentDetailRead)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    student = (
        db.query(StudentProfile)
        .options(
            joinedload(StudentProfile.user),
            joinedload(StudentProfile.section),
            joinedload(StudentProfile.enrollments),
        )
        .filter(StudentProfile.id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    user = student.user
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.is_active is not None:
        user.is_active = payload.is_active

    if payload.roll_number is not None and payload.roll_number != student.roll_number:
        dup = db.query(StudentProfile).filter(StudentProfile.roll_number == payload.roll_number, StudentProfile.id != student.id).first()
        if dup:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Student roll number already exists")
        student.roll_number = payload.roll_number

    if payload.enrollment_number is not None:
        student.enrollment_number = payload.enrollment_number

    section_changed = payload.section_id is not None and payload.section_id != student.section_id
    group_changed = payload.current_group_id is not None and payload.current_group_id != student.current_group_id

    if payload.section_id is not None:
        student.section_id = payload.section_id
    if payload.current_group_id is not None:
        student.current_group_id = payload.current_group_id

    # If section or group changed, update academic enrollment
    if (section_changed or group_changed) and student.section_id:
        sec = (
            db.query(Section)
            .options(
                joinedload(Section.batch).joinedload(Batch.branch).joinedload(Branch.course),
            )
            .filter(Section.id == student.section_id)
            .first()
        )
        if sec and sec.batch and sec.batch.branch:
            # Check for existing active enrollment
            active_en = next((e for e in student.enrollments if getattr(e, "is_current", True)), None)
            if active_en:
                active_en.section_id = sec.id
                active_en.batch_id = sec.batch_id
                active_en.branch_id = sec.batch.branch_id
                active_en.course_id = sec.batch.branch.course_id
                active_en.student_group_id = student.current_group_id
                if payload.semester is not None:
                    active_en.semester = payload.semester
            else:
                academic_year = f"{sec.batch.start_year}-{sec.batch.start_year + 1}" if (sec.batch and sec.batch.start_year) else "2024-2025"
                sem = payload.semester
                if not sem:
                    first_off = db.query(SubjectOffering).filter(SubjectOffering.section_id == sec.id).first()
                    sem = first_off.semester if first_off else 1
                new_en = AcademicEnrollment(
                    student_id=student.id,
                    course_id=sec.batch.branch.course_id,
                    branch_id=sec.batch.branch_id,
                    batch_id=sec.batch_id,
                    section_id=sec.id,
                    student_group_id=student.current_group_id,
                    semester=sem,
                    academic_year=academic_year,
                    is_current=True,
                    status=EnrollmentStatus.ACTIVE,
                )
                db.add(new_en)

    db.commit()
    db.refresh(student)
    db.refresh(user)

    AuditService.log_action(
        db=db,
        user=current_user,
        action="UPDATE_STUDENT",
        entity_type="STUDENT",
        entity_id=student.id,
        metadata={"roll_number": student.roll_number, "full_name": user.full_name},
        reason=f"Updated student profile for {user.full_name}",
    )

    return _build_student_detail(student, db)


@router.post("/{student_id}/bind-device", response_model=StudentDetailRead)
def bind_student_device(
    student_id: int,
    payload: StudentDeviceBindRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    student = (
        db.query(StudentProfile)
        .options(
            joinedload(StudentProfile.user),
            joinedload(StudentProfile.section),
            joinedload(StudentProfile.current_group),
            joinedload(StudentProfile.enrollments),
            joinedload(StudentProfile.attendance_records),
        )
        .filter(StudentProfile.id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    dev_id = payload.device_id.strip()
    if len(dev_id) < 6:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Device ID must be at least 6 characters.")

    conflict = (
        db.query(StudentProfile)
        .filter(StudentProfile.device_id == dev_id, StudentProfile.id != student_id)
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device ID '{dev_id}' is already bound to student {conflict.roll_number} ({conflict.user.full_name if conflict.user else 'Another student'}).",
        )

    old_device = student.device_id
    student.device_id = dev_id
    student.device_registered_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(student)

    AuditService.log_action(
        db=db,
        user=current_user,
        action="BIND_STUDENT_DEVICE",
        entity_type="STUDENT_DEVICE",
        entity_id=student.id,
        metadata={
            "student_id": student.id,
            "roll_number": student.roll_number,
            "old_device_id": old_device,
            "new_device_id": dev_id,
            "platform": payload.platform,
            "model": payload.model,
        },
        reason="Device bound by administrator",
    )

    return _build_student_detail(student, db)


@router.post("/{student_id}/reset-device", response_model=MessageResponse)
def reset_student_device(
    student_id: int,
    payload: StudentDeviceResetRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    """Unbind student device to allow re-registration from new phone."""
    try:
        student = AttendanceService.unbind_student_device(
            db=db,
            student_id=student_id,
            reason=payload.reason,
            admin_user=current_user,
        )
        return MessageResponse(message=f"Device unbind successful for student {student.roll_number}")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{student_id}/reset-password", response_model=MessageResponse)
def reset_student_password(
    student_id: int,
    payload: PasswordResetRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    student = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    user = student.user
    user.password_hash = get_password_hash(payload.new_password)
    db.commit()

    AuditService.log_action(
        db=db,
        user=current_user,
        action="RESET_STUDENT_PASSWORD",
        entity_type="STUDENT",
        entity_id=student.id,
        metadata={"email": user.email, "roll_number": student.roll_number},
        reason="Administrative password reset",
    )
    return MessageResponse(message=f"Password reset successfully for {user.full_name}")


@router.patch("/{student_id}/toggle-status", response_model=MessageResponse)
def toggle_student_status(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    student = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    user = student.user
    user.is_active = not user.is_active
    db.commit()

    status_str = "activated" if user.is_active else "deactivated"
    AuditService.log_action(
        db=db,
        user=current_user,
        action="TOGGLE_STUDENT_STATUS",
        entity_type="STUDENT",
        entity_id=student.id,
        metadata={"email": user.email, "is_active": user.is_active},
        reason=f"Account {status_str} by administrator",
    )
    return MessageResponse(message=f"Student account {status_str} successfully")


@router.delete("/{student_id}", response_model=MessageResponse)
def delete_student(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
    force: bool = Query(False, description="Force delete student and all associated records"),
):
    student = (
        db.query(StudentProfile)
        .options(
            joinedload(StudentProfile.user),
            joinedload(StudentProfile.attendance_records),
            joinedload(StudentProfile.enrollments),
        )
        .filter(StudentProfile.id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    # Protection of historical attendance data
    att_count = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student_id).count()
    if att_count > 0 and not force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot permanently delete student '{student.roll_number}' because they have {att_count} "
                f"historical attendance record(s). Deactivate the student account instead, or use Force Delete."
            ),
        )

    user = student.user
    roll_number = student.roll_number
    student_name = user.full_name if user else "Unknown"

    # If force-deleting with attendance, remove attendance & suspicious activities first
    if att_count > 0 and force:
        db.query(SuspiciousActivity).filter(SuspiciousActivity.student_id == student_id).delete()
        db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student_id).delete()

    # Delete applications and suspicious activities linked to student
    db.query(AttendanceApplication).filter(AttendanceApplication.student_id == student_id).delete()
    db.query(SuspiciousActivity).filter(SuspiciousActivity.student_id == student_id).delete()

    # Delete notifications linked to student's user account and unlink audit logs
    if user:
        db.query(AuditLog).filter(AuditLog.user_id == user.id).update({AuditLog.user_id: None})
        db.query(Notification).filter(Notification.user_id == user.id).delete()

    # Delete academic enrollments
    for en in list(student.enrollments):
        db.delete(en)

    # Delete student profile
    db.delete(student)

    # Delete underlying user account
    if user:
        db.delete(user)

    db.commit()

    AuditService.log_action(
        db=db,
        user=current_user,
        action="DELETE_STUDENT",
        entity_type="STUDENT",
        entity_id=student_id,
        metadata={"roll_number": roll_number, "full_name": student_name, "forced": force},
        reason=f"Permanently deleted student profile {roll_number} (forced={force}, had {att_count} attendance records)",
    )

    return MessageResponse(message=f"Student {roll_number} ({student_name}) has been permanently deleted.")
