import json
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.orm import Session
from app.models import AuditLog, User


class AuditService:
    @staticmethod
    def log_action(
        db: Session,
        user: User | None,
        action: str,
        entity_type: str,
        entity_id: int | None = None,
        metadata: dict[str, Any] | None = None,
        reason: str | None = None,
    ) -> AuditLog:
        """Create an immutable audit log entry for system and administrative events."""
        metadata_str = json.dumps(metadata) if metadata is not None else None
        user_id = user.id if user else None

        audit_entry = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            reason=reason,
            metadata_json=metadata_str,
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry
