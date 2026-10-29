from datetime import datetime, time
from typing import Generic, TypeVar

from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field, computed_field

from app.models import (
    ApplicationStatus,
    AttendanceStatus,
    AudienceType,
    ClassType,
    DayOfWeek,
    DetectionMethod,
    EnrollmentStatus,
    NotificationType,
    ResponsibilityType,
    ReviewDecision,
    ReviewStatus,
    ScopeType,
    SessionStatus,
    UserRole,
)

T = TypeVar("T")


class MessageResponse(BaseModel):
    message: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: UserRole
    responsibilities: list[str] = Field(default_factory=list)


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class RefreshRequest(BaseModel):
    refresh_token: str


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    phone: str | None = None
    role: UserRole
    college_id: int | None = None


class UserCreate(UserBase):
    password: str = Field(min_length=8)


class FacultyResponsibilityCreate(BaseModel):
    faculty_id: int | None = None
    responsibility_type: ResponsibilityType
    scope_type: ScopeType = ScopeType.DEPARTMENT
    college_id: int | None = None
    department_id: int | None = None
    section_id: int | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class FacultyResponsibilityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    faculty_id: int
    responsibility_type: ResponsibilityType
    scope_type: ScopeType
    college_id: int | None = None
    department_id: int | None = None
    section_id: int | None = None
    section_name: str | None = None
    is_active: bool
    start_date: datetime | None = None
    end_date: datetime | None = None
    created_at: datetime


class FacultyProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    department_id: int
    department_name: str | None = None
    employee_id: str
    designation: str | None = None
    responsibilities: list[FacultyResponsibilityRead] = Field(default_factory=list)


class FacultyDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    department_id: int
    department_name: str | None = None
    employee_id: str
    designation: str | None = None
    full_name: str
    email: str
    phone: str | None = None
    is_active: bool = True
    responsibilities: list[FacultyResponsibilityRead] = Field(default_factory=list)
    subjects: list[str] = Field(default_factory=list)
    sections_assigned: list[str] = Field(default_factory=list)
    todays_sessions: int = 0
    total_sessions: int = 0
    created_at: datetime | None = None


class FacultyCreate(BaseModel):
    email: EmailStr
    password: str = Field(default="Faculty@12345", min_length=6)
    full_name: str = Field(min_length=2, max_length=255)
    employee_id: str = Field(min_length=1, max_length=50)
    phone: str | None = None
    department_id: int | None = None
    department: str | None = None
    designation: str | None = None
    subjects: list[str] = Field(default_factory=list)
    sections_assigned: list[str] = Field(default_factory=list)
    college_id: int | None = None


class FacultyUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    employee_id: str | None = None
    department_id: int | None = None
    department: str | None = None
    designation: str | None = None
    is_active: bool | None = None
    subjects: list[str] | None = None
    sections_assigned: list[str] | None = None


class FacultyClassRead(BaseModel):
    assignment_id: int
    subject_offering_id: int
    subject_id: int
    subject_name: str
    subject_code: str
    credits: int
    course_name: str
    branch_name: str
    semester: int
    section_id: int
    section_name: str
    student_group_id: int | None = None
    student_group_name: str | None = None
    class_type: ClassType
    total_enrolled: int
    total_sessions_conducted: int


class CoordinatorDeskSummary(BaseModel):
    has_coordinator_role: bool
    section_id: int | None = None
    section_name: str | None = None
    branch_name: str | None = None
    course_name: str | None = None
    semester: int | None = None
    total_students: int = 0
    average_section_attendance: float | None = 0.0
    short_attendance_count: int = 0
    attendance_threshold: float = 75.0


class CoordinatorSubjectHeader(BaseModel):
    subject_code: str
    subject_name: str
    code: str
    name: str
    class_type: str | None = None
    total_conducted: int = 0


class CoordinatorSubjectAttendance(BaseModel):
    subject_code: str
    subject_name: str
    class_type: str | None = None
    attended: int
    total: int
    percentage: float | None = None


class CoordinatorStudentRow(BaseModel):
    student_id: int
    user_id: int
    full_name: str
    roll_number: str
    email: str
    total_attended: int = 0
    total_eligible: int = 0
    overall_percentage: float | None = None
    is_short_attendance: bool
    subjects: list[CoordinatorSubjectAttendance]


class CoordinatorMatrixResponse(BaseModel):
    section_id: int
    section_name: str
    attendance_threshold: float = 75.0
    subjects_header: list[CoordinatorSubjectHeader]
    students: list[CoordinatorStudentRow]



class CourseCreate(BaseModel):
    college_id: int | None = None
    name: str = Field(min_length=2, max_length=255)
    code: str = Field(min_length=2, max_length=50)
    duration_years: int = Field(default=4, ge=1, le=10)
    total_semesters: int = Field(default=8, ge=1, le=20)


class CourseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    code: str | None = Field(default=None, min_length=2, max_length=50)
    duration_years: int | None = Field(default=None, ge=1, le=10)
    total_semesters: int | None = Field(default=None, ge=1, le=20)
    is_active: bool | None = None


class CourseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    college_id: int | None
    name: str
    code: str
    duration_years: int
    total_semesters: int
    is_active: bool
    created_at: datetime
    department_count: int = 0


class DepartmentCreate(BaseModel):
    campus_id: int | None = None
    college_id: int | None = None
    course_id: int | None = None
    name: str = Field(min_length=2, max_length=255)
    code: str = Field(min_length=2, max_length=50)


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    code: str | None = Field(default=None, min_length=2, max_length=50)
    campus_id: int | None = None
    course_id: int | None = None
    is_active: bool | None = None


class DepartmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campus_id: int | None
    college_id: int | None
    course_id: int | None
    name: str
    code: str
    is_active: bool
    created_at: datetime
    branch_count: int = 0
    course_name: str | None = None


class BranchCreate(BaseModel):
    department_id: int
    course_id: int | None = None
    name: str = Field(min_length=2, max_length=255)
    code: str = Field(min_length=2, max_length=50)


class BranchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    code: str | None = Field(default=None, min_length=2, max_length=50)
    department_id: int | None = None
    course_id: int | None = None
    is_active: bool | None = None


class BranchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    department_id: int
    course_id: int | None
    name: str
    code: str
    is_active: bool
    created_at: datetime
    batch_count: int = 0
    department_name: str | None = None
    course_name: str | None = None


class BatchCreate(BaseModel):
    branch_id: int
    name: str = Field(min_length=2, max_length=100)
    start_year: int = Field(ge=2000, le=2100)
    end_year: int = Field(ge=2000, le=2100)


class BatchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    start_year: int | None = Field(default=None, ge=2000, le=2100)
    end_year: int | None = Field(default=None, ge=2000, le=2100)
    branch_id: int | None = None
    is_active: bool | None = None


class BatchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int
    name: str
    start_year: int
    end_year: int
    is_active: bool
    created_at: datetime
    section_count: int = 0
    branch_name: str | None = None


class SectionCreate(BaseModel):
    batch_id: int
    name: str = Field(min_length=1, max_length=50)
    capacity: int = Field(default=60, ge=1, le=300)


class SectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    capacity: int | None = Field(default=None, ge=1, le=300)
    batch_id: int | None = None
    is_active: bool | None = None


class SectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: int
    name: str
    capacity: int
    is_active: bool
    created_at: datetime
    group_count: int = 0
    student_count: int = 0
    batch_name: str | None = None


class StudentGroupCreate(BaseModel):
    section_id: int
    name: str = Field(min_length=1, max_length=50)
    description: str | None = Field(default=None, max_length=255)


class StudentGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class StudentGroupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    section_id: int
    name: str
    description: str | None = None
    is_active: bool
    created_at: datetime
    enrolled_count: int = 0
    section_name: str | None = None


class AcademicEnrollmentCreate(BaseModel):
    student_id: int
    course_id: int
    branch_id: int
    batch_id: int
    section_id: int
    student_group_id: int | None = None
    semester: int = Field(ge=1, le=20)
    academic_year: str = Field(min_length=4, max_length=20)  # e.g. "2024-2025"
    status: EnrollmentStatus = EnrollmentStatus.ACTIVE
    is_current: bool = True


class AcademicEnrollmentBulkCreate(BaseModel):
    student_ids: list[int]
    course_id: int
    branch_id: int
    batch_id: int
    section_id: int
    student_group_id: int | None = None
    semester: int = Field(ge=1, le=20)
    academic_year: str = Field(min_length=4, max_length=20)
    status: EnrollmentStatus = EnrollmentStatus.ACTIVE


class AcademicEnrollmentUpdate(BaseModel):
    student_group_id: int | None = None
    semester: int | None = Field(default=None, ge=1, le=20)
    academic_year: str | None = Field(default=None, min_length=4, max_length=20)
    status: EnrollmentStatus | None = None
    is_current: bool | None = None


class AcademicEnrollmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    course_id: int
    branch_id: int
    batch_id: int
    section_id: int
    student_group_id: int | None
    semester: int
    academic_year: str
    status: EnrollmentStatus
    is_current: bool
    enrolled_at: datetime
    created_at: datetime
    student_name: str | None = None
    student_roll_number: str | None = None
    student_email: str | None = None
    section_name: str | None = None
    student_group_name: str | None = None
    course_name: str | None = None
    branch_name: str | None = None
    batch_name: str | None = None


class StudentProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    section_id: int | None = None
    current_group_id: int | None = None
    roll_number: str
    enrollment_number: str | None = None
    device_id: str | None = None
    device_registered_at: datetime | None = None
    current_enrollment: AcademicEnrollmentRead | None = None


class StudentDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    full_name: str
    email: str
    phone: str | None = None
    roll_number: str
    enrollment_number: str | None = None
    section_id: int | None = None
    section_name: str | None = None
    current_group_id: int | None = None
    current_group_name: str | None = None
    device_id: str | None = None
    device_registered_at: datetime | None = None
    is_active: bool = True
    created_at: datetime
    course_name: str | None = None
    department_name: str | None = None
    branch_name: str | None = None
    batch_name: str | None = None
    enrollment_status: str | None = None
    attendance_count: int = 0


class StudentCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=2, max_length=255)
    phone: str | None = None
    roll_number: str = Field(min_length=1, max_length=50)
    enrollment_number: str | None = None
    course_id: int | None = None
    branch_id: int | None = None
    batch_id: int | None = None
    section_id: int | None = None
    current_group_id: int | None = None
    semester: int | None = None
    college_id: int | None = None
    device_id: str | None = None


class StudentDeviceBindRequest(BaseModel):
    device_id: str = Field(min_length=6, max_length=255)
    platform: str | None = None
    model: str | None = None


class StudentUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    roll_number: str | None = None
    enrollment_number: str | None = None
    section_id: int | None = None
    current_group_id: int | None = None
    semester: int | None = None
    is_active: bool | None = None



class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime
    faculty_profile: FacultyProfileRead | None = None
    student_profile: StudentProfileRead | None = None


class CollegeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    code: str = Field(min_length=2, max_length=50)
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str = "India"


class CollegeRead(CollegeCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime


class CampusCreate(BaseModel):
    college_id: int
    name: str
    code: str
    latitude: float | None = None
    longitude: float | None = None
    geofence_radius_meters: int = 100


class CampusRead(CampusCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool


class SubjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    code: str = Field(min_length=2, max_length=50)
    description: str | None = None
    credits: int = Field(default=3, ge=1, le=10)
    department_id: int | None = None


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    code: str | None = Field(default=None, min_length=2, max_length=50)
    description: str | None = None
    credits: int | None = Field(default=None, ge=1, le=10)
    department_id: int | None = None
    is_active: bool | None = None


class SubjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    description: str | None = None
    credits: int
    department_id: int | None = None
    department_name: str | None = None
    is_active: bool
    created_at: datetime
    offerings_count: int = 0


class SubjectOfferingCreate(BaseModel):
    subject_id: int
    course_id: int
    semester: int = Field(ge=1, le=20)
    branch_id: int
    batch_id: int | None = None
    section_id: int
    student_group_id: int | None = None
    class_type: ClassType = ClassType.THEORY
    academic_year: str | None = None


class SubjectOfferingUpdate(BaseModel):
    subject_id: int | None = None
    course_id: int | None = None
    branch_id: int | None = None
    semester: int | None = Field(default=None, ge=1, le=20)
    section_id: int | None = None
    student_group_id: int | None = None
    class_type: ClassType | None = None
    academic_year: str | None = None
    is_active: bool | None = None


class SubjectOfferingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject_id: int
    course_id: int
    semester: int
    branch_id: int
    batch_id: int | None = None
    section_id: int
    student_group_id: int | None = None
    class_type: ClassType
    academic_year: str | None = None
    is_active: bool
    created_at: datetime

    # Rich relations for UI
    subject_name: str | None = None
    subject_code: str | None = None
    credits: int | None = None
    course_name: str | None = None
    branch_name: str | None = None
    batch_name: str | None = None
    section_name: str | None = None
    student_group_name: str | None = None
    assigned_faculty_count: int = 0
    assigned_faculty_names: list[str] = Field(default_factory=list)


class FacultyAssignmentCreate(BaseModel):
    faculty_id: int
    subject_offering_id: int
    is_primary: bool = True


class FacultyAssignmentUpdate(BaseModel):
    faculty_id: int | None = None
    subject_offering_id: int | None = None
    is_primary: bool | None = None
    is_active: bool | None = None


class FacultyAssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    faculty_id: int
    subject_offering_id: int
    is_primary: bool = True
    is_active: bool
    created_at: datetime
    faculty_name: str | None = None
    employee_id: str | None = None
    faculty_designation: str | None = None
    subject_name: str | None = None
    subject_code: str | None = None
    course_name: str | None = None
    branch_name: str | None = None
    batch_name: str | None = None
    section_name: str | None = None
    student_group_name: str | None = None
    semester: int | None = None
    academic_year: str | None = None
    class_type: ClassType | None = None


class FacultyAssignmentDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    faculty_id: int
    faculty_name: str
    employee_id: str
    faculty_designation: str | None = None
    subject_offering_id: int
    subject_id: int
    subject_name: str
    subject_code: str
    course_name: str
    branch_name: str
    batch_name: str | None = None
    section_name: str
    student_group_name: str | None = None
    semester: int
    academic_year: str | None = None
    class_type: ClassType
    is_primary: bool = True
    is_active: bool
    created_at: datetime


class ConflictItem(BaseModel):
    conflict_type: str  # "faculty" | "room" | "student_group"
    severity: str = "warning"
    title: str
    description: str
    conflicting_entry_id: int
    conflicting_subject_code: str
    conflicting_subject_name: str
    conflicting_faculty_name: str
    conflicting_room: str
    conflicting_section_name: str
    conflicting_group_name: str | None = None
    conflicting_time: str
    overlapping_interval: str


class ConflictValidationRequest(BaseModel):
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    room_number: str = Field(min_length=1, max_length=50)
    subject_offering_id: int
    faculty_assignment_id: int
    section_id: int | None = None
    student_group_id: int | None = None
    exclude_entry_id: int | None = None


class ConflictValidationResponse(BaseModel):
    has_conflict: bool
    conflicts: list[ConflictItem] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class TimetableConflictSummary(BaseModel):
    total_entries: int
    faculty_conflicts: int
    room_conflicts: int
    student_group_conflicts: int
    conflict_free: int
    has_any_conflict: bool


class TimetableEntryCreate(BaseModel):
    subject_offering_id: int
    faculty_assignment_id: int
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    room_number: str = Field(min_length=1, max_length=50)
    allow_override: bool = False
    override_reason: str | None = None


class TimetableEntryUpdate(BaseModel):
    faculty_assignment_id: int | None = None
    day_of_week: DayOfWeek | None = None
    start_time: time | None = None
    end_time: time | None = None
    room_number: str | None = Field(default=None, min_length=1, max_length=50)
    is_active: bool | None = None
    allow_override: bool = False
    override_reason: str | None = None


class TimetableEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject_offering_id: int
    faculty_assignment_id: int
    section_id: int
    student_group_id: int | None = None
    class_type: ClassType
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    room_number: str
    is_active: bool
    created_at: datetime


class TimetableEntryDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject_offering_id: int
    faculty_assignment_id: int
    faculty_id: int
    faculty_name: str
    employee_id: str
    subject_id: int
    subject_name: str
    subject_code: str
    course_id: int
    course_name: str
    branch_id: int
    branch_name: str
    section_id: int
    section_name: str
    student_group_id: int | None = None
    student_group_name: str | None = None
    semester: int
    class_type: ClassType
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    room_number: str
    is_active: bool
    created_at: datetime
    has_conflict: bool = False
    conflict_types: list[str] = Field(default_factory=list)
    conflicts: list[ConflictItem] = Field(default_factory=list)


class TimetableUploadResponse(BaseModel):
    rows_processed: int
    created_count: int
    errors: list[str] = Field(default_factory=list)


class StartSessionRequest(BaseModel):
    timetable_entry_id: int
    geofence_latitude: float | None = None
    geofence_longitude: float | None = None
    geofence_radius_meters: int = Field(default=100, ge=10, le=500)


class AttendanceSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timetable_entry_id: int | None = None
    subject_offering_id: int | None = None
    faculty_assignment_id: int | None = None
    faculty_id: int
    section_id: int
    student_group_id: int | None = None
    class_type: ClassType | None = None
    room_number: str | None = None
    campus_id: int | None = None
    status: SessionStatus
    started_at: datetime
    ended_at: datetime | None = None
    geofence_latitude: float | None = None
    geofence_longitude: float | None = None
    geofence_radius_meters: int | None = None


class AttendanceSessionDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timetable_entry_id: int | None = None
    subject_offering_id: int | None = None
    faculty_assignment_id: int | None = None
    faculty_id: int
    faculty_name: str
    faculty_employee_id: str | None = None
    subject_name: str
    subject_code: str
    course_name: str | None = None
    branch_name: str | None = None
    section_id: int
    section_name: str
    student_group_id: int | None = None
    student_group_name: str | None = None
    class_type: ClassType | None = None
    room_number: str | None = None
    status: SessionStatus
    session_date: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    started_at: datetime
    ended_at: datetime | None = None
    total_enrolled: int = 0
    total_present: int = 0
    present_count: int = 0
    late_count: int = 0
    absent_count: int = 0
    geofence_latitude: float | None = None
    geofence_longitude: float | None = None
    geofence_radius_meters: int | None = None
    active_qr_token: str | None = None


class AttendanceMonitorStats(BaseModel):
    active_sessions: int
    scheduled_today: int
    completed_today: int
    students_present: int
    late_checkins: int
    suspicious_checkins: int
    total_records: int


class QRSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    token: str
    expires_at: datetime
    is_active: bool
    qr_payload: str


class CheckInRequest(BaseModel):
    session_id: int
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    accuracy_meters: float | None = None
    device_id: str | None = None
    device_model: str | None = None
    wifi_bssid: str | None = None
    wifi_ssid: str | None = None
    bluetooth_beacon_id: str | None = None
    qr_token: str | None = None


class AttendanceRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    student_id: int
    status: AttendanceStatus
    marked_at: datetime
    latitude: float | None = None
    longitude: float | None = None
    distance_meters: float | None = None
    is_suspicious: bool
    suspicion_reason: str | None = None
    is_manually_adjusted: bool = False
    adjusted_by_user_id: int | None = None
    adjustment_reason: str | None = None
    original_status: str | None = None


class AttendanceRecordDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    student_id: int
    student_name: str
    roll_number: str
    status: AttendanceStatus
    marked_at: datetime
    distance_meters: float | None = None
    is_suspicious: bool


class StudentAttendanceSummary(BaseModel):
    subject_name: str
    subject_code: str
    class_type: ClassType
    total_sessions: int
    attended: int
    total_classes: int | None = None
    attended_classes: int | None = None
    percentage: float


class DashboardStats(BaseModel):
    total_colleges: int
    total_students: int
    total_faculty: int
    active_sessions: int
    today_attendance_count: int


class SuspiciousActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    attendance_record_id: int
    student_id: int
    session_id: int
    risk_score: float
    detection_method: DetectionMethod
    reason: str
    raw_signals: str | None = None
    review_status: ReviewStatus
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    reviewer_notes: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class SuspiciousActivityStats(BaseModel):
    total_flagged: int
    pending_reviews: int
    high_risk: int
    confirmed_violations: int
    false_positives: int
    data_quality_issues: int


class SuspiciousActivityHistoryItem(BaseModel):
    id: int
    action: str
    user_id: int | None = None
    user_name: str
    user_role: str | None = None
    old_status: str | None = None
    new_status: str | None = None
    reason: str | None = None
    created_at: str | None = None


class SuspiciousActivityDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    attendance_record_id: int
    student_id: int
    student_name: str
    student_roll_number: str
    session_id: int
    subject_name: str
    subject_code: str | None = None
    section_name: str | None = None
    room_number: str | None = None
    faculty_name: str
    risk_score: float
    severity: str = "low"  # low, medium, high, critical
    detection_method: DetectionMethod
    reason: str
    raw_signals: str | None = None
    review_status: ReviewStatus
    reviewed_by: int | None = None
    reviewer_name: str | None = None
    reviewed_at: datetime | None = None
    reviewer_notes: str | None = None
    marked_at: datetime
    session_started_at: datetime | None = None
    distance_meters: float | None = None
    device_id: str | None = None
    attendance_status: AttendanceStatus
    is_data_quality_issue: bool = False
    data_quality_reason: str | None = None
    related_activities_count: int = 0
    created_at: datetime


class ReviewSuspiciousActivityRequest(BaseModel):
    review_status: ReviewStatus
    reviewer_notes: str | None = None
    decision_reason: str | None = None


class ApplicationCreate(BaseModel):
    subject_offering_id: int
    reason: str = Field(..., min_length=2, max_length=255)
    description: str = Field(..., min_length=5)
    supporting_document_url: str | None = None


class FacultyReviewRequest(BaseModel):
    decision: ReviewDecision
    remarks: str | None = None


class CoordinatorReviewRequest(BaseModel):
    decision: ReviewDecision
    remarks: str | None = None


class HODReviewRequest(BaseModel):
    decision: ReviewDecision
    remarks: str | None = None


class ApplicationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    subject_offering_id: int
    enrollment_id: int | None = None
    reason: str
    description: str
    supporting_document_url: str | None = None
    status: ApplicationStatus
    faculty_reviewer_id: int | None = None
    faculty_decision: ReviewDecision | None = None
    faculty_remarks: str | None = None
    faculty_reviewed_at: datetime | None = None
    coordinator_reviewer_id: int | None = None
    coordinator_decision: ReviewDecision | None = None
    coordinator_remarks: str | None = None
    coordinator_reviewed_at: datetime | None = None
    hod_reviewer_id: int | None = None
    hod_decision: ReviewDecision | None = None
    hod_remarks: str | None = None
    hod_reviewed_at: datetime | None = None
    submitted_at: datetime
    created_at: datetime
    updated_at: datetime | None = None


class ApplicationStats(BaseModel):
    total_applications: int
    pending_faculty: int
    pending_coordinator: int = 0
    pending_hod: int
    approved: int
    rejected: int


class ApplicationHistoryItem(BaseModel):
    id: int
    action: str
    user_id: int | None = None
    user_name: str
    user_role: str | None = None
    stage: str | None = None
    decision: str | None = None
    remarks: str | None = None
    created_at: str | None = None


class ApplicationDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    student_name: str
    student_roll_number: str
    student_email: str | None = None
    subject_offering_id: int
    subject_name: str
    subject_code: str
    course_name: str | None = None
    branch_name: str | None = None
    semester: int | None = None
    class_type: str | None = None
    application_type: str = "attendance_condonation"
    department_id: int
    department_name: str
    section_name: str
    student_group_name: str | None = None
    reason: str
    description: str
    supporting_document_url: str | None = None
    status: ApplicationStatus
    faculty_reviewer_id: int | None = None
    faculty_reviewer_name: str | None = None
    faculty_decision: ReviewDecision | None = None
    faculty_remarks: str | None = None
    faculty_reviewed_at: datetime | None = None
    coordinator_reviewer_id: int | None = None
    coordinator_reviewer_name: str | None = None
    coordinator_decision: ReviewDecision | None = None
    coordinator_remarks: str | None = None
    coordinator_reviewed_at: datetime | None = None
    hod_reviewer_id: int | None = None
    hod_reviewer_name: str | None = None
    hod_decision: ReviewDecision | None = None
    hod_remarks: str | None = None
    hod_reviewed_at: datetime | None = None
    attendance_percentage: float | None = None
    attendance_threshold: float = 75.0
    total_sessions: int = 0
    attended_sessions: int = 0
    is_exam_eligible: bool = False
    condonation_granted: bool = False
    submitted_at: datetime
    created_at: datetime


class NoticeCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    content: str = Field(..., min_length=2)
    audience_type: AudienceType
    department_id: int | None = None
    branch_id: int | None = None
    student_group_id: int | None = None
    category: str | None = "General"
    expires_at: datetime | None = None
    is_active: bool = True


class NoticeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    content: str | None = Field(default=None, min_length=2)
    audience_type: AudienceType | None = None
    department_id: int | None = None
    branch_id: int | None = None
    student_group_id: int | None = None
    category: str | None = None
    expires_at: datetime | None = None
    is_active: bool | None = None


class NoticeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    created_by: int
    audience_type: AudienceType
    department_id: int | None = None
    branch_id: int | None = None
    student_group_id: int | None = None
    category: str | None = "General"
    expires_at: datetime | None = None
    is_active: bool
    published_at: datetime
    created_at: datetime
    updated_at: datetime | None = None


class NoticeDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    created_by: int
    creator_name: str
    audience_type: AudienceType
    department_id: int | None = None
    department_name: str | None = None
    branch_id: int | None = None
    branch_name: str | None = None
    student_group_id: int | None = None
    student_group_name: str | None = None
    category: str | None = "General"
    expires_at: datetime | None = None
    is_active: bool
    published_at: datetime
    created_at: datetime
    updated_at: datetime | None = None


class NotificationCounts(BaseModel):
    all: int
    unread: int
    read: int


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    message: str
    notification_type: NotificationType
    related_entity_id: int | None = None
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime
    link_url: str | None = None
    action_label: str | None = None


class NotificationBatchReadResponse(BaseModel):
    marked_count: int
    message: str


class DevicePushTokenRegister(BaseModel):
    fcm_token: str = Field(..., min_length=10, max_length=512, validation_alias=AliasChoices("fcm_token", "token"))
    platform: str = Field(default="android", pattern="^(android|ios|web)$")
    device_id: str | None = Field(default=None, max_length=255, validation_alias=AliasChoices("device_id", "device_model"))


class DevicePushTokenRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    user_id: int
    fcm_token: str
    platform: str
    device_id: str | None = None
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None = None

    @computed_field
    @property
    def token(self) -> str:
        return self.fcm_token

    @computed_field
    @property
    def device_model(self) -> str | None:
        return self.device_id


class PushNotificationDispatchPayload(BaseModel):
    title: str
    body: str
    data: dict[str, str] = Field(default_factory=dict)


# ── Admin Control Center Schemas ─────────────────────────────────────
class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None = None
    user_name: str | None = None
    user_email: str | None = None
    user_role: str | None = None
    action: str
    entity_type: str
    entity_id: int | None = None
    reason: str | None = None
    metadata_json: str | None = None
    created_at: datetime


class SystemSettingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: str
    key: str
    value: str
    value_type: str
    description: str | None = None
    is_public: bool = False
    updated_at: datetime | None = None


class SystemSettingUpdate(BaseModel):
    key: str
    value: str


class SystemSettingBatchUpdate(BaseModel):
    settings: dict[str, str]
    reason: str | None = None


class RoomCreate(BaseModel):
    campus_id: int
    name: str = Field(..., min_length=1, max_length=100)
    building: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    geofence_radius_meters: int = 100
    gps_accuracy_threshold: float = 50.0
    capacity: int | None = None
    is_active: bool = True


class RoomUpdate(BaseModel):
    name: str | None = None
    building: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    geofence_radius_meters: int | None = None
    gps_accuracy_threshold: float | None = None
    capacity: int | None = None
    is_active: bool | None = None


class RoomRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campus_id: int
    name: str
    building: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    geofence_radius_meters: int = 100
    gps_accuracy_threshold: float = 50.0
    capacity: int | None = None
    is_active: bool = True
    created_at: datetime


class AttendanceOverrideRequest(BaseModel):
    status: AttendanceStatus
    reason: str = Field(..., min_length=3, max_length=500)


class StudentDeviceResetRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


class AdminAnalyticsResponse(BaseModel):
    total_students: int
    total_faculty: int
    total_departments: int
    total_courses: int
    total_subjects: int
    total_active_sessions: int
    today_sessions_count: int
    today_attendance_count: int
    overall_attendance_percentage: float
    pending_applications: int
    total_suspicious_activities: int
    high_risk_anomalies: int
    department_attendance: list[dict]
    attendance_by_day: list[dict]
    risk_distribution: dict





