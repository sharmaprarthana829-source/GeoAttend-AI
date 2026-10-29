import enum
from datetime import datetime, time

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    FACULTY = "faculty"
    STUDENT = "student"


class ResponsibilityType(str, enum.Enum):
    PROFESSOR = "professor"
    HOD = "hod"
    DEAN = "dean"
    PRINCIPAL = "principal"
    COORDINATOR = "coordinator"


class ScopeType(str, enum.Enum):
    COLLEGE = "college"
    DEPARTMENT = "department"
    SECTION = "section"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    SUSPICIOUS = "suspicious"
    EXCUSED = "excused"


class SessionStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    COMPLETED = "completed"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class DayOfWeek(str, enum.Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class EnrollmentStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    DROPPED = "dropped"
    SUSPENDED = "suspended"


class DetectionMethod(str, enum.Enum):
    GPS = "gps"
    WIFI = "wifi"
    BLUETOOTH = "bluetooth"
    DEVICE = "device"
    TIMING = "timing"
    MULTI_SIGNAL = "multi_signal"


class ReviewStatus(str, enum.Enum):
    PENDING = "pending"
    REVIEWED = "reviewed"
    DISMISSED = "dismissed"
    CONFIRMED = "confirmed"


class ApplicationStatus(str, enum.Enum):
    PENDING_FACULTY = "pending_faculty"
    PENDING_COORDINATOR = "pending_coordinator"
    PENDING_HOD = "pending_hod"
    APPROVED = "approved"
    REJECTED = "rejected"
    # Legacy compatibility aliases
    FACULTY_APPROVED = "faculty_approved"
    FACULTY_REJECTED = "faculty_rejected"
    HOD_APPROVED = "hod_approved"
    HOD_REJECTED = "hod_rejected"


class ReviewDecision(str, enum.Enum):
    APPROVED = "approved"
    REJECTED = "rejected"


class AudienceType(str, enum.Enum):
    ALL = "all"
    STUDENTS = "students"
    FACULTY = "faculty"
    COORDINATORS = "coordinators"
    DEPARTMENT = "department"
    BRANCH = "branch"
    GROUP = "group"


class NotificationType(str, enum.Enum):
    NOTICE = "notice"
    ATTENDANCE = "attendance"
    APPLICATION = "application"
    SYSTEM = "system"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class College(Base, TimestampMixin):
    __tablename__ = "colleges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(100), default="India")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    campuses: Mapped[list["Campus"]] = relationship(back_populates="college")
    users: Mapped[list["User"]] = relationship(back_populates="college")
    courses: Mapped[list["Course"]] = relationship(back_populates="college")
    departments: Mapped[list["Department"]] = relationship(back_populates="college")


class Campus(Base, TimestampMixin):
    __tablename__ = "campuses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    college_id: Mapped[int] = mapped_column(ForeignKey("colleges.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    geofence_radius_meters: Mapped[int] = mapped_column(Integer, default=100)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    college: Mapped["College"] = relationship(back_populates="campuses")
    departments: Mapped[list["Department"]] = relationship(back_populates="campus")

    __table_args__ = (UniqueConstraint("college_id", "code", name="uq_campus_college_code"),)


class Course(Base, TimestampMixin):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    college_id: Mapped[int | None] = mapped_column(ForeignKey("colleges.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    duration_years: Mapped[int] = mapped_column(Integer, default=4)
    total_semesters: Mapped[int] = mapped_column(Integer, default=8)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    college: Mapped["College | None"] = relationship(back_populates="courses")
    departments: Mapped[list["Department"]] = relationship(back_populates="course")
    branches: Mapped[list["Branch"]] = relationship(back_populates="course")
    enrollments: Mapped[list["AcademicEnrollment"]] = relationship(back_populates="course")

    @property
    def department_count(self) -> int:
        try:
            return len([d for d in self.departments if d.is_active]) if self.departments else 0
        except Exception:
            return 0


class Department(Base, TimestampMixin):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    campus_id: Mapped[int | None] = mapped_column(ForeignKey("campuses.id"), index=True)
    college_id: Mapped[int | None] = mapped_column(ForeignKey("colleges.id"), index=True)
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    campus: Mapped["Campus | None"] = relationship(back_populates="departments")
    college: Mapped["College | None"] = relationship(back_populates="departments")
    course: Mapped["Course | None"] = relationship(back_populates="departments")
    branches: Mapped[list["Branch"]] = relationship(back_populates="department")
    faculty_members: Mapped[list["FacultyProfile"]] = relationship(back_populates="department")
    subjects: Mapped[list["Subject"]] = relationship(back_populates="department")

    @property
    def branch_count(self) -> int:
        try:
            return len([b for b in self.branches if b.is_active]) if self.branches else 0
        except Exception:
            return 0

    @property
    def course_name(self) -> str | None:
        try:
            return self.course.name if self.course else None
        except Exception:
            return None

    __table_args__ = (UniqueConstraint("code", "campus_id", name="uq_department_code_campus"),)


class Branch(Base, TimestampMixin):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    department: Mapped["Department"] = relationship(back_populates="branches")
    course: Mapped["Course | None"] = relationship(back_populates="branches")
    batches: Mapped[list["Batch"]] = relationship(back_populates="branch")
    enrollments: Mapped[list["AcademicEnrollment"]] = relationship(back_populates="branch")

    @property
    def batch_count(self) -> int:
        try:
            return len([b for b in self.batches if b.is_active]) if self.batches else 0
        except Exception:
            return 0

    @property
    def department_name(self) -> str | None:
        try:
            return self.department.name if self.department else None
        except Exception:
            return None

    @property
    def course_name(self) -> str | None:
        try:
            return self.course.name if self.course else None
        except Exception:
            return None

    __table_args__ = (UniqueConstraint("department_id", "code", name="uq_branch_department_code"),)


class Batch(Base, TimestampMixin):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_year: Mapped[int] = mapped_column(Integer, nullable=False)
    end_year: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    branch: Mapped["Branch"] = relationship(back_populates="batches")
    sections: Mapped[list["Section"]] = relationship(back_populates="batch")
    enrollments: Mapped[list["AcademicEnrollment"]] = relationship(back_populates="batch")

    @property
    def section_count(self) -> int:
        try:
            return len([s for s in self.sections if s.is_active]) if self.sections else 0
        except Exception:
            return 0

    @property
    def branch_name(self) -> str | None:
        try:
            return self.branch.name if self.branch else None
        except Exception:
            return None

    __table_args__ = (UniqueConstraint("branch_id", "name", name="uq_batch_branch_name"),)


class Section(Base, TimestampMixin):
    __tablename__ = "sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=60)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    batch: Mapped["Batch"] = relationship(back_populates="sections")
    student_groups: Mapped[list["StudentGroup"]] = relationship(back_populates="section", cascade="all, delete-orphan")
    students: Mapped[list["StudentProfile"]] = relationship(back_populates="section")
    enrollments: Mapped[list["AcademicEnrollment"]] = relationship(back_populates="section")

    @property
    def group_count(self) -> int:
        try:
            return len([g for g in self.student_groups if g.is_active]) if self.student_groups else 0
        except Exception:
            return 0

    @property
    def student_count(self) -> int:
        try:
            return len([e for e in self.enrollments if e.is_current and e.status == EnrollmentStatus.ACTIVE]) if self.enrollments else 0
        except Exception:
            return 0

    @property
    def batch_name(self) -> str | None:
        try:
            return self.batch.name if self.batch else None
        except Exception:
            return None

    __table_args__ = (UniqueConstraint("batch_id", "name", name="uq_section_batch_name"),)


class StudentGroup(Base, TimestampMixin):
    __tablename__ = "student_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    section: Mapped["Section"] = relationship(back_populates="student_groups")
    enrollments: Mapped[list["AcademicEnrollment"]] = relationship(back_populates="student_group")

    @property
    def enrolled_count(self) -> int:
        try:
            return len([e for e in self.enrollments if e.is_current and e.status == EnrollmentStatus.ACTIVE]) if self.enrollments else 0
        except Exception:
            return 0

    @property
    def section_name(self) -> str | None:
        try:
            return self.section.name if self.section else None
        except Exception:
            return None

    __table_args__ = (UniqueConstraint("section_id", "name", name="uq_student_group_section_name"),)


class AcademicEnrollment(Base, TimestampMixin):
    __tablename__ = "academic_enrollments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False, index=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False, index=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id"), nullable=False, index=True)
    student_group_id: Mapped[int | None] = mapped_column(ForeignKey("student_groups.id"), index=True)
    semester: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    academic_year: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    status: Mapped[EnrollmentStatus] = mapped_column(
        Enum(EnrollmentStatus, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
        default=EnrollmentStatus.ACTIVE,
        index=True,
    )
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["StudentProfile"] = relationship(back_populates="enrollments")
    course: Mapped["Course"] = relationship(back_populates="enrollments")
    branch: Mapped["Branch"] = relationship(back_populates="enrollments")
    batch: Mapped["Batch"] = relationship(back_populates="enrollments")
    section: Mapped["Section"] = relationship(back_populates="enrollments")
    student_group: Mapped["StudentGroup | None"] = relationship(back_populates="enrollments")

    @property
    def student_name(self) -> str | None:
        try:
            return self.student.user.full_name if self.student and self.student.user else None
        except Exception:
            return None

    @property
    def student_roll_number(self) -> str | None:
        try:
            return self.student.roll_number if self.student else None
        except Exception:
            return None

    @property
    def student_email(self) -> str | None:
        try:
            return self.student.user.email if self.student and self.student.user else None
        except Exception:
            return None

    @property
    def section_name(self) -> str | None:
        try:
            return self.section.name if self.section else None
        except Exception:
            return None

    @property
    def student_group_name(self) -> str | None:
        try:
            return self.student_group.name if self.student_group else None
        except Exception:
            return None

    @property
    def course_name(self) -> str | None:
        try:
            return self.course.name if self.course else None
        except Exception:
            return None

    @property
    def branch_name(self) -> str | None:
        try:
            return self.branch.name if self.branch else None
        except Exception:
            return None

    @property
    def batch_name(self) -> str | None:
        try:
            return self.batch.name if self.batch else None
        except Exception:
            return None

    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "semester",
            "academic_year",
            name="uq_enrollment_student_semester_year",
        ),
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    college_id: Mapped[int | None] = mapped_column(ForeignKey("colleges.id"), index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    college: Mapped["College | None"] = relationship(back_populates="users")
    student_profile: Mapped["StudentProfile | None"] = relationship(back_populates="user", uselist=False)
    faculty_profile: Mapped["FacultyProfile | None"] = relationship(back_populates="user", uselist=False)


class StudentProfile(Base, TimestampMixin):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    section_id: Mapped[int | None] = mapped_column(ForeignKey("sections.id"), index=True)
    current_group_id: Mapped[int | None] = mapped_column(ForeignKey("student_groups.id"), index=True)
    roll_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    enrollment_number: Mapped[str | None] = mapped_column(String(50))
    device_id: Mapped[str | None] = mapped_column(String(255), index=True)
    device_registered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="student_profile")
    section: Mapped["Section | None"] = relationship(back_populates="students")
    current_group: Mapped["StudentGroup | None"] = relationship()
    enrollments: Mapped[list["AcademicEnrollment"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(back_populates="student")

    __table_args__ = (UniqueConstraint("roll_number", name="uq_student_roll_number"),)


class ClassType(str, enum.Enum):
    THEORY = "theory"
    LAB = "lab"


class FacultyProfile(Base, TimestampMixin):
    __tablename__ = "faculty"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    employee_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    designation: Mapped[str | None] = mapped_column(String(100))

    user: Mapped["User"] = relationship(back_populates="faculty_profile")
    department: Mapped["Department"] = relationship(back_populates="faculty_members")
    sessions: Mapped[list["AttendanceSession"]] = relationship(back_populates="faculty")
    responsibilities: Mapped[list["FacultyResponsibility"]] = relationship(
        back_populates="faculty", cascade="all, delete-orphan"
    )
    assignments: Mapped[list["FacultyAssignment"]] = relationship(
        back_populates="faculty", cascade="all, delete-orphan"
    )

    @property
    def department_name(self) -> str | None:
        return self.department.name if self.department else None


class FacultyResponsibility(Base, TimestampMixin):
    __tablename__ = "faculty_responsibilities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    faculty_id: Mapped[int] = mapped_column(ForeignKey("faculty.id"), nullable=False, index=True)
    responsibility_type: Mapped[ResponsibilityType] = mapped_column(
        Enum(ResponsibilityType, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
        index=True,
    )
    scope_type: Mapped[ScopeType] = mapped_column(
        Enum(ScopeType, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
        default=ScopeType.DEPARTMENT,
    )
    college_id: Mapped[int | None] = mapped_column(ForeignKey("colleges.id"), index=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), index=True)
    section_id: Mapped[int | None] = mapped_column(ForeignKey("sections.id"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    faculty: Mapped["FacultyProfile"] = relationship(back_populates="responsibilities")
    college: Mapped["College | None"] = relationship()
    department: Mapped["Department | None"] = relationship()
    section: Mapped["Section | None"] = relationship()

    @property
    def section_name(self) -> str | None:
        return self.section.name if self.section else None


class Subject(Base, TimestampMixin):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    credits: Mapped[int] = mapped_column(Integer, default=3)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    department: Mapped["Department | None"] = relationship(back_populates="subjects")
    offerings: Mapped[list["SubjectOffering"]] = relationship(back_populates="subject", cascade="all, delete-orphan")


class SubjectOffering(Base, TimestampMixin):
    __tablename__ = "subject_offerings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False, index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    semester: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False, index=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id"), nullable=False, index=True)
    student_group_id: Mapped[int | None] = mapped_column(ForeignKey("student_groups.id"), index=True)
    class_type: Mapped[ClassType] = mapped_column(
        Enum(ClassType, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
        default=ClassType.THEORY,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    subject: Mapped["Subject"] = relationship(back_populates="offerings")
    course: Mapped["Course"] = relationship()
    branch: Mapped["Branch"] = relationship()
    section: Mapped["Section"] = relationship()
    student_group: Mapped["StudentGroup | None"] = relationship()
    faculty_assignments: Mapped[list["FacultyAssignment"]] = relationship(
        back_populates="subject_offering", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint(
            "subject_id",
            "section_id",
            "student_group_id",
            "class_type",
            "semester",
            name="uq_subject_offering_unique",
        ),
    )


class FacultyAssignment(Base, TimestampMixin):
    __tablename__ = "faculty_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    faculty_id: Mapped[int] = mapped_column(ForeignKey("faculty.id"), nullable=False, index=True)
    subject_offering_id: Mapped[int] = mapped_column(
        ForeignKey("subject_offerings.id"), nullable=False, index=True
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    faculty: Mapped["FacultyProfile"] = relationship(back_populates="assignments")
    subject_offering: Mapped["SubjectOffering"] = relationship(back_populates="faculty_assignments")

    __table_args__ = (
        UniqueConstraint("faculty_id", "subject_offering_id", name="uq_faculty_assignment_unique"),
    )


class TimetableEntry(Base, TimestampMixin):
    __tablename__ = "timetable_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject_offering_id: Mapped[int] = mapped_column(
        ForeignKey("subject_offerings.id"), nullable=False, index=True
    )
    faculty_assignment_id: Mapped[int] = mapped_column(
        ForeignKey("faculty_assignments.id"), nullable=False, index=True
    )
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id"), nullable=False, index=True)
    student_group_id: Mapped[int | None] = mapped_column(ForeignKey("student_groups.id"), index=True)
    class_type: Mapped[ClassType] = mapped_column(
        Enum(ClassType, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
        default=ClassType.THEORY,
        index=True,
    )
    day_of_week: Mapped[DayOfWeek] = mapped_column(
        Enum(DayOfWeek, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
        index=True,
    )
    start_time: Mapped[time] = mapped_column(Time, nullable=False, index=True)
    end_time: Mapped[time] = mapped_column(Time, nullable=False, index=True)
    room_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    subject_offering: Mapped["SubjectOffering"] = relationship()
    faculty_assignment: Mapped["FacultyAssignment"] = relationship()
    section: Mapped["Section"] = relationship()
    student_group: Mapped["StudentGroup | None"] = relationship()


class Room(Base, TimestampMixin):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    campus_id: Mapped[int] = mapped_column(ForeignKey("campuses.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    building: Mapped[str | None] = mapped_column(String(100))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    geofence_radius_meters: Mapped[int] = mapped_column(Integer, default=100)
    gps_accuracy_threshold: Mapped[float] = mapped_column(Float, default=50.0)
    capacity: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    campus: Mapped["Campus"] = relationship()

    __table_args__ = (UniqueConstraint("campus_id", "name", name="uq_room_campus_name"),)


class AttendanceSession(Base, TimestampMixin):
    __tablename__ = "attendance_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    timetable_entry_id: Mapped[int | None] = mapped_column(
        ForeignKey("timetable_entries.id"), index=True
    )
    subject_offering_id: Mapped[int | None] = mapped_column(
        ForeignKey("subject_offerings.id"), index=True
    )
    faculty_assignment_id: Mapped[int | None] = mapped_column(
        ForeignKey("faculty_assignments.id"), index=True
    )
    faculty_id: Mapped[int] = mapped_column(ForeignKey("faculty.id"), nullable=False, index=True)
    subject_id: Mapped[int | None] = mapped_column(ForeignKey("subjects.id"), index=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id"), nullable=False, index=True)
    student_group_id: Mapped[int | None] = mapped_column(ForeignKey("student_groups.id"), index=True)
    class_type: Mapped[ClassType | None] = mapped_column(
        Enum(ClassType, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        index=True,
    )
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id"))
    room_number: Mapped[str | None] = mapped_column(String(50))
    campus_id: Mapped[int | None] = mapped_column(ForeignKey("campuses.id"), index=True)
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        default=SessionStatus.ACTIVE,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    geofence_latitude: Mapped[float | None] = mapped_column(Float)
    geofence_longitude: Mapped[float | None] = mapped_column(Float)
    geofence_radius_meters: Mapped[int | None] = mapped_column(Integer)

    timetable_entry: Mapped["TimetableEntry | None"] = relationship()
    subject_offering: Mapped["SubjectOffering | None"] = relationship()
    faculty_assignment: Mapped["FacultyAssignment | None"] = relationship()
    faculty: Mapped["FacultyProfile"] = relationship(back_populates="sessions")
    section: Mapped["Section"] = relationship()
    student_group: Mapped["StudentGroup | None"] = relationship()
    subject: Mapped["Subject | None"] = relationship(foreign_keys=[subject_id])
    qr_sessions: Mapped[list["QRSession"]] = relationship(back_populates="attendance_session")
    records: Mapped[list["AttendanceRecord"]] = relationship(back_populates="session")


class QRSession(Base, TimestampMixin):
    __tablename__ = "qr_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    attendance_session_id: Mapped[int] = mapped_column(
        ForeignKey("attendance_sessions.id"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    attendance_session: Mapped["AttendanceSession"] = relationship(back_populates="qr_sessions")


class AttendanceRecord(Base, TimestampMixin):
    __tablename__ = "attendance_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("attendance_sessions.id"), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    status: Mapped[AttendanceStatus] = mapped_column(
        Enum(AttendanceStatus, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        default=AttendanceStatus.PRESENT,
    )
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    distance_meters: Mapped[float | None] = mapped_column(Float)
    device_id: Mapped[str | None] = mapped_column(String(255))
    is_suspicious: Mapped[bool] = mapped_column(Boolean, default=False)
    suspicion_reason: Mapped[str | None] = mapped_column(Text)
    verification_json: Mapped[str | None] = mapped_column(Text)
    is_manually_adjusted: Mapped[bool] = mapped_column(Boolean, default=False)
    adjusted_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    adjustment_reason: Mapped[str | None] = mapped_column(Text)
    original_status: Mapped[str | None] = mapped_column(String(50))

    session: Mapped["AttendanceSession"] = relationship(back_populates="records")
    student: Mapped["StudentProfile"] = relationship(back_populates="attendance_records")
    adjusted_by: Mapped["User | None"] = relationship(foreign_keys=[adjusted_by_user_id])

    __table_args__ = (UniqueConstraint("session_id", "student_id", name="uq_attendance_session_student"),)


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_id: Mapped[int | None] = mapped_column(Integer, index=True)
    reason: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[str | None] = mapped_column(Text)

    user: Mapped["User | None"] = relationship()


class SystemSetting(Base, TimestampMixin):
    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # attendance, gps, qr, ml, device, wifi
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    value_type: Mapped[str] = mapped_column(String(20), default="string")  # string, int, float, bool, json
    description: Mapped[str | None] = mapped_column(String(255))
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    updated_by: Mapped["User | None"] = relationship(foreign_keys=[updated_by_id])


class SuspiciousActivity(Base, TimestampMixin):
    __tablename__ = "suspicious_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    attendance_record_id: Mapped[int] = mapped_column(
        ForeignKey("attendance_records.id"), nullable=False, index=True
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"), nullable=False, index=True
    )
    session_id: Mapped[int] = mapped_column(
        ForeignKey("attendance_sessions.id"), nullable=False, index=True
    )
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    detection_method: Mapped[DetectionMethod] = mapped_column(
        Enum(
            DetectionMethod,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        index=True,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    raw_signals: Mapped[str | None] = mapped_column(Text)
    review_status: Mapped[ReviewStatus] = mapped_column(
        Enum(
            ReviewStatus,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=ReviewStatus.PENDING,
        index=True,
    )
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewer_notes: Mapped[str | None] = mapped_column(Text)

    attendance_record: Mapped["AttendanceRecord"] = relationship()
    student: Mapped["StudentProfile"] = relationship()
    session: Mapped["AttendanceSession"] = relationship()
    reviewer: Mapped["User | None"] = relationship()


class AttendanceApplication(Base, TimestampMixin):
    __tablename__ = "attendance_applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    subject_offering_id: Mapped[int] = mapped_column(
        ForeignKey("subject_offerings.id"), nullable=False, index=True
    )
    enrollment_id: Mapped[int | None] = mapped_column(ForeignKey("academic_enrollments.id"), index=True)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    supporting_document_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(
            ApplicationStatus,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=ApplicationStatus.PENDING_FACULTY,
        nullable=False,
        index=True,
    )
    faculty_reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("faculty.id"), index=True)
    faculty_decision: Mapped[ReviewDecision | None] = mapped_column(
        Enum(
            ReviewDecision,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
    )
    faculty_remarks: Mapped[str | None] = mapped_column(Text)
    faculty_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    coordinator_reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("faculty.id"), index=True)
    coordinator_decision: Mapped[ReviewDecision | None] = mapped_column(
        Enum(
            ReviewDecision,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
    )
    coordinator_remarks: Mapped[str | None] = mapped_column(Text)
    coordinator_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    hod_reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("faculty.id"), index=True)
    hod_decision: Mapped[ReviewDecision | None] = mapped_column(
        Enum(
            ReviewDecision,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
    )
    hod_remarks: Mapped[str | None] = mapped_column(Text)
    hod_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    student: Mapped["StudentProfile"] = relationship()
    subject_offering: Mapped["SubjectOffering"] = relationship()
    enrollment: Mapped["AcademicEnrollment | None"] = relationship()
    faculty_reviewer: Mapped["FacultyProfile | None"] = relationship(foreign_keys=[faculty_reviewer_id])
    coordinator_reviewer: Mapped["FacultyProfile | None"] = relationship(foreign_keys=[coordinator_reviewer_id])
    hod_reviewer: Mapped["FacultyProfile | None"] = relationship(foreign_keys=[hod_reviewer_id])


class Notice(Base, TimestampMixin):
    __tablename__ = "notices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    audience_type: Mapped[AudienceType] = mapped_column(
        Enum(
            AudienceType,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        index=True,
    )
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), index=True)
    branch_id: Mapped[int | None] = mapped_column(ForeignKey("branches.id"), index=True)
    student_group_id: Mapped[int | None] = mapped_column(ForeignKey("student_groups.id"), index=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True, default="General", server_default="General", index=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    creator: Mapped["User"] = relationship()
    department: Mapped["Department | None"] = relationship()
    branch: Mapped["Branch | None"] = relationship()
    student_group: Mapped["StudentGroup | None"] = relationship()


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(
            NotificationType,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=NotificationType.NOTICE,
        nullable=False,
        index=True,
    )
    related_entity_id: Mapped[int | None] = mapped_column(Integer, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship()


class DevicePushToken(Base, TimestampMixin):
    __tablename__ = "device_push_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id: Mapped[str | None] = mapped_column(String(255), index=True)
    fcm_token: Mapped[str] = mapped_column(String(512), nullable=False, unique=True, index=True)
    platform: Mapped[str] = mapped_column(String(50), nullable=False, default="android")  # android, ios, web
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship()




