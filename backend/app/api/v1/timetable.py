from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import ClassType, DayOfWeek, User, UserRole
from app.schemas import (
    ConflictValidationRequest,
    ConflictValidationResponse,
    TimetableConflictSummary,
    TimetableEntryCreate,
    TimetableEntryDetailRead,
    TimetableEntryRead,
    TimetableEntryUpdate,
    TimetableUploadResponse,
)
from app.services.timetable import TimetableService

router = APIRouter(prefix="/timetable", tags=["timetable"])


class CSVUploadRequest(BaseModel):
    csv_data: str | None = None
    csv_content: str | None = None


# -----------------------------------------------------------------
# Conflict Inspection & Summaries (Placed before dynamic {entry_id})
# -----------------------------------------------------------------
@router.post("/validate-conflicts", response_model=ConflictValidationResponse)
def validate_timetable_conflicts(
    payload: ConflictValidationRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))],
):
    """Inspect prospective timetable entry for conflicts prior to persistence."""
    return TimetableService.validate_conflicts(db, payload)


@router.get("/conflict-summary", response_model=TimetableConflictSummary)
def get_conflict_summary(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    """Retrieve system-wide conflict breakdown counts."""
    return TimetableService.get_conflict_summary(db)


# -----------------------------------------------------------------
# Timetable CRUD
# -----------------------------------------------------------------
@router.post("", response_model=TimetableEntryRead, status_code=status.HTTP_201_CREATED)
def create_timetable_entry(
    payload: TimetableEntryCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return TimetableService.create_entry(db, payload, current_user=current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("", response_model=list[TimetableEntryDetailRead])
def list_timetable_entries(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    query: str | None = None,
    section_id: int | None = None,
    faculty_id: int | None = None,
    day_of_week: DayOfWeek | None = None,
    room_number: str | None = None,
    class_type: ClassType | None = None,
    conflict_status: str | None = None,
    is_active: bool | None = None,
):
    return TimetableService.list_entries(
        db,
        section_id=section_id,
        faculty_id=faculty_id,
        day_of_week=day_of_week,
        room_number=room_number,
        class_type=class_type,
        conflict_status=conflict_status,
        query_str=query,
        is_active=is_active,
    )


# -----------------------------------------------------------------
# Role-Specific Schedule Endpoints (Placed before dynamic {entry_id})
# -----------------------------------------------------------------
@router.get("/today/faculty", response_model=list[TimetableEntryDetailRead])
@router.get("/faculty/today", response_model=list[TimetableEntryDetailRead])
def get_today_faculty_schedule(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FACULTY))],
):
    if not current_user.faculty_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")
    return TimetableService.get_today_faculty_schedule(db, current_user.faculty_profile.id)


@router.get("/today/student", response_model=list[TimetableEntryDetailRead])
@router.get("/student/today", response_model=list[TimetableEntryDetailRead])
def get_today_student_schedule(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.STUDENT))],
):
    if not current_user.student_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
    return TimetableService.get_today_student_schedule(db, current_user.student_profile.id)


@router.get("/section/{section_id}", response_model=list[TimetableEntryDetailRead])
def get_section_schedule(
    section_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    day_of_week: DayOfWeek | None = None,
):
    return TimetableService.list_entries(db, section_id=section_id, day_of_week=day_of_week, is_active=True)


@router.get("/faculty/{faculty_id}", response_model=list[TimetableEntryDetailRead])
def get_faculty_schedule(
    faculty_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    day_of_week: DayOfWeek | None = None,
):
    return TimetableService.list_entries(db, faculty_id=faculty_id, day_of_week=day_of_week, is_active=True)


# -----------------------------------------------------------------
# CSV Upload Endpoints
# -----------------------------------------------------------------
@router.post("/upload", response_model=TimetableUploadResponse)
@router.post("/upload-csv", response_model=TimetableUploadResponse)
def upload_timetable_csv(
    payload: CSVUploadRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    content = payload.csv_data or payload.csv_content or ""
    res = TimetableService.upload_csv(db, content, current_user=current_user)
    if res.errors:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "CSV validation failed", "errors": res.errors})
    return res


@router.post("/upload-file", response_model=TimetableUploadResponse)
async def upload_timetable_csv_file(
    file: UploadFile,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    content = await file.read()
    csv_text = content.decode("utf-8")
    res = TimetableService.upload_csv(db, csv_text, current_user=current_user)
    if res.errors:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "CSV validation failed", "errors": res.errors})
    return res


# -----------------------------------------------------------------
# Entry Specific Operations
# -----------------------------------------------------------------
@router.get("/{entry_id}", response_model=TimetableEntryDetailRead)
def get_timetable_entry(
    entry_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    try:
        return TimetableService.get_entry(db, entry_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/{entry_id}", response_model=TimetableEntryRead)
def update_timetable_entry(
    entry_id: int,
    payload: TimetableEntryUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return TimetableService.update_entry(db, entry_id, payload, current_user=current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{entry_id}", response_model=TimetableEntryRead)
def delete_timetable_entry(
    entry_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return TimetableService.delete_entry(db, entry_id, current_user=current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
