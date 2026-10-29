"""Timetable-linked Attendance Engine — Phase 7

Flow: TimetableEntry → Faculty starts session → Students check in → Faculty closes session
"""

import json
import math
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models import (
    AcademicEnrollment,
    AttendanceRecord,
    AttendanceSession,
    AttendanceStatus,
    Branch,
    ClassType,
    Course,
    DayOfWeek,
    Department,
    EnrollmentStatus,
    FacultyAssignment,
    FacultyProfile,
    QRSession,
    Section,
    SessionStatus,
    StudentGroup,
    StudentProfile,
    Subject,
    SubjectOffering,
    TimetableEntry,
    User,
)
from app.schemas import (
    AttendanceMonitorStats,
    AttendanceRecordDetailRead,
    AttendanceSessionDetailRead,
    CheckInRequest,
    StartSessionRequest,
    StudentAttendanceSummary,
)


# ── Haversine ────────────────────────────────────────────────────────
def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Modular Verification Service ────────────────────────────────────
class VerificationService:
    """Modular verification — each method returns (passed, detail_dict).

    Phase 7 implements GPS/geofence + session/time.
    Wi-Fi, Bluetooth, Device are stubs returning (None, {...}) indicating
    the signal was not provided (NOT that it passed).
    """

    @staticmethod
    def verify_geofence(
        student_lat: float | None,
        student_lon: float | None,
        session: AttendanceSession,
    ) -> tuple[bool | None, dict[str, Any]]:
        if student_lat is None or student_lon is None:
            return None, {"method": "gps", "status": "not_provided"}
        if session.geofence_latitude is None or session.geofence_longitude is None:
            return None, {"method": "gps", "status": "session_has_no_geofence"}

        distance = haversine_distance_meters(
            student_lat, student_lon,
            session.geofence_latitude, session.geofence_longitude,
        )
        radius = session.geofence_radius_meters or 100
        passed = distance <= radius
        return passed, {
            "method": "gps",
            "status": "passed" if passed else "failed",
            "distance_meters": round(distance, 2),
            "radius_meters": radius,
            "student_lat": student_lat,
            "student_lon": student_lon,
        }

    @staticmethod
    def verify_qr_token(
        qr_token: str | None,
        db: Session,
        session: AttendanceSession,
    ) -> tuple[bool | None, dict[str, Any]]:
        if not qr_token or not qr_token.strip():
            return None, {"method": "qr", "status": "not_provided"}

        token = qr_token.strip()
        from app.models import QRSession
        from app.services.system_config import SystemConfigService

        grace = int(SystemConfigService.get_setting(db, "qr_expiry_grace_seconds", default=10))
        now = datetime.now(timezone.utc)

        recent_qr = (
            db.query(QRSession)
            .filter(
                QRSession.attendance_session_id == session.id,
                QRSession.token == token,
            )
            .first()
        )
        if not recent_qr:
            return False, {"method": "qr", "status": "invalid", "reason": "QR token does not match active session"}

        expires = recent_qr.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)

        if now <= expires + timedelta(seconds=grace):
            return True, {"method": "qr", "status": "passed", "token": token[:8] + "..."}
        return False, {"method": "qr", "status": "expired", "reason": "QR token has expired"}

    @staticmethod
    def verify_wifi(
        wifi_bssid: str | None,
        wifi_ssid: str | None = None,
        db: Session | None = None,
    ) -> tuple[bool | None, dict[str, Any]]:
        if wifi_bssid is None and wifi_ssid is None:
            return None, {"method": "wifi", "status": "not_provided"}

        is_verified = False
        match_reason = None

        if db is not None:
            from app.services.system_config import SystemConfigService
            auth_ssids_raw = str(SystemConfigService.get_setting(db, "authorized_campus_wifi_ssids", default="GeoAttend-Campus,Campus-WiFi,Eduroam,CSD-Dept-Mesh"))
            auth_bssids_raw = str(SystemConfigService.get_setting(db, "authorized_campus_wifi_bssids", default="70:3a:0e:*,00:1a:2b:*,24:f5:a2:*"))

            auth_ssids = [s.strip().lower() for s in auth_ssids_raw.split(",") if s.strip()]
            auth_bssids = [b.strip().lower() for b in auth_bssids_raw.split(",") if b.strip()]

            if wifi_ssid:
                s_lower = wifi_ssid.lower()
                for target in auth_ssids:
                    if target in s_lower or s_lower in target:
                        is_verified = True
                        match_reason = f"SSID '{wifi_ssid}' matches authorized campus network"
                        break

            if not is_verified and wifi_bssid:
                b_lower = wifi_bssid.lower()
                for target in auth_bssids:
                    if target.endswith("*") and b_lower.startswith(target[:-1]):
                        is_verified = True
                        match_reason = f"BSSID '{wifi_bssid}' matches authorized prefix '{target}'"
                        break
                    elif b_lower == target:
                        is_verified = True
                        match_reason = f"BSSID '{wifi_bssid}' matches authorized campus AP"
                        break

        status_str = "passed" if is_verified else "recorded"
        return is_verified if is_verified else None, {
            "method": "wifi",
            "status": status_str,
            "bssid": wifi_bssid,
            "ssid": wifi_ssid,
            "verified": is_verified,
            "detail": match_reason or "Wi-Fi telemetry recorded",
        }

    @staticmethod
    def verify_bluetooth(beacon_id: str | None) -> tuple[bool | None, dict[str, Any]]:
        if beacon_id is None:
            return None, {"method": "bluetooth", "status": "not_provided"}
        return None, {"method": "bluetooth", "status": "recorded", "beacon_id": beacon_id}

    @staticmethod
    def verify_device(device_id: str | None, db: Session, session_id: int, student_id: int) -> tuple[bool | None, dict[str, Any]]:
        if device_id is None:
            return None, {"method": "device", "status": "not_provided"}
        # Check for same device used by another student in same session
        dup = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.session_id == session_id,
                AttendanceRecord.device_id == device_id,
                AttendanceRecord.student_id != student_id,
            )
            .first()
        )
        if dup:
            return False, {"method": "device", "status": "duplicate_device", "device_id": device_id}
        return True, {"method": "device", "status": "passed", "device_id": device_id}

    @staticmethod
    def verify_session_time(session: AttendanceSession) -> tuple[bool, dict[str, Any]]:
        now = datetime.now(timezone.utc)
        started = session.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        elapsed = (now - started).total_seconds()
        return True, {"method": "session_time", "status": "passed", "elapsed_seconds": round(elapsed, 1)}


# ── Eligibility ─────────────────────────────────────────────────────
def get_eligible_students(db: Session, session: AttendanceSession) -> list[StudentProfile]:
    """Return students eligible for this session based on their current AcademicEnrollment."""
    if not session.subject_offering_id:
        # Legacy session without offering link — fallback to section match
        return db.query(StudentProfile).filter(StudentProfile.section_id == session.section_id).all()

    offering = db.query(SubjectOffering).filter(SubjectOffering.id == session.subject_offering_id).first()
    if not offering:
        return []

    query = (
        db.query(StudentProfile)
        .join(AcademicEnrollment)
        .filter(
            AcademicEnrollment.is_current.is_(True),
            AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
            AcademicEnrollment.course_id == offering.course_id,
            AcademicEnrollment.branch_id == offering.branch_id,
            AcademicEnrollment.section_id == offering.section_id,
        )
    )
    target_group_id = offering.student_group_id or session.student_group_id
    if target_group_id is not None:
        query = query.filter(AcademicEnrollment.student_group_id == target_group_id)

    return query.all()


def is_student_eligible(db: Session, student: StudentProfile, session: AttendanceSession) -> bool:
    if not session.subject_offering_id:
        return student.section_id == session.section_id

    offering = db.query(SubjectOffering).filter(SubjectOffering.id == session.subject_offering_id).first()
    if not offering:
        return False

    enrollment = (
        db.query(AcademicEnrollment)
        .filter(
            AcademicEnrollment.student_id == student.id,
            AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
            AcademicEnrollment.course_id == offering.course_id,
            AcademicEnrollment.branch_id == offering.branch_id,
            AcademicEnrollment.section_id == offering.section_id,
        )
        .order_by(AcademicEnrollment.is_current.desc(), AcademicEnrollment.id.desc())
        .first()
    )
    if not enrollment:
        if student.section_id != offering.section_id and student.section_id != session.section_id:
            return False

    # Check student group if session or subject offering is group-specific (e.g. Lab B1 / B2)
    target_group_id = offering.student_group_id or session.student_group_id
    if target_group_id is not None:
        student_group_id = (enrollment.student_group_id if enrollment else None) or student.current_group_id
        return student_group_id == target_group_id

    return True


# ── Core Service ─────────────────────────────────────────────────────
class AttendanceService:
    @staticmethod
    def get_faculty_profile(db: Session, user: User) -> FacultyProfile:
        faculty = db.query(FacultyProfile).filter(FacultyProfile.user_id == user.id).first()
        if not faculty:
            raise ValueError("Faculty profile not found")
        return faculty

    @staticmethod
    def get_student_profile(db: Session, user: User) -> StudentProfile:
        student = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
        if not student:
            raise ValueError("Student profile not found")
        return student

    # ── Session Lifecycle ────────────────────────────────────────────
    @staticmethod
    def start_session(db: Session, faculty: FacultyProfile, payload: StartSessionRequest) -> AttendanceSession:
        # 1. Validate timetable entry
        tt_entry = (
            db.query(TimetableEntry)
            .options(
                joinedload(TimetableEntry.subject_offering).joinedload(SubjectOffering.subject),
                joinedload(TimetableEntry.faculty_assignment),
            )
            .filter(TimetableEntry.id == payload.timetable_entry_id, TimetableEntry.is_active.is_(True))
            .first()
        )
        if not tt_entry:
            raise ValueError("Timetable entry not found or inactive")

        # 2. Validate faculty assignment ownership
        assignment = tt_entry.faculty_assignment
        if assignment.faculty_id != faculty.id:
            raise ValueError("You are not assigned to this class")

        # 3. Check for duplicate active session
        existing = (
            db.query(AttendanceSession)
            .filter(
                AttendanceSession.timetable_entry_id == tt_entry.id,
                AttendanceSession.status.in_([SessionStatus.ACTIVE, SessionStatus.SCHEDULED]),
            )
            .first()
        )
        if existing:
            raise ValueError("An active or scheduled session already exists for this timetable entry")

        offering = tt_entry.subject_offering

        session = AttendanceSession(
            timetable_entry_id=tt_entry.id,
            subject_offering_id=offering.id,
            faculty_assignment_id=assignment.id,
            faculty_id=faculty.id,
            subject_id=offering.subject_id,
            section_id=tt_entry.section_id,
            student_group_id=tt_entry.student_group_id,
            class_type=tt_entry.class_type,
            room_number=tt_entry.room_number,
            status=SessionStatus.ACTIVE,
            started_at=datetime.now(timezone.utc),
            geofence_latitude=payload.geofence_latitude,
            geofence_longitude=payload.geofence_longitude,
            geofence_radius_meters=payload.geofence_radius_meters,
        )
        db.add(session)
        db.flush()

        # Auto-generate first QR
        AttendanceService.rotate_qr(db, session)
        db.commit()
        db.refresh(session)

        try:
            from app.services.notification import NotificationService
            NotificationService.dispatch_attendance_session_notification(db, session.id)
            db.commit()
        except Exception:
            pass

        return session

    @staticmethod
    def rotate_qr(db: Session, session: AttendanceSession, ttl_seconds: int = 30) -> QRSession:
        from app.services.system_config import SystemConfigService
        actual_ttl = ttl_seconds if ttl_seconds != 30 else int(SystemConfigService.get_setting(db, "qr_rotation_interval_seconds", default=30))
        db.query(QRSession).filter(
            QRSession.attendance_session_id == session.id,
            QRSession.is_active.is_(True),
        ).update({"is_active": False})

        qr = QRSession(
            attendance_session_id=session.id,
            token=secrets.token_urlsafe(32),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=actual_ttl),
            is_active=True,
        )
        db.add(qr)
        db.flush()
        return qr

    @staticmethod
    def close_session(db: Session, session: AttendanceSession) -> AttendanceSession:
        session.status = SessionStatus.COMPLETED
        session.ended_at = datetime.now(timezone.utc)
        db.query(QRSession).filter(QRSession.attendance_session_id == session.id).update({"is_active": False})
        db.commit()
        db.refresh(session)
        return session

    # ── Student Check-In ─────────────────────────────────────────────
    @staticmethod
    def check_in(db: Session, student: StudentProfile, payload: CheckInRequest) -> AttendanceRecord:
        # 1. Find the session
        session = db.query(AttendanceSession).filter(AttendanceSession.id == payload.session_id).first()
        if not session:
            raise ValueError("Attendance session not found")

        # 2. Session must be ACTIVE
        if session.status != SessionStatus.ACTIVE:
            raise ValueError("Attendance session is not active")

        # 3. Student must be eligible (enrollment-based)
        if not is_student_eligible(db, student, session):
            raise ValueError("You are not eligible for this attendance session")

        # 4. No duplicate check-in
        existing = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.session_id == session.id,
                AttendanceRecord.student_id == student.id,
            )
            .first()
        )
        if existing:
            raise ValueError("Attendance already marked for this session")

        # Keep current enrollment semester in sync with offering if needed
        if session.subject_offering_id:
            offering = db.query(SubjectOffering).filter(SubjectOffering.id == session.subject_offering_id).first()
            if offering and offering.semester:
                enr = (
                    db.query(AcademicEnrollment)
                    .filter(
                        AcademicEnrollment.student_id == student.id,
                        AcademicEnrollment.is_current.is_(True),
                        AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
                    )
                    .first()
                )
                if enr and enr.semester != offering.semester:
                    enr.semester = offering.semester
                    db.flush()

        # 5. Run modular verification
        verifications: list[dict[str, Any]] = []

        # 5a. QR Code verification (if dynamic QR or student provided token)
        qr_passed, qr_detail = VerificationService.verify_qr_token(payload.qr_token, db, session)
        if qr_detail.get("status") != "not_provided":
            verifications.append(qr_detail)
            if qr_passed is False:
                raise ValueError(qr_detail.get("reason", "Invalid QR code token"))

        # 5b. GPS geofence verification
        gps_passed, gps_detail = VerificationService.verify_geofence(
            payload.latitude, payload.longitude, session,
        )
        verifications.append(gps_detail)

        # 5c. Wi-Fi verification
        wifi_passed, wifi_detail = VerificationService.verify_wifi(
            payload.wifi_bssid, payload.wifi_ssid, db,
        )
        verifications.append(wifi_detail)

        # 5d. Bluetooth BLE beacon verification
        bt_passed, bt_detail = VerificationService.verify_bluetooth(payload.bluetooth_beacon_id)
        verifications.append(bt_detail)

        # 5e. Hardware Device Binding verification
        dev_passed, dev_detail = VerificationService.verify_device(
            payload.device_id, db, session.id, student.id,
        )
        verifications.append(dev_detail)

        # 5f. Session timing verification
        time_passed, time_detail = VerificationService.verify_session_time(session)
        verifications.append(time_detail)

        # 5g. Indoor GPS attenuation & Wi-Fi fallback resolution:
        # In academic concrete structures, satellite signal attenuation increases horizontal uncertainty (HDOP).
        # Where technically supported, campus Wi-Fi AP matching or reported accuracy error acts as a fallback.
        is_indoor_fallback = False
        indoor_fallback_reason = None

        if gps_passed is False and session.geofence_latitude is not None:
            dist = gps_detail.get("distance_meters")
            radius = gps_detail.get("radius_meters") or 100

            from app.services.system_config import SystemConfigService
            wifi_fallback_enabled = SystemConfigService.get_setting(db, "enable_wifi_geofence_fallback", default=True)
            max_gps_acc = float(SystemConfigService.get_setting(db, "max_allowed_gps_accuracy_meters", default=50.0))
            reported_acc = payload.accuracy_meters if payload.accuracy_meters is not None else 0.0

            # Condition 1: Verified Campus Wi-Fi AP match overrides indoor satellite attenuation
            if wifi_fallback_enabled and (wifi_passed is True or wifi_detail.get("verified") is True):
                if dist is None or dist <= (radius * 3.0):
                    is_indoor_fallback = True
                    indoor_fallback_reason = f"Indoor GPS attenuation ({dist}m) compensated by verified campus Wi-Fi ({wifi_detail.get('detail')})"

            # Condition 2: Distance is within device's reported GPS horizontal accuracy circle
            elif dist is not None and reported_acc > 15.0 and dist <= (radius + min(reported_acc, max_gps_acc)):
                is_indoor_fallback = True
                indoor_fallback_reason = f"Indoor GPS reading ({dist}m) is within horizontal accuracy circle (±{reported_acc:.1f}m)"

            if is_indoor_fallback:
                gps_detail["status"] = "indoor_compensated"
                gps_detail["fallback_reason"] = indoor_fallback_reason
            else:
                raise ValueError(f"Outside geofence. Distance: {dist}m (max {radius}m)")

        distance_meters = gps_detail.get("distance_meters") if (gps_passed is not None or is_indoor_fallback) else None

        # Determine late status based on session start time
        att_status = AttendanceStatus.PRESENT
        now = datetime.now(timezone.utc)
        started = session.started_at
        elapsed_seconds: float | None = None
        if started is not None:
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            elapsed_seconds = (now - started).total_seconds()
            from app.services.system_config import SystemConfigService
            late_threshold_mins = SystemConfigService.get_setting(db, "late_threshold_minutes", default=15)
            if elapsed_seconds > (late_threshold_mins * 60):
                att_status = AttendanceStatus.LATE

        if payload.device_id:
            if not student.device_id:
                student.device_id = payload.device_id
                student.device_registered_at = now
                db.add(student)

        record = AttendanceRecord(
            session_id=session.id,
            student_id=student.id,
            status=att_status,
            latitude=payload.latitude,
            longitude=payload.longitude,
            distance_meters=distance_meters,
            device_id=payload.device_id,
            is_suspicious=False,
            verification_json=json.dumps(verifications),
            marked_at=now,
        )
        db.add(record)
        db.flush()

        # Run rule-based anomaly detection (Phase 8)
        from app.services.anomaly import AnomalyService
        AnomalyService.evaluate_checkin(
            db=db,
            record=record,
            session=session,
            verifications=verifications,
            elapsed_seconds=elapsed_seconds,
        )

        db.commit()
        db.refresh(record)
        return record

    # ── Query Helpers ────────────────────────────────────────────────
    @staticmethod
    def get_session_detail(db: Session, session: AttendanceSession) -> AttendanceSessionDetailRead:
        offering = session.subject_offering
        assignment = session.faculty_assignment
        faculty_profile = assignment.faculty if assignment else session.faculty
        faculty_user = faculty_profile.user if faculty_profile else None
        subject = offering.subject if offering else (session.subject if session.subject else None)
        course = offering.course if offering else None
        branch = offering.branch if offering else None

        total_enrolled = len(get_eligible_students(db, session))
        present_count = (
            db.query(func.count(AttendanceRecord.id))
            .filter(AttendanceRecord.session_id == session.id, AttendanceRecord.status == AttendanceStatus.PRESENT)
            .scalar()
            or 0
        )
        late_count = (
            db.query(func.count(AttendanceRecord.id))
            .filter(AttendanceRecord.session_id == session.id, AttendanceRecord.status == AttendanceStatus.LATE)
            .scalar()
            or 0
        )
        absent_count = max(0, total_enrolled - present_count - late_count)

        # Active QR session token if session is live
        active_qr = (
            db.query(QRSession)
            .filter(QRSession.attendance_session_id == session.id, QRSession.is_active.is_(True))
            .first()
        )

        tt = session.timetable_entry
        if not tt and session.timetable_entry_id:
            tt = db.query(TimetableEntry).filter(TimetableEntry.id == session.timetable_entry_id).first()
        start_time_str = None
        end_time_str = None
        if tt:
            if hasattr(tt.start_time, "strftime"):
                start_time_str = tt.start_time.strftime("%H:%M")
            elif tt.start_time:
                start_time_str = str(tt.start_time)[:5]
            if hasattr(tt.end_time, "strftime"):
                end_time_str = tt.end_time.strftime("%H:%M")
            elif tt.end_time:
                end_time_str = str(tt.end_time)[:5]

        return AttendanceSessionDetailRead(
            id=session.id,
            timetable_entry_id=session.timetable_entry_id,
            subject_offering_id=session.subject_offering_id,
            faculty_assignment_id=session.faculty_assignment_id,
            faculty_id=session.faculty_id,
            faculty_name=faculty_user.full_name if faculty_user else "Unknown Faculty",
            faculty_employee_id=faculty_profile.employee_id if faculty_profile else None,
            subject_name=subject.name if subject else "Unknown Subject",
            subject_code=subject.code if subject else "N/A",
            course_name=course.name if course else None,
            branch_name=branch.name if branch else None,
            section_id=session.section_id,
            section_name=session.section.name if session.section else f"Section {session.section_id}",
            student_group_id=session.student_group_id,
            student_group_name=session.student_group.name if session.student_group else None,
            class_type=session.class_type,
            room_number=session.room_number,
            status=session.status,
            session_date=session.started_at.strftime("%Y-%m-%d") if session.started_at else None,
            start_time=start_time_str,
            end_time=end_time_str,
            started_at=session.started_at,
            ended_at=session.ended_at,
            total_enrolled=total_enrolled,
            total_present=present_count + late_count,
            present_count=present_count,
            late_count=late_count,
            absent_count=absent_count,
            geofence_latitude=session.geofence_latitude,
            geofence_longitude=session.geofence_longitude,
            geofence_radius_meters=session.geofence_radius_meters,
            active_qr_token=active_qr.token if active_qr else None,
        )

    @staticmethod
    def get_monitor_stats(db: Session) -> AttendanceMonitorStats:
        """Calculate dynamic attendance monitor statistics from actual backend records."""
        today_date = date.today()
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        today_day_str = days[today_date.weekday()]
        today_enum = DayOfWeek(today_day_str)

        active_sessions = (
            db.query(func.count(AttendanceSession.id))
            .filter(AttendanceSession.status == SessionStatus.ACTIVE)
            .scalar()
            or 0
        )

        scheduled_today = (
            db.query(func.count(TimetableEntry.id))
            .filter(TimetableEntry.day_of_week == today_enum, TimetableEntry.is_active.is_(True))
            .scalar()
            or 0
        )

        completed_today = (
            db.query(func.count(AttendanceSession.id))
            .filter(
                AttendanceSession.status.in_([SessionStatus.COMPLETED, SessionStatus.CLOSED]),
                func.date(AttendanceSession.started_at) == today_date,
            )
            .scalar()
            or 0
        )

        students_present = (
            db.query(func.count(AttendanceRecord.id))
            .filter(
                AttendanceRecord.status == AttendanceStatus.PRESENT,
                func.date(AttendanceRecord.marked_at) == today_date,
            )
            .scalar()
            or 0
        )

        late_checkins = (
            db.query(func.count(AttendanceRecord.id))
            .filter(
                AttendanceRecord.status == AttendanceStatus.LATE,
                func.date(AttendanceRecord.marked_at) == today_date,
            )
            .scalar()
            or 0
        )

        suspicious_checkins = (
            db.query(func.count(AttendanceRecord.id))
            .filter(
                AttendanceRecord.is_suspicious.is_(True),
                func.date(AttendanceRecord.marked_at) == today_date,
            )
            .scalar()
            or 0
        )

        total_records = db.query(func.count(AttendanceRecord.id)).scalar() or 0

        return AttendanceMonitorStats(
            active_sessions=active_sessions,
            scheduled_today=scheduled_today,
            completed_today=completed_today,
            students_present=students_present,
            late_checkins=late_checkins,
            suspicious_checkins=suspicious_checkins,
            total_records=total_records,
        )

    @staticmethod
    def list_admin_sessions(
        db: Session,
        status: SessionStatus | None = None,
        department_id: int | None = None,
        session_date: date | None = None,
        query_str: str | None = None,
        faculty_id: int | None = None,
        section_id: int | None = None,
    ) -> list[AttendanceSessionDetailRead]:
        query = (
            db.query(AttendanceSession)
            .options(
                joinedload(AttendanceSession.subject_offering).joinedload(SubjectOffering.subject),
                joinedload(AttendanceSession.subject_offering).joinedload(SubjectOffering.course),
                joinedload(AttendanceSession.subject_offering).joinedload(SubjectOffering.branch),
                joinedload(AttendanceSession.faculty_assignment).joinedload(FacultyAssignment.faculty).joinedload(FacultyProfile.user),
                joinedload(AttendanceSession.section),
                joinedload(AttendanceSession.student_group),
            )
        )

        if status is not None:
            query = query.filter(AttendanceSession.status == status)

        if department_id is not None:
            query = (
                query.join(SubjectOffering, AttendanceSession.subject_offering_id == SubjectOffering.id)
                .join(Branch, SubjectOffering.branch_id == Branch.id)
                .filter(Branch.department_id == department_id)
            )

        if session_date is not None:
            query = query.filter(func.date(AttendanceSession.started_at) == session_date)

        if faculty_id is not None:
            query = query.filter(AttendanceSession.faculty_id == faculty_id)

        if section_id is not None:
            query = query.filter(AttendanceSession.section_id == section_id)

        sessions = query.order_by(AttendanceSession.started_at.desc()).all()
        details = [AttendanceService.get_session_detail(db, s) for s in sessions]

        if query_str:
            q = query_str.strip().lower()
            details = [
                d
                for d in details
                if q in d.subject_name.lower()
                or q in d.subject_code.lower()
                or q in d.faculty_name.lower()
                or (d.faculty_employee_id and q in d.faculty_employee_id.lower())
                or (d.room_number and q in d.room_number.lower())
                or q in d.section_name.lower()
                or (d.student_group_name and q in d.student_group_name.lower())
                or (d.branch_name and q in d.branch_name.lower())
            ]

        return details

    @staticmethod
    def list_admin_records(
        db: Session,
        student_id: int | None = None,
        session_id: int | None = None,
        section_id: int | None = None,
        department_id: int | None = None,
        status: str | None = None,
        is_suspicious: bool | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        query_str: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        query = (
            db.query(AttendanceRecord)
            .options(
                joinedload(AttendanceRecord.student).joinedload(StudentProfile.user),
                joinedload(AttendanceRecord.session).joinedload(AttendanceSession.subject_offering).joinedload(SubjectOffering.subject),
                joinedload(AttendanceRecord.session).joinedload(AttendanceSession.faculty_assignment).joinedload(FacultyAssignment.faculty).joinedload(FacultyProfile.user),
                joinedload(AttendanceRecord.session).joinedload(AttendanceSession.section),
                joinedload(AttendanceRecord.session).joinedload(AttendanceSession.student_group),
                joinedload(AttendanceRecord.adjusted_by),
            )
        )

        if student_id:
            query = query.filter(AttendanceRecord.student_id == student_id)
        if session_id:
            query = query.filter(AttendanceRecord.session_id == session_id)
        if is_suspicious is not None:
            query = query.filter(AttendanceRecord.is_suspicious == is_suspicious)
        if status:
            query = query.filter(AttendanceRecord.status == status)
        if section_id:
            query = query.join(AttendanceSession).filter(AttendanceSession.section_id == section_id)
        if date_from:
            query = query.filter(func.date(AttendanceRecord.marked_at) >= date_from)
        if date_to:
            query = query.filter(func.date(AttendanceRecord.marked_at) <= date_to)

        records = query.order_by(AttendanceRecord.marked_at.desc()).offset(offset).limit(limit).all()

        results = []
        for r in records:
            st = r.student
            usr = st.user if st else None
            sess = r.session
            off = sess.subject_offering if sess else None
            sub = off.subject if off else None
            asgn = sess.faculty_assignment if sess else None
            fac_usr = asgn.faculty.user if (asgn and asgn.faculty) else None

            # Parse verification_json
            verifications: list[dict[str, Any]] = []
            gps_status = "not_provided"
            device_status = "not_provided"
            wifi_status = "not_provided"
            bt_status = "not_provided"

            if r.verification_json:
                try:
                    verifications = json.loads(r.verification_json)
                    for v in verifications:
                        m = v.get("method")
                        st_val = v.get("status")
                        if m == "gps":
                            gps_status = st_val
                        elif m == "device":
                            device_status = st_val
                        elif m == "wifi":
                            wifi_status = st_val
                        elif m == "bluetooth":
                            bt_status = st_val
                except Exception:
                    pass

            results.append({
                "id": r.id,
                "session_id": r.session_id,
                "student_id": r.student_id,
                "student_name": usr.full_name if usr else "Unknown Student",
                "roll_number": st.roll_number if st else "N/A",
                "enrollment_number": st.enrollment_number if st else None,
                "subject_name": sub.name if sub else "Unknown Subject",
                "subject_code": sub.code if sub else "—",
                "faculty_name": fac_usr.full_name if fac_usr else "Faculty",
                "section_name": sess.section.name if (sess and sess.section) else "Section",
                "student_group_name": sess.student_group.name if (sess and sess.student_group) else None,
                "class_type": sess.class_type.value if (sess and sess.class_type) else "theory",
                "status": r.status.value if hasattr(r.status, "value") else str(r.status),
                "original_status": r.original_status,
                "is_manually_adjusted": r.is_manually_adjusted,
                "adjustment_reason": r.adjustment_reason,
                "adjusted_by_name": r.adjusted_by.full_name if r.adjusted_by else None,
                "marked_at": r.marked_at.isoformat() if r.marked_at else "",
                "check_in_time": r.marked_at.strftime("%H:%M:%S") if r.marked_at else "",
                "distance_meters": r.distance_meters,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "device_id": r.device_id,
                "is_suspicious": r.is_suspicious,
                "suspicion_reason": r.suspicion_reason,
                "gps_status": gps_status,
                "device_status": device_status,
                "wifi_status": wifi_status,
                "bt_status": bt_status,
                "verifications": verifications,
            })

        if query_str:
            q = query_str.strip().lower()
            results = [
                row
                for row in results
                if q in row["student_name"].lower()
                or q in row["roll_number"].lower()
                or q in row["subject_name"].lower()
                or (row["subject_code"] and q in row["subject_code"].lower())
                or (row["faculty_name"] and q in row["faculty_name"].lower())
            ]

        return results

    @staticmethod
    def get_session_records(db: Session, session_id: int) -> list[AttendanceRecordDetailRead]:
        records = (
            db.query(AttendanceRecord)
            .options(joinedload(AttendanceRecord.student).joinedload(StudentProfile.user))
            .filter(AttendanceRecord.session_id == session_id)
            .order_by(AttendanceRecord.marked_at)
            .all()
        )
        return [
            AttendanceRecordDetailRead(
                id=r.id,
                session_id=r.session_id,
                student_id=r.student_id,
                student_name=r.student.user.full_name,
                roll_number=r.student.roll_number,
                status=r.status,
                marked_at=r.marked_at,
                distance_meters=r.distance_meters,
                is_suspicious=r.is_suspicious,
            )
            for r in records
        ]

    @staticmethod
    def get_active_sessions_for_student(db: Session, student: StudentProfile) -> list[AttendanceSessionDetailRead]:
        enrollment = (
            db.query(AcademicEnrollment)
            .filter(
                AcademicEnrollment.student_id == student.id,
                AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
            )
            .order_by(AcademicEnrollment.is_current.desc(), AcademicEnrollment.id.desc())
            .first()
        )
        section_id = enrollment.section_id if enrollment else student.section_id
        student_group_id = (enrollment.student_group_id if enrollment else None) or student.current_group_id
        if not section_id:
            return []

        active_sessions = (
            db.query(AttendanceSession)
            .options(
                joinedload(AttendanceSession.subject_offering).joinedload(SubjectOffering.subject),
                joinedload(AttendanceSession.faculty_assignment).joinedload(FacultyAssignment.faculty).joinedload(FacultyProfile.user),
                joinedload(AttendanceSession.section),
                joinedload(AttendanceSession.student_group),
            )
            .filter(
                AttendanceSession.status == SessionStatus.ACTIVE,
                AttendanceSession.section_id == section_id,
            )
            .all()
        )

        results = []
        for sess in active_sessions:
            if sess.student_group_id is None or sess.student_group_id == student_group_id:
                results.append(AttendanceService.get_session_detail(db, sess))
        return results

    @staticmethod
    def get_faculty_sessions(
        db: Session, faculty_id: int, status: SessionStatus | None = None
    ) -> list[AttendanceSessionDetailRead]:
        query = (
            db.query(AttendanceSession)
            .options(
                joinedload(AttendanceSession.subject_offering).joinedload(SubjectOffering.subject),
                joinedload(AttendanceSession.faculty_assignment).joinedload(FacultyAssignment.faculty).joinedload(FacultyProfile.user),
                joinedload(AttendanceSession.section),
                joinedload(AttendanceSession.student_group),
                joinedload(AttendanceSession.timetable_entry),
            )
            .filter(AttendanceSession.faculty_id == faculty_id)
        )
        if status is not None:
            query = query.filter(AttendanceSession.status == status)
        sessions = query.order_by(AttendanceSession.started_at.desc()).all()
        return [AttendanceService.get_session_detail(db, s) for s in sessions]

    @staticmethod
    def get_student_attendance_history(db: Session, student_id: int) -> list:
        records = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.student_id == student_id)
            .order_by(AttendanceRecord.marked_at.desc())
            .all()
        )
        return records

    @staticmethod
    def get_student_summary(db: Session, student_id: int) -> list[StudentAttendanceSummary]:
        """Subject-wise attendance summary for a student."""
        # Get all sessions the student could have attended
        student = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
        if not student:
            return []

        enrollment = (
            db.query(AcademicEnrollment)
            .filter(
                AcademicEnrollment.student_id == student_id,
                AcademicEnrollment.is_current.is_(True),
                AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
            )
            .first()
        )
        if not enrollment:
            return []

        # All completed/active sessions for this student's section/group
        sessions = (
            db.query(AttendanceSession)
            .options(joinedload(AttendanceSession.subject_offering).joinedload(SubjectOffering.subject))
            .filter(
                AttendanceSession.section_id == enrollment.section_id,
                AttendanceSession.status.in_([SessionStatus.ACTIVE, SessionStatus.COMPLETED, SessionStatus.CLOSED]),
                or_(
                    AttendanceSession.student_group_id.is_(None),
                    AttendanceSession.student_group_id == enrollment.student_group_id,
                ),
            )
            .all()
        )

        # Group by (subject_offering_id, class_type)
        offering_map: dict[tuple[int, str], dict] = {}
        for sess in sessions:
            if not sess.subject_offering_id:
                continue
            key = (sess.subject_offering_id, sess.class_type.value if sess.class_type else "theory")
            if key not in offering_map:
                sub = sess.subject_offering.subject
                offering_map[key] = {
                    "subject_name": sub.name,
                    "subject_code": sub.code,
                    "class_type": sess.class_type or ClassType.THEORY,
                    "total_sessions": 0,
                    "attended": 0,
                }
            offering_map[key]["total_sessions"] += 1
            # Check if student attended
            record = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.session_id == sess.id,
                    AttendanceRecord.student_id == student_id,
                )
                .first()
            )
            if record:
                offering_map[key]["attended"] += 1

        summaries = []
        for data in offering_map.values():
            total = data["total_sessions"]
            attended = data["attended"]
            summaries.append(
                StudentAttendanceSummary(
                    subject_name=data["subject_name"],
                    subject_code=data["subject_code"],
                    class_type=data["class_type"],
                    total_sessions=total,
                    attended=attended,
                    total_classes=total,
                    attended_classes=attended,
                    percentage=round((attended / total) * 100, 1) if total > 0 else 0.0,
                )
            )
        return summaries

    @staticmethod
    def override_attendance(
        db: Session,
        record_id: int,
        new_status: AttendanceStatus,
        reason: str,
        admin_user: User,
    ) -> AttendanceRecord:
        record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
        if not record:
            raise ValueError("Attendance record not found")

        old_status = record.status.value if hasattr(record.status, "value") else str(record.status)
        record.original_status = old_status
        record.status = new_status
        record.is_manually_adjusted = True
        record.adjusted_by_user_id = admin_user.id
        record.adjustment_reason = reason
        db.commit()
        db.refresh(record)

        from app.services.audit import AuditService
        AuditService.log_action(
            db=db,
            user=admin_user,
            action="ATTENDANCE_OVERRIDE",
            entity_type="ATTENDANCE_RECORD",
            entity_id=record.id,
            metadata={
                "session_id": record.session_id,
                "student_id": record.student_id,
                "old_status": old_status,
                "new_status": new_status.value if hasattr(new_status, "value") else str(new_status),
            },
            reason=reason,
        )
        return record

    @staticmethod
    def unbind_student_device(
        db: Session,
        student_id: int,
        reason: str,
        admin_user: User,
    ) -> StudentProfile:
        student = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
        if not student:
            raise ValueError("Student profile not found")

        old_device = student.device_id
        student.device_id = None
        student.device_registered_at = None
        db.commit()
        db.refresh(student)

        from app.services.audit import AuditService
        AuditService.log_action(
            db=db,
            user=admin_user,
            action="DEVICE_UNBIND",
            entity_type="STUDENT_DEVICE",
            entity_id=student.id,
            metadata={
                "student_id": student.id,
                "roll_number": student.roll_number,
                "old_device_id": old_device,
            },
            reason=reason,
        )
        return student
