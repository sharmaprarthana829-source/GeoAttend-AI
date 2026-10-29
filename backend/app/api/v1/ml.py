"""ML Pipeline Management & Admin Retraining API — Phase 17

Provides:
- POST /api/v1/ml/retrain: Admin-only authenticated endpoint for model retraining.
- GET  /api/v1/ml/retrain/status: Admin-only check on running or latest retraining job.
- GET  /api/v1/ml/status: Faculty & Admin status endpoint for ML model metadata.
"""

from datetime import datetime, timezone
import logging
import threading
from typing import Annotated, Any
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import SessionLocal, get_db
from app.models import User, UserRole
from app.ml.config import MIN_SAMPLES_ISOLATION_FOREST
from app.ml.model_manager import ModelManager
from app.ml.schemas import (
    MLModelStatus,
    MLRetrainRequest,
    MLRetrainResponse,
    MLRetrainStatusResponse,
)
from app.ml.train_pipeline import run_training_pipeline
from app.services.audit import AuditService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ml", tags=["ml"])

_retrain_lock = threading.Lock()
_job_state: dict[str, Any] = {
    "is_retraining": False,
    "last_job_id": None,
    "last_status": None,
    "last_run_at": None,
    "last_result": None,
}


def _execute_retraining_job(
    job_id: str,
    user_id: int,
    min_samples: int,
    allow_test_data: bool,
) -> None:
    """Worker function executed either synchronously or via BackgroundTasks."""
    global _job_state
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        result = run_training_pipeline(
            db=db,
            min_samples=min_samples,
            allow_test_data=allow_test_data,
        )

        now_iso = datetime.now(timezone.utc).isoformat()
        _job_state["last_run_at"] = now_iso
        _job_state["last_result"] = result

        if result.get("success"):
            _job_state["last_status"] = "success"
            ModelManager.get_instance().reload()
            if user:
                AuditService.log_action(
                    db=db,
                    user=user,
                    action="ML_RETRAIN_COMPLETED",
                    entity_type="ML_MODEL",
                    entity_id=None,
                    reason=f"Model retraining job {job_id} completed and promoted artifact.",
                    metadata={
                        "job_id": job_id,
                        "model_version": result.get("model_version"),
                        "training_samples": result.get("training_samples"),
                    },
                )
        else:
            _job_state["last_status"] = result.get("status", "halted")
            if user:
                AuditService.log_action(
                    db=db,
                    user=user,
                    action="ML_RETRAIN_HALTED",
                    entity_type="ML_MODEL",
                    entity_id=None,
                    reason=result.get("message", "Model retraining halted."),
                    metadata={
                        "job_id": job_id,
                        "status": result.get("status"),
                        "eligible_count": result.get("eligible_record_count"),
                    },
                )

    except Exception as exc:
        logger.error(f"[MLRetrainJob {job_id}] Execution error: {exc}", exc_info=True)
        _job_state["last_status"] = "failed"
        _job_state["last_result"] = {"error": str(exc)}
    finally:
        _job_state["is_retraining"] = False
        if _retrain_lock.locked():
            _retrain_lock.release()
        db.close()


# ── Admin-Only: Trigger ML Retraining ────────────────────────────────
@router.post("/retrain", response_model=MLRetrainResponse)
def trigger_ml_retraining(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
    payload: MLRetrainRequest | None = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Enforces authenticated ADMIN-only access to trigger model retraining.

    Prevents concurrent training jobs using non-blocking synchronization.
    """
    global _job_state
    acquired = _retrain_lock.acquire(blocking=False)
    if not acquired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A model retraining job is already in progress. Please wait for completion.",
        )

    job_id = f"job_ml_{uuid.uuid4().hex[:8]}"
    _job_state["is_retraining"] = True
    _job_state["last_job_id"] = job_id
    _job_state["last_status"] = "in_progress"

    req = payload or MLRetrainRequest()
    min_samples = req.min_samples or MIN_SAMPLES_ISOLATION_FOREST
    allow_test_data = req.allow_test_data

    # Log initiation in audit trail
    AuditService.log_action(
        db=db,
        user=current_user,
        action="ML_RETRAIN_REQUESTED",
        entity_type="ML_MODEL",
        entity_id=None,
        reason=f"Admin initiated ML retraining job {job_id}",
        metadata={"min_samples": min_samples, "allow_test_data": allow_test_data},
    )

    if req.run_async:
        background_tasks.add_task(
            _execute_retraining_job,
            job_id=job_id,
            user_id=current_user.id,
            min_samples=min_samples,
            allow_test_data=allow_test_data,
        )
        return MLRetrainResponse(
            status="in_progress",
            message=f"Model retraining job {job_id} scheduled in background.",
            job_id=job_id,
            details={"min_samples": min_samples, "allow_test_data": allow_test_data},
        )

    # Synchronous execution
    try:
        _execute_retraining_job(
            job_id=job_id,
            user_id=current_user.id,
            min_samples=min_samples,
            allow_test_data=allow_test_data,
        )
        result = _job_state["last_result"] or {}
        st = _job_state["last_status"] or "unknown"
        msg = result.get("message", "Retraining completed.")
        return MLRetrainResponse(
            status=st,
            message=msg,
            job_id=job_id,
            details=result,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Retraining execution error: {exc}",
        ) from exc


# ── Admin-Only: Check Retraining Job Status ──────────────────────────
@router.get("/retrain/status", response_model=MLRetrainStatusResponse)
def get_retrain_status(
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    """Exposes current retraining worker activity and last job results."""
    return MLRetrainStatusResponse(
        is_retraining=_job_state["is_retraining"],
        last_job_id=_job_state["last_job_id"],
        last_status=_job_state["last_status"],
        last_run_at=_job_state["last_run_at"],
        last_result=_job_state["last_result"],
    )


# ── Faculty & Admin: Get Active Model Metadata ───────────────────────
@router.get("/status", response_model=MLModelStatus)
def get_ml_status(
    _: Annotated[User, Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN))],
):
    """Exposes currently loaded ML model status, version, and readiness metadata."""
    manager = ModelManager.get_instance()
    return manager.get_status()
