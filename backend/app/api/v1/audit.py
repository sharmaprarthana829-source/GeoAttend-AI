from datetime import datetime, time, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from app.core.deps import get_db, require_roles
from app.models import AuditLog, User, UserRole
from app.schemas import AuditLogRead

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs", response_model=list[AuditLogRead])
def get_audit_logs(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
    response: Response,
    query: str | None = Query(None, description="Search across action, entity, reason, and actor"),
    action: str | None = Query(None, description="Filter by action name"),
    entity_type: str | None = Query(None, description="Filter by entity type"),
    entity_id: int | None = Query(None, description="Filter by entity ID"),
    user_id: int | None = Query(None, description="Filter by actor user ID"),
    role: str | None = Query(None, description="Filter by actor role"),
    actor_name: str | None = Query(None, description="Filter by actor name or email"),
    start_date: str | None = Query(None, description="Filter start date (YYYY-MM-DD or ISO)"),
    end_date: str | None = Query(None, description="Filter end date (YYYY-MM-DD or ISO)"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Retrieve immutable system audit logs for administrative review with full filtering and pagination."""
    base_query = db.query(AuditLog).outerjoin(User, AuditLog.user_id == User.id)

    if action:
        base_query = base_query.filter(AuditLog.action.ilike(f"%{action.strip()}%"))
    if entity_type:
        base_query = base_query.filter(AuditLog.entity_type.ilike(f"%{entity_type.strip()}%"))
    if entity_id is not None:
        base_query = base_query.filter(AuditLog.entity_id == entity_id)
    if user_id is not None:
        base_query = base_query.filter(AuditLog.user_id == user_id)
    if role:
        base_query = base_query.filter(User.role == role.strip().lower())
    if actor_name:
        actor_term = f"%{actor_name.strip()}%"
        base_query = base_query.filter(
            or_(
                User.full_name.ilike(actor_term),
                User.email.ilike(actor_term),
            )
        )
    if query:
        q_term = f"%{query.strip()}%"
        base_query = base_query.filter(
            or_(
                AuditLog.action.ilike(q_term),
                AuditLog.entity_type.ilike(q_term),
                AuditLog.reason.ilike(q_term),
                User.full_name.ilike(q_term),
                User.email.ilike(q_term),
            )
        )

    if start_date:
        try:
            if len(start_date.strip()) == 10:
                s_date = datetime.strptime(start_date.strip(), "%Y-%m-%d").date()
                s_dt = datetime.combine(s_date, time.min).replace(tzinfo=timezone.utc)
            else:
                s_dt = datetime.fromisoformat(start_date.strip().replace("Z", "+00:00"))
            base_query = base_query.filter(AuditLog.created_at >= s_dt)
        except Exception:
            pass

    if end_date:
        try:
            if len(end_date.strip()) == 10:
                e_date = datetime.strptime(end_date.strip(), "%Y-%m-%d").date()
                e_dt = datetime.combine(e_date, time.max).replace(tzinfo=timezone.utc)
            else:
                e_dt = datetime.fromisoformat(end_date.strip().replace("Z", "+00:00"))
            base_query = base_query.filter(AuditLog.created_at <= e_dt)
        except Exception:
            pass

    total_count = base_query.count()
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    logs = (
        base_query.options(joinedload(AuditLog.user))
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    results = []
    for log in logs:
        user_name = log.user.full_name if log.user else "System Automated"
        user_email = log.user.email if log.user else None
        user_role = log.user.role.value if (log.user and hasattr(log.user.role, "value")) else (log.user.role if log.user else None)
        results.append(
            AuditLogRead(
                id=log.id,
                user_id=log.user_id,
                user_name=user_name,
                user_email=user_email,
                user_role=user_role,
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                reason=log.reason,
                metadata_json=log.metadata_json,
                created_at=log.created_at,
            )
        )
    return results
