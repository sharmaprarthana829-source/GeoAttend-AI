from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models import FacultyResponsibility, ResponsibilityType, User, UserRole

security_scheme = HTTPBearer()


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    try:
        payload = decode_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials") from exc

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user = db.query(User).filter(User.email == payload.get("sub"), User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_roles(*roles: UserRole):
    def role_checker(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return role_checker


def require_faculty_responsibility(*responsibilities: ResponsibilityType):
    def responsibility_checker(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[Session, Depends(get_db)],
    ) -> User:
        if current_user.role == UserRole.ADMIN:
            return current_user

        if current_user.role != UserRole.FACULTY or not current_user.faculty_profile:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions: Faculty designation required",
            )

        active_resp = (
            db.query(FacultyResponsibility)
            .filter(
                FacultyResponsibility.faculty_id == current_user.faculty_profile.id,
                FacultyResponsibility.responsibility_type.in_(responsibilities),
                FacultyResponsibility.is_active.is_(True),
            )
            .first()
        )
        if not active_resp:
            required_str = ", ".join(r.value for r in responsibilities)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: Required active responsibility: {required_str}",
            )
        return current_user

    return responsibility_checker
