"""Attendance Application & Debarment Workflow Service — Phase 9

Implements the multi-stage application review workflow:
STUDENT -> PENDING_FACULTY -> PENDING_HOD -> HOD_APPROVED / HOD_REJECTED
"""

import json
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models import (
    AcademicEnrollment,
    ApplicationStatus,
    AttendanceApplication,
    AttendanceRecord,
    AttendanceSession,
    AttendanceStatus,
    AuditLog,
    Batch,
    Branch,
    Course,
    Department,
    EnrollmentStatus,
    FacultyAssignment,
    FacultyProfile,
    FacultyResponsibility,
    ResponsibilityType,
    ReviewDecision,
    Section,
    SessionStatus,
    StudentGroup,
    StudentProfile,
    Subject,
    SubjectOffering,
    User,
)
from app.schemas import (
    ApplicationCreate,
    ApplicationDetailRead,
    ApplicationHistoryItem,
    ApplicationStats,
    CoordinatorReviewRequest,
    FacultyReviewRequest,
    HODReviewRequest,
)
from app.services.audit import AuditService
from app.services.system_config import SystemConfigService


def deduce_application_type(reason: str | None) -> str:
    """Classifies an application reason into structured application category."""
    if not reason:
        return "attendance_condonation"
    r = reason.lower()
    if any(k in r for k in ["med", "health", "fever", "ill", "hospital", "doctor", "clinic", "surgery"]):
        return "medical_leave"
    if any(k in r for k in ["sport", "tournament", "game", "athletic", "match", "meet"]):
        return "sports_representation"
    if any(k in r for k in ["duty", "official", "conference", "hackathon", "symposium", "seminar"]):
        return "duty_leave"
    if any(k in r for k in ["emerg", "personal", "family", "bereave", "wedding", "death"]):
        return "personal_emergency"
    return "attendance_condonation"


def apply_application_filters(
    query,
    db: Session,
    query_str: str | None = None,
    application_type: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    """Applies search, category, and date range filters across applications."""
    if start_date is not None:
        query = query.filter(func.date(AttendanceApplication.submitted_at) >= start_date)
    if end_date is not None:
        query = query.filter(func.date(AttendanceApplication.submitted_at) <= end_date)

    if query_str:
        q = query_str.strip()
        num_val = int(q.lstrip("#")) if (q.lstrip("#").isdigit()) else None

        student_sub = (
            db.query(StudentProfile.id)
            .join(User, StudentProfile.user_id == User.id)
            .filter(or_(User.full_name.ilike(f"%{q}%"), StudentProfile.roll_number.ilike(f"%{q}%")))
        )
        subject_sub = (
            db.query(SubjectOffering.id)
            .join(Subject, SubjectOffering.subject_id == Subject.id)
            .filter(or_(Subject.name.ilike(f"%{q}%"), Subject.code.ilike(f"%{q}%")))
        )

        conditions = [
            AttendanceApplication.student_id.in_(student_sub),
            AttendanceApplication.subject_offering_id.in_(subject_sub),
            AttendanceApplication.reason.ilike(f"%{q}%"),
            AttendanceApplication.description.ilike(f"%{q}%"),
        ]
        if num_val is not None:
            conditions.append(AttendanceApplication.id == num_val)

        query = query.filter(or_(*conditions))

    if application_type:
        app_t = application_type.lower()
        if app_t == "medical_leave":
            query = query.filter(
                or_(
                    AttendanceApplication.reason.ilike("%med%"),
                    AttendanceApplication.reason.ilike("%health%"),
                    AttendanceApplication.reason.ilike("%fever%"),
                    AttendanceApplication.reason.ilike("%hospital%"),
                    AttendanceApplication.reason.ilike("%ill%"),
                    AttendanceApplication.reason.ilike("%doctor%"),
                )
            )
        elif app_t == "sports_representation":
            query = query.filter(
                or_(
                    AttendanceApplication.reason.ilike("%sport%"),
                    AttendanceApplication.reason.ilike("%tournament%"),
                    AttendanceApplication.reason.ilike("%match%"),
                    AttendanceApplication.reason.ilike("%meet%"),
                )
            )
        elif app_t == "duty_leave":
            query = query.filter(
                or_(
                    AttendanceApplication.reason.ilike("%duty%"),
                    AttendanceApplication.reason.ilike("%official%"),
                    AttendanceApplication.reason.ilike("%conference%"),
                    AttendanceApplication.reason.ilike("%hackathon%"),
                )
            )
        elif app_t == "personal_emergency":
            query = query.filter(
                or_(
                    AttendanceApplication.reason.ilike("%emerg%"),
                    AttendanceApplication.reason.ilike("%personal%"),
                    AttendanceApplication.reason.ilike("%family%"),
                )
            )

    return query


class ApplicationService:
    @staticmethod
    def get_application_detail(db: Session, app: AttendanceApplication) -> ApplicationDetailRead:
        student = db.query(StudentProfile).filter(StudentProfile.id == app.student_id).first()
        student_user = student.user if student else None

        offering = (
            db.query(SubjectOffering)
            .options(
                joinedload(SubjectOffering.subject),
                joinedload(SubjectOffering.course),
                joinedload(SubjectOffering.section),
                joinedload(SubjectOffering.student_group),
                joinedload(SubjectOffering.branch).joinedload(Branch.department),
            )
            .filter(SubjectOffering.id == app.subject_offering_id)
            .first()
        )

        course = offering.course if offering else None
        subject = offering.subject if offering else None
        branch = offering.branch if offering else None
        department = branch.department if branch else None
        section = offering.section if offering else None
        group = offering.student_group if offering else None

        faculty_rev_user = app.faculty_reviewer.user if app.faculty_reviewer else None
        coord_rev_user = app.coordinator_reviewer.user if app.coordinator_reviewer else None
        hod_rev_user = app.hod_reviewer.user if app.hod_reviewer else None

        class_type_str = offering.class_type.value if (offering and offering.class_type) else None
        app_type = deduce_application_type(app.reason)

        # Real attendance context & eligibility calculation
        threshold = float(SystemConfigService.get_setting(db, "minimum_attendance_percentage", default=75.0))
        valid_session_statuses = [SessionStatus.ACTIVE, SessionStatus.COMPLETED, SessionStatus.CLOSED]
        valid_att_statuses = [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED]

        sessions = (
            db.query(AttendanceSession.id)
            .filter(
                AttendanceSession.subject_offering_id == app.subject_offering_id,
                AttendanceSession.status.in_(valid_session_statuses),
            )
            .all()
        )
        total_sessions = len(sessions)
        session_ids = [s[0] for s in sessions]

        if total_sessions > 0 and session_ids:
            attended_sessions = (
                db.query(func.count(AttendanceRecord.id))
                .filter(
                    AttendanceRecord.student_id == app.student_id,
                    AttendanceRecord.session_id.in_(session_ids),
                    AttendanceRecord.status.in_(valid_att_statuses),
                )
                .scalar()
                or 0
            )
            attendance_pct = round((attended_sessions / total_sessions) * 100, 1)
        else:
            attended_sessions = 0
            attendance_pct = 100.0

        condonation_granted = app.status in [ApplicationStatus.APPROVED, ApplicationStatus.HOD_APPROVED]
        is_exam_eligible = (attendance_pct >= threshold) or condonation_granted

        return ApplicationDetailRead(
            id=app.id,
            student_id=app.student_id,
            student_name=student_user.full_name if student_user else "Unknown",
            student_roll_number=student.roll_number if student else "N/A",
            student_email=student_user.email if student_user else None,
            subject_offering_id=app.subject_offering_id,
            subject_name=subject.name if subject else "Unknown",
            subject_code=subject.code if subject else "N/A",
            course_name=course.name if course else None,
            branch_name=branch.name if branch else None,
            semester=offering.semester if offering else None,
            class_type=class_type_str,
            application_type=app_type,
            department_id=department.id if department else 0,
            department_name=department.name if department else "Unknown",
            section_name=section.name if section else "Unknown",
            student_group_name=group.name if group else None,
            reason=app.reason,
            description=app.description,
            supporting_document_url=app.supporting_document_url,
            status=app.status,
            faculty_reviewer_id=app.faculty_reviewer_id,
            faculty_reviewer_name=faculty_rev_user.full_name if faculty_rev_user else None,
            faculty_decision=app.faculty_decision,
            faculty_remarks=app.faculty_remarks,
            faculty_reviewed_at=app.faculty_reviewed_at,
            coordinator_reviewer_id=app.coordinator_reviewer_id,
            coordinator_reviewer_name=coord_rev_user.full_name if coord_rev_user else None,
            coordinator_decision=app.coordinator_decision,
            coordinator_remarks=app.coordinator_remarks,
            coordinator_reviewed_at=app.coordinator_reviewed_at,
            hod_reviewer_id=app.hod_reviewer_id,
            hod_reviewer_name=hod_rev_user.full_name if hod_rev_user else None,
            hod_decision=app.hod_decision,
            hod_remarks=app.hod_remarks,
            hod_reviewed_at=app.hod_reviewed_at,
            attendance_percentage=attendance_pct,
            attendance_threshold=threshold,
            total_sessions=total_sessions,
            attended_sessions=attended_sessions,
            is_exam_eligible=is_exam_eligible,
            condonation_granted=condonation_granted,
            submitted_at=app.submitted_at,
            created_at=app.created_at,
        )

    # ── Summary Statistics ───────────────────────────────────────────
    @staticmethod
    def get_application_stats(
        db: Session,
        faculty_id: int | None = None,
        is_admin: bool = False,
        student_id: int | None = None,
    ) -> ApplicationStats:
        query = db.query(AttendanceApplication)
        if student_id is not None:
            query = query.filter(AttendanceApplication.student_id == student_id)
        elif faculty_id is not None and not is_admin:
            # Aggregate teaching assignments, coordinator sections, and HOD departments
            assigned_offering_ids = {
                a[0]
                for a in db.query(FacultyAssignment.subject_offering_id)
                .filter(FacultyAssignment.faculty_id == faculty_id, FacultyAssignment.is_active.is_(True))
                .all()
            }

            coord_resps = (
                db.query(FacultyResponsibility)
                .filter(
                    FacultyResponsibility.faculty_id == faculty_id,
                    FacultyResponsibility.responsibility_type == ResponsibilityType.COORDINATOR,
                    FacultyResponsibility.is_active.is_(True),
                )
                .all()
            )
            coord_section_ids: set[int] = set()
            for cr in coord_resps:
                if cr.section_id:
                    coord_section_ids.add(cr.section_id)
                elif cr.department_id:
                    dept_sec_ids = [
                        s[0]
                        for s in db.query(Section.id)
                        .join(Batch, Section.batch_id == Batch.id)
                        .join(Branch, Batch.branch_id == Branch.id)
                        .filter(Branch.department_id == cr.department_id)
                        .all()
                    ]
                    coord_section_ids.update(dept_sec_ids)

            if coord_section_ids:
                coord_offering_ids = {
                    o[0]
                    for o in db.query(SubjectOffering.id)
                    .filter(SubjectOffering.section_id.in_(coord_section_ids))
                    .all()
                }
            else:
                coord_offering_ids = set()

            hod_resps = (
                db.query(FacultyResponsibility)
                .filter(
                    FacultyResponsibility.faculty_id == faculty_id,
                    FacultyResponsibility.responsibility_type == ResponsibilityType.HOD,
                    FacultyResponsibility.is_active.is_(True),
                )
                .all()
            )
            hod_dept_ids = {hr.department_id for hr in hod_resps if hr.department_id}
            if hod_dept_ids:
                hod_offering_ids = {
                    o[0]
                    for o in db.query(SubjectOffering.id)
                    .join(Branch, SubjectOffering.branch_id == Branch.id)
                    .filter(Branch.department_id.in_(hod_dept_ids))
                    .all()
                }
            else:
                hod_offering_ids = set()

            all_offering_ids = assigned_offering_ids | coord_offering_ids | hod_offering_ids
            if not all_offering_ids:
                return ApplicationStats(
                    total_applications=0,
                    pending_faculty=0,
                    pending_coordinator=0,
                    pending_hod=0,
                    approved=0,
                    rejected=0,
                )
            query = query.filter(AttendanceApplication.subject_offering_id.in_(all_offering_ids))

        all_apps = query.all()
        total = len(all_apps)
        p_fac = sum(1 for a in all_apps if a.status == ApplicationStatus.PENDING_FACULTY)
        p_coord = sum(1 for a in all_apps if a.status == ApplicationStatus.PENDING_COORDINATOR)
        p_hod = sum(
            1
            for a in all_apps
            if a.status in [ApplicationStatus.PENDING_HOD, ApplicationStatus.FACULTY_APPROVED]
        )
        approved = sum(
            1
            for a in all_apps
            if a.status in [ApplicationStatus.APPROVED, ApplicationStatus.HOD_APPROVED]
        )
        rejected = sum(
            1
            for a in all_apps
            if a.status in [ApplicationStatus.REJECTED, ApplicationStatus.FACULTY_REJECTED, ApplicationStatus.HOD_REJECTED]
        )

        return ApplicationStats(
            total_applications=total,
            pending_faculty=p_fac,
            pending_coordinator=p_coord,
            pending_hod=p_hod,
            approved=approved,
            rejected=rejected,
        )

    # ── Audit History ────────────────────────────────────────────────
    @staticmethod
    def get_application_history(db: Session, application_id: int) -> list[ApplicationHistoryItem]:
        logs = (
            db.query(AuditLog)
            .options(joinedload(AuditLog.user))
            .filter(
                AuditLog.entity_type == "ATTENDANCE_APPLICATION",
                AuditLog.entity_id == application_id,
            )
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .all()
        )
        history: list[ApplicationHistoryItem] = []
        for log in logs:
            meta: dict[str, Any] = {}
            if log.metadata_json:
                try:
                    meta = json.loads(log.metadata_json)
                except Exception:
                    pass
            history.append(
                ApplicationHistoryItem(
                    id=log.id,
                    action=log.action,
                    user_id=log.user_id,
                    user_name=log.user.full_name if log.user else (meta.get("reviewer_name") or "System"),
                    user_role=log.user.role.value if (log.user and hasattr(log.user.role, "value")) else None,
                    stage=meta.get("stage"),
                    decision=meta.get("decision"),
                    remarks=log.reason or meta.get("remarks"),
                    created_at=log.created_at.isoformat() if log.created_at else None,
                )
            )
        return history

    # ── Student: Submit Application ──────────────────────────────────
    @staticmethod
    def submit_application(
        db: Session, student: StudentProfile, payload: ApplicationCreate
    ) -> AttendanceApplication:
        offering = (
            db.query(SubjectOffering)
            .filter(SubjectOffering.id == payload.subject_offering_id, SubjectOffering.is_active.is_(True))
            .first()
        )
        if not offering:
            raise ValueError("Subject offering not found or inactive")

        enrollment = (
            db.query(AcademicEnrollment)
            .filter(
                AcademicEnrollment.student_id == student.id,
                AcademicEnrollment.is_current.is_(True),
                AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
                AcademicEnrollment.course_id == offering.course_id,
                AcademicEnrollment.branch_id == offering.branch_id,
                AcademicEnrollment.semester == offering.semester,
                AcademicEnrollment.section_id == offering.section_id,
            )
            .first()
        )
        if not enrollment:
            raise ValueError("You are not enrolled in the course/branch/section for this subject offering")

        if offering.student_group_id is not None and enrollment.student_group_id != offering.student_group_id:
            raise ValueError("You are not in the student group assigned to this subject offering")

        existing_active = (
            db.query(AttendanceApplication)
            .filter(
                AttendanceApplication.student_id == student.id,
                AttendanceApplication.subject_offering_id == offering.id,
                AttendanceApplication.status.in_([
                    ApplicationStatus.PENDING_FACULTY,
                    ApplicationStatus.PENDING_COORDINATOR,
                    ApplicationStatus.PENDING_HOD,
                    ApplicationStatus.FACULTY_APPROVED,
                ]),
            )
            .first()
        )
        if existing_active:
            raise ValueError("An active application is already pending for this subject offering")

        app = AttendanceApplication(
            student_id=student.id,
            subject_offering_id=offering.id,
            enrollment_id=enrollment.id,
            reason=payload.reason,
            description=payload.description,
            supporting_document_url=payload.supporting_document_url,
            status=ApplicationStatus.PENDING_FACULTY,
        )
        db.add(app)
        db.commit()
        db.refresh(app)

        # Audit initial submission
        AuditService.log_action(
            db=db,
            user=student.user,
            action="APPLICATION_SUBMITTED",
            entity_type="ATTENDANCE_APPLICATION",
            entity_id=app.id,
            reason=payload.reason,
            metadata={
                "stage": "student_submission",
                "student_id": student.id,
                "student_roll": student.roll_number,
                "subject_offering_id": offering.id,
                "reason": payload.reason,
            },
        )

        try:
            from app.services.notification import NotificationService
            NotificationService.dispatch_application_notification(db, app.id, event="submitted")
            db.commit()
        except Exception:
            pass

        return app

    # ── Student: List Own Applications ───────────────────────────────
    @staticmethod
    def list_student_applications(
        db: Session,
        student_id: int,
        status: ApplicationStatus | None = None,
        application_type: str | None = None,
        query_str: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ApplicationDetailRead]:
        query = db.query(AttendanceApplication).filter(AttendanceApplication.student_id == student_id)
        if status is not None:
            query = query.filter(AttendanceApplication.status == status)

        query = apply_application_filters(
            query=query,
            db=db,
            query_str=query_str,
            application_type=application_type,
            start_date=start_date,
            end_date=end_date,
        )

        apps = query.order_by(AttendanceApplication.submitted_at.desc()).offset(offset).limit(limit).all()
        return [ApplicationService.get_application_detail(db, a) for a in apps]

    # ── Faculty: List Assigned Applications ──────────────────────────
    @staticmethod
    def list_faculty_applications(
        db: Session,
        faculty_id: int,
        status: ApplicationStatus | None = None,
        application_type: str | None = None,
        query_str: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ApplicationDetailRead]:
        assignments = (
            db.query(FacultyAssignment)
            .filter(FacultyAssignment.faculty_id == faculty_id, FacultyAssignment.is_active.is_(True))
            .all()
        )
        offering_ids = [a.subject_offering_id for a in assignments]
        if not offering_ids:
            return []

        query = db.query(AttendanceApplication).filter(
            AttendanceApplication.subject_offering_id.in_(offering_ids)
        )
        if status is not None:
            query = query.filter(AttendanceApplication.status == status)

        query = apply_application_filters(
            query=query,
            db=db,
            query_str=query_str,
            application_type=application_type,
            start_date=start_date,
            end_date=end_date,
        )

        apps = query.order_by(AttendanceApplication.submitted_at.desc()).offset(offset).limit(limit).all()
        return [ApplicationService.get_application_detail(db, a) for a in apps]

    # ── Faculty: Review Application ──────────────────────────────────
    @staticmethod
    def review_faculty_application(
        db: Session, application_id: int, faculty: FacultyProfile, payload: FacultyReviewRequest
    ) -> AttendanceApplication:
        app = db.query(AttendanceApplication).filter(AttendanceApplication.id == application_id).first()
        if not app:
            raise ValueError("Application not found")

        if app.status != ApplicationStatus.PENDING_FACULTY:
            raise ValueError(f"Application is in '{app.status.value}' state and cannot be reviewed by Faculty")

        if payload.decision == ReviewDecision.REJECTED and (not payload.remarks or not payload.remarks.strip()):
            raise ValueError("A rejection reason/remarks is required when rejecting a student application.")

        assignment = (
            db.query(FacultyAssignment)
            .filter(
                FacultyAssignment.faculty_id == faculty.id,
                FacultyAssignment.subject_offering_id == app.subject_offering_id,
                FacultyAssignment.is_active.is_(True),
            )
            .first()
        )
        if not assignment:
            raise PermissionError("You are not assigned as faculty for this subject offering")

        if payload.decision == ReviewDecision.APPROVED:
            app.status = ApplicationStatus.PENDING_COORDINATOR
            app.faculty_decision = ReviewDecision.APPROVED
        else:
            app.status = ApplicationStatus.REJECTED
            app.faculty_decision = ReviewDecision.REJECTED

        app.faculty_reviewer_id = faculty.id
        app.faculty_remarks = payload.remarks
        app.faculty_reviewed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(app)

        # Audit trail logging
        AuditService.log_action(
            db=db,
            user=faculty.user,
            action="APPLICATION_FACULTY_REVIEW",
            entity_type="ATTENDANCE_APPLICATION",
            entity_id=app.id,
            reason=payload.remarks,
            metadata={
                "stage": "faculty_review",
                "decision": payload.decision.value,
                "remarks": payload.remarks,
                "student_id": app.student_id,
                "subject_offering_id": app.subject_offering_id,
                "reviewer_name": faculty.user.full_name if faculty.user else None,
            },
        )

        try:
            from app.services.notification import NotificationService
            evt = "faculty_approved" if payload.decision == ReviewDecision.APPROVED else "faculty_rejected"
            NotificationService.dispatch_application_notification(db, app.id, event=evt, remarks=payload.remarks)
            db.commit()
        except Exception:
            pass

        return app

    # ── Section Coordinator: Helper to resolve coordinator sections ──
    @staticmethod
    def get_coordinator_sections(db: Session, faculty_id: int) -> set[int]:
        coord_resps = (
            db.query(FacultyResponsibility)
            .filter(
                FacultyResponsibility.faculty_id == faculty_id,
                FacultyResponsibility.responsibility_type == ResponsibilityType.COORDINATOR,
                FacultyResponsibility.is_active.is_(True),
            )
            .all()
        )
        if not coord_resps:
            return set()

        section_ids: set[int] = set()
        for resp in coord_resps:
            if resp.section_id:
                section_ids.add(resp.section_id)
            elif resp.department_id:
                dept_secs = (
                    db.query(Section.id)
                    .join(Batch, Section.batch_id == Batch.id)
                    .join(Branch, Batch.branch_id == Branch.id)
                    .filter(Branch.department_id == resp.department_id)
                    .all()
                )
                section_ids.update([s[0] for s in dept_secs])
        return section_ids

    # ── Section Coordinator: List Section Applications ────────────────
    @staticmethod
    def list_coordinator_applications(
        db: Session,
        faculty_id: int,
        status: ApplicationStatus | None = None,
        application_type: str | None = None,
        query_str: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ApplicationDetailRead]:
        section_ids = ApplicationService.get_coordinator_sections(db, faculty_id)
        if not section_ids:
            return []

        query = (
            db.query(AttendanceApplication)
            .join(SubjectOffering, AttendanceApplication.subject_offering_id == SubjectOffering.id)
            .filter(SubjectOffering.section_id.in_(section_ids))
        )
        if status is not None:
            query = query.filter(AttendanceApplication.status == status)

        query = apply_application_filters(
            query=query,
            db=db,
            query_str=query_str,
            application_type=application_type,
            start_date=start_date,
            end_date=end_date,
        )

        apps = query.order_by(AttendanceApplication.submitted_at.desc()).offset(offset).limit(limit).all()
        return [ApplicationService.get_application_detail(db, a) for a in apps]

    # ── Section Coordinator: Review Application ───────────────────────
    @staticmethod
    def review_coordinator_application(
        db: Session, application_id: int, faculty: FacultyProfile, payload: CoordinatorReviewRequest
    ) -> AttendanceApplication:
        app = db.query(AttendanceApplication).filter(AttendanceApplication.id == application_id).first()
        if not app:
            raise ValueError("Application not found")

        if app.status != ApplicationStatus.PENDING_COORDINATOR:
            raise ValueError(
                f"Application is in '{app.status.value}' state and cannot be reviewed by Section Coordinator. "
                "Applications must be approved by Subject Faculty first."
            )

        if payload.decision == ReviewDecision.REJECTED and (not payload.remarks or not payload.remarks.strip()):
            raise ValueError("A rejection reason/remarks is required when rejecting a student application.")

        # Check coordinator responsibility for this section
        section_ids = ApplicationService.get_coordinator_sections(db, faculty.id)
        offering = db.query(SubjectOffering).filter(SubjectOffering.id == app.subject_offering_id).first()
        if not offering or offering.section_id not in section_ids:
            raise PermissionError("Application belongs to a section outside your Section Coordinator assignment")

        if payload.decision == ReviewDecision.APPROVED:
            app.status = ApplicationStatus.PENDING_HOD
            app.coordinator_decision = ReviewDecision.APPROVED
        else:
            app.status = ApplicationStatus.REJECTED
            app.coordinator_decision = ReviewDecision.REJECTED

        app.coordinator_reviewer_id = faculty.id
        app.coordinator_remarks = payload.remarks
        app.coordinator_reviewed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(app)

        # Audit trail logging
        AuditService.log_action(
            db=db,
            user=faculty.user,
            action="APPLICATION_COORDINATOR_REVIEW",
            entity_type="ATTENDANCE_APPLICATION",
            entity_id=app.id,
            reason=payload.remarks,
            metadata={
                "stage": "coordinator_review",
                "decision": payload.decision.value,
                "remarks": payload.remarks,
                "student_id": app.student_id,
                "subject_offering_id": app.subject_offering_id,
                "reviewer_name": faculty.user.full_name if faculty.user else None,
            },
        )

        try:
            from app.services.notification import NotificationService
            evt = "coordinator_approved" if payload.decision == ReviewDecision.APPROVED else "coordinator_rejected"
            NotificationService.dispatch_application_notification(db, app.id, event=evt, remarks=payload.remarks)
            db.commit()
        except Exception:
            pass

        return app

    # ── HOD: Helper to find active HOD responsibility ────────────────
    @staticmethod
    def get_hod_responsibility(db: Session, faculty_id: int) -> FacultyResponsibility:
        hod_resp = (
            db.query(FacultyResponsibility)
            .filter(
                FacultyResponsibility.faculty_id == faculty_id,
                FacultyResponsibility.responsibility_type == ResponsibilityType.HOD,
                FacultyResponsibility.is_active.is_(True),
            )
            .first()
        )
        if not hod_resp or not hod_resp.department_id:
            raise PermissionError("User does not have an active HOD responsibility assigned")
        return hod_resp

    # ── HOD: List Department Applications ────────────────────────────
    @staticmethod
    def list_hod_applications(
        db: Session,
        faculty_id: int,
        status: ApplicationStatus | None = None,
        application_type: str | None = None,
        query_str: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ApplicationDetailRead]:
        hod_resp = ApplicationService.get_hod_responsibility(db, faculty_id)
        department_id = hod_resp.department_id

        query = (
            db.query(AttendanceApplication)
            .join(SubjectOffering, AttendanceApplication.subject_offering_id == SubjectOffering.id)
            .join(Branch, SubjectOffering.branch_id == Branch.id)
            .filter(Branch.department_id == department_id)
        )
        if status is not None:
            query = query.filter(AttendanceApplication.status == status)

        query = apply_application_filters(
            query=query,
            db=db,
            query_str=query_str,
            application_type=application_type,
            start_date=start_date,
            end_date=end_date,
        )

        apps = query.order_by(AttendanceApplication.submitted_at.desc()).offset(offset).limit(limit).all()
        return [ApplicationService.get_application_detail(db, a) for a in apps]

    # ── HOD: Review Application ──────────────────────────────────────
    @staticmethod
    def review_hod_application(
        db: Session, application_id: int, faculty: FacultyProfile, payload: HODReviewRequest
    ) -> AttendanceApplication:
        app = db.query(AttendanceApplication).filter(AttendanceApplication.id == application_id).first()
        if not app:
            raise ValueError("Application not found")

        if app.status not in [ApplicationStatus.PENDING_HOD, ApplicationStatus.FACULTY_APPROVED]:
            raise ValueError(
                f"Application is in '{app.status.value}' state and is not ready for HOD decision. "
                "Applications must be approved by Subject Faculty and Section Coordinator first."
            )

        if payload.decision == ReviewDecision.REJECTED and (not payload.remarks or not payload.remarks.strip()):
            raise ValueError("A rejection reason/remarks is required when rejecting a student application.")

        hod_resp = ApplicationService.get_hod_responsibility(db, faculty.id)
        offering = (
            db.query(SubjectOffering)
            .join(Branch, SubjectOffering.branch_id == Branch.id)
            .filter(SubjectOffering.id == app.subject_offering_id)
            .first()
        )
        if not offering or offering.branch.department_id != hod_resp.department_id:
            raise PermissionError("Application belongs to a department outside your HOD responsibility")

        if payload.decision == ReviewDecision.APPROVED:
            app.status = ApplicationStatus.APPROVED
            app.hod_decision = ReviewDecision.APPROVED
        else:
            app.status = ApplicationStatus.REJECTED
            app.hod_decision = ReviewDecision.REJECTED

        app.hod_reviewer_id = faculty.id
        app.hod_remarks = payload.remarks
        app.hod_reviewed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(app)

        # Audit trail logging: HOD Decision
        AuditService.log_action(
            db=db,
            user=faculty.user,
            action="APPLICATION_HOD_DECISION",
            entity_type="ATTENDANCE_APPLICATION",
            entity_id=app.id,
            reason=payload.remarks,
            metadata={
                "stage": "hod_decision",
                "decision": payload.decision.value,
                "remarks": payload.remarks,
                "student_id": app.student_id,
                "subject_offering_id": app.subject_offering_id,
                "reviewer_name": faculty.user.full_name if faculty.user else None,
            },
        )

        # If approved, record exam eligibility & condonation in audit log
        if payload.decision == ReviewDecision.APPROVED:
            AuditService.log_action(
                db=db,
                user=faculty.user,
                action="EXAM_ELIGIBILITY_GRANTED",
                entity_type="ATTENDANCE_APPLICATION",
                entity_id=app.id,
                reason="Attendance condonation approved by HOD; exam eligibility granted.",
                metadata={
                    "stage": "condonation_granted",
                    "student_id": app.student_id,
                    "subject_offering_id": app.subject_offering_id,
                    "condonation_granted": True,
                    "is_exam_eligible": True,
                    "approved_by_hod_id": faculty.id,
                },
            )

        try:
            from app.services.notification import NotificationService
            evt = "hod_approved" if payload.decision == ReviewDecision.APPROVED else "hod_rejected"
            NotificationService.dispatch_application_notification(db, app.id, event=evt, remarks=payload.remarks)
            db.commit()
        except Exception:
            pass

        return app

    # ── Admin: List Applications with Filters ────────────────────────
    @staticmethod
    def list_admin_applications(
        db: Session,
        student_id: int | None = None,
        department_id: int | None = None,
        status: ApplicationStatus | None = None,
        application_type: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        query_str: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ApplicationDetailRead]:
        query = db.query(AttendanceApplication)

        if student_id is not None:
            query = query.filter(AttendanceApplication.student_id == student_id)
        if status is not None:
            query = query.filter(AttendanceApplication.status == status)

        if department_id is not None:
            query = (
                query.join(SubjectOffering, AttendanceApplication.subject_offering_id == SubjectOffering.id)
                .join(Branch, SubjectOffering.branch_id == Branch.id)
                .filter(Branch.department_id == department_id)
            )

        query = apply_application_filters(
            query=query,
            db=db,
            query_str=query_str,
            application_type=application_type,
            start_date=start_date,
            end_date=end_date,
        )

        apps = query.order_by(AttendanceApplication.submitted_at.desc()).offset(offset).limit(limit).all()
        return [ApplicationService.get_application_detail(db, a) for a in apps]

