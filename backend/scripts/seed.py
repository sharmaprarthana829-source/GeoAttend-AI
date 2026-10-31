import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import date, time

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models import (
    AcademicEnrollment,
    Batch,
    Branch,
    Campus,
    ClassType,
    College,
    Course,
    DayOfWeek,
    Department,
    EnrollmentStatus,
    FacultyAssignment,
    FacultyProfile,
    FacultyResponsibility,
    ResponsibilityType,
    ScopeType,
    Section,
    StudentGroup,
    StudentProfile,
    Subject,
    SubjectOffering,
    TimetableEntry,
    User,
    UserRole,
)


def seed() -> None:
    db = SessionLocal()
    try:
        college = db.query(College).filter(College.code == "DEC001").first()
        if not college:
            college = College(
                name="Demo Engineering College",
                code="DEC001",
                city="Pune",
                state="Maharashtra",
                country="India",
            )
            db.add(college)
            db.flush()

        campus = db.query(Campus).filter(Campus.code == "MAIN", Campus.college_id == college.id).first()
        if not campus:
            campus = Campus(
                college_id=college.id,
                name="Main Campus",
                code="MAIN",
                latitude=18.5204,
                longitude=73.8567,
                geofence_radius_meters=100,
            )
            db.add(campus)
            db.flush()

        # 1. Course
        course = db.query(Course).filter(Course.code == "BTECH").first()
        if not course:
            course = Course(
                college_id=college.id,
                name="Bachelor of Technology",
                code="BTECH",
                duration_years=4,
                total_semesters=8,
                is_active=True,
            )
            db.add(course)
            db.flush()

        # 2. Department
        department = db.query(Department).filter(Department.code == "CSE", Department.campus_id == campus.id).first()
        if not department:
            department = Department(
                campus_id=campus.id,
                college_id=college.id,
                course_id=course.id,
                name="Computer Science & Engineering",
                code="CSE",
                is_active=True,
            )
            db.add(department)
            db.flush()
        elif not department.course_id:
            department.course_id = course.id
            db.flush()

        # 3. Branch
        branch = db.query(Branch).filter(Branch.code == "CSD", Branch.department_id == department.id).first()
        if not branch:
            branch = Branch(
                department_id=department.id,
                course_id=course.id,
                name="Computer Science & Design",
                code="CSD",
                is_active=True,
            )
            db.add(branch)
            db.flush()

        # 4. Batch
        batch = db.query(Batch).filter(Batch.name == "2024-2028", Batch.branch_id == branch.id).first()
        if not batch:
            batch = Batch(
                branch_id=branch.id,
                name="2024-2028",
                start_year=2024,
                end_year=2028,
                is_active=True,
            )
            db.add(batch)
            db.flush()

        # 5. Section
        section = db.query(Section).filter(Section.name == "CSD-A", Section.batch_id == batch.id).first()
        if not section:
            section = Section(batch_id=batch.id, name="CSD-A", capacity=60, is_active=True)
            db.add(section)
            db.flush()

        # 6. Student Groups (B1, B2)
        group_b1 = db.query(StudentGroup).filter(StudentGroup.section_id == section.id, StudentGroup.name == "B1").first()
        if not group_b1:
            group_b1 = StudentGroup(section_id=section.id, name="B1", description="Lab Batch 1", is_active=True)
            db.add(group_b1)
            db.flush()

        group_b2 = db.query(StudentGroup).filter(StudentGroup.section_id == section.id, StudentGroup.name == "B2").first()
        if not group_b2:
            group_b2 = StudentGroup(section_id=section.id, name="B2", description="Lab Batch 2", is_active=True)
            db.add(group_b2)
            db.flush()

        # 7. Users & Profiles
        admin = db.query(User).filter(User.email == "admin@geoattend.ai").first()
        if not admin:
            admin = User(
                email="admin@geoattend.ai",
                password_hash=get_password_hash("Admin@12345"),
                full_name="Super Admin",
                role=UserRole.ADMIN,
            )
            db.add(admin)
            db.flush()
        else:
            admin.is_active = True
            db.flush()

        faculty_user = db.query(User).filter(User.email == "faculty@geoattend.ai").first()
        if not faculty_user:
            faculty_user = User(
                college_id=college.id,
                email="faculty@geoattend.ai",
                password_hash=get_password_hash("Faculty@12345"),
                full_name="Dr. Priya Sharma",
                role=UserRole.FACULTY,
            )
            db.add(faculty_user)
            db.flush()
        else:
            faculty_user.is_active = True
            db.flush()

        faculty = db.query(FacultyProfile).filter(FacultyProfile.user_id == faculty_user.id).first()
        if not faculty:
            faculty = FacultyProfile(
                user_id=faculty_user.id,
                department_id=department.id,
                employee_id="FAC001",
                designation="Associate Professor & HOD",
            )
            db.add(faculty)
            db.flush()

        # Seed HOD and Professor responsibility for Dr. Priya Sharma
        hod_resp = (
            db.query(FacultyResponsibility)
            .filter(
                FacultyResponsibility.faculty_id == faculty.id,
                FacultyResponsibility.responsibility_type == ResponsibilityType.HOD,
            )
            .first()
        )
        if not hod_resp:
            hod_resp = FacultyResponsibility(
                faculty_id=faculty.id,
                responsibility_type=ResponsibilityType.HOD,
                scope_type=ScopeType.DEPARTMENT,
                department_id=department.id,
                college_id=college.id,
                is_active=True,
            )
            prof_resp = FacultyResponsibility(
                faculty_id=faculty.id,
                responsibility_type=ResponsibilityType.PROFESSOR,
                scope_type=ScopeType.DEPARTMENT,
                department_id=department.id,
                college_id=college.id,
                is_active=True,
            )
            db.add_all([hod_resp, prof_resp])

        # Second faculty member WITHOUT HOD responsibility (Professor only)
        faculty2_user = db.query(User).filter(User.email == "faculty2@geoattend.ai").first()
        if not faculty2_user:
            faculty2_user = User(
                college_id=college.id,
                email="faculty2@geoattend.ai",
                password_hash=get_password_hash("Faculty@12345"),
                full_name="Prof. Rajesh Kumar",
                role=UserRole.FACULTY,
            )
            db.add(faculty2_user)
            db.flush()
        else:
            faculty2_user.is_active = True
            db.flush()

        faculty2 = db.query(FacultyProfile).filter(FacultyProfile.user_id == faculty2_user.id).first()
        if not faculty2:
            faculty2 = FacultyProfile(
                user_id=faculty2_user.id,
                department_id=department.id,
                employee_id="FAC002",
                designation="Assistant Professor",
            )
            db.add(faculty2)
            db.flush()

        prof2_resp = (
            db.query(FacultyResponsibility)
            .filter(
                FacultyResponsibility.faculty_id == faculty2.id,
                FacultyResponsibility.responsibility_type == ResponsibilityType.PROFESSOR,
            )
            .first()
        )
        if not prof2_resp:
            prof2_resp = FacultyResponsibility(
                faculty_id=faculty2.id,
                responsibility_type=ResponsibilityType.PROFESSOR,
                scope_type=ScopeType.DEPARTMENT,
                department_id=department.id,
                college_id=college.id,
                is_active=True,
            )
            db.add(prof2_resp)

        # 8. Master Subjects
        subject = db.query(Subject).filter(Subject.code == "CS201").first()
        if not subject:
            subject = Subject(
                department_id=department.id,
                name="Data Structures",
                code="CS201",
                description="Core Data Structures & Algorithms",
                credits=4,
                is_active=True,
            )
            db.add(subject)
            db.flush()

        subject_lab = db.query(Subject).filter(Subject.code == "CS203").first()
        if not subject_lab:
            subject_lab = Subject(
                department_id=department.id,
                name="Data Structures Lab",
                code="CS203",
                description="Practical implementation of data structures",
                credits=2,
                is_active=True,
            )
            db.add(subject_lab)
            db.flush()

        # 9. Subject Offerings
        # 9a. CS201 Theory (Whole Section CSD-A)
        offering_theory = (
            db.query(SubjectOffering)
            .filter(
                SubjectOffering.subject_id == subject.id,
                SubjectOffering.section_id == section.id,
                SubjectOffering.student_group_id.is_(None),
                SubjectOffering.class_type == ClassType.THEORY,
            )
            .first()
        )
        if not offering_theory:
            offering_theory = SubjectOffering(
                subject_id=subject.id,
                course_id=course.id,
                branch_id=branch.id,
                section_id=section.id,
                student_group_id=None,
                semester=1,
                class_type=ClassType.THEORY,
                is_active=True,
            )
            db.add(offering_theory)
            db.flush()

        # 9b. CS203 Lab for Group B1
        offering_lab_b1 = (
            db.query(SubjectOffering)
            .filter(
                SubjectOffering.subject_id == subject_lab.id,
                SubjectOffering.section_id == section.id,
                SubjectOffering.student_group_id == group_b1.id,
                SubjectOffering.class_type == ClassType.LAB,
            )
            .first()
        )
        if not offering_lab_b1:
            offering_lab_b1 = SubjectOffering(
                subject_id=subject_lab.id,
                course_id=course.id,
                branch_id=branch.id,
                section_id=section.id,
                student_group_id=group_b1.id,
                semester=1,
                class_type=ClassType.LAB,
                is_active=True,
            )
            db.add(offering_lab_b1)
            db.flush()

        # 9c. CS203 Lab for Group B2
        offering_lab_b2 = (
            db.query(SubjectOffering)
            .filter(
                SubjectOffering.subject_id == subject_lab.id,
                SubjectOffering.section_id == section.id,
                SubjectOffering.student_group_id == group_b2.id,
                SubjectOffering.class_type == ClassType.LAB,
            )
            .first()
        )
        if not offering_lab_b2:
            offering_lab_b2 = SubjectOffering(
                subject_id=subject_lab.id,
                course_id=course.id,
                branch_id=branch.id,
                section_id=section.id,
                student_group_id=group_b2.id,
                semester=1,
                class_type=ClassType.LAB,
                is_active=True,
            )
            db.add(offering_lab_b2)
            db.flush()

        # 10. Faculty Assignments
        # Priya Sharma -> CS201 Theory & CS203 Lab (B1)
        asgn1 = (
            db.query(FacultyAssignment)
            .filter(
                FacultyAssignment.faculty_id == faculty.id,
                FacultyAssignment.subject_offering_id == offering_theory.id,
            )
            .first()
        )
        if not asgn1:
            asgn1 = FacultyAssignment(
                faculty_id=faculty.id,
                subject_offering_id=offering_theory.id,
                is_active=True,
            )
            db.add(asgn1)
        else:
            asgn1.is_active = True
            db.flush()

        asgn2 = (
            db.query(FacultyAssignment)
            .filter(
                FacultyAssignment.faculty_id == faculty.id,
                FacultyAssignment.subject_offering_id == offering_lab_b1.id,
            )
            .first()
        )
        if not asgn2:
            asgn2 = FacultyAssignment(
                faculty_id=faculty.id,
                subject_offering_id=offering_lab_b1.id,
                is_active=True,
            )
            db.add(asgn2)
        else:
            asgn2.is_active = True
            db.flush()

        # Rajesh Kumar -> CS203 Lab (B2)
        asgn3 = (
            db.query(FacultyAssignment)
            .filter(
                FacultyAssignment.faculty_id == faculty2.id,
                FacultyAssignment.subject_offering_id == offering_lab_b2.id,
            )
            .first()
        )
        if not asgn3:
            asgn3 = FacultyAssignment(
                faculty_id=faculty2.id,
                subject_offering_id=offering_lab_b2.id,
                is_active=True,
            )
            db.add(asgn3)
        else:
            asgn3.is_active = True
            db.flush()

        # 11. Student User & Profile
        student_user = db.query(User).filter(User.email == "student@geoattend.ai").first()
        if not student_user:
            student_user = User(
                college_id=college.id,
                email="student@geoattend.ai",
                password_hash=get_password_hash("Student@12345"),
                full_name="Arjun Mehta",
                role=UserRole.STUDENT,
            )
            db.add(student_user)
            db.flush()
        else:
            student_user.is_active = True
            db.flush()

        student = db.query(StudentProfile).filter(StudentProfile.user_id == student_user.id).first()
        if not student:
            student = StudentProfile(
                user_id=student_user.id,
                section_id=section.id,
                current_group_id=group_b1.id,
                roll_number="CS24A001",
                enrollment_number="EN2024001",
            )
            db.add(student)
            db.flush()
        else:
            student.section_id = section.id
            student.current_group_id = group_b1.id
            db.flush()

        # 12. Academic Enrollment for student
        enrollment = (
            db.query(AcademicEnrollment)
            .filter(
                AcademicEnrollment.student_id == student.id,
                AcademicEnrollment.semester == 1,
                AcademicEnrollment.academic_year == "2024-2025",
            )
            .first()
        )
        if not enrollment:
            enrollment = AcademicEnrollment(
                student_id=student.id,
                course_id=course.id,
                branch_id=branch.id,
                batch_id=batch.id,
                section_id=section.id,
                student_group_id=group_b1.id,
                semester=1,
                academic_year="2024-2025",
                status=EnrollmentStatus.ACTIVE,
                is_current=True,
            )
            db.add(enrollment)
        else:
            enrollment.is_current = True
            enrollment.status = EnrollmentStatus.ACTIVE


        # 12c. Student 3 (Prarthana Sharma)
        prarthana_user = db.query(User).filter(User.email == "Prarthana@gmail.com").first()
        if not prarthana_user:
            prarthana_user = User(
                college_id=college.id,
                email="Prarthana@gmail.com",
                password_hash=get_password_hash("Prarthana@123"),
                full_name="Prarthana Sharma",
                role=UserRole.STUDENT,
            )
            db.add(prarthana_user)
            db.flush()
        else:
            prarthana_user.password_hash = get_password_hash("Prarthana@123")
            prarthana_user.is_active = True
            db.flush()

        prarthana = db.query(StudentProfile).filter(StudentProfile.user_id == prarthana_user.id).first()
        if not prarthana:
            prarthana = StudentProfile(
                user_id=prarthana_user.id,
                section_id=section.id,
                current_group_id=group_b1.id,
                roll_number="BTCD24O1045",
                enrollment_number="EN2024045",
            )
            db.add(prarthana)
            db.flush()

        prarthana_enrollment = (
            db.query(AcademicEnrollment)
            .filter(
                AcademicEnrollment.student_id == prarthana.id,
                AcademicEnrollment.semester == 5,
                AcademicEnrollment.academic_year == "2024-2025",
            )
            .first()
        )
        if not prarthana_enrollment:
            prarthana_enrollment = AcademicEnrollment(
                student_id=prarthana.id,
                course_id=course.id,
                branch_id=branch.id,
                batch_id=batch.id,
                section_id=section.id,
                student_group_id=group_b1.id,
                semester=5,
                academic_year="2024-2025",
                status=EnrollmentStatus.ACTIVE,
                is_current=True,
            )
            db.add(prarthana_enrollment)
            db.flush()
        else:
            prarthana_enrollment.section_id = section.id
            prarthana_enrollment.student_group_id = group_b1.id
            prarthana_enrollment.is_current = True
            prarthana_enrollment.status = EnrollmentStatus.ACTIVE
            db.flush()

        # 12d. Faculty (Ashish Tomar)
        ashish_user = db.query(User).filter(User.email == "Ashish123@gmail.com").first()
        if not ashish_user:
            ashish_user = User(
                college_id=college.id,
                email="Ashish123@gmail.com",
                password_hash=get_password_hash("Faculty@12345"),
                full_name="Ashish Tomar",
                role=UserRole.FACULTY,
            )
            db.add(ashish_user)
            db.flush()
        else:
            ashish_user.is_active = True
            db.flush()

        ashish_faculty = db.query(FacultyProfile).filter(FacultyProfile.user_id == ashish_user.id).first()
        if not ashish_faculty:
            ashish_faculty = FacultyProfile(
                user_id=ashish_user.id,
                department_id=department.id,
                employee_id="FAC003",
                designation="Assistant Professor",
            )
            db.add(ashish_faculty)
            db.flush()

        # 13. Timetable Entries
        # 13a. Monday 09:00 - 10:00: CS201 Theory (Whole Section CSD-A, Priya Sharma, Room C-204)
        t_entry1 = (
            db.query(TimetableEntry)
            .filter(
                TimetableEntry.subject_offering_id == offering_theory.id,
                TimetableEntry.day_of_week == DayOfWeek.MONDAY,
                TimetableEntry.start_time == time(9, 0),
            )
            .first()
        )
        if not t_entry1:
            t_entry1 = TimetableEntry(
                subject_offering_id=offering_theory.id,
                faculty_assignment_id=asgn1.id,
                section_id=section.id,
                student_group_id=None,
                class_type=ClassType.THEORY,
                day_of_week=DayOfWeek.MONDAY,
                start_time=time(9, 0),
                end_time=time(10, 0),
                room_number="C-204",
                is_active=True,
            )
            db.add(t_entry1)
        else:
            t_entry1.is_active = True
            db.flush()

        # 13b. Monday 10:00 - 11:00: CS203 Lab (Group B1, Priya Sharma, Room LAB-1)
        t_entry2 = (
            db.query(TimetableEntry)
            .filter(
                TimetableEntry.subject_offering_id == offering_lab_b1.id,
                TimetableEntry.day_of_week == DayOfWeek.MONDAY,
                TimetableEntry.start_time == time(10, 0),
            )
            .first()
        )
        if not t_entry2:
            t_entry2 = TimetableEntry(
                subject_offering_id=offering_lab_b1.id,
                faculty_assignment_id=asgn2.id,
                section_id=section.id,
                student_group_id=group_b1.id,
                class_type=ClassType.LAB,
                day_of_week=DayOfWeek.MONDAY,
                start_time=time(10, 0),
                end_time=time(11, 0),
                room_number="LAB-1",
                is_active=True,
            )
            db.add(t_entry2)
        else:
            t_entry2.is_active = True
            db.flush()

        # 13c. Monday 10:00 - 11:00: CS203 Lab (Group B2, Rajesh Kumar, Room LAB-2)
        t_entry3 = (
            db.query(TimetableEntry)
            .filter(
                TimetableEntry.subject_offering_id == offering_lab_b2.id,
                TimetableEntry.day_of_week == DayOfWeek.MONDAY,
                TimetableEntry.start_time == time(10, 0),
            )
            .first()
        )
        if not t_entry3:
            t_entry3 = TimetableEntry(
                subject_offering_id=offering_lab_b2.id,
                faculty_assignment_id=asgn3.id,
                section_id=section.id,
                student_group_id=group_b2.id,
                class_type=ClassType.LAB,
                day_of_week=DayOfWeek.MONDAY,
                start_time=time(10, 0),
                end_time=time(11, 0),
                room_number="LAB-2",
                is_active=True,
            )
            db.add(t_entry3)
        else:
            t_entry3.is_active = True
            db.flush()

        # 13d. Friday 09:00 - 10:00: CS201 Theory (Whole Section CSD-A, Priya Sharma, Room C-204)
        t_entry_friday = (
            db.query(TimetableEntry)
            .filter(
                TimetableEntry.subject_offering_id == offering_theory.id,
                TimetableEntry.day_of_week == DayOfWeek.FRIDAY,
                TimetableEntry.start_time == time(9, 0),
            )
            .first()
        )
        if not t_entry_friday:
            t_entry_friday = TimetableEntry(
                subject_offering_id=offering_theory.id,
                faculty_assignment_id=asgn1.id,
                section_id=section.id,
                student_group_id=None,
                class_type=ClassType.THEORY,
                day_of_week=DayOfWeek.FRIDAY,
                start_time=time(9, 0),
                end_time=time(10, 0),
                room_number="C-204",
                is_active=True,
            )
            db.add(t_entry_friday)
        else:
            t_entry_friday.is_active = True

        # 13e. Today's schedule (for active day-of-week test verification)
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        today_enum = DayOfWeek(days[date.today().weekday()])
        if today_enum != DayOfWeek.MONDAY:
            today_entry = (
                db.query(TimetableEntry)
                .filter(
                    TimetableEntry.subject_offering_id == offering_theory.id,
                    TimetableEntry.day_of_week == today_enum,
                    TimetableEntry.start_time == time(9, 0),
                )
                .first()
            )
            if not today_entry:
                today_entry = TimetableEntry(
                    subject_offering_id=offering_theory.id,
                    faculty_assignment_id=asgn1.id,
                    section_id=section.id,
                    student_group_id=None,
                    class_type=ClassType.THEORY,
                    day_of_week=today_enum,
                    start_time=time(9, 0),
                    end_time=time(10, 0),
                    room_number="C-204",
                    is_active=True,
                )
                db.add(today_entry)
            else:
                today_entry.is_active = True

            today_lab1 = (
                db.query(TimetableEntry)
                .filter(
                    TimetableEntry.subject_offering_id == offering_lab_b1.id,
                    TimetableEntry.day_of_week == today_enum,
                    TimetableEntry.start_time == time(10, 0),
                )
                .first()
            )
            if not today_lab1:
                today_lab1 = TimetableEntry(
                    subject_offering_id=offering_lab_b1.id,
                    faculty_assignment_id=asgn2.id,
                    section_id=section.id,
                    student_group_id=group_b1.id,
                    class_type=ClassType.LAB,
                    day_of_week=today_enum,
                    start_time=time(10, 0),
                    end_time=time(11, 0),
                    room_number="LAB-1",
                    is_active=True,
                )
                db.add(today_lab1)
            else:
                today_lab1.is_active = True

            today_lab2 = (
                db.query(TimetableEntry)
                .filter(
                    TimetableEntry.subject_offering_id == offering_lab_b2.id,
                    TimetableEntry.day_of_week == today_enum,
                    TimetableEntry.start_time == time(10, 0),
                )
                .first()
            )
            if not today_lab2:
                today_lab2 = TimetableEntry(
                    subject_offering_id=offering_lab_b2.id,
                    faculty_assignment_id=asgn3.id,
                    section_id=section.id,
                    student_group_id=group_b2.id,
                    class_type=ClassType.LAB,
                    day_of_week=today_enum,
                    start_time=time(10, 0),
                    end_time=time(11, 0),
                    room_number="LAB-2",
                    is_active=True,
                )
                db.add(today_lab2)
            else:
                today_lab2.is_active = True

        # ── Seed Notices & Notifications ─────────────────────────────────
        from app.models import Notice, AudienceType, Notification, NotificationType
        from app.services.notification import NotificationService

        notices = db.query(Notice).all()
        if not notices:
            default_notices = [
                Notice(
                    title="Semester Examination & Attendance Policy",
                    content="Students must maintain a minimum of 75% attendance to qualify for the final semester examinations.",
                    created_by=admin.id,
                    audience_type=AudienceType.ALL,
                    is_active=True,
                ),
                Notice(
                    title="CSE Department Hackathon Registration Open",
                    content="Registrations are now open for the annual 24-hour Smart Campus Hackathon.",
                    created_by=admin.id,
                    audience_type=AudienceType.DEPARTMENT,
                    department_id=department.id,
                    is_active=True,
                ),
            ]
            db.add_all(default_notices)
            db.commit()
            notices = db.query(Notice).all()

        for n in notices:
            if n.is_active:
                NotificationService.dispatch_notice_notifications(db, n)
        db.commit()

        # Seed sample workflow notifications for student Arjun Mehta
        NotificationService.dispatch_notification(
            db=db,
            user_id=student_user.id,
            title="Attendance Session Active: CS201 - Data Structures",
            message="Live lecture session is active in Room C-204. Open GeoAttend AI mobile app to check in.",
            notification_type=NotificationType.ATTENDANCE,
        )
        NotificationService.dispatch_notification(
            db=db,
            user_id=student_user.id,
            title="Application #APP-75: Faculty Recommended Approval",
            message="Dr. Priya Sharma recommended approval for your medical leave application. Forwarded to HOD for final decision.",
            notification_type=NotificationType.APPLICATION,
            related_entity_id=75,
        )

        # Seed sample workflow notifications for faculty Dr. Priya Sharma
        NotificationService.dispatch_notification(
            db=db,
            user_id=faculty_user.id,
            title="New Student Application #APP-75 Submitted",
            message="Arjun Mehta (CS24A001) submitted an attendance condonation application for Data Structures.",
            notification_type=NotificationType.APPLICATION,
            related_entity_id=75,
        )
        NotificationService.dispatch_notification(
            db=db,
            user_id=faculty_user.id,
            title="Security Alert: Attendance Anomaly Detected",
            message="Check-in flagged near geofence boundary in session #12. Review available in Control Center.",
            notification_type=NotificationType.SYSTEM,
        )

        # Seed sample notifications for Admin
        NotificationService.dispatch_notification(
            db=db,
            user_id=admin.id,
            title="GeoMesh Telemetry Online",
            message="Campus GPS Boundary & BLE Mesh operational across 3 faculty lecture halls.",
            notification_type=NotificationType.SYSTEM,
        )
        db.commit()

        print("Phase 6 Seed data initialized successfully.")
        print(f"  Course: {course.name} ({course.code})")
        print(f"  Department: {department.name} ({department.code})")
        print(f"  Branch: {branch.name} ({branch.code})")
        print(f"  Batch: {batch.name}")
        print(f"  Section: {section.name}")
        print(f"  Groups: {group_b1.name}, {group_b2.name}")
        print(f"  Subjects: {subject.name} ({subject.code}), {subject_lab.name} ({subject_lab.code})")
        print(f"  Offerings: {subject.name} Theory, {subject_lab.name} Lab (B1 & B2)")
        print(f"  Faculty Assignments: Dr. Priya Sharma -> {subject.name} (Theory) & {subject_lab.name} (Lab B1); Prof. Rajesh Kumar -> {subject_lab.name} (Lab B2)")
        print(f"  Timetable: Monday & Today: 09:00-10:00 Theory (C-204), 10:00-11:00 Lab B1 (LAB-1) & B2 (LAB-2)")
        print(f"  Student: {student_user.full_name} -> Enrolled Sem 1, Group {group_b1.name}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
