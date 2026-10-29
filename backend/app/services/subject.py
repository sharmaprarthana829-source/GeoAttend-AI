from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models import (
    AttendanceSession,
    Batch,
    Branch,
    ClassType,
    Course,
    Department,
    FacultyAssignment,
    FacultyProfile,
    Section,
    StudentGroup,
    Subject,
    SubjectOffering,
    TimetableEntry,
    User,
)
from app.schemas import (
    FacultyAssignmentCreate,
    FacultyAssignmentDetailRead,
    FacultyAssignmentRead,
    FacultyAssignmentUpdate,
    SubjectCreate,
    SubjectOfferingCreate,
    SubjectOfferingRead,
    SubjectOfferingUpdate,
    SubjectRead,
    SubjectUpdate,
)


def _build_subject_read(s: Subject) -> SubjectRead:
    dept = s.department
    offerings_count = len(s.offerings) if s.offerings else 0
    return SubjectRead(
        id=s.id,
        name=s.name,
        code=s.code,
        description=s.description,
        credits=s.credits,
        department_id=s.department_id,
        department_name=dept.name if dept else None,
        is_active=s.is_active,
        created_at=s.created_at,
        offerings_count=offerings_count,
    )


def _build_offering_read(o: SubjectOffering) -> SubjectOfferingRead:
    sub = o.subject
    course = o.course
    branch = o.branch
    section = o.section
    batch = section.batch if (section and section.batch) else None
    group = o.student_group

    academic_year = f"{batch.start_year}-{batch.end_year}" if (batch and batch.start_year and batch.end_year) else None

    fac_names: list[str] = []
    if o.faculty_assignments:
        for fa in o.faculty_assignments:
            if fa.is_active and fa.faculty and fa.faculty.user:
                fac_names.append(fa.faculty.user.full_name)

    return SubjectOfferingRead(
        id=o.id,
        subject_id=o.subject_id,
        course_id=o.course_id,
        semester=o.semester,
        branch_id=o.branch_id,
        batch_id=batch.id if batch else None,
        section_id=o.section_id,
        student_group_id=o.student_group_id,
        class_type=o.class_type,
        academic_year=academic_year,
        is_active=o.is_active,
        created_at=o.created_at,
        subject_name=sub.name if sub else None,
        subject_code=sub.code if sub else None,
        credits=sub.credits if sub else None,
        course_name=course.name if course else None,
        branch_name=branch.name if branch else None,
        batch_name=batch.name if batch else None,
        section_name=section.name if section else None,
        student_group_name=group.name if group else None,
        assigned_faculty_count=len(fac_names),
        assigned_faculty_names=fac_names,
    )


def _build_assignment_read(a: FacultyAssignment) -> FacultyAssignmentRead:
    fac = a.faculty
    user = fac.user if fac else None
    off = a.subject_offering
    sub = off.subject if off else None
    course = off.course if off else None
    branch = off.branch if off else None
    section = off.section if off else None
    batch = section.batch if (section and section.batch) else None
    group = off.student_group if off else None

    academic_year = f"{batch.start_year}-{batch.end_year}" if (batch and batch.start_year and batch.end_year) else None

    is_pri = getattr(a, "is_primary", True)
    if is_pri is None:
        is_pri = True

    return FacultyAssignmentRead(
        id=a.id,
        faculty_id=a.faculty_id,
        subject_offering_id=a.subject_offering_id,
        is_primary=is_pri,
        is_active=a.is_active,
        created_at=a.created_at,
        faculty_name=user.full_name if user else f"Faculty #{a.faculty_id}",
        employee_id=fac.employee_id if fac else "N/A",
        faculty_designation=fac.designation if fac else "Faculty",
        subject_name=sub.name if sub else "Unknown Subject",
        subject_code=sub.code if sub else "N/A",
        course_name=course.name if course else "N/A",
        branch_name=branch.name if branch else "N/A",
        batch_name=batch.name if batch else None,
        section_name=section.name if section else "N/A",
        student_group_name=group.name if group else None,
        semester=off.semester if off else 1,
        academic_year=academic_year,
        class_type=off.class_type if off else ClassType.THEORY,
    )


class SubjectService:
    # -------------------------------------------------------------
    # Master Subjects
    # -------------------------------------------------------------
    @staticmethod
    def create_subject(db: Session, payload: SubjectCreate) -> SubjectRead:
        code_clean = payload.code.strip().upper()
        name_clean = payload.name.strip()

        existing = db.query(Subject).filter(Subject.code.ilike(code_clean)).first()
        if existing:
            raise ValueError(f"Subject with code '{code_clean}' already exists")

        dept_id = payload.department_id
        if dept_id is not None:
            dept = db.query(Department).filter(Department.id == dept_id).first()
            if not dept:
                raise ValueError("Department not found")
        else:
            first_dept = db.query(Department).first()
            if first_dept:
                dept_id = first_dept.id

        subject = Subject(
            name=name_clean,
            code=code_clean,
            description=payload.description.strip() if payload.description else None,
            credits=payload.credits,
            department_id=dept_id,
            is_active=True,
        )
        db.add(subject)
        db.commit()
        db.refresh(subject)
        return _build_subject_read(subject)

    @staticmethod
    def list_subjects(
        db: Session,
        department_id: int | None = None,
        is_active: bool | None = None,
        query: str | None = None,
    ) -> list[SubjectRead]:
        q = (
            db.query(Subject)
            .options(
                joinedload(Subject.department),
                joinedload(Subject.offerings),
            )
        )
        if department_id is not None:
            q = q.filter(Subject.department_id == department_id)
        if is_active is not None:
            q = q.filter(Subject.is_active == is_active)
        if query:
            term = f"%{query.strip()}%"
            q = q.filter(
                or_(
                    Subject.name.ilike(term),
                    Subject.code.ilike(term),
                    Subject.description.ilike(term),
                )
            )
        subjects = q.order_by(Subject.code).all()
        return [_build_subject_read(s) for s in subjects]

    @staticmethod
    def get_subject(db: Session, subject_id: int) -> SubjectRead:
        subject = (
            db.query(Subject)
            .options(
                joinedload(Subject.department),
                joinedload(Subject.offerings),
            )
            .filter(Subject.id == subject_id)
            .first()
        )
        if not subject:
            raise ValueError("Subject not found")
        return _build_subject_read(subject)

    @staticmethod
    def update_subject(db: Session, subject_id: int, payload: SubjectUpdate) -> SubjectRead:
        subject = (
            db.query(Subject)
            .options(
                joinedload(Subject.department),
                joinedload(Subject.offerings),
            )
            .filter(Subject.id == subject_id)
            .first()
        )
        if not subject:
            raise ValueError("Subject not found")

        if payload.code is not None:
            code_clean = payload.code.strip().upper()
            if code_clean != subject.code:
                existing = db.query(Subject).filter(Subject.code.ilike(code_clean), Subject.id != subject_id).first()
                if existing:
                    raise ValueError(f"Subject with code '{code_clean}' already exists")
                subject.code = code_clean

        if payload.name is not None:
            subject.name = payload.name.strip()
        if payload.description is not None:
            subject.description = payload.description.strip() or None
        if payload.credits is not None:
            subject.credits = payload.credits
        if payload.department_id is not None:
            dept = db.query(Department).filter(Department.id == payload.department_id).first()
            if not dept:
                raise ValueError("Department not found")
            subject.department_id = payload.department_id
        if payload.is_active is not None:
            subject.is_active = payload.is_active

        db.commit()
        db.refresh(subject)
        return _build_subject_read(subject)

    @staticmethod
    def delete_subject(db: Session, subject_id: int) -> SubjectRead:
        subject = (
            db.query(Subject)
            .options(
                joinedload(Subject.department),
                joinedload(Subject.offerings),
            )
            .filter(Subject.id == subject_id)
            .first()
        )
        if not subject:
            raise ValueError("Subject not found")

        # Check if offerings exist
        offerings_count = db.query(SubjectOffering).filter(SubjectOffering.subject_id == subject_id).count()
        if offerings_count > 0:
            # Safe deactivation rule to preserve academic and historical references
            subject.is_active = False
            db.commit()
            db.refresh(subject)
            return _build_subject_read(subject)

        # Safe hard delete if completely unused
        db.delete(subject)
        db.commit()
        subject.is_active = False
        return _build_subject_read(subject)

    # -------------------------------------------------------------
    # Subject Offerings
    # -------------------------------------------------------------
    @staticmethod
    def create_offering(db: Session, payload: SubjectOfferingCreate) -> SubjectOfferingRead:
        # 1. Validate entities
        subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
        if not subject:
            raise ValueError("Subject not found")

        course = db.query(Course).filter(Course.id == payload.course_id).first()
        if not course:
            raise ValueError("Course not found")

        branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
        if not branch:
            raise ValueError("Branch not found")

        section = (
            db.query(Section)
            .options(joinedload(Section.batch).joinedload(Batch.branch))
            .filter(Section.id == payload.section_id)
            .first()
        )
        if not section:
            raise ValueError("Section not found")

        # 2. Validate hierarchy consistency
        if payload.semester < 1 or payload.semester > course.total_semesters:
            raise ValueError(f"Semester {payload.semester} must be between 1 and {course.total_semesters} for course '{course.name}'")

        if branch.course_id != course.id:
            raise ValueError(f"Branch '{branch.name}' does not belong to Course '{course.name}'")

        if section.batch and section.batch.branch_id != branch.id:
            raise ValueError(f"Section '{section.name}' does not belong to Branch '{branch.name}'")

        if payload.batch_id is not None and section.batch_id != payload.batch_id:
            raise ValueError("Section does not belong to the selected Batch")

        if payload.student_group_id is not None:
            group = db.query(StudentGroup).filter(StudentGroup.id == payload.student_group_id).first()
            if not group:
                raise ValueError("Student Group not found")
            if group.section_id != section.id:
                raise ValueError(f"Student Group '{group.name}' does not belong to Section '{section.name}'")

        # 3. Check duplicate offering
        existing = (
            db.query(SubjectOffering)
            .filter(
                SubjectOffering.subject_id == payload.subject_id,
                SubjectOffering.section_id == payload.section_id,
                SubjectOffering.student_group_id == payload.student_group_id,
                SubjectOffering.class_type == payload.class_type,
                SubjectOffering.semester == payload.semester,
            )
            .first()
        )
        if existing:
            if not existing.is_active:
                existing.is_active = True
                db.commit()
                return SubjectService.get_offering(db, existing.id)
            raise ValueError("Subject offering already exists for this subject, section, student group, class type and semester")

        offering = SubjectOffering(
            subject_id=payload.subject_id,
            course_id=payload.course_id,
            semester=payload.semester,
            branch_id=payload.branch_id,
            section_id=payload.section_id,
            student_group_id=payload.student_group_id,
            class_type=payload.class_type,
            is_active=True,
        )
        db.add(offering)
        db.commit()
        db.refresh(offering)
        return SubjectService.get_offering(db, offering.id)

    @staticmethod
    def list_offerings(
        db: Session,
        subject_id: int | None = None,
        course_id: int | None = None,
        branch_id: int | None = None,
        batch_id: int | None = None,
        section_id: int | None = None,
        semester: int | None = None,
        class_type: str | None = None,
        is_active: bool | None = None,
        query: str | None = None,
    ) -> list[SubjectOfferingRead]:
        q = (
            db.query(SubjectOffering)
            .join(SubjectOffering.subject)
            .options(
                joinedload(SubjectOffering.subject),
                joinedload(SubjectOffering.course),
                joinedload(SubjectOffering.branch),
                joinedload(SubjectOffering.section).joinedload(Section.batch),
                joinedload(SubjectOffering.student_group),
                joinedload(SubjectOffering.faculty_assignments)
                .joinedload(FacultyAssignment.faculty)
                .joinedload(FacultyProfile.user),
            )
        )
        if subject_id is not None:
            q = q.filter(SubjectOffering.subject_id == subject_id)
        if course_id is not None:
            q = q.filter(SubjectOffering.course_id == course_id)
        if branch_id is not None:
            q = q.filter(SubjectOffering.branch_id == branch_id)
        if section_id is not None:
            q = q.filter(SubjectOffering.section_id == section_id)
        if batch_id is not None:
            q = q.join(SubjectOffering.section).filter(Section.batch_id == batch_id)
        if semester is not None:
            q = q.filter(SubjectOffering.semester == semester)
        if class_type is not None:
            q = q.filter(SubjectOffering.class_type == class_type)
        if is_active is not None:
            q = q.filter(SubjectOffering.is_active == is_active)
        if query:
            term = f"%{query.strip()}%"
            q = q.filter(
                or_(
                    Subject.name.ilike(term),
                    Subject.code.ilike(term),
                )
            )

        offerings = q.order_by(SubjectOffering.id.desc()).all()
        return [_build_offering_read(o) for o in offerings]

    @staticmethod
    def get_offering(db: Session, offering_id: int) -> SubjectOfferingRead:
        offering = (
            db.query(SubjectOffering)
            .options(
                joinedload(SubjectOffering.subject),
                joinedload(SubjectOffering.course),
                joinedload(SubjectOffering.branch),
                joinedload(SubjectOffering.section).joinedload(Section.batch),
                joinedload(SubjectOffering.student_group),
                joinedload(SubjectOffering.faculty_assignments)
                .joinedload(FacultyAssignment.faculty)
                .joinedload(FacultyProfile.user),
            )
            .filter(SubjectOffering.id == offering_id)
            .first()
        )
        if not offering:
            raise ValueError("Subject offering not found")
        return _build_offering_read(offering)

    @staticmethod
    def update_offering(db: Session, offering_id: int, payload: SubjectOfferingUpdate) -> SubjectOfferingRead:
        offering = db.query(SubjectOffering).filter(SubjectOffering.id == offering_id).first()
        if not offering:
            raise ValueError("Subject offering not found")

        if payload.subject_id is not None:
            sub = db.query(Subject).filter(Subject.id == payload.subject_id).first()
            if not sub:
                raise ValueError("Subject not found")
            offering.subject_id = payload.subject_id

        if payload.course_id is not None:
            course = db.query(Course).filter(Course.id == payload.course_id).first()
            if not course:
                raise ValueError("Course not found")
            offering.course_id = payload.course_id

        if payload.branch_id is not None:
            branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
            if not branch:
                raise ValueError("Branch not found")
            offering.branch_id = payload.branch_id

        if payload.section_id is not None:
            sec = db.query(Section).filter(Section.id == payload.section_id).first()
            if not sec:
                raise ValueError("Section not found")
            offering.section_id = payload.section_id

        if payload.student_group_id is not None:
            group = db.query(StudentGroup).filter(StudentGroup.id == payload.student_group_id).first()
            if not group or group.section_id != offering.section_id:
                raise ValueError(f"Student Group does not belong to Section ID {offering.section_id}")
            offering.student_group_id = payload.student_group_id

        if payload.semester is not None:
            offering.semester = payload.semester
        if payload.class_type is not None:
            offering.class_type = payload.class_type
        if payload.is_active is not None:
            offering.is_active = payload.is_active

        db.commit()
        return SubjectService.get_offering(db, offering_id)

    @staticmethod
    def delete_offering(db: Session, offering_id: int) -> SubjectOfferingRead:
        offering = db.query(SubjectOffering).filter(SubjectOffering.id == offering_id).first()
        if not offering:
            raise ValueError("Subject offering not found")

        # Check historical references
        has_sessions = db.query(AttendanceSession).filter(AttendanceSession.subject_offering_id == offering_id).count() > 0
        has_timetable = db.query(TimetableEntry).filter(TimetableEntry.subject_offering_id == offering_id).count() > 0

        if has_sessions or has_timetable:
            offering.is_active = False
            # Also deactivate assignments
            for a in offering.faculty_assignments:
                a.is_active = False
            db.commit()
            return SubjectService.get_offering(db, offering_id)

        # If completely unreferenced, can safely delete
        read_obj = SubjectService.get_offering(db, offering_id)
        db.delete(offering)
        db.commit()
        read_obj.is_active = False
        return read_obj

    # -------------------------------------------------------------
    # Faculty Assignments
    # -------------------------------------------------------------
    @staticmethod
    def assign_faculty(db: Session, payload: FacultyAssignmentCreate) -> FacultyAssignmentRead:
        faculty = (
            db.query(FacultyProfile)
            .options(joinedload(FacultyProfile.user))
            .filter(FacultyProfile.id == payload.faculty_id)
            .first()
        )
        if not faculty:
            raise ValueError("Faculty profile not found")

        offering = db.query(SubjectOffering).filter(SubjectOffering.id == payload.subject_offering_id).first()
        if not offering:
            raise ValueError("Subject offering not found")
        if not offering.is_active:
            raise ValueError("Cannot assign faculty to an inactive subject offering")

        existing = (
            db.query(FacultyAssignment)
            .filter(
                FacultyAssignment.faculty_id == payload.faculty_id,
                FacultyAssignment.subject_offering_id == payload.subject_offering_id,
            )
            .first()
        )
        if existing:
            if not existing.is_active:
                existing.is_active = True
                existing.is_primary = payload.is_primary
                db.commit()
                return SubjectService.get_assignment(db, existing.id)
            raise ValueError(f"{faculty.user.full_name} is already assigned to this subject offering")

        assignment = FacultyAssignment(
            faculty_id=payload.faculty_id,
            subject_offering_id=payload.subject_offering_id,
            is_primary=payload.is_primary,
            is_active=True,
        )
        db.add(assignment)
        db.commit()
        db.refresh(assignment)
        return SubjectService.get_assignment(db, assignment.id)

    @staticmethod
    def list_assignments(
        db: Session,
        faculty_id: int | None = None,
        subject_offering_id: int | None = None,
        is_active: bool | None = None,
        query: str | None = None,
    ) -> list[FacultyAssignmentRead]:
        q = (
            db.query(FacultyAssignment)
            .join(FacultyAssignment.faculty)
            .join(FacultyProfile.user)
            .join(FacultyAssignment.subject_offering)
            .join(SubjectOffering.subject)
            .options(
                joinedload(FacultyAssignment.faculty).joinedload(FacultyProfile.user),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.subject),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.course),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.branch),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.section).joinedload(Section.batch),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.student_group),
            )
        )
        if faculty_id is not None:
            q = q.filter(FacultyAssignment.faculty_id == faculty_id)
        if subject_offering_id is not None:
            q = q.filter(FacultyAssignment.subject_offering_id == subject_offering_id)
        if is_active is not None:
            q = q.filter(FacultyAssignment.is_active == is_active)
        if query:
            term = f"%{query.strip()}%"
            q = q.filter(
                or_(
                    User.full_name.ilike(term),
                    FacultyProfile.employee_id.ilike(term),
                    Subject.name.ilike(term),
                    Subject.code.ilike(term),
                )
            )
        assignments = q.order_by(FacultyAssignment.id.desc()).all()
        return [_build_assignment_read(a) for a in assignments]

    @staticmethod
    def get_assignment(db: Session, assignment_id: int) -> FacultyAssignmentRead:
        assignment = (
            db.query(FacultyAssignment)
            .options(
                joinedload(FacultyAssignment.faculty).joinedload(FacultyProfile.user),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.subject),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.course),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.branch),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.section).joinedload(Section.batch),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.student_group),
            )
            .filter(FacultyAssignment.id == assignment_id)
            .first()
        )
        if not assignment:
            raise ValueError("Faculty assignment not found")
        return _build_assignment_read(assignment)

    @staticmethod
    def update_assignment(
        db: Session, assignment_id: int, payload: FacultyAssignmentUpdate
    ) -> FacultyAssignmentRead:
        assignment = db.query(FacultyAssignment).filter(FacultyAssignment.id == assignment_id).first()
        if not assignment:
            raise ValueError("Faculty assignment not found")

        if payload.faculty_id is not None and payload.faculty_id != assignment.faculty_id:
            faculty = db.query(FacultyProfile).filter(FacultyProfile.id == payload.faculty_id).first()
            if not faculty:
                raise ValueError("Faculty profile not found")
            # Check duplicate
            dup = (
                db.query(FacultyAssignment)
                .filter(
                    FacultyAssignment.faculty_id == payload.faculty_id,
                    FacultyAssignment.subject_offering_id == assignment.subject_offering_id,
                    FacultyAssignment.id != assignment_id,
                )
                .first()
            )
            if dup:
                raise ValueError("Faculty is already assigned to this offering")
            assignment.faculty_id = payload.faculty_id

        if payload.subject_offering_id is not None and payload.subject_offering_id != assignment.subject_offering_id:
            offering = db.query(SubjectOffering).filter(SubjectOffering.id == payload.subject_offering_id).first()
            if not offering:
                raise ValueError("Subject offering not found")
            dup = (
                db.query(FacultyAssignment)
                .filter(
                    FacultyAssignment.faculty_id == assignment.faculty_id,
                    FacultyAssignment.subject_offering_id == payload.subject_offering_id,
                    FacultyAssignment.id != assignment_id,
                )
                .first()
            )
            if dup:
                raise ValueError("Faculty is already assigned to this offering")
            assignment.subject_offering_id = payload.subject_offering_id

        if payload.is_primary is not None:
            assignment.is_primary = payload.is_primary
        if payload.is_active is not None:
            assignment.is_active = payload.is_active

        db.commit()
        return SubjectService.get_assignment(db, assignment_id)

    @staticmethod
    def delete_assignment(db: Session, assignment_id: int) -> FacultyAssignmentRead:
        assignment = db.query(FacultyAssignment).filter(FacultyAssignment.id == assignment_id).first()
        if not assignment:
            raise ValueError("Faculty assignment not found")

        # Check if sessions or timetable exist
        has_sessions = db.query(AttendanceSession).filter(AttendanceSession.faculty_assignment_id == assignment_id).count() > 0
        has_timetable = db.query(TimetableEntry).filter(TimetableEntry.faculty_assignment_id == assignment_id).count() > 0

        if has_sessions or has_timetable:
            assignment.is_active = False
            db.commit()
            return SubjectService.get_assignment(db, assignment_id)

        read_obj = SubjectService.get_assignment(db, assignment_id)
        db.delete(assignment)
        db.commit()
        read_obj.is_active = False
        return read_obj

    @staticmethod
    def get_faculty_assigned_classes(db: Session, faculty_id: int) -> list[FacultyAssignmentDetailRead]:
        assignments = (
            db.query(FacultyAssignment)
            .options(
                joinedload(FacultyAssignment.faculty).joinedload(FacultyProfile.user),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.subject),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.course),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.branch),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.section).joinedload(Section.batch),
                joinedload(FacultyAssignment.subject_offering).joinedload(SubjectOffering.student_group),
            )
            .filter(FacultyAssignment.faculty_id == faculty_id, FacultyAssignment.is_active.is_(True))
            .all()
        )

        details: list[FacultyAssignmentDetailRead] = []
        for a in assignments:
            offering = a.subject_offering
            sec = offering.section
            batch = sec.batch if (sec and sec.batch) else None
            acad_yr = f"{batch.start_year}-{batch.end_year}" if (batch and batch.start_year) else None
            details.append(
                FacultyAssignmentDetailRead(
                    id=a.id,
                    faculty_id=a.faculty_id,
                    faculty_name=a.faculty.user.full_name if (a.faculty and a.faculty.user) else f"Faculty #{a.faculty_id}",
                    employee_id=a.faculty.employee_id if a.faculty else "N/A",
                    faculty_designation=a.faculty.designation if a.faculty else None,
                    subject_offering_id=offering.id,
                    subject_id=offering.subject.id,
                    subject_name=offering.subject.name,
                    subject_code=offering.subject.code,
                    course_name=offering.course.name,
                    branch_name=offering.branch.name,
                    batch_name=batch.name if batch else None,
                    section_name=offering.section.name,
                    student_group_name=offering.student_group.name if offering.student_group else None,
                    semester=offering.semester,
                    academic_year=acad_yr,
                    class_type=offering.class_type,
                    is_primary=getattr(a, "is_primary", True),
                    is_active=a.is_active,
                    created_at=a.created_at,
                )
            )
        return details
