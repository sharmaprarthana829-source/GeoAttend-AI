from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import ClassType, User, UserRole
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
from app.services.subject import SubjectService

router = APIRouter(tags=["subjects"])


# -----------------------------------------------------------------
# Master Subjects (/subjects)
# -----------------------------------------------------------------
@router.post("/subjects", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: SubjectCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return SubjectService.create_subject(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/subjects", response_model=list[SubjectRead])
def list_subjects(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    department_id: int | None = Query(None),
    is_active: bool | None = Query(None),
    query: str | None = Query(None),
):
    return SubjectService.list_subjects(
        db, department_id=department_id, is_active=is_active, query=query
    )


@router.get("/subjects/{subject_id}", response_model=SubjectRead)
def get_subject(
    subject_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    try:
        return SubjectService.get_subject(db, subject_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/subjects/{subject_id}", response_model=SubjectRead)
def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return SubjectService.update_subject(db, subject_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/subjects/{subject_id}", response_model=SubjectRead)
def delete_subject(
    subject_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return SubjectService.delete_subject(db, subject_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# -----------------------------------------------------------------
# Subject Offerings (/subject-offerings)
# -----------------------------------------------------------------
@router.post("/subject-offerings", response_model=SubjectOfferingRead, status_code=status.HTTP_201_CREATED)
def create_offering(
    payload: SubjectOfferingCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return SubjectService.create_offering(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/subject-offerings", response_model=list[SubjectOfferingRead])
def list_offerings(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    subject_id: int | None = Query(None),
    course_id: int | None = Query(None),
    branch_id: int | None = Query(None),
    batch_id: int | None = Query(None),
    section_id: int | None = Query(None),
    semester: int | None = Query(None),
    class_type: str | None = Query(None),
    is_active: bool | None = Query(None),
    query: str | None = Query(None),
):
    return SubjectService.list_offerings(
        db,
        subject_id=subject_id,
        course_id=course_id,
        branch_id=branch_id,
        batch_id=batch_id,
        section_id=section_id,
        semester=semester,
        class_type=class_type,
        is_active=is_active,
        query=query,
    )


@router.get("/subject-offerings/{offering_id}", response_model=SubjectOfferingRead)
def get_offering(
    offering_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    try:
        return SubjectService.get_offering(db, offering_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/subject-offerings/{offering_id}", response_model=SubjectOfferingRead)
def update_offering(
    offering_id: int,
    payload: SubjectOfferingUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return SubjectService.update_offering(db, offering_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/subject-offerings/{offering_id}", response_model=SubjectOfferingRead)
def delete_offering(
    offering_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return SubjectService.delete_offering(db, offering_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# -----------------------------------------------------------------
# Faculty Assignments (/faculty-assignments)
# -----------------------------------------------------------------
@router.post("/faculty-assignments", response_model=FacultyAssignmentRead, status_code=status.HTTP_201_CREATED)
def assign_faculty(
    payload: FacultyAssignmentCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return SubjectService.assign_faculty(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/faculty-assignments", response_model=list[FacultyAssignmentRead])
def list_assignments(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))],
    faculty_id: int | None = Query(None),
    subject_offering_id: int | None = Query(None),
    is_active: bool | None = Query(None),
    query: str | None = Query(None),
):
    return SubjectService.list_assignments(
        db,
        faculty_id=faculty_id,
        subject_offering_id=subject_offering_id,
        is_active=is_active,
        query=query,
    )


@router.get("/faculty-assignments/my", response_model=list[FacultyAssignmentDetailRead])
def get_my_assignments(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
):
    if not current_user.faculty_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")
    return SubjectService.get_faculty_assigned_classes(db, current_user.faculty_profile.id)


@router.get("/faculty-assignments/by-faculty/{faculty_id}", response_model=list[FacultyAssignmentDetailRead])
def get_assignments_by_faculty(
    faculty_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))],
):
    return SubjectService.get_faculty_assigned_classes(db, faculty_id)


@router.get("/faculty-assignments/{assignment_id}", response_model=FacultyAssignmentRead)
def get_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    try:
        return SubjectService.get_assignment(db, assignment_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/faculty-assignments/{assignment_id}", response_model=FacultyAssignmentRead)
def update_assignment(
    assignment_id: int,
    payload: FacultyAssignmentUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return SubjectService.update_assignment(db, assignment_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/faculty-assignments/{assignment_id}", response_model=FacultyAssignmentRead)
def delete_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return SubjectService.delete_assignment(db, assignment_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
