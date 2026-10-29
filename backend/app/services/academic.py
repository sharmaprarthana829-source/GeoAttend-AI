from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    AcademicEnrollment,
    AttendanceRecord,
    Batch,
    Branch,
    Course,
    Department,
    EnrollmentStatus,
    FacultyProfile,
    Section,
    StudentGroup,
    StudentProfile,
    Subject,
    TimetableEntry,
)
from app.schemas import (
    AcademicEnrollmentBulkCreate,
    AcademicEnrollmentCreate,
    AcademicEnrollmentUpdate,
    BatchCreate,
    BatchUpdate,
    BranchCreate,
    BranchUpdate,
    CourseCreate,
    CourseUpdate,
    DepartmentCreate,
    DepartmentUpdate,
    SectionCreate,
    SectionUpdate,
    StudentGroupCreate,
    StudentGroupUpdate,
)


class AcademicService:
    # -------------------------------------------------------------
    # Courses
    # -------------------------------------------------------------
    @staticmethod
    def create_course(db: Session, payload: CourseCreate) -> Course:
        existing = db.query(Course).filter(Course.code == payload.code).first()
        if existing:
            raise ValueError(f"Course with code '{payload.code}' already exists")
        course = Course(
            college_id=payload.college_id,
            name=payload.name,
            code=payload.code,
            duration_years=payload.duration_years,
            total_semesters=payload.total_semesters,
            is_active=True,
        )
        db.add(course)
        db.commit()
        db.refresh(course)
        return course

    @staticmethod
    def list_courses(db: Session, college_id: int | None = None, is_active: bool | None = None) -> list[Course]:
        query = db.query(Course)
        if college_id is not None:
            query = query.filter(Course.college_id == college_id)
        if is_active is not None:
            query = query.filter(Course.is_active == is_active)
        return query.order_by(Course.code).all()

    @staticmethod
    def get_course(db: Session, course_id: int) -> Course:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise ValueError("Course not found")
        return course

    @staticmethod
    def update_course(db: Session, course_id: int, payload: CourseUpdate) -> Course:
        course = AcademicService.get_course(db, course_id)
        if payload.code is not None and payload.code != course.code:
            existing = db.query(Course).filter(Course.code == payload.code, Course.id != course_id).first()
            if existing:
                raise ValueError(f"Course with code '{payload.code}' already exists")
            course.code = payload.code

        if payload.name is not None:
            course.name = payload.name
        if payload.duration_years is not None:
            course.duration_years = payload.duration_years
        if payload.total_semesters is not None:
            course.total_semesters = payload.total_semesters
        if payload.is_active is not None:
            course.is_active = payload.is_active

        db.commit()
        db.refresh(course)
        return course

    @staticmethod
    def delete_course(db: Session, course_id: int) -> Course:
        course = AcademicService.get_course(db, course_id)
        active_depts = db.query(Department).filter(Department.course_id == course_id, Department.is_active.is_(True)).count()
        active_enr = db.query(AcademicEnrollment).filter(AcademicEnrollment.course_id == course_id, AcademicEnrollment.is_current.is_(True)).count()
        if active_depts > 0 or active_enr > 0:
            raise ValueError(f"Cannot delete course '{course.name}': {active_depts} active department(s) and {active_enr} active enrollment(s) depend on it. Deactivate or reassign them first.")
        db.query(AcademicEnrollment).filter(AcademicEnrollment.course_id == course_id).delete(synchronize_session=False)
        db.query(Branch).filter(Branch.course_id == course_id).delete(synchronize_session=False)
        db.query(Department).filter(Department.course_id == course_id).delete(synchronize_session=False)
        db.delete(course)
        db.commit()
        return course

    # -------------------------------------------------------------
    # Departments
    # -------------------------------------------------------------
    @staticmethod
    def create_department(db: Session, payload: DepartmentCreate) -> Department:
        existing = (
            db.query(Department)
            .filter(Department.code == payload.code, Department.campus_id == payload.campus_id)
            .first()
        )
        if existing:
            raise ValueError(f"Department with code '{payload.code}' already exists in this campus")

        if payload.course_id:
            AcademicService.get_course(db, payload.course_id)

        dept = Department(
            campus_id=payload.campus_id,
            college_id=payload.college_id,
            course_id=payload.course_id,
            name=payload.name,
            code=payload.code,
            is_active=True,
        )
        db.add(dept)
        db.commit()
        db.refresh(dept)
        return dept

    @staticmethod
    def list_departments(
        db: Session, campus_id: int | None = None, course_id: int | None = None, is_active: bool | None = None
    ) -> list[Department]:
        query = db.query(Department)
        if campus_id is not None:
            query = query.filter(Department.campus_id == campus_id)
        if course_id is not None:
            query = query.filter(Department.course_id == course_id)
        if is_active is not None:
            query = query.filter(Department.is_active == is_active)
        return query.order_by(Department.name).all()

    @staticmethod
    def get_department(db: Session, department_id: int) -> Department:
        dept = db.query(Department).filter(Department.id == department_id).first()
        if not dept:
            raise ValueError("Department not found")
        return dept

    @staticmethod
    def update_department(db: Session, department_id: int, payload: DepartmentUpdate) -> Department:
        dept = AcademicService.get_department(db, department_id)
        if payload.name is not None:
            dept.name = payload.name
        if payload.code is not None:
            dept.code = payload.code
        if payload.campus_id is not None:
            dept.campus_id = payload.campus_id
        if payload.course_id is not None:
            dept.course_id = payload.course_id
        if payload.is_active is not None:
            dept.is_active = payload.is_active

        db.commit()
        db.refresh(dept)
        return dept

    @staticmethod
    def delete_department(db: Session, department_id: int) -> Department:
        dept = AcademicService.get_department(db, department_id)
        active_branches = db.query(Branch).filter(Branch.department_id == department_id, Branch.is_active.is_(True)).count()
        active_faculty = db.query(FacultyProfile).filter(FacultyProfile.department_id == department_id).count()
        active_subjects = db.query(Subject).filter(Subject.department_id == department_id, Subject.is_active.is_(True)).count()
        if active_branches > 0 or active_faculty > 0 or active_subjects > 0:
            raise ValueError(f"Cannot delete department '{dept.name}': {active_branches} active branch(es), {active_faculty} faculty profile(s), and {active_subjects} subject(s) depend on it.")
        db.query(Branch).filter(Branch.department_id == department_id).delete(synchronize_session=False)
        db.delete(dept)
        db.commit()
        return dept

    # -------------------------------------------------------------
    # Branches
    # -------------------------------------------------------------
    @staticmethod
    def create_branch(db: Session, payload: BranchCreate) -> Branch:
        AcademicService.get_department(db, payload.department_id)
        if payload.course_id:
            AcademicService.get_course(db, payload.course_id)

        existing = (
            db.query(Branch)
            .filter(Branch.department_id == payload.department_id, Branch.code == payload.code)
            .first()
        )
        if existing:
            raise ValueError(f"Branch with code '{payload.code}' already exists in this department")

        branch = Branch(
            department_id=payload.department_id,
            course_id=payload.course_id,
            name=payload.name,
            code=payload.code,
            is_active=True,
        )
        db.add(branch)
        db.commit()
        db.refresh(branch)
        return branch

    @staticmethod
    def list_branches(
        db: Session, department_id: int | None = None, course_id: int | None = None, is_active: bool | None = None
    ) -> list[Branch]:
        query = db.query(Branch)
        if department_id is not None:
            query = query.filter(Branch.department_id == department_id)
        if course_id is not None:
            query = query.filter(Branch.course_id == course_id)
        if is_active is not None:
            query = query.filter(Branch.is_active == is_active)
        return query.order_by(Branch.code).all()

    @staticmethod
    def get_branch(db: Session, branch_id: int) -> Branch:
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            raise ValueError("Branch not found")
        return branch

    @staticmethod
    def update_branch(db: Session, branch_id: int, payload: BranchUpdate) -> Branch:
        branch = AcademicService.get_branch(db, branch_id)
        if payload.name is not None:
            branch.name = payload.name
        if payload.code is not None:
            branch.code = payload.code
        if payload.department_id is not None:
            AcademicService.get_department(db, payload.department_id)
            branch.department_id = payload.department_id
        if payload.course_id is not None:
            AcademicService.get_course(db, payload.course_id)
            branch.course_id = payload.course_id
        if payload.is_active is not None:
            branch.is_active = payload.is_active

        db.commit()
        db.refresh(branch)
        return branch

    @staticmethod
    def delete_branch(db: Session, branch_id: int) -> Branch:
        branch = AcademicService.get_branch(db, branch_id)
        active_batches = db.query(Batch).filter(Batch.branch_id == branch_id, Batch.is_active.is_(True)).count()
        active_enr = db.query(AcademicEnrollment).filter(AcademicEnrollment.branch_id == branch_id, AcademicEnrollment.is_current.is_(True)).count()
        if active_batches > 0 or active_enr > 0:
            raise ValueError(f"Cannot delete branch '{branch.name}': {active_batches} active batch(es) and {active_enr} active enrollment(s) depend on it.")
        db.query(AcademicEnrollment).filter(AcademicEnrollment.branch_id == branch_id).delete(synchronize_session=False)
        db.query(Batch).filter(Batch.branch_id == branch_id).delete(synchronize_session=False)
        db.delete(branch)
        db.commit()
        return branch

    # -------------------------------------------------------------
    # Batches
    # -------------------------------------------------------------
    @staticmethod
    def create_batch(db: Session, payload: BatchCreate) -> Batch:
        AcademicService.get_branch(db, payload.branch_id)
        if payload.start_year >= payload.end_year:
            raise ValueError("start_year must be earlier than end_year")

        existing = (
            db.query(Batch)
            .filter(Batch.branch_id == payload.branch_id, Batch.name == payload.name)
            .first()
        )
        if existing:
            raise ValueError(f"Batch '{payload.name}' already exists in this branch")

        batch = Batch(
            branch_id=payload.branch_id,
            name=payload.name,
            start_year=payload.start_year,
            end_year=payload.end_year,
            is_active=True,
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)
        return batch

    @staticmethod
    def list_batches(db: Session, branch_id: int | None = None, is_active: bool | None = None) -> list[Batch]:
        query = db.query(Batch)
        if branch_id is not None:
            query = query.filter(Batch.branch_id == branch_id)
        if is_active is not None:
            query = query.filter(Batch.is_active == is_active)
        return query.order_by(Batch.start_year.desc()).all()

    @staticmethod
    def get_batch(db: Session, batch_id: int) -> Batch:
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            raise ValueError("Batch not found")
        return batch

    @staticmethod
    def update_batch(db: Session, batch_id: int, payload: BatchUpdate) -> Batch:
        batch = AcademicService.get_batch(db, batch_id)
        start = payload.start_year if payload.start_year is not None else batch.start_year
        end = payload.end_year if payload.end_year is not None else batch.end_year
        if start >= end:
            raise ValueError("start_year must be earlier than end_year")

        if payload.name is not None:
            batch.name = payload.name
        if payload.start_year is not None:
            batch.start_year = payload.start_year
        if payload.end_year is not None:
            batch.end_year = payload.end_year
        if payload.branch_id is not None:
            AcademicService.get_branch(db, payload.branch_id)
            batch.branch_id = payload.branch_id
        if payload.is_active is not None:
            batch.is_active = payload.is_active

        db.commit()
        db.refresh(batch)
        return batch

    @staticmethod
    def delete_batch(db: Session, batch_id: int) -> Batch:
        batch = AcademicService.get_batch(db, batch_id)
        active_sections = db.query(Section).filter(Section.batch_id == batch_id, Section.is_active.is_(True)).count()
        active_enr = db.query(AcademicEnrollment).filter(AcademicEnrollment.batch_id == batch_id, AcademicEnrollment.is_current.is_(True)).count()
        if active_sections > 0 or active_enr > 0:
            raise ValueError(f"Cannot delete batch '{batch.name}': {active_sections} active section(s) and {active_enr} active enrollment(s) depend on it.")
        db.query(AcademicEnrollment).filter(AcademicEnrollment.batch_id == batch_id).delete(synchronize_session=False)
        db.query(Section).filter(Section.batch_id == batch_id).delete(synchronize_session=False)
        db.delete(batch)
        db.commit()
        return batch

    # -------------------------------------------------------------
    # Sections
    # -------------------------------------------------------------
    @staticmethod
    def create_section(db: Session, payload: SectionCreate) -> Section:
        AcademicService.get_batch(db, payload.batch_id)
        existing = (
            db.query(Section)
            .filter(Section.batch_id == payload.batch_id, Section.name == payload.name)
            .first()
        )
        if existing:
            raise ValueError(f"Section '{payload.name}' already exists in this batch")

        section = Section(
            batch_id=payload.batch_id,
            name=payload.name,
            capacity=payload.capacity,
            is_active=True,
        )
        db.add(section)
        db.commit()
        db.refresh(section)
        return section

    @staticmethod
    def list_sections(db: Session, batch_id: int | None = None, is_active: bool | None = None) -> list[Section]:
        query = db.query(Section)
        if batch_id is not None:
            query = query.filter(Section.batch_id == batch_id)
        if is_active is not None:
            query = query.filter(Section.is_active == is_active)
        return query.order_by(Section.name).all()

    @staticmethod
    def get_section(db: Session, section_id: int) -> Section:
        section = db.query(Section).filter(Section.id == section_id).first()
        if not section:
            raise ValueError("Section not found")
        return section

    @staticmethod
    def update_section(db: Session, section_id: int, payload: SectionUpdate) -> Section:
        section = AcademicService.get_section(db, section_id)
        if payload.name is not None:
            section.name = payload.name
        if payload.capacity is not None:
            section.capacity = payload.capacity
        if payload.batch_id is not None:
            AcademicService.get_batch(db, payload.batch_id)
            section.batch_id = payload.batch_id
        if payload.is_active is not None:
            section.is_active = payload.is_active

        db.commit()
        db.refresh(section)
        return section

    @staticmethod
    def delete_section(db: Session, section_id: int) -> Section:
        section = AcademicService.get_section(db, section_id)
        active_groups = db.query(StudentGroup).filter(StudentGroup.section_id == section_id, StudentGroup.is_active.is_(True)).count()
        active_enr = db.query(AcademicEnrollment).filter(AcademicEnrollment.section_id == section_id, AcademicEnrollment.is_current.is_(True)).count()
        active_slots = db.query(TimetableEntry).filter(TimetableEntry.section_id == section_id).count()
        if active_groups > 0 or active_enr > 0 or active_slots > 0:
            raise ValueError(f"Cannot delete section '{section.name}': {active_groups} active group(s), {active_enr} active enrollment(s), and {active_slots} timetable slot(s) depend on it.")
        students = db.query(StudentProfile).filter(StudentProfile.section_id == section_id).count()
        if students > 0:
            raise ValueError(f"Cannot delete section '{section.name}': {students} student profile(s) reference it.")
        db.query(AcademicEnrollment).filter(AcademicEnrollment.section_id == section_id).delete(synchronize_session=False)
        db.query(StudentGroup).filter(StudentGroup.section_id == section_id).delete(synchronize_session=False)
        db.delete(section)
        db.commit()
        return section

    # -------------------------------------------------------------
    # Student Groups (B1, B2)
    # -------------------------------------------------------------
    @staticmethod
    def create_group(db: Session, payload: StudentGroupCreate) -> StudentGroup:
        AcademicService.get_section(db, payload.section_id)
        existing = (
            db.query(StudentGroup)
            .filter(StudentGroup.section_id == payload.section_id, StudentGroup.name == payload.name)
            .first()
        )
        if existing:
            raise ValueError(f"Student Group '{payload.name}' already exists in this section")

        group = StudentGroup(
            section_id=payload.section_id,
            name=payload.name,
            description=payload.description,
            is_active=True,
        )
        db.add(group)
        db.commit()
        db.refresh(group)
        return group

    @staticmethod
    def list_groups(db: Session, section_id: int | None = None, is_active: bool | None = None) -> list[StudentGroup]:
        query = db.query(StudentGroup)
        if section_id is not None:
            query = query.filter(StudentGroup.section_id == section_id)
        if is_active is not None:
            query = query.filter(StudentGroup.is_active == is_active)
        return query.order_by(StudentGroup.name).all()

    @staticmethod
    def get_group(db: Session, group_id: int) -> StudentGroup:
        group = db.query(StudentGroup).filter(StudentGroup.id == group_id).first()
        if not group:
            raise ValueError("Student Group not found")
        return group

    @staticmethod
    def update_group(db: Session, group_id: int, payload: StudentGroupUpdate) -> StudentGroup:
        group = AcademicService.get_group(db, group_id)
        if payload.name is not None and payload.name != group.name:
            existing = (
                db.query(StudentGroup)
                .filter(
                    StudentGroup.section_id == group.section_id,
                    StudentGroup.name == payload.name,
                    StudentGroup.id != group_id,
                )
                .first()
            )
            if existing:
                raise ValueError(f"Student Group '{payload.name}' already exists in this section")
            group.name = payload.name

        if payload.description is not None:
            group.description = payload.description
        if payload.is_active is not None:
            group.is_active = payload.is_active

        db.commit()
        db.refresh(group)
        return group

    @staticmethod
    def delete_group(db: Session, group_id: int) -> StudentGroup:
        group = AcademicService.get_group(db, group_id)
        active_enr = db.query(AcademicEnrollment).filter(AcademicEnrollment.student_group_id == group_id, AcademicEnrollment.is_current.is_(True)).count()
        if active_enr > 0:
            raise ValueError(f"Cannot delete student group '{group.name}': {active_enr} active student enrollment(s) are assigned to it.")
        db.query(StudentProfile).filter(StudentProfile.current_group_id == group_id).update({"current_group_id": None})
        db.query(AcademicEnrollment).filter(AcademicEnrollment.student_group_id == group_id).delete(synchronize_session=False)
        db.delete(group)
        db.commit()
        return group

    # -------------------------------------------------------------
    # Academic Enrollments
    # -------------------------------------------------------------
    @staticmethod
    def enroll_student(db: Session, payload: AcademicEnrollmentCreate) -> AcademicEnrollment:
        # 1. Validate student exists
        student = db.query(StudentProfile).filter(StudentProfile.id == payload.student_id).first()
        if not student:
            raise ValueError("Student profile not found")

        # 2. Validate hierarchy consistency
        course = AcademicService.get_course(db, payload.course_id)
        branch = AcademicService.get_branch(db, payload.branch_id)
        batch = AcademicService.get_batch(db, payload.batch_id)
        section = AcademicService.get_section(db, payload.section_id)

        if batch.branch_id != branch.id:
            raise ValueError(f"Batch '{batch.name}' does not belong to Branch '{branch.name}'")

        if section.batch_id != batch.id:
            raise ValueError(f"Section '{section.name}' does not belong to Batch '{batch.name}'")

        if payload.student_group_id:
            group = AcademicService.get_group(db, payload.student_group_id)
            if group.section_id != section.id:
                raise ValueError(f"Group '{group.name}' does not belong to Section '{section.name}'")

        if payload.semester > course.total_semesters:
            raise ValueError(f"Semester {payload.semester} exceeds total semesters ({course.total_semesters}) for course '{course.name}'")

        # 3. Prevent duplicate active enrollment for same semester + academic_year
        duplicate = (
            db.query(AcademicEnrollment)
            .filter(
                AcademicEnrollment.student_id == payload.student_id,
                AcademicEnrollment.semester == payload.semester,
                AcademicEnrollment.academic_year == payload.academic_year,
            )
            .first()
        )
        if duplicate:
            raise ValueError(f"Student is already enrolled in semester {payload.semester} for academic year {payload.academic_year}")

        # 4. If this is marked current, set previous current enrollments for student to is_current=False
        if payload.is_current:
            db.query(AcademicEnrollment).filter(
                AcademicEnrollment.student_id == payload.student_id,
                AcademicEnrollment.is_current.is_(True),
            ).update({"is_current": False})

        # 5. Create enrollment
        enrollment = AcademicEnrollment(
            student_id=payload.student_id,
            course_id=payload.course_id,
            branch_id=payload.branch_id,
            batch_id=payload.batch_id,
            section_id=payload.section_id,
            student_group_id=payload.student_group_id,
            semester=payload.semester,
            academic_year=payload.academic_year,
            status=payload.status,
            is_current=payload.is_current,
        )
        db.add(enrollment)

        # Update current section and group pointers on StudentProfile
        student.section_id = payload.section_id
        student.current_group_id = payload.student_group_id

        db.commit()
        db.refresh(enrollment)
        return enrollment

    @staticmethod
    def bulk_enroll(db: Session, payload: AcademicEnrollmentBulkCreate) -> list[AcademicEnrollment]:
        created = []
        for sid in payload.student_ids:
            single = AcademicEnrollmentCreate(
                student_id=sid,
                course_id=payload.course_id,
                branch_id=payload.branch_id,
                batch_id=payload.batch_id,
                section_id=payload.section_id,
                student_group_id=payload.student_group_id,
                semester=payload.semester,
                academic_year=payload.academic_year,
                status=payload.status,
                is_current=True,
            )
            created.append(AcademicService.enroll_student(db, single))
        return created

    @staticmethod
    def list_enrollments(
        db: Session,
        student_id: int | None = None,
        section_id: int | None = None,
        student_group_id: int | None = None,
        branch_id: int | None = None,
        batch_id: int | None = None,
        course_id: int | None = None,
        semester: int | None = None,
        academic_year: str | None = None,
        is_current: bool | None = None,
    ) -> list[AcademicEnrollment]:
        query = db.query(AcademicEnrollment)
        if student_id is not None:
            query = query.filter(AcademicEnrollment.student_id == student_id)
        if section_id is not None:
            query = query.filter(AcademicEnrollment.section_id == section_id)
        if student_group_id is not None:
            query = query.filter(AcademicEnrollment.student_group_id == student_group_id)
        if branch_id is not None:
            query = query.filter(AcademicEnrollment.branch_id == branch_id)
        if batch_id is not None:
            query = query.filter(AcademicEnrollment.batch_id == batch_id)
        if course_id is not None:
            query = query.filter(AcademicEnrollment.course_id == course_id)
        if semester is not None:
            query = query.filter(AcademicEnrollment.semester == semester)
        if academic_year is not None:
            query = query.filter(AcademicEnrollment.academic_year == academic_year)
        if is_current is not None:
            query = query.filter(AcademicEnrollment.is_current == is_current)
        return query.order_by(AcademicEnrollment.enrolled_at.desc()).all()

    @staticmethod
    def get_enrollment(db: Session, enrollment_id: int) -> AcademicEnrollment:
        enrollment = db.query(AcademicEnrollment).filter(AcademicEnrollment.id == enrollment_id).first()
        if not enrollment:
            raise ValueError("Academic Enrollment not found")
        return enrollment

    @staticmethod
    def get_student_current_enrollment(db: Session, student_id: int) -> AcademicEnrollment | None:
        return (
            db.query(AcademicEnrollment)
            .filter(
                AcademicEnrollment.student_id == student_id,
                AcademicEnrollment.status == EnrollmentStatus.ACTIVE,
            )
            .order_by(AcademicEnrollment.is_current.desc(), AcademicEnrollment.id.desc())
            .first()
        )

    @staticmethod
    def update_enrollment(db: Session, enrollment_id: int, payload: AcademicEnrollmentUpdate) -> AcademicEnrollment:
        enrollment = AcademicService.get_enrollment(db, enrollment_id)
        if payload.student_group_id is not None:
            group = AcademicService.get_group(db, payload.student_group_id)
            if group.section_id != enrollment.section_id:
                raise ValueError(f"Group '{group.name}' does not belong to Section ID {enrollment.section_id}")
            enrollment.student_group_id = payload.student_group_id
            if enrollment.is_current:
                student = db.query(StudentProfile).filter(StudentProfile.id == enrollment.student_id).first()
                if student:
                    student.current_group_id = payload.student_group_id

        if payload.semester is not None:
            enrollment.semester = payload.semester
        if payload.academic_year is not None:
            enrollment.academic_year = payload.academic_year
        if payload.status is not None:
            enrollment.status = payload.status
        if payload.is_current is not None:
            if payload.is_current:
                db.query(AcademicEnrollment).filter(
                    AcademicEnrollment.student_id == enrollment.student_id,
                    AcademicEnrollment.id != enrollment.id,
                ).update({"is_current": False})
            enrollment.is_current = payload.is_current

        db.commit()
        db.refresh(enrollment)
        return enrollment

    @staticmethod
    def delete_enrollment(db: Session, enrollment_id: int) -> AcademicEnrollment:
        enrollment = AcademicService.get_enrollment(db, enrollment_id)
        student = db.query(StudentProfile).filter(StudentProfile.id == enrollment.student_id).first()
        if student:
            other_enr = (
                db.query(AcademicEnrollment)
                .filter(
                    AcademicEnrollment.student_id == enrollment.student_id,
                    AcademicEnrollment.id != enrollment_id,
                )
                .order_by(AcademicEnrollment.is_current.desc(), AcademicEnrollment.id.desc())
                .first()
            )
            if other_enr:
                student.section_id = other_enr.section_id
                student.current_group_id = other_enr.student_group_id
            else:
                student.current_group_id = None

        att_count = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == enrollment.student_id).count()
        if att_count > 0:
            # Historical attendance exists: prevent hard deletion, deactivate safely
            enrollment.is_current = False
            enrollment.status = EnrollmentStatus.DROPPED
            db.commit()
            db.refresh(enrollment)
            return enrollment
        db.delete(enrollment)
        db.commit()
        return enrollment
