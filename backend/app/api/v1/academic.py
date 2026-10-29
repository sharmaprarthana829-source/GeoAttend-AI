from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import User, UserRole
from app.schemas import (
    AcademicEnrollmentBulkCreate,
    AcademicEnrollmentCreate,
    AcademicEnrollmentRead,
    AcademicEnrollmentUpdate,
    BatchCreate,
    BatchRead,
    BatchUpdate,
    BranchCreate,
    BranchRead,
    BranchUpdate,
    CourseCreate,
    CourseRead,
    CourseUpdate,
    DepartmentCreate,
    DepartmentRead,
    DepartmentUpdate,
    SectionCreate,
    SectionRead,
    SectionUpdate,
    StudentGroupCreate,
    StudentGroupRead,
    StudentGroupUpdate,
)
from app.services.academic import AcademicService

router = APIRouter(prefix="/academic", tags=["academic"])


# -----------------------------------------------------------------
# Courses
# -----------------------------------------------------------------
@router.post("/courses", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.create_course(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/courses", response_model=list[CourseRead])
def list_courses(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    college_id: int | None = None,
    is_active: bool | None = None,
):
    return AcademicService.list_courses(db, college_id=college_id, is_active=is_active)


@router.get("/courses/{course_id}", response_model=CourseRead)
def get_course(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    try:
        return AcademicService.get_course(db, course_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/courses/{course_id}", response_model=CourseRead)
def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.update_course(db, course_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/courses/{course_id}", response_model=CourseRead)
def delete_course(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.delete_course(db, course_id)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if "not found" in str(exc).lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


# -----------------------------------------------------------------
# Departments
# -----------------------------------------------------------------
@router.post("/departments", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.create_department(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/departments", response_model=list[DepartmentRead])
def list_departments(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    campus_id: int | None = None,
    course_id: int | None = None,
    is_active: bool | None = None,
):
    return AcademicService.list_departments(db, campus_id=campus_id, course_id=course_id, is_active=is_active)


@router.get("/departments/{department_id}", response_model=DepartmentRead)
def get_department(
    department_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    try:
        return AcademicService.get_department(db, department_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/departments/{department_id}", response_model=DepartmentRead)
def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.update_department(db, department_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/departments/{department_id}", response_model=DepartmentRead)
def delete_department(
    department_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.delete_department(db, department_id)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if "not found" in str(exc).lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


# -----------------------------------------------------------------
# Branches
# -----------------------------------------------------------------
@router.post("/branches", response_model=BranchRead, status_code=status.HTTP_201_CREATED)
def create_branch(
    payload: BranchCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.create_branch(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/branches", response_model=list[BranchRead])
def list_branches(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    department_id: int | None = None,
    course_id: int | None = None,
    is_active: bool | None = None,
):
    return AcademicService.list_branches(db, department_id=department_id, course_id=course_id, is_active=is_active)


@router.get("/branches/{branch_id}", response_model=BranchRead)
def get_branch(
    branch_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    try:
        return AcademicService.get_branch(db, branch_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/branches/{branch_id}", response_model=BranchRead)
def update_branch(
    branch_id: int,
    payload: BranchUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.update_branch(db, branch_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/branches/{branch_id}", response_model=BranchRead)
def delete_branch(
    branch_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.delete_branch(db, branch_id)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if "not found" in str(exc).lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


# -----------------------------------------------------------------
# Batches
# -----------------------------------------------------------------
@router.post("/batches", response_model=BatchRead, status_code=status.HTTP_201_CREATED)
def create_batch(
    payload: BatchCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.create_batch(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/batches", response_model=list[BatchRead])
def list_batches(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    branch_id: int | None = None,
    is_active: bool | None = None,
):
    return AcademicService.list_batches(db, branch_id=branch_id, is_active=is_active)


@router.get("/batches/{batch_id}", response_model=BatchRead)
def get_batch(
    batch_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    try:
        return AcademicService.get_batch(db, batch_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/batches/{batch_id}", response_model=BatchRead)
def update_batch(
    batch_id: int,
    payload: BatchUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.update_batch(db, batch_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/batches/{batch_id}", response_model=BatchRead)
def delete_batch(
    batch_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.delete_batch(db, batch_id)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if "not found" in str(exc).lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


# -----------------------------------------------------------------
# Sections
# -----------------------------------------------------------------
@router.post("/sections", response_model=SectionRead, status_code=status.HTTP_201_CREATED)
def create_section(
    payload: SectionCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.create_section(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/sections", response_model=list[SectionRead])
def list_sections(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    batch_id: int | None = None,
    is_active: bool | None = None,
):
    return AcademicService.list_sections(db, batch_id=batch_id, is_active=is_active)


@router.get("/sections/{section_id}", response_model=SectionRead)
def get_section(
    section_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    try:
        return AcademicService.get_section(db, section_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/sections/{section_id}", response_model=SectionRead)
def update_section(
    section_id: int,
    payload: SectionUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.update_section(db, section_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/sections/{section_id}", response_model=SectionRead)
def delete_section(
    section_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.delete_section(db, section_id)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if "not found" in str(exc).lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


# -----------------------------------------------------------------
# Student Groups (B1, B2)
# -----------------------------------------------------------------
@router.post("/groups", response_model=StudentGroupRead, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: StudentGroupCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.create_group(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/groups", response_model=list[StudentGroupRead])
def list_groups(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    section_id: int | None = None,
    is_active: bool | None = None,
):
    return AcademicService.list_groups(db, section_id=section_id, is_active=is_active)


@router.get("/groups/{group_id}", response_model=StudentGroupRead)
def get_group(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    try:
        return AcademicService.get_group(db, group_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/groups/{group_id}", response_model=StudentGroupRead)
def update_group(
    group_id: int,
    payload: StudentGroupUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.update_group(db, group_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/groups/{group_id}", response_model=StudentGroupRead)
def delete_group(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.delete_group(db, group_id)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if "not found" in str(exc).lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


# -----------------------------------------------------------------
# Academic Enrollments
# -----------------------------------------------------------------
@router.post("/enrollments", response_model=AcademicEnrollmentRead, status_code=status.HTTP_201_CREATED)
def enroll_student(
    payload: AcademicEnrollmentCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.enroll_student(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/enrollments/bulk", response_model=list[AcademicEnrollmentRead], status_code=status.HTTP_201_CREATED)
def bulk_enroll_students(
    payload: AcademicEnrollmentBulkCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.bulk_enroll(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/enrollments", response_model=list[AcademicEnrollmentRead])
def list_enrollments(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))],
    student_id: int | None = None,
    section_id: int | None = None,
    student_group_id: int | None = None,
    branch_id: int | None = None,
    batch_id: int | None = None,
    course_id: int | None = None,
    semester: int | None = None,
    academic_year: str | None = None,
    is_current: bool | None = None,
):
    return AcademicService.list_enrollments(
        db,
        student_id=student_id,
        section_id=section_id,
        student_group_id=student_group_id,
        branch_id=branch_id,
        batch_id=batch_id,
        course_id=course_id,
        semester=semester,
        academic_year=academic_year,
        is_current=is_current,
    )


@router.get("/enrollments/{enrollment_id}", response_model=AcademicEnrollmentRead)
def get_enrollment(
    enrollment_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    try:
        return AcademicService.get_enrollment(db, enrollment_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/enrollments/{enrollment_id}", response_model=AcademicEnrollmentRead)
def update_enrollment(
    enrollment_id: int,
    payload: AcademicEnrollmentUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.update_enrollment(db, enrollment_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/enrollments/{enrollment_id}", response_model=AcademicEnrollmentRead)
def delete_enrollment(
    enrollment_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return AcademicService.delete_enrollment(db, enrollment_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/students/{student_id}/current-enrollment", response_model=AcademicEnrollmentRead | None)
def get_student_current_enrollment(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    return AcademicService.get_student_current_enrollment(db, student_id)
