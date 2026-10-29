import csv
import io
from datetime import date, datetime, time
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models import (
    AcademicEnrollment,
    AttendanceSession,
    ClassType,
    Course,
    DayOfWeek,
    EnrollmentStatus,
    FacultyAssignment,
    FacultyProfile,
    Section,
    StudentGroup,
    StudentProfile,
    Subject,
    SubjectOffering,
    TimetableEntry,
    User,
)
from app.schemas import (
    ConflictItem,
    ConflictValidationRequest,
    ConflictValidationResponse,
    TimetableConflictSummary,
    TimetableEntryCreate,
    TimetableEntryDetailRead,
    TimetableEntryUpdate,
    TimetableUploadResponse,
)
from app.services.audit import AuditService


def _intervals_overlap(s1: time, e1: time, s2: time, e2: time) -> bool:
    """Return True if time interval [s1, e1) overlaps with [s2, e2)."""
    return s1 < e2 and s2 < e1


def _calculate_overlapping_interval(s1: time, e1: time, s2: time, e2: time) -> str:
    """Compute the actual overlapping time window string."""
    start = max(s1, s2)
    end = min(e1, e2)
    return f"{start.strftime('%H:%M')} - {end.strftime('%H:%M')}"


def _to_detail_read(entry: TimetableEntry) -> TimetableEntryDetailRead:
    offering = entry.subject_offering
    asgn = entry.faculty_assignment
    fac_user = asgn.faculty.user if asgn and asgn.faculty else None
    fac_profile = asgn.faculty if asgn else None

    return TimetableEntryDetailRead(
        id=entry.id,
        subject_offering_id=offering.id if offering else 0,
        faculty_assignment_id=asgn.id if asgn else 0,
        faculty_id=fac_profile.id if fac_profile else 0,
        faculty_name=fac_user.full_name if fac_user else "Unassigned",
        employee_id=fac_profile.employee_id if fac_profile else "",
        subject_id=offering.subject.id if offering and offering.subject else 0,
        subject_name=offering.subject.name if offering and offering.subject else "Unknown",
        subject_code=offering.subject.code if offering and offering.subject else "—",
        course_id=offering.course.id if offering and offering.course else 0,
        course_name=offering.course.name if offering and offering.course else "—",
        branch_id=offering.branch.id if offering and offering.branch else 0,
        branch_name=offering.branch.name if offering and offering.branch else "—",
        section_id=entry.section_id,
        section_name=entry.section.name if entry.section else f"Section {entry.section_id}",
        student_group_id=entry.student_group_id,
        student_group_name=entry.student_group.name if entry.student_group else None,
        semester=offering.semester if offering else 1,
        class_type=entry.class_type,
        day_of_week=entry.day_of_week,
        start_time=entry.start_time,
        end_time=entry.end_time,
        room_number=entry.room_number,
        is_active=entry.is_active,
        created_at=entry.created_at,
        has_conflict=False,
        conflict_types=[],
        conflicts=[],
    )


def _populate_conflicts_for_entries(entries: list[TimetableEntryDetailRead]) -> None:
    """Evaluate pairwise conflict graph across active timetable entries and populate metadata."""
    for i, a in enumerate(entries):
        a_conflicts: list[ConflictItem] = []
        for j, b in enumerate(entries):
            if i == j:
                continue
            if a.day_of_week != b.day_of_week:
                continue
            if not _intervals_overlap(a.start_time, a.end_time, b.start_time, b.end_time):
                continue

            overlap_str = _calculate_overlapping_interval(a.start_time, a.end_time, b.start_time, b.end_time)

            # 1. Faculty conflict
            if a.faculty_id > 0 and b.faculty_id > 0 and a.faculty_id == b.faculty_id:
                a_conflicts.append(
                    ConflictItem(
                        conflict_type="faculty",
                        severity="error",
                        title="Faculty Overlap",
                        description=f"Instructor {a.faculty_name} is already scheduled for '{b.subject_name}' ({b.subject_code}) in {b.room_number}",
                        conflicting_entry_id=b.id,
                        conflicting_subject_code=b.subject_code,
                        conflicting_subject_name=b.subject_name,
                        conflicting_faculty_name=b.faculty_name,
                        conflicting_room=b.room_number,
                        conflicting_section_name=b.section_name,
                        conflicting_group_name=b.student_group_name,
                        conflicting_time=f"{b.start_time.strftime('%H:%M')} - {b.end_time.strftime('%H:%M')}",
                        overlapping_interval=overlap_str,
                    )
                )

            # 2. Room conflict
            if a.room_number.strip().lower() == b.room_number.strip().lower():
                a_conflicts.append(
                    ConflictItem(
                        conflict_type="room",
                        severity="error",
                        title="Room Clashed",
                        description=f"Room '{a.room_number}' is already booked for '{b.subject_name}' ({b.subject_code})",
                        conflicting_entry_id=b.id,
                        conflicting_subject_code=b.subject_code,
                        conflicting_subject_name=b.subject_name,
                        conflicting_faculty_name=b.faculty_name,
                        conflicting_room=b.room_number,
                        conflicting_section_name=b.section_name,
                        conflicting_group_name=b.student_group_name,
                        conflicting_time=f"{b.start_time.strftime('%H:%M')} - {b.end_time.strftime('%H:%M')}",
                        overlapping_interval=overlap_str,
                    )
                )

            # 3. Student group / Section conflict
            if a.section_id == b.section_id:
                is_grp_conflict = (
                    a.student_group_id is None
                    or b.student_group_id is None
                    or a.student_group_id == b.student_group_id
                )
                if is_grp_conflict:
                    grp_txt = f"Group {b.student_group_name}" if b.student_group_name else "Whole Section"
                    a_conflicts.append(
                        ConflictItem(
                            conflict_type="student_group",
                            severity="error",
                            title="Student Group Clashed",
                            description=f"Section '{b.section_name}' ({grp_txt}) is already scheduled for '{b.subject_name}' ({b.subject_code})",
                            conflicting_entry_id=b.id,
                            conflicting_subject_code=b.subject_code,
                            conflicting_subject_name=b.subject_name,
                            conflicting_faculty_name=b.faculty_name,
                            conflicting_room=b.room_number,
                            conflicting_section_name=b.section_name,
                            conflicting_group_name=b.student_group_name,
                            conflicting_time=f"{b.start_time.strftime('%H:%M')} - {b.end_time.strftime('%H:%M')}",
                            overlapping_interval=overlap_str,
                        )
                    )

        a.conflicts = a_conflicts
        a.conflict_types = list(dict.fromkeys([c.conflict_type for c in a_conflicts]))
        a.has_conflict = len(a_conflicts) > 0


class TimetableService:
    @staticmethod
    def _validate_conflicts_structured(
        db: Session,
        day_of_week: DayOfWeek,
        start_time: time,
        end_time: time,
        room_number: str,
        faculty_id: int,
        section_id: int,
        student_group_id: int | None,
        exclude_entry_id: int | None = None,
    ) -> tuple[list[str], list[ConflictItem]]:
        """Run comprehensive conflict engine checks and return (errors, conflicts)."""
        errors: list[str] = []
        conflicts: list[ConflictItem] = []

        if start_time >= end_time:
            errors.append(
                f"Invalid time interval: start_time ({start_time.strftime('%H:%M')}) must be earlier than end_time ({end_time.strftime('%H:%M')})"
            )
            return errors, conflicts

        # Query all active timetable entries on the given day
        query = (
            db.query(TimetableEntry)
            .options(
                joinedload(TimetableEntry.subject_offering).joinedload(SubjectOffering.subject),
                joinedload(TimetableEntry.faculty_assignment).joinedload(FacultyAssignment.faculty).joinedload(FacultyProfile.user),
                joinedload(TimetableEntry.section),
                joinedload(TimetableEntry.student_group),
            )
            .filter(
                TimetableEntry.day_of_week == day_of_week,
                TimetableEntry.is_active.is_(True),
            )
        )
        if exclude_entry_id:
            query = query.filter(TimetableEntry.id != exclude_entry_id)

        active_entries = query.all()

        for entry in active_entries:
            if not _intervals_overlap(start_time, end_time, entry.start_time, entry.end_time):
                continue

            overlap_str = _calculate_overlapping_interval(start_time, end_time, entry.start_time, entry.end_time)
            sub_name = entry.subject_offering.subject.name if entry.subject_offering and entry.subject_offering.subject else "Unknown Subject"
            sub_code = entry.subject_offering.subject.code if entry.subject_offering and entry.subject_offering.subject else "—"
            fac_asgn = entry.faculty_assignment
            fac_name = fac_asgn.faculty.user.full_name if fac_asgn and fac_asgn.faculty and fac_asgn.faculty.user else "Faculty"
            entry_fac_id = fac_asgn.faculty_id if fac_asgn else 0
            sec_name = entry.section.name if entry.section else f"Section {entry.section_id}"
            grp_name = entry.student_group.name if entry.student_group else None

            # 1. Faculty conflict check
            if faculty_id > 0 and entry_fac_id == faculty_id:
                conflicts.append(
                    ConflictItem(
                        conflict_type="faculty",
                        severity="error",
                        title="Faculty Overlap",
                        description=f"Instructor is already scheduled for '{sub_name}' on {day_of_week.value.capitalize()} from {entry.start_time.strftime('%H:%M')} to {entry.end_time.strftime('%H:%M')} in Room {entry.room_number}",
                        conflicting_entry_id=entry.id,
                        conflicting_subject_code=sub_code,
                        conflicting_subject_name=sub_name,
                        conflicting_faculty_name=fac_name,
                        conflicting_room=entry.room_number,
                        conflicting_section_name=sec_name,
                        conflicting_group_name=grp_name,
                        conflicting_time=f"{entry.start_time.strftime('%H:%M')} - {entry.end_time.strftime('%H:%M')}",
                        overlapping_interval=overlap_str,
                    )
                )

            # 2. Room conflict check
            if entry.room_number.strip().lower() == room_number.strip().lower():
                conflicts.append(
                    ConflictItem(
                        conflict_type="room",
                        severity="error",
                        title="Room Clashed",
                        description=f"Room '{room_number.strip()}' is already occupied for '{sub_name}' on {day_of_week.value.capitalize()} from {entry.start_time.strftime('%H:%M')} to {entry.end_time.strftime('%H:%M')}",
                        conflicting_entry_id=entry.id,
                        conflicting_subject_code=sub_code,
                        conflicting_subject_name=sub_name,
                        conflicting_faculty_name=fac_name,
                        conflicting_room=entry.room_number,
                        conflicting_section_name=sec_name,
                        conflicting_group_name=grp_name,
                        conflicting_time=f"{entry.start_time.strftime('%H:%M')} - {entry.end_time.strftime('%H:%M')}",
                        overlapping_interval=overlap_str,
                    )
                )

            # 3. Student group / Section conflict check
            if entry.section_id == section_id:
                is_group_conflict = (
                    student_group_id is None
                    or entry.student_group_id is None
                    or entry.student_group_id == student_group_id
                )
                if is_group_conflict:
                    group_str = f"Group {grp_name}" if grp_name else "Whole Section"
                    conflicts.append(
                        ConflictItem(
                            conflict_type="student_group",
                            severity="error",
                            title="Student Group Clashed",
                            description=f"Section '{sec_name}' ({group_str}) already has '{sub_name}' on {day_of_week.value.capitalize()} from {entry.start_time.strftime('%H:%M')} to {entry.end_time.strftime('%H:%M')}",
                            conflicting_entry_id=entry.id,
                            conflicting_subject_code=sub_code,
                            conflicting_subject_name=sub_name,
                            conflicting_faculty_name=fac_name,
                            conflicting_room=entry.room_number,
                            conflicting_section_name=sec_name,
                            conflicting_group_name=grp_name,
                            conflicting_time=f"{entry.start_time.strftime('%H:%M')} - {entry.end_time.strftime('%H:%M')}",
                            overlapping_interval=overlap_str,
                        )
                    )

        return errors, conflicts

    @staticmethod
    def _validate_conflicts(
        db: Session,
        day_of_week: DayOfWeek,
        start_time: time,
        end_time: time,
        room_number: str,
        faculty_id: int,
        section_id: int,
        student_group_id: int | None,
        exclude_entry_id: int | None = None,
    ) -> None:
        """Backward-compatible validation raising ValueError on first hard conflict."""
        errors, conflicts = TimetableService._validate_conflicts_structured(
            db=db,
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            room_number=room_number,
            faculty_id=faculty_id,
            section_id=section_id,
            student_group_id=student_group_id,
            exclude_entry_id=exclude_entry_id,
        )

        if errors:
            raise ValueError(errors[0])

        for c in conflicts:
            if c.conflict_type == "faculty":
                raise ValueError(
                    f"Faculty conflict: Instructor is already scheduled for '{c.conflicting_subject_name}' on {day_of_week.value.capitalize()} "
                    f"from {c.conflicting_time} in Room {c.conflicting_room}"
                )
            elif c.conflict_type == "room":
                raise ValueError(
                    f"Room conflict: Room '{room_number}' is already occupied for '{c.conflicting_subject_name}' on {day_of_week.value.capitalize()} "
                    f"from {c.conflicting_time}"
                )
            elif c.conflict_type == "student_group":
                grp_lbl = f"Group {c.conflicting_group_name}" if c.conflicting_group_name else "Whole Section"
                raise ValueError(
                    f"Student group conflict: Section '{c.conflicting_section_name}' ({grp_lbl}) already has '{c.conflicting_subject_name}' "
                    f"on {day_of_week.value.capitalize()} from {c.conflicting_time}"
                )

    @staticmethod
    def validate_conflicts(db: Session, payload: ConflictValidationRequest) -> ConflictValidationResponse:
        """Dedicated API conflict inspection for candidate or edited timetable entry."""
        offering = (
            db.query(SubjectOffering)
            .filter(SubjectOffering.id == payload.subject_offering_id)
            .first()
        )
        asgn = (
            db.query(FacultyAssignment)
            .filter(FacultyAssignment.id == payload.faculty_assignment_id)
            .first()
        )

        faculty_id = asgn.faculty_id if asgn else 0
        section_id = payload.section_id or (offering.section_id if offering else 0)
        group_id = payload.student_group_id if payload.student_group_id is not None else (offering.student_group_id if offering else None)

        errors, conflicts = TimetableService._validate_conflicts_structured(
            db=db,
            day_of_week=payload.day_of_week,
            start_time=payload.start_time,
            end_time=payload.end_time,
            room_number=payload.room_number,
            faculty_id=faculty_id,
            section_id=section_id,
            student_group_id=group_id,
            exclude_entry_id=payload.exclude_entry_id,
        )

        return ConflictValidationResponse(
            has_conflict=len(conflicts) > 0,
            conflicts=conflicts,
            errors=errors,
        )

    @staticmethod
    def get_conflict_summary(db: Session) -> TimetableConflictSummary:
        """Calculate system-wide conflict summary counts across all active schedule entries."""
        entries = TimetableService.list_entries(db, is_active=True)
        total = len(entries)
        faculty_clashes = sum(1 for e in entries if "faculty" in e.conflict_types)
        room_clashes = sum(1 for e in entries if "room" in e.conflict_types)
        group_clashes = sum(1 for e in entries if "student_group" in e.conflict_types)
        free = sum(1 for e in entries if not e.has_conflict)

        return TimetableConflictSummary(
            total_entries=total,
            faculty_conflicts=faculty_clashes,
            room_conflicts=room_clashes,
            student_group_conflicts=group_clashes,
            conflict_free=free,
            has_any_conflict=(faculty_clashes > 0 or room_clashes > 0 or group_clashes > 0),
        )

    @staticmethod
    def create_entry(db: Session, payload: TimetableEntryCreate, current_user: User | None = None) -> TimetableEntry:
        # Validate SubjectOffering
        offering = (
            db.query(SubjectOffering)
            .filter(SubjectOffering.id == payload.subject_offering_id, SubjectOffering.is_active.is_(True))
            .first()
        )
        if not offering:
            raise ValueError("Active subject offering not found")

        # Validate FacultyAssignment
        assignment = (
            db.query(FacultyAssignment)
            .filter(FacultyAssignment.id == payload.faculty_assignment_id, FacultyAssignment.is_active.is_(True))
            .first()
        )
        if not assignment:
            raise ValueError("Active faculty assignment not found")

        if assignment.subject_offering_id != offering.id:
            raise ValueError("Faculty assignment does not match the provided subject offering")

        # Conflict Validation
        errors, conflicts = TimetableService._validate_conflicts_structured(
            db=db,
            day_of_week=payload.day_of_week,
            start_time=payload.start_time,
            end_time=payload.end_time,
            room_number=payload.room_number,
            faculty_id=assignment.faculty_id,
            section_id=offering.section_id,
            student_group_id=offering.student_group_id,
        )

        if errors:
            raise ValueError(errors[0])

        if conflicts:
            if payload.allow_override and payload.override_reason:
                if current_user:
                    AuditService.log_action(
                        db=db,
                        user=current_user,
                        action="OVERRIDE_TIMETABLE_CONFLICT",
                        entity_type="TIMETABLE_ENTRY",
                        reason=payload.override_reason,
                        metadata={
                            "conflicts_count": len(conflicts),
                            "room_number": payload.room_number,
                            "day": payload.day_of_week.value,
                        },
                    )
            else:
                # Raise descriptive exception for the first conflict
                c = conflicts[0]
                if c.conflict_type == "faculty":
                    raise ValueError(
                        f"Faculty conflict: Instructor is already scheduled for '{c.conflicting_subject_name}' on {payload.day_of_week.value.capitalize()} "
                        f"from {c.conflicting_time} in Room {c.conflicting_room}"
                    )
                elif c.conflict_type == "room":
                    raise ValueError(
                        f"Room conflict: Room '{payload.room_number}' is already occupied for '{c.conflicting_subject_name}' on {payload.day_of_week.value.capitalize()} "
                        f"from {c.conflicting_time}"
                    )
                else:
                    grp_lbl = f"Group {c.conflicting_group_name}" if c.conflicting_group_name else "Whole Section"
                    raise ValueError(
                        f"Student group conflict: Section '{c.conflicting_section_name}' ({grp_lbl}) already has '{c.conflicting_subject_name}' "
                        f"on {payload.day_of_week.value.capitalize()} from {c.conflicting_time}"
                    )

        entry = TimetableEntry(
            subject_offering_id=offering.id,
            faculty_assignment_id=assignment.id,
            section_id=offering.section_id,
            student_group_id=offering.student_group_id,
            class_type=offering.class_type,
            day_of_week=payload.day_of_week,
            start_time=payload.start_time,
            end_time=payload.end_time,
            room_number=payload.room_number.strip(),
            is_active=True,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)

        if current_user:
            AuditService.log_action(
                db=db,
                user=current_user,
                action="CREATE_TIMETABLE_ENTRY",
                entity_type="TIMETABLE_ENTRY",
                entity_id=entry.id,
                reason=f"Scheduled {offering.class_type.value} on {payload.day_of_week.value} in {entry.room_number}",
            )

        return entry

    @staticmethod
    def update_entry(
        db: Session,
        entry_id: int,
        payload: TimetableEntryUpdate,
        current_user: User | None = None,
    ) -> TimetableEntry:
        entry = (
            db.query(TimetableEntry)
            .options(
                joinedload(TimetableEntry.subject_offering),
                joinedload(TimetableEntry.faculty_assignment),
            )
            .filter(TimetableEntry.id == entry_id)
            .first()
        )
        if not entry:
            raise ValueError("Timetable entry not found")

        assignment = entry.faculty_assignment
        if payload.faculty_assignment_id is not None:
            assignment = (
                db.query(FacultyAssignment)
                .filter(FacultyAssignment.id == payload.faculty_assignment_id, FacultyAssignment.is_active.is_(True))
                .first()
            )
            if not assignment:
                raise ValueError("Faculty assignment not found")
            if assignment.subject_offering_id != entry.subject_offering_id:
                raise ValueError("Faculty assignment does not match this entry's subject offering")
            entry.faculty_assignment_id = assignment.id

        new_day = payload.day_of_week if payload.day_of_week is not None else entry.day_of_week
        new_start = payload.start_time if payload.start_time is not None else entry.start_time
        new_end = payload.end_time if payload.end_time is not None else entry.end_time
        new_room = payload.room_number.strip() if payload.room_number is not None else entry.room_number

        if payload.is_active is not None:
            entry.is_active = payload.is_active

        if entry.is_active:
            errors, conflicts = TimetableService._validate_conflicts_structured(
                db=db,
                day_of_week=new_day,
                start_time=new_start,
                end_time=new_end,
                room_number=new_room,
                faculty_id=assignment.faculty_id if assignment else 0,
                section_id=entry.section_id,
                student_group_id=entry.student_group_id,
                exclude_entry_id=entry.id,
            )

            if errors:
                raise ValueError(errors[0])

            if conflicts:
                if payload.allow_override and payload.override_reason:
                    if current_user:
                        AuditService.log_action(
                            db=db,
                            user=current_user,
                            action="OVERRIDE_TIMETABLE_UPDATE_CONFLICT",
                            entity_type="TIMETABLE_ENTRY",
                            entity_id=entry.id,
                            reason=payload.override_reason,
                        )
                else:
                    c = conflicts[0]
                    if c.conflict_type == "faculty":
                        raise ValueError(
                            f"Faculty conflict: Instructor is already scheduled for '{c.conflicting_subject_name}' on {new_day.value.capitalize()} "
                            f"from {c.conflicting_time} in Room {c.conflicting_room}"
                        )
                    elif c.conflict_type == "room":
                        raise ValueError(
                            f"Room conflict: Room '{new_room}' is already occupied for '{c.conflicting_subject_name}' on {new_day.value.capitalize()} "
                            f"from {c.conflicting_time}"
                        )
                    else:
                        grp_lbl = f"Group {c.conflicting_group_name}" if c.conflicting_group_name else "Whole Section"
                        raise ValueError(
                            f"Student group conflict: Section '{c.conflicting_section_name}' ({grp_lbl}) already has '{c.conflicting_subject_name}' "
                            f"on {new_day.value.capitalize()} from {c.conflicting_time}"
                        )

        entry.day_of_week = new_day
        entry.start_time = new_start
        entry.end_time = new_end
        entry.room_number = new_room

        db.commit()
        db.refresh(entry)

        if current_user:
            AuditService.log_action(
                db=db,
                user=current_user,
                action="UPDATE_TIMETABLE_ENTRY",
                entity_type="TIMETABLE_ENTRY",
                entity_id=entry.id,
                reason="Updated timetable schedule parameters",
            )

        return entry

    @staticmethod
    def delete_entry(db: Session, entry_id: int, current_user: User | None = None) -> TimetableEntry:
        """Safely deactivate a timetable entry and preserve any historical attendance sessions."""
        entry = db.query(TimetableEntry).filter(TimetableEntry.id == entry_id).first()
        if not entry:
            raise ValueError("Timetable entry not found")

        has_attendance = (
            db.query(AttendanceSession)
            .filter(AttendanceSession.timetable_entry_id == entry_id)
            .count()
            > 0
        )

        entry.is_active = False
        db.commit()
        db.refresh(entry)

        if current_user:
            AuditService.log_action(
                db=db,
                user=current_user,
                action="DEACTIVATE_TIMETABLE_ENTRY",
                entity_type="TIMETABLE_ENTRY",
                entity_id=entry_id,
                reason="Deactivated timetable entry" + (" (historical attendance records preserved)" if has_attendance else ""),
            )

        return entry

    @staticmethod
    def get_entry(db: Session, entry_id: int) -> TimetableEntryDetailRead:
        entry = (
            db.query(TimetableEntry)
            .options(
                joinedload(TimetableEntry.subject_offering).joinedload(SubjectOffering.subject),
                joinedload(TimetableEntry.subject_offering).joinedload(SubjectOffering.course),
                joinedload(TimetableEntry.subject_offering).joinedload(SubjectOffering.branch),
                joinedload(TimetableEntry.faculty_assignment).joinedload(FacultyAssignment.faculty).joinedload(FacultyProfile.user),
                joinedload(TimetableEntry.section),
                joinedload(TimetableEntry.student_group),
            )
            .filter(TimetableEntry.id == entry_id)
            .first()
        )
        if not entry:
            raise ValueError("Timetable entry not found")

        detail = _to_detail_read(entry)

        # Populate conflicts against system active entries
        all_active = TimetableService.list_entries(db, is_active=True)
        for act in all_active:
            if act.id == detail.id:
                detail.conflicts = act.conflicts
                detail.conflict_types = act.conflict_types
                detail.has_conflict = act.has_conflict
                break

        return detail

    @staticmethod
    def list_entries(
        db: Session,
        section_id: int | None = None,
        faculty_id: int | None = None,
        day_of_week: DayOfWeek | None = None,
        room_number: str | None = None,
        class_type: ClassType | None = None,
        conflict_status: str | None = None,
        query_str: str | None = None,
        is_active: bool | None = None,
    ) -> list[TimetableEntryDetailRead]:
        """Fetch timetable entries with eager relationships and system-wide conflict analysis."""
        # 1. Fetch all active entries to compute the system-wide conflict graph accurately
        base_query = (
            db.query(TimetableEntry)
            .options(
                joinedload(TimetableEntry.subject_offering).joinedload(SubjectOffering.subject),
                joinedload(TimetableEntry.subject_offering).joinedload(SubjectOffering.course),
                joinedload(TimetableEntry.subject_offering).joinedload(SubjectOffering.branch),
                joinedload(TimetableEntry.faculty_assignment).joinedload(FacultyAssignment.faculty).joinedload(FacultyProfile.user),
                joinedload(TimetableEntry.section),
                joinedload(TimetableEntry.student_group),
            )
            .order_by(TimetableEntry.day_of_week, TimetableEntry.start_time)
        )

        all_entries_db = base_query.all()
        all_details = [_to_detail_read(e) for e in all_entries_db]

        # Populate conflicts across all active entries
        active_details = [d for d in all_details if d.is_active]
        _populate_conflicts_for_entries(active_details)

        # 2. Apply filters to the analyzed list
        filtered = all_details

        if is_active is not None:
            filtered = [e for e in filtered if e.is_active == is_active]

        if section_id is not None:
            filtered = [e for e in filtered if e.section_id == section_id]

        if faculty_id is not None:
            filtered = [e for e in filtered if e.faculty_id == faculty_id]

        if day_of_week is not None:
            filtered = [e for e in filtered if e.day_of_week == day_of_week]

        if room_number:
            filtered = [e for e in filtered if e.room_number.strip().lower() == room_number.strip().lower()]

        if class_type is not None:
            filtered = [e for e in filtered if e.class_type == class_type]

        if query_str:
            q = query_str.strip().lower()
            filtered = [
                e
                for e in filtered
                if q in e.subject_name.lower()
                or q in e.subject_code.lower()
                or q in e.faculty_name.lower()
                or q in e.employee_id.lower()
                or q in e.room_number.lower()
                or q in e.section_name.lower()
                or (e.student_group_name and q in e.student_group_name.lower())
                or q in e.day_of_week.value.lower()
                or q in e.class_type.value.lower()
                or q in e.course_name.lower()
                or q in e.branch_name.lower()
            ]

        if conflict_status:
            cs = conflict_status.strip().lower()
            if cs == "conflict":
                filtered = [e for e in filtered if e.has_conflict]
            elif cs == "conflict_free":
                filtered = [e for e in filtered if not e.has_conflict]
            elif cs == "faculty":
                filtered = [e for e in filtered if "faculty" in e.conflict_types]
            elif cs == "room":
                filtered = [e for e in filtered if "room" in e.conflict_types]
            elif cs == "student_group":
                filtered = [e for e in filtered if "student_group" in e.conflict_types]

        return filtered

    @staticmethod
    def get_today_faculty_schedule(db: Session, faculty_id: int) -> list[TimetableEntryDetailRead]:
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        today_day_str = days[date.today().weekday()]
        today_enum = DayOfWeek(today_day_str)

        entries = TimetableService.list_entries(
            db,
            faculty_id=faculty_id,
            day_of_week=today_enum,
            is_active=True,
        )
        return entries

    @staticmethod
    def get_today_student_schedule(db: Session, student_id: int) -> list[TimetableEntryDetailRead]:
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        today_day_str = days[date.today().weekday()]
        today_enum = DayOfWeek(today_day_str)

        student = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
        if not student:
            return []

        enrollment = (
            db.query(AcademicEnrollment)
            .filter(
                AcademicEnrollment.student_id == student_id,
                AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
            )
            .order_by(AcademicEnrollment.is_current.desc(), AcademicEnrollment.id.desc())
            .first()
        )
        section_id = enrollment.section_id if enrollment else student.section_id
        group_id = (enrollment.student_group_id if enrollment else None) or student.current_group_id
        if not section_id:
            return []

        entries = TimetableService.list_entries(
            db,
            section_id=section_id,
            day_of_week=today_enum,
            is_active=True,
        )

        return [e for e in entries if e.student_group_id is None or e.student_group_id == group_id]

    @staticmethod
    def upload_csv(db: Session, csv_content: str, current_user: User | None = None) -> TimetableUploadResponse:
        """Atomic CSV upload: Parses, pre-validates all rows and commits only if 100% valid."""
        reader = csv.DictReader(io.StringIO(csv_content.strip()))
        rows = list(reader)
        if not rows:
            return TimetableUploadResponse(rows_processed=0, created_count=0, errors=["Empty CSV content"])

        required_cols = {"subject_code", "section_name", "faculty_email", "class_type", "day_of_week", "start_time", "end_time", "room_number"}
        fieldnames = set(reader.fieldnames or [])
        missing = required_cols - fieldnames
        if missing:
            return TimetableUploadResponse(
                rows_processed=len(rows),
                created_count=0,
                errors=[f"Missing required CSV column(s): {', '.join(sorted(missing))}"],
            )

        errors: list[str] = []
        entries_to_create: list[TimetableEntry] = []
        seen_staged_signatures: set[tuple] = set()

        for idx, row in enumerate(rows, start=2):  # Row 1 is header
            sub_code = row.get("subject_code", "").strip()
            sec_name = row.get("section_name", "").strip()
            group_name = row.get("student_group_name", "").strip() or None
            fac_email = row.get("faculty_email", "").strip()
            class_type_str = row.get("class_type", "theory").strip().lower()
            day_str = row.get("day_of_week", "").strip().lower()
            start_str = row.get("start_time", "").strip()
            end_str = row.get("end_time", "").strip()
            room = row.get("room_number", "").strip()

            if not all([sub_code, sec_name, fac_email, class_type_str, day_str, start_str, end_str, room]):
                errors.append(f"Row {idx}: Missing required field values")
                continue

            # Validate Enum
            try:
                day_enum = DayOfWeek(day_str)
            except ValueError:
                errors.append(f"Row {idx}: Invalid day_of_week '{day_str}'")
                continue

            try:
                class_type_enum = ClassType(class_type_str)
            except ValueError:
                errors.append(f"Row {idx}: Invalid class_type '{class_type_str}'")
                continue

            # Parse time
            try:
                start_t = datetime.strptime(start_str, "%H:%M").time()
                end_t = datetime.strptime(end_str, "%H:%M").time()
            except ValueError:
                try:
                    start_t = datetime.strptime(start_str, "%H:%M:%S").time()
                    end_t = datetime.strptime(end_str, "%H:%M:%S").time()
                except ValueError:
                    errors.append(f"Row {idx}: Invalid time format (use HH:MM)")
                    continue

            if start_t >= end_t:
                errors.append(f"Row {idx}: Invalid time interval (start_time {start_str} must be earlier than end_time {end_str})")
                continue

            # Check duplicate row in CSV
            sig = (day_enum, start_t, end_t, room.lower(), sec_name.lower(), group_name, fac_email.lower())
            if sig in seen_staged_signatures:
                errors.append(f"Row {idx}: Duplicate timetable entry in the CSV batch")
                continue
            seen_staged_signatures.add(sig)

            # Find Subject
            subject = db.query(Subject).filter(Subject.code == sub_code).first()
            if not subject:
                errors.append(f"Row {idx}: Subject with code '{sub_code}' not found")
                continue

            # Find Section
            section = db.query(Section).filter(Section.name == sec_name).first()
            if not section:
                errors.append(f"Row {idx}: Section with name '{sec_name}' not found")
                continue

            # Find Group if provided
            group_id = None
            if group_name:
                group = db.query(StudentGroup).filter(StudentGroup.section_id == section.id, StudentGroup.name == group_name).first()
                if not group:
                    errors.append(f"Row {idx}: Student group '{group_name}' not found in section '{sec_name}'")
                    continue
                group_id = group.id

            # Find Subject Offering
            offering = (
                db.query(SubjectOffering)
                .filter(
                    SubjectOffering.subject_id == subject.id,
                    SubjectOffering.section_id == section.id,
                    SubjectOffering.student_group_id == group_id,
                    SubjectOffering.class_type == class_type_enum,
                    SubjectOffering.is_active.is_(True),
                )
                .first()
            )
            if not offering:
                errors.append(f"Row {idx}: No active SubjectOffering found for {sub_code} in section {sec_name}")
                continue

            # Find Faculty
            faculty_user = db.query(User).filter(User.email == fac_email).first()
            if not faculty_user or not faculty_user.faculty_profile:
                errors.append(f"Row {idx}: Faculty with email '{fac_email}' not found")
                continue

            faculty_id = faculty_user.faculty_profile.id
            assignment = (
                db.query(FacultyAssignment)
                .filter(
                    FacultyAssignment.faculty_id == faculty_id,
                    FacultyAssignment.subject_offering_id == offering.id,
                    FacultyAssignment.is_active.is_(True),
                )
                .first()
            )
            if not assignment:
                errors.append(f"Row {idx}: Faculty '{fac_email}' is not assigned to offering for {sub_code}")
                continue

            # Validate conflicts against database and already staged entries
            try:
                TimetableService._validate_conflicts(
                    db=db,
                    day_of_week=day_enum,
                    start_time=start_t,
                    end_time=end_t,
                    room_number=room,
                    faculty_id=faculty_id,
                    section_id=section.id,
                    student_group_id=group_id,
                )
                # Check conflicts with other newly staged entries in same CSV batch
                for staged in entries_to_create:
                    if staged.day_of_week == day_enum and _intervals_overlap(start_t, end_t, staged.start_time, staged.end_time):
                        if staged.faculty_assignment.faculty_id == faculty_id:
                            raise ValueError("Batch conflict: Faculty double booked with another row in CSV")
                        if staged.room_number.lower() == room.lower():
                            raise ValueError(f"Batch conflict: Room '{room}' double booked with another row in CSV")
                        if staged.section_id == section.id:
                            if group_id is None or staged.student_group_id is None or staged.student_group_id == group_id:
                                raise ValueError(f"Batch conflict: Section '{sec_name}' double booked with another row in CSV")
            except ValueError as val_err:
                errors.append(f"Row {idx}: {str(val_err)}")
                continue

            staged_entry = TimetableEntry(
                subject_offering_id=offering.id,
                faculty_assignment_id=assignment.id,
                section_id=section.id,
                student_group_id=group_id,
                class_type=class_type_enum,
                day_of_week=day_enum,
                start_time=start_t,
                end_time=end_t,
                room_number=room,
                is_active=True,
            )
            staged_entry.faculty_assignment = assignment
            entries_to_create.append(staged_entry)

        if errors:
            # Atomic: Reject entire batch if there are any errors
            return TimetableUploadResponse(
                rows_processed=len(rows),
                created_count=0,
                errors=errors,
            )

        db.add_all(entries_to_create)
        db.commit()

        if current_user:
            AuditService.log_action(
                db=db,
                user=current_user,
                action="CSV_UPLOAD_TIMETABLE",
                entity_type="TIMETABLE_BATCH",
                reason=f"Batch uploaded {len(entries_to_create)} timetable entries via CSV",
            )

        return TimetableUploadResponse(
            rows_processed=len(rows),
            created_count=len(entries_to_create),
            errors=[],
        )
