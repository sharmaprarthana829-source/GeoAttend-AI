from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import (
    Notification,
    NotificationType,
    User,
)
from app.schemas import (
    DevicePushTokenRead,
    DevicePushTokenRegister,
    NotificationBatchReadResponse,
    NotificationCounts,
    NotificationRead,
    PushNotificationDispatchPayload,
)
from app.services.notification import NotificationService
from app.services.push_notification import PushNotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ── Authenticated Users: View My Notifications ───────────────────────
@router.get("/my", response_model=list[NotificationRead])
def get_my_notifications(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    is_read: bool | None = Query(default=None),
    notification_type: NotificationType | None = Query(default=None),
    search: str | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return NotificationService.list_user_notifications(
        db=db,
        user_id=current_user.id,
        is_read=is_read,
        notification_type=notification_type,
        search=search,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )


# ── Authenticated Users: Get Notification Counts ─────────────────────
@router.get("/counts", response_model=NotificationCounts)
def get_my_notification_counts(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return NotificationService.get_user_notification_counts(db, current_user.id)


# ── Authenticated Users: Mark Single Notification as Read ───────────
@router.patch("/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(
    notification_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    try:
        return NotificationService.mark_as_read(db, notification_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ── Authenticated Users: Mark All Notifications as Read ─────────────
@router.patch("/read-all", response_model=NotificationBatchReadResponse)
def mark_all_notifications_read(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    count = NotificationService.mark_all_as_read(db, current_user.id)
    return NotificationBatchReadResponse(
        marked_count=count,
        message=f"Marked {count} notifications as read",
    )


# ── Push Notifications: Device Token Registration ────────────────────
@router.post("/push-token", response_model=DevicePushTokenRead, status_code=status.HTTP_201_CREATED)
def register_device_push_token(
    payload: DevicePushTokenRegister,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Registers an FCM push notification token for the current user's mobile device."""
    return PushNotificationService.register_token(
        db=db,
        user=current_user,
        fcm_token=payload.fcm_token,
        platform=payload.platform,
        device_id=payload.device_id,
    )


# ── Push Notifications: Device Token Removal ─────────────────────────
@router.delete("/push-token")
def unregister_device_push_token(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    token: str | None = None,
    fcm_token: str | None = None,
):
    """Deactivates an FCM device token upon logout to stop receiving notifications."""
    effective_token = (token or fcm_token or "").strip()
    if len(effective_token) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token parameter is required and must be at least 5 characters",
        )

    success = PushNotificationService.unregister_token(
        db=db,
        user=current_user,
        fcm_token=effective_token,
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Push token not found for current user")
    return {"success": True, "message": "Device push token unregistered successfully"}


# ── Authenticated Users: Delete / Dismiss Notification ──────────────
@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    try:
        NotificationService.delete_notification(db, notification_id, current_user.id)
        return {"success": True, "message": "Notification deleted successfully"}
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ── Push Notifications: Send Test Push to Current User ───────────────
@router.post("/test-push")
def send_test_push(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    payload: PushNotificationDispatchPayload | None = None,
):
    """Dispatches a test push notification to all active devices registered under current user."""
    tokens = PushNotificationService.get_user_tokens(db, current_user.id)
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active device push tokens registered for current user. Please register an FCM token first.",
        )

    title = payload.title if payload and payload.title else "🔔 GeoAttend Test Notification"
    body = (
        payload.body
        if payload and payload.body
        else f"Hello {current_user.full_name}, push notifications are working smoothly on your device!"
    )
    data = payload.data if payload and payload.data else {"type": "test_ping", "click_action": "/dashboard"}

    result = PushNotificationService.send_multicast(
        db=db,
        tokens=tokens,
        title=title,
        body=body,
        data=data,
    )
    return {
        "success": True,
        "dispatched": True,
        "recipient_count": len(tokens),
        "result": result,
    }


