from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import get_db, require_roles
from app.models import User, UserRole
from app.schemas import SystemSettingBatchUpdate, SystemSettingRead, SystemSettingUpdate
from app.services.system_config import SystemConfigService

router = APIRouter(prefix="/system/config", tags=["system-config"])


@router.get("", response_model=list[SystemSettingRead])
def get_system_config(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    """Retrieve all configurable system settings categorized by domain."""
    return SystemConfigService.get_all_settings(db)


@router.put("", response_model=list[SystemSettingRead])
def update_system_config(
    payload: SystemSettingBatchUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    """Update runtime system settings with mandatory audit trail."""
    try:
        SystemConfigService.update_settings(
            db=db,
            updates=payload.settings,
            admin_user=current_user,
            reason=payload.reason,
        )
        return SystemConfigService.get_all_settings(db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/{key}", response_model=SystemSettingRead)
def update_single_system_setting(
    key: str,
    payload: SystemSettingUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    """Update an individual configuration setting."""
    try:
        updated = SystemConfigService.update_settings(
            db=db,
            updates={key: payload.value},
            admin_user=current_user,
            reason=f"Updated configuration key: {key}",
        )
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Setting key not found")
        return updated[0]
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
