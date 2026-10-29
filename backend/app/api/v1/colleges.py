from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models import User, UserRole
from app.schemas import CollegeCreate, CollegeRead
from app.services.auth import CollegeService

router = APIRouter(prefix="/colleges", tags=["colleges"])


@router.get("", response_model=list[CollegeRead])
def list_colleges(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    return CollegeService.list_all(db)


@router.post("", response_model=CollegeRead, status_code=status.HTTP_201_CREATED)
def create_college(
    payload: CollegeCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    try:
        return CollegeService.create(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
