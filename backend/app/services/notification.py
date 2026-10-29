"""Notice Board & Notification Service — Phase 10

Implements audience-targeted Notice publishing and user-specific Notification dispatch.
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models import (
    AcademicEnrollment,
    AudienceType,
    AuditLog,
    Branch,
    Department,
    EnrollmentStatus,
    FacultyProfile,
    FacultyResponsibility,
    Notice,
    Notification,
    NotificationType,
    ResponsibilityType,
    Section,
    StudentGroup,
    StudentProfile,
    User,
    UserRole,
)
from app.schemas import (
    NoticeCreate,
    NoticeDetailRead,
    NoticeUpdate,
    NotificationCounts,
    NotificationRead,
)


class NotificationService:
    @staticmethod
    def get_eligible_user_ids_for_notice(db: Session, notice: Notice) -> set[int]:
        """Determine eligible recipient user_ids based on audience type and targeting criteria."""
        user_ids: set[int] = set()

        if notice.audience_type == AudienceType.ALL:
            users = db.query(User.id).filter(User.is_active.is_(True)).all()
            return {u[0] for u in users}

        elif notice.audience_type == AudienceType.STUDENTS:
            students = (
                db.query(User.id)
                .filter(User.role == UserRole.STUDENT, User.is_active.is_(True))
                .all()
            )
            return {s[0] for s in students}

        elif notice.audience_type == AudienceType.FACULTY:
            faculty = (
                db.query(User.id)
                .filter(User.role == UserRole.FACULTY, User.is_active.is_(True))
                .all()
            )
            return {f[0] for f in faculty}

        elif notice.audience_type == AudienceType.COORDINATORS:
            coord_users = (
                db.query(FacultyProfile.user_id)
                .join(FacultyResponsibility, FacultyResponsibility.faculty_id == FacultyProfile.id)
                .join(User, FacultyProfile.user_id == User.id)
                .filter(
                    FacultyResponsibility.responsibility_type == ResponsibilityType.COORDINATOR,
                    FacultyResponsibility.is_active.is_(True),
                    User.is_active.is_(True),
                )
                .distinct()
                .all()
            )
            return {c[0] for c in coord_users}

        elif notice.audience_type == AudienceType.DEPARTMENT:
            if not notice.department_id:
                return set()

            # 1. Faculty belonging to this department
            fac_users = (
                db.query(FacultyProfile.user_id)
                .join(User, FacultyProfile.user_id == User.id)
                .filter(FacultyProfile.department_id == notice.department_id, User.is_active.is_(True))
                .all()
            )
            user_ids.update(f[0] for f in fac_users)

            # 2. Students enrolled in branches of this department
            student_users = (
                db.query(StudentProfile.user_id)
                .join(AcademicEnrollment, StudentProfile.id == AcademicEnrollment.student_id)
                .join(Branch, AcademicEnrollment.branch_id == Branch.id)
                .join(User, StudentProfile.user_id == User.id)
                .filter(
                    Branch.department_id == notice.department_id,
                    AcademicEnrollment.is_current.is_(True),
                    AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
                    User.is_active.is_(True),
                )
                .all()
            )
            user_ids.update(s[0] for s in student_users)
            return user_ids

        elif notice.audience_type == AudienceType.BRANCH:
            if not notice.branch_id:
                return set()

            # 1. Students enrolled in this branch
            student_users = (
                db.query(StudentProfile.user_id)
                .join(AcademicEnrollment, StudentProfile.id == AcademicEnrollment.student_id)
                .join(User, StudentProfile.user_id == User.id)
                .filter(
                    AcademicEnrollment.branch_id == notice.branch_id,
                    AcademicEnrollment.is_current.is_(True),
                    AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
                    User.is_active.is_(True),
                )
                .all()
            )
            user_ids.update(s[0] for s in student_users)

            # 2. Faculty in the department of this branch
            branch = db.query(Branch).filter(Branch.id == notice.branch_id).first()
            if branch and branch.department_id:
                fac_users = (
                    db.query(FacultyProfile.user_id)
                    .join(User, FacultyProfile.user_id == User.id)
                    .filter(FacultyProfile.department_id == branch.department_id, User.is_active.is_(True))
                    .all()
                )
                user_ids.update(f[0] for f in fac_users)
            return user_ids

        elif notice.audience_type == AudienceType.GROUP:
            if not notice.student_group_id:
                return set()

            student_users = (
                db.query(StudentProfile.user_id)
                .join(AcademicEnrollment, StudentProfile.id == AcademicEnrollment.student_id)
                .join(User, StudentProfile.user_id == User.id)
                .filter(
                    AcademicEnrollment.student_group_id == notice.student_group_id,
                    AcademicEnrollment.is_current.is_(True),
                    AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
                    User.is_active.is_(True),
                )
                .all()
            )
            return {s[0] for s in student_users}

        return set()

    @staticmethod
    def resolve_notification_read(n: Notification) -> NotificationRead:
        link_url = "/dashboard"
        action_label = "View Details"
        if n.notification_type == NotificationType.NOTICE:
            link_url = "/dashboard/notices"
            action_label = "View Notice"
        elif n.notification_type == NotificationType.APPLICATION:
            link_url = "/dashboard/applications"
            action_label = "View Application"
        elif n.notification_type == NotificationType.ATTENDANCE:
            link_url = "/dashboard/attendance"
            action_label = "View Attendance"
        elif n.notification_type == NotificationType.SYSTEM:
            link_url = "/dashboard"
            action_label = "Go to Dashboard"

        return NotificationRead(
            id=n.id,
            user_id=n.user_id,
            title=n.title,
            message=n.message,
            notification_type=n.notification_type,
            related_entity_id=n.related_entity_id,
            is_read=n.is_read,
            read_at=n.read_at,
            created_at=n.created_at,
            link_url=link_url,
            action_label=action_label,
        )

    @staticmethod
    def dispatch_notification(
        db: Session,
        user_id: int,
        title: str,
        message: str,
        notification_type: NotificationType = NotificationType.SYSTEM,
        related_entity_id: int | None = None,
    ) -> Notification:
        """Create a notification for a user, avoiding duplicate unread notifications."""
        existing = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.notification_type == notification_type,
                Notification.related_entity_id == related_entity_id,
                Notification.title == title,
            )
            .first()
        )
        if existing:
            return existing

        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            related_entity_id=related_entity_id,
            is_read=False,
        )
        db.add(notif)
        db.flush()

        # Trigger native background push notification via FCM if user has active registered tokens
        try:
            from app.services.push_notification import PushNotificationService
            tokens = PushNotificationService.get_user_tokens(db, user_id)
            if tokens:
                PushNotificationService.send_multicast(
                    db=db,
                    tokens=tokens,
                    title=title,
                    body=message[:150] + ("..." if len(message) > 150 else ""),
                    data={
                        "type": notification_type.value if hasattr(notification_type, "value") else str(notification_type),
                        "related_entity_id": str(related_entity_id) if related_entity_id is not None else "",
                    },
                )
        except Exception as push_err:
            logger.warning(f"FCM push notification dispatch skipped or failed for user #{user_id}: {push_err}")

        return notif

    @staticmethod
    def dispatch_notice_notifications(db: Session, notice: Notice) -> int:
        """Create user-specific notification records for all eligible recipients of a notice.
        Deduplicates so already notified users are not notified twice.
        """
        eligible_user_ids = NotificationService.get_eligible_user_ids_for_notice(db, notice)
        if not eligible_user_ids:
            return 0

        # Query users who have already received a notification for this notice
        existing_uids = {
            row[0]
            for row in db.query(Notification.user_id)
            .filter(
                Notification.notification_type == NotificationType.NOTICE,
                Notification.related_entity_id == notice.id,
            )
            .all()
        }
        target_uids = eligible_user_ids - existing_uids
        if not target_uids:
            return 0

        notifications = [
            Notification(
                user_id=uid,
                title=notice.title,
                message=notice.content,
                notification_type=NotificationType.NOTICE,
                related_entity_id=notice.id,
                is_read=False,
            )
            for uid in target_uids
        ]
        db.add_all(notifications)
        db.flush()
        return len(notifications)

    @staticmethod
    def list_user_notifications(
        db: Session,
        user_id: int,
        is_read: bool | None = None,
        notification_type: NotificationType | None = None,
        search: str | None = None,
        start_date: Any | None = None,
        end_date: Any | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[NotificationRead]:
        query = db.query(Notification).filter(Notification.user_id == user_id)
        if is_read is not None:
            query = query.filter(Notification.is_read == is_read)
        if notification_type is not None:
            query = query.filter(Notification.notification_type == notification_type)
        if search:
            search_pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Notification.title.ilike(search_pattern),
                    Notification.message.ilike(search_pattern),
                )
            )
        if start_date:
            start_dt = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
            query = query.filter(Notification.created_at >= start_dt)
        if end_date:
            end_dt = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
            query = query.filter(Notification.created_at <= end_dt)

        items = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
        return [NotificationService.resolve_notification_read(n) for n in items]

    @staticmethod
    def get_user_notification_counts(db: Session, user_id: int) -> NotificationCounts:
        total_count = db.query(Notification).filter(Notification.user_id == user_id).count()
        unread_count = (
            db.query(Notification)
            .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
            .count()
        )
        read_count = total_count - unread_count
        return NotificationCounts(all=total_count, unread=unread_count, read=read_count)

    @staticmethod
    def mark_as_read(db: Session, notification_id: int, user_id: int) -> NotificationRead:
        notification = db.query(Notification).filter(Notification.id == notification_id).first()
        if not notification:
            raise ValueError("Notification not found")
        if notification.user_id != user_id:
            raise PermissionError("Not authorized to access another user's notification")

        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
        return NotificationService.resolve_notification_read(notification)

    @staticmethod
    def mark_all_as_read(db: Session, user_id: int) -> int:
        now = datetime.now(timezone.utc)
        updated = (
            db.query(Notification)
            .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
            .update({"is_read": True, "read_at": now}, synchronize_session=False)
        )
        db.commit()
        return updated

    @staticmethod
    def delete_notification(db: Session, notification_id: int, user_id: int) -> bool:
        notification = db.query(Notification).filter(Notification.id == notification_id).first()
        if not notification:
            raise ValueError("Notification not found")
        if notification.user_id != user_id:
            raise PermissionError("Not authorized to delete another user's notification")

        db.delete(notification)
        db.commit()
        return True

    @staticmethod
    def dispatch_application_notification(
        db: Session,
        application_id: int,
        event: str,
        remarks: str | None = None,
    ) -> None:
        """Dispatch notifications for attendance application workflows."""
        from app.models import AttendanceApplication, FacultyResponsibility, ResponsibilityType
        app = db.query(AttendanceApplication).filter(AttendanceApplication.id == application_id).first()
        if not app:
            return

        student = app.student
        student_user_id = student.user_id if student else None
        subject_name = app.subject_offering.subject.name if (app.subject_offering and app.subject_offering.subject) else "Subject"

        if event == "submitted":
            # Notify student
            if student_user_id:
                NotificationService.dispatch_notification(
                    db=db,
                    user_id=student_user_id,
                    title=f"Application Submitted: #APP-{app.id}",
                    message=f"Your attendance condonation application for {subject_name} was successfully submitted for Faculty review.",
                    notification_type=NotificationType.APPLICATION,
                    related_entity_id=app.id,
                )
            # Notify assigned faculty reviewer or offering teaching faculty
            notified_faculty_ids = set()
            if app.faculty_reviewer and app.faculty_reviewer.user_id:
                notified_faculty_ids.add(app.faculty_reviewer.user_id)
            elif app.subject_offering:
                for asgn in app.subject_offering.faculty_assignments:
                    if asgn.is_active and asgn.faculty and asgn.faculty.user_id:
                        notified_faculty_ids.add(asgn.faculty.user_id)

            for fac_uid in notified_faculty_ids:
                NotificationService.dispatch_notification(
                    db=db,
                    user_id=fac_uid,
                    title=f"New Application Pending Review: #APP-{app.id}",
                    message=f"Student {student.user.full_name if student and student.user else 'Student'} submitted an application for {subject_name}.",
                    notification_type=NotificationType.APPLICATION,
                    related_entity_id=app.id,
                )

        elif event == "faculty_approved":
            # Notify student
            if student_user_id:
                rem_text = f" Remarks: '{remarks}'" if remarks else ""
                NotificationService.dispatch_notification(
                    db=db,
                    user_id=student_user_id,
                    title=f"Application #APP-{app.id} Faculty Approved",
                    message=f"Faculty approved your application for {subject_name}. Forwarded to Section Coordinator for review.{rem_text}",
                    notification_type=NotificationType.APPLICATION,
                    related_entity_id=app.id,
                )
            # Notify Section Coordinator if assigned
            sec_id = app.subject_offering.section_id if app.subject_offering else None
            if sec_id:
                coord_resp = (
                    db.query(FacultyResponsibility)
                    .filter(
                        FacultyResponsibility.responsibility_type == ResponsibilityType.COORDINATOR,
                        FacultyResponsibility.section_id == sec_id,
                        FacultyResponsibility.is_active.is_(True),
                    )
                    .first()
                )
                if coord_resp and coord_resp.faculty and coord_resp.faculty.user_id:
                    NotificationService.dispatch_notification(
                        db=db,
                        user_id=coord_resp.faculty.user_id,
                        title=f"Application #APP-{app.id} Pending Coordinator Review",
                        message=f"Faculty approved application for student {student.user.full_name if student and student.user else 'Student'}. Section Coordinator review required.",
                        notification_type=NotificationType.APPLICATION,
                        related_entity_id=app.id,
                    )

        elif event == "coordinator_approved":
            # Notify student
            if student_user_id:
                rem_text = f" Remarks: '{remarks}'" if remarks else ""
                NotificationService.dispatch_notification(
                    db=db,
                    user_id=student_user_id,
                    title=f"Application #APP-{app.id} Coordinator Approved",
                    message=f"Section Coordinator approved your application for {subject_name}. Forwarded to HOD for final decision.{rem_text}",
                    notification_type=NotificationType.APPLICATION,
                    related_entity_id=app.id,
                )
            # Notify HOD of department if applicable
            dept_id = app.subject_offering.subject.department_id if (app.subject_offering and app.subject_offering.subject) else None
            if dept_id:
                hod_resp = (
                    db.query(FacultyResponsibility)
                    .filter(
                        FacultyResponsibility.responsibility_type == ResponsibilityType.HOD,
                        FacultyResponsibility.department_id == dept_id,
                        FacultyResponsibility.is_active.is_(True),
                    )
                    .first()
                )
                if hod_resp and hod_resp.faculty and hod_resp.faculty.user_id:
                    NotificationService.dispatch_notification(
                        db=db,
                        user_id=hod_resp.faculty.user_id,
                        title=f"Application #APP-{app.id} Awaiting Final Decision",
                        message=f"Coordinator approved application for student {student.user.full_name if student and student.user else 'Student'}. Final HOD decision required.",
                        notification_type=NotificationType.APPLICATION,
                        related_entity_id=app.id,
                    )

        elif event == "coordinator_rejected":
            if student_user_id:
                rem_text = f" Reason: '{remarks}'" if remarks else ""
                NotificationService.dispatch_notification(
                    db=db,
                    user_id=student_user_id,
                    title=f"Application #APP-{app.id} Rejected by Coordinator",
                    message=f"Your application for {subject_name} was rejected by Section Coordinator.{rem_text}",
                    notification_type=NotificationType.APPLICATION,
                    related_entity_id=app.id,
                )

        elif event == "faculty_rejected":
            if student_user_id:
                rem_text = f" Reason: '{remarks}'" if remarks else ""
                NotificationService.dispatch_notification(
                    db=db,
                    user_id=student_user_id,
                    title=f"Application #APP-{app.id} Rejected by Faculty",
                    message=f"Your application for {subject_name} was rejected by faculty.{rem_text}",
                    notification_type=NotificationType.APPLICATION,
                    related_entity_id=app.id,
                )

        elif event == "hod_approved":
            if student_user_id:
                rem_text = f" Remarks: '{remarks}'" if remarks else ""
                NotificationService.dispatch_notification(
                    db=db,
                    user_id=student_user_id,
                    title=f"Application #APP-{app.id} Final Decision: Approved & Condoned",
                    message=f"HOD has rendered final approval. Your attendance records for {subject_name} have been condoned and exam eligibility granted.{rem_text}",
                    notification_type=NotificationType.APPLICATION,
                    related_entity_id=app.id,
                )

        elif event == "hod_rejected":
            if student_user_id:
                rem_text = f" Reason: '{remarks}'" if remarks else ""
                NotificationService.dispatch_notification(
                    db=db,
                    user_id=student_user_id,
                    title=f"Application #APP-{app.id} Final Decision: Rejected",
                    message=f"HOD has rejected your application for {subject_name}.{rem_text}",
                    notification_type=NotificationType.APPLICATION,
                    related_entity_id=app.id,
                )

    @staticmethod
    def dispatch_attendance_session_notification(
        db: Session,
        session_id: int,
    ) -> int:
        """Notify enrolled students when an attendance session starts."""
        from app.models import AttendanceSession, AcademicEnrollment, StudentProfile
        sess = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not sess or not sess.subject_offering:
            return 0

        offering = sess.subject_offering
        subject = offering.subject
        sub_name = subject.name if subject else "Class"
        sub_code = subject.code if subject else "Session"
        room = sess.timetable_entry.room_number if sess.timetable_entry else "Campus"

        # Find eligible students for this offering
        enrollment_query = (
            db.query(StudentProfile.user_id)
            .join(AcademicEnrollment, StudentProfile.id == AcademicEnrollment.student_id)
            .filter(
                AcademicEnrollment.branch_id == offering.branch_id,
                AcademicEnrollment.semester == offering.semester,
                AcademicEnrollment.is_current.is_(True),
            )
        )
        if sess.student_group_id:
            enrollment_query = enrollment_query.filter(
                AcademicEnrollment.student_group_id == sess.student_group_id
            )

        user_ids = {row[0] for row in enrollment_query.all()}
        count = 0
        for uid in user_ids:
            notif = NotificationService.dispatch_notification(
                db=db,
                user_id=uid,
                title=f"Attendance Active: {sub_code} - {sub_name}",
                message=f"Live attendance session started in {room}. Check in on your mobile app within the geofence.",
                notification_type=NotificationType.ATTENDANCE,
                related_entity_id=sess.id,
            )
            if notif:
                count += 1
        return count

    @staticmethod
    def dispatch_security_alert_notification(
        db: Session,
        activity_id: int,
    ) -> None:
        """Notify session faculty when suspicious attendance activity is flagged."""
        from app.models import SuspiciousActivity
        act = db.query(SuspiciousActivity).filter(SuspiciousActivity.id == activity_id).first()
        if not act or not act.session:
            return

        session = act.session
        faculty_user_id = None
        if session.faculty and session.faculty.user_id:
            faculty_user_id = session.faculty.user_id
        elif session.faculty_assignment and session.faculty_assignment.faculty:
            faculty_user_id = session.faculty_assignment.faculty.user_id

        if faculty_user_id:
            NotificationService.dispatch_notification(
                db=db,
                user_id=faculty_user_id,
                title=f"Security Alert: Attendance Anomaly (Risk: {int(act.risk_score)})",
                message=f"Suspicious activity ({act.detection_method.value.upper()}) flagged for session #{session.id}. Review pending in Control Center.",
                notification_type=NotificationType.SYSTEM,
                related_entity_id=act.id,
            )


class NoticeService:
    @staticmethod
    def get_notice_detail(db: Session, notice: Notice) -> NoticeDetailRead:
        creator = db.query(User).filter(User.id == notice.created_by).first()
        dept = db.query(Department).filter(Department.id == notice.department_id).first() if notice.department_id else None
        branch = db.query(Branch).filter(Branch.id == notice.branch_id).first() if notice.branch_id else None
        group = db.query(StudentGroup).filter(StudentGroup.id == notice.student_group_id).first() if notice.student_group_id else None

        return NoticeDetailRead(
            id=notice.id,
            title=notice.title,
            content=notice.content,
            created_by=notice.created_by,
            creator_name=creator.full_name if creator else "Admin",
            audience_type=notice.audience_type,
            department_id=notice.department_id,
            department_name=dept.name if dept else None,
            branch_id=notice.branch_id,
            branch_name=branch.name if branch else None,
            student_group_id=notice.student_group_id,
            student_group_name=group.name if group else None,
            category=notice.category or "General",
            expires_at=notice.expires_at,
            is_active=notice.is_active,
            published_at=notice.published_at,
            created_at=notice.created_at,
            updated_at=notice.updated_at,
        )

    @staticmethod
    def create_notice(db: Session, creator_id: int, payload: NoticeCreate) -> Notice:
        # Validate audience requirements
        if payload.audience_type == AudienceType.DEPARTMENT:
            if not payload.department_id:
                raise ValueError("department_id is required for DEPARTMENT audience")
            dept = db.query(Department).filter(Department.id == payload.department_id).first()
            if not dept:
                raise ValueError("Target department not found")

        elif payload.audience_type == AudienceType.BRANCH:
            if not payload.branch_id:
                raise ValueError("branch_id is required for BRANCH audience")
            br = db.query(Branch).filter(Branch.id == payload.branch_id).first()
            if not br:
                raise ValueError("Target branch not found")

        elif payload.audience_type == AudienceType.GROUP:
            if not payload.student_group_id:
                raise ValueError("student_group_id is required for GROUP audience")
            grp = db.query(StudentGroup).filter(StudentGroup.id == payload.student_group_id).first()
            if not grp:
                raise ValueError("Target student group not found")

        notice = Notice(
            title=payload.title,
            content=payload.content,
            created_by=creator_id,
            audience_type=payload.audience_type,
            department_id=payload.department_id,
            branch_id=payload.branch_id,
            student_group_id=payload.student_group_id,
            category=payload.category or "General",
            expires_at=payload.expires_at,
            is_active=payload.is_active,
        )
        db.add(notice)
        db.flush()

        # Audit log creation
        audit = AuditLog(
            user_id=creator_id,
            action="NOTICE_CREATED",
            entity_type="Notice",
            entity_id=notice.id,
            reason=f"Created notice '{notice.title}' targeted to audience '{notice.audience_type.value}'",
        )
        db.add(audit)

        if notice.is_active:
            NotificationService.dispatch_notice_notifications(db, notice)
            if (notice.category and notice.category.lower() in ("urgent", "exam")) or "urgent" in notice.title.lower():
                try:
                    from app.services.push_notification import PushNotificationService
                    PushNotificationService.dispatch_urgent_notice(db, notice)
                except Exception as push_err:
                    logger.warning(f"Push dispatch for urgent notice #{notice.id} skipped/failed: {push_err}")

        db.commit()
        db.refresh(notice)
        return notice

    @staticmethod
    def update_notice(db: Session, notice_id: int, payload: NoticeUpdate, updater_id: int | None = None) -> Notice:
        notice = db.query(Notice).filter(Notice.id == notice_id).first()
        if not notice:
            raise ValueError("Notice not found")

        was_inactive = not notice.is_active

        # If audience changed, validate requirements
        new_audience = payload.audience_type or notice.audience_type
        new_dept_id = payload.department_id if payload.department_id is not None else notice.department_id
        new_branch_id = payload.branch_id if payload.branch_id is not None else notice.branch_id
        new_group_id = payload.student_group_id if payload.student_group_id is not None else notice.student_group_id

        if new_audience == AudienceType.DEPARTMENT:
            if not new_dept_id:
                raise ValueError("department_id is required for DEPARTMENT audience")
            dept = db.query(Department).filter(Department.id == new_dept_id).first()
            if not dept:
                raise ValueError("Target department not found")
        elif new_audience == AudienceType.BRANCH:
            if not new_branch_id:
                raise ValueError("branch_id is required for BRANCH audience")
            br = db.query(Branch).filter(Branch.id == new_branch_id).first()
            if not br:
                raise ValueError("Target branch not found")
        elif new_audience == AudienceType.GROUP:
            if not new_group_id:
                raise ValueError("student_group_id is required for GROUP audience")
            grp = db.query(StudentGroup).filter(StudentGroup.id == new_group_id).first()
            if not grp:
                raise ValueError("Target student group not found")

        if payload.title is not None:
            notice.title = payload.title
        if payload.content is not None:
            notice.content = payload.content
        if payload.audience_type is not None:
            notice.audience_type = payload.audience_type
            notice.department_id = payload.department_id
            notice.branch_id = payload.branch_id
            notice.student_group_id = payload.student_group_id
        else:
            if payload.department_id is not None:
                notice.department_id = payload.department_id
            if payload.branch_id is not None:
                notice.branch_id = payload.branch_id
            if payload.student_group_id is not None:
                notice.student_group_id = payload.student_group_id

        if payload.category is not None:
            notice.category = payload.category
        if payload.expires_at is not None:
            notice.expires_at = payload.expires_at
        if payload.is_active is not None:
            notice.is_active = payload.is_active

        # Audit log update
        audit = AuditLog(
            user_id=updater_id,
            action="NOTICE_UPDATED",
            entity_type="Notice",
            entity_id=notice.id,
            reason=f"Updated notice '{notice.title}'",
        )
        db.add(audit)

        # If it was inactive and is now being activated/published, dispatch notifications
        if was_inactive and notice.is_active:
            NotificationService.dispatch_notice_notifications(db, notice)

        db.commit()
        db.refresh(notice)
        return notice

    @staticmethod
    def delete_notice(db: Session, notice_id: int, deleter_id: int | None = None) -> Notice:
        notice = db.query(Notice).filter(Notice.id == notice_id).first()
        if not notice:
            raise ValueError("Notice not found")
        notice.is_active = False

        audit = AuditLog(
            user_id=deleter_id,
            action="NOTICE_DELETED",
            entity_type="Notice",
            entity_id=notice.id,
            reason=f"Deactivated notice '{notice.title}'",
        )
        db.add(audit)

        db.commit()
        db.refresh(notice)
        return notice

    @staticmethod
    def list_admin_notices(
        db: Session,
        is_active: bool | None = None,
        audience_type: AudienceType | None = None,
        category: str | None = None,
        search: str | None = None,
    ) -> list[NoticeDetailRead]:
        query = db.query(Notice)
        if is_active is not None:
            query = query.filter(Notice.is_active == is_active)
        if audience_type is not None:
            query = query.filter(Notice.audience_type == audience_type)
        if category and category.lower() != "all":
            query = query.filter(Notice.category == category)
        if search and search.strip():
            pat = f"%{search.strip()}%"
            query = query.filter(or_(Notice.title.ilike(pat), Notice.content.ilike(pat)))

        notices = query.order_by(Notice.published_at.desc()).all()
        return [NoticeService.get_notice_detail(db, n) for n in notices]

    @staticmethod
    def list_user_notices(
        db: Session,
        user: User,
        category: str | None = None,
        search: str | None = None,
    ) -> list[NoticeDetailRead]:
        """Fetch active notices targeted to the calling user based on their role and academic enrollment."""
        if user.role == UserRole.ADMIN:
            query = db.query(Notice).filter(Notice.is_active.is_(True))
            if category and category.lower() != "all":
                query = query.filter(Notice.category == category)
            if search and search.strip():
                pat = f"%{search.strip()}%"
                query = query.filter(or_(Notice.title.ilike(pat), Notice.content.ilike(pat)))
            notices = query.order_by(Notice.published_at.desc()).all()
            return [NoticeService.get_notice_detail(db, n) for n in notices]

        elif user.role == UserRole.FACULTY:
            fac = db.query(FacultyProfile).filter(FacultyProfile.user_id == user.id).first()
            conditions = [Notice.audience_type == AudienceType.ALL, Notice.audience_type == AudienceType.FACULTY]
            if fac:
                # Check coordinator responsibility
                is_coord = (
                    db.query(FacultyResponsibility)
                    .filter(
                        FacultyResponsibility.faculty_id == fac.id,
                        FacultyResponsibility.responsibility_type == ResponsibilityType.COORDINATOR,
                        FacultyResponsibility.is_active.is_(True),
                    )
                    .first()
                    is not None
                )
                if is_coord:
                    conditions.append(Notice.audience_type == AudienceType.COORDINATORS)

                if fac.department_id:
                    conditions.append(
                        (Notice.audience_type == AudienceType.DEPARTMENT) & (Notice.department_id == fac.department_id)
                    )

                # Responsibilities with department scope (e.g. HOD)
                resp_depts = {
                    r.department_id
                    for r in db.query(FacultyResponsibility.department_id)
                    .filter(
                        FacultyResponsibility.faculty_id == fac.id,
                        FacultyResponsibility.is_active.is_(True),
                        FacultyResponsibility.department_id.isnot(None),
                    )
                    .all()
                }
                for d_id in resp_depts:
                    if d_id and d_id != fac.department_id:
                        conditions.append(
                            (Notice.audience_type == AudienceType.DEPARTMENT) & (Notice.department_id == d_id)
                        )

            query = db.query(Notice).filter(Notice.is_active.is_(True), or_(*conditions))
            # Exclude expired notices
            query = query.filter(
                or_(Notice.expires_at.is_(None), Notice.expires_at > datetime.now(timezone.utc))
            )
            if category and category.lower() != "all":
                query = query.filter(Notice.category == category)
            if search and search.strip():
                pat = f"%{search.strip()}%"
                query = query.filter(or_(Notice.title.ilike(pat), Notice.content.ilike(pat)))

            notices = query.order_by(Notice.published_at.desc()).all()
            return [NoticeService.get_notice_detail(db, n) for n in notices]

        elif user.role == UserRole.STUDENT:
            student = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
            conditions = [Notice.audience_type == AudienceType.ALL, Notice.audience_type == AudienceType.STUDENTS]

            if student:
                enrollments = (
                    db.query(AcademicEnrollment)
                    .options(joinedload(AcademicEnrollment.branch))
                    .filter(
                        AcademicEnrollment.student_id == student.id,
                        AcademicEnrollment.is_current.is_(True),
                        AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
                    )
                    .all()
                )
                for enrollment in enrollments:
                    if enrollment.branch and enrollment.branch.department_id:
                        conditions.append(
                            (Notice.audience_type == AudienceType.DEPARTMENT)
                            & (Notice.department_id == enrollment.branch.department_id)
                        )
                    if enrollment.branch_id:
                        conditions.append(
                            (Notice.audience_type == AudienceType.BRANCH)
                            & (Notice.branch_id == enrollment.branch_id)
                        )
                    if enrollment.student_group_id:
                        conditions.append(
                            (Notice.audience_type == AudienceType.GROUP)
                            & (Notice.student_group_id == enrollment.student_group_id)
                        )

            query = db.query(Notice).filter(Notice.is_active.is_(True), or_(*conditions))
            # Exclude expired notices
            query = query.filter(
                or_(Notice.expires_at.is_(None), Notice.expires_at > datetime.now(timezone.utc))
            )
            if category and category.lower() != "all":
                query = query.filter(Notice.category == category)
            if search and search.strip():
                pat = f"%{search.strip()}%"
                query = query.filter(or_(Notice.title.ilike(pat), Notice.content.ilike(pat)))

            notices = query.order_by(Notice.published_at.desc()).all()
            return [NoticeService.get_notice_detail(db, n) for n in notices]

        return []
