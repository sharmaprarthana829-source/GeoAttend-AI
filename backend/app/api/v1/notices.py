"""Notice Board API — Phase 10

Endpoints:
- Admin: Create, update, delete, view all notices
- Authenticated Users: View relevant notices (/notices/my)
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import (
    AudienceType,
    Notice,
    User,
    UserRole,
)
from app.schemas import (
    NoticeCreate,
    NoticeDetailRead,
    NoticeRead,
    NoticeUpdate,
)
from app.services.notification import NoticeService

router = APIRouter(prefix="/notices", tags=["notices"])


# ── Authenticated Users: View My Relevant Notices ────────────────────
@router.get("/my", response_model=list[NoticeDetailRead])
def get_my_notices(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    category: str | None = Query(None, description="Filter by notice category"),
    search: str | None = Query(None, description="Search term in title or content"),
):
    return NoticeService.list_user_notices(db, current_user, category=category, search=search)


# ── Admin: Create Notice ─────────────────────────────────────────────
@router.post("", response_model=NoticeDetailRead, status_code=status.HTTP_201_CREATED)
def create_notice(
    payload: NoticeCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        notice = NoticeService.create_notice(db, current_user.id, payload)
        return NoticeService.get_notice_detail(db, notice)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ── Admin: List All Notices ──────────────────────────────────────────
@router.get("", response_model=list[NoticeDetailRead])
def list_notices(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
    is_active: bool | None = None,
    audience_type: AudienceType | None = None,
    category: str | None = Query(None, description="Filter by notice category"),
    search: str | None = Query(None, description="Search term in title or content"),
):
    return NoticeService.list_admin_notices(
        db, is_active=is_active, audience_type=audience_type, category=category, search=search
    )


# ── Authenticated: Get Single Notice (Admin or Eligible Recipient) ──
@router.get("/{notice_id}", response_model=NoticeDetailRead)
def get_notice(
    notice_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notice not found")

    # Admins can view any notice
    if current_user.role == UserRole.ADMIN:
        return NoticeService.get_notice_detail(db, notice)

    # Inactive notices cannot be viewed by non-admins
    if not notice.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notice not found")

    # Non-admins can only view notices matching their audience
    from app.services.notification import NotificationService
    eligible_ids = NotificationService.get_eligible_user_ids_for_notice(db, notice)
    if current_user.id not in eligible_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this notice",
        )

    return NoticeService.get_notice_detail(db, notice)


# ── Admin: Update Notice ─────────────────────────────────────────────
@router.put("/{notice_id}", response_model=NoticeDetailRead)
@router.patch("/{notice_id}", response_model=NoticeDetailRead)
def update_notice(
    notice_id: int,
    payload: NoticeUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        notice = NoticeService.update_notice(db, notice_id, payload, updater_id=current_user.id)
        return NoticeService.get_notice_detail(db, notice)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ── Admin: Delete / Deactivate Notice ────────────────────────────────
@router.delete("/{notice_id}", response_model=NoticeDetailRead)
def delete_notice(
    notice_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        notice = NoticeService.delete_notice(db, notice_id, deleter_id=current_user.id)
        return NoticeService.get_notice_detail(db, notice)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
