"""Push Notification Service via Firebase Cloud Messaging (FCM).

Handles:
1. Cross-platform device push token registration and unregistration.
2. Secure credential loading (from environment variable or secure service account file).
3. Dry-run and live multicast message dispatch for urgent notices, application workflow, and attendance shortfall alerts.
4. Auto-pruning of expired / invalidated tokens.
"""

from datetime import datetime, timezone
import json
import logging
import os
from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    DevicePushToken,
    Notice,
    Notification,
    NotificationType,
    StudentProfile,
    SubjectOffering,
    User,
)

logger = logging.getLogger(__name__)

# Firebase App state
_firebase_initialized = False
_firebase_app = None


def get_firebase_app():
    """Initializes and returns Firebase Admin SDK App singleton.

    Loads credentials securely from FIREBASE_CREDENTIALS_PATH or FIREBASE_SERVICE_ACCOUNT_JSON.
    Returns None if credentials are not configured (gracefully enabling mock / dry-run dispatch).
    """
    global _firebase_initialized, _firebase_app
    if _firebase_initialized:
        return _firebase_app

    try:
        import firebase_admin
        from firebase_admin import credentials

        cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
        cred_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")

        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            _firebase_app = firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK successfully initialized from certificate path.")
        elif cred_json:
            cred_dict = json.loads(cred_json)
            cred = credentials.Certificate(cred_dict)
            _firebase_app = firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK successfully initialized from JSON environment variable.")
        else:
            logger.info(
                "No Firebase service account credentials provided in environment. "
                "Operating in safe dry-run / simulated push notification mode."
            )
            _firebase_app = None
    except Exception as exc:
        logger.warning(f"Firebase initialization bypassed: {exc}")
        _firebase_app = None

    _firebase_initialized = True
    return _firebase_app


class PushNotificationService:
    # ── Token Registration & Management ──────────────────────────────
    @staticmethod
    def register_token(
        db: Session,
        user: User,
        fcm_token: str,
        platform: str = "android",
        device_id: str | None = None,
    ) -> DevicePushToken:
        """Registers or refreshes an FCM device token for the authenticated user."""
        token_clean = fcm_token.strip()
        now = datetime.now(timezone.utc)

        existing = db.query(DevicePushToken).filter(DevicePushToken.fcm_token == token_clean).first()
        if existing:
            existing.user_id = user.id
            existing.platform = platform.lower()
            existing.device_id = device_id
            existing.is_active = True
            existing.last_used_at = now
            db.commit()
            db.refresh(existing)
            logger.info(f"Updated existing push token #{existing.id} for user #{user.id}")
            return existing

        new_token = DevicePushToken(
            user_id=user.id,
            fcm_token=token_clean,
            platform=platform.lower(),
            device_id=device_id,
            is_active=True,
            last_used_at=now,
        )
        db.add(new_token)
        db.commit()
        db.refresh(new_token)
        logger.info(f"Registered new push token #{new_token.id} for user #{user.id}")
        return new_token

    @staticmethod
    def unregister_token(db: Session, user: User, fcm_token: str) -> bool:
        """Deactivates an FCM device token on user logout."""
        token_clean = fcm_token.strip()
        record = (
            db.query(DevicePushToken)
            .filter(
                DevicePushToken.user_id == user.id,
                DevicePushToken.fcm_token == token_clean,
            )
            .first()
        )
        if record:
            record.is_active = False
            db.commit()
            logger.info(f"Unregistered push token #{record.id} for user #{user.id}")
            return True
        return False

    @staticmethod
    def get_user_tokens(db: Session, user_id: int) -> list[str]:
        """Returns all active FCM tokens for a user."""
        records = (
            db.query(DevicePushToken.fcm_token)
            .filter(
                DevicePushToken.user_id == user_id,
                DevicePushToken.is_active.is_(True),
            )
            .all()
        )
        return [r[0] for r in records]

    # ── Dispatch Engine ──────────────────────────────────────────────
    @staticmethod
    def send_multicast(
        db: Session,
        tokens: list[str],
        title: str,
        body: str,
        data: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Dispatches a push notification to multiple device tokens via FCM or dry-run simulator."""
        if not tokens:
            return {"success_count": 0, "failure_count": 0, "simulated": False}

        unique_tokens = list(set(tokens))
        app = get_firebase_app()
        payload_data = data or {}

        # Safe Simulated / Dry-run dispatch when no Google Cloud key is bound
        if app is None:
            logger.info(
                f"[Simulated Push Dispatch] Title: '{title}', Body: '{body}', "
                f"Targets: {len(unique_tokens)} device(s), Data: {payload_data}"
            )
            return {
                "success_count": len(unique_tokens),
                "failure_count": 0,
                "simulated": True,
                "title": title,
                "body": body,
            }

        # Real Firebase Cloud Messaging Dispatch
        try:
            from firebase_admin import messaging

            message = messaging.MulticastMessage(
                notification=messaging.Notification(title=title, body=body),
                data=payload_data,
                tokens=unique_tokens,
            )
            response = messaging.send_each_for_multicast(message)

            # Auto-prune dead/unregistered tokens
            failed_tokens = []
            for idx, resp in enumerate(response.responses):
                if not resp.success:
                    err_code = getattr(resp.exception, "code", "")
                    if "registration-token-not-registered" in str(resp.exception) or err_code == "UNREGISTERED":
                        failed_tokens.append(unique_tokens[idx])

            if failed_tokens:
                db.query(DevicePushToken).filter(DevicePushToken.fcm_token.in_(failed_tokens)).update(
                    {"is_active": False}, synchronize_session=False
                )
                db.commit()
                logger.info(f"Pruned {len(failed_tokens)} stale FCM tokens.")

            return {
                "success_count": response.success_count,
                "failure_count": response.failure_count,
                "simulated": False,
            }
        except Exception as e:
            logger.error(f"FCM Multicast error: {e}")
            return {"success_count": 0, "failure_count": len(unique_tokens), "error": str(e)}

    # ── High-Level Event Dispatches ──────────────────────────────────
    @staticmethod
    def dispatch_urgent_notice(db: Session, notice: Notice) -> dict[str, Any]:
        """Dispatches real-time push notification for an urgent notice."""
        # Find all user IDs who received in-app notification for this notice
        recipient_user_ids = (
            db.query(Notification.user_id)
            .filter(
                Notification.notification_type == NotificationType.NOTICE,
                Notification.related_entity_id == notice.id,
            )
            .distinct()
            .all()
        )
        user_ids = [r[0] for r in recipient_user_ids]
        if not user_ids:
            return {"dispatched": 0}

        tokens = (
            db.query(DevicePushToken.fcm_token)
            .filter(
                DevicePushToken.user_id.in_(user_ids),
                DevicePushToken.is_active.is_(True),
            )
            .all()
        )
        token_list = [t[0] for t in tokens]

        return PushNotificationService.send_multicast(
            db=db,
            tokens=token_list,
            title=f"🚨 Urgent: {notice.title}",
            body=notice.content[:150] + ("..." if len(notice.content) > 150 else ""),
            data={
                "type": "urgent_notice",
                "notice_id": str(notice.id),
                "category": notice.category or "Urgent",
                "click_action": "/dashboard/notices",
            },
        )

    @staticmethod
    def dispatch_application_status_update(
        db: Session,
        application_id: int,
        student_user_id: int,
        new_status: str,
        reviewer_role: str,
    ) -> dict[str, Any]:
        """Dispatches real-time push notification to student upon application review."""
        tokens = PushNotificationService.get_user_tokens(db, student_user_id)
        if not tokens:
            return {"dispatched": 0}

        title_map = {
            "faculty_approved": "Application Approved by Faculty",
            "coordinator_approved": "Application Verified by Coordinator",
            "approved": "Condonation Granted by HOD",
            "hod_approved": "Condonation Granted by HOD",
            "rejected": "Attendance Application Rejected",
        }
        title = title_map.get(new_status.lower(), f"Application Status Updated: {new_status}")
        body = f"Your attendance condonation application #{application_id} has been reviewed by the {reviewer_role.title()}."

        return PushNotificationService.send_multicast(
            db=db,
            tokens=tokens,
            title=title,
            body=body,
            data={
                "type": "application_update",
                "application_id": str(application_id),
                "status": new_status,
                "click_action": "/dashboard/applications",
            },
        )

    @staticmethod
    def dispatch_shortfall_alert(
        db: Session,
        student_id: int,
        subject_offering_id: int,
        attendance_percentage: float,
        threshold_percentage: float = 75.0,
    ) -> dict[str, Any]:
        """Dispatches attendance shortfall warning push notification to student."""
        student = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
        if not student:
            return {"dispatched": 0}

        offering = db.query(SubjectOffering).filter(SubjectOffering.id == subject_offering_id).first()
        subj_name = offering.subject.name if offering and offering.subject else "Subject"

        tokens = PushNotificationService.get_user_tokens(db, student.user_id)
        if not tokens:
            return {"dispatched": 0}

        title = f"⚠️ Attendance Shortfall Warning: {subj_name}"
        body = (
            f"Your attendance is currently {attendance_percentage:.1f}%, below the required "
            f"{threshold_percentage:.1f}% threshold for exam eligibility."
        )

        return PushNotificationService.send_multicast(
            db=db,
            tokens=tokens,
            title=title,
            body=body,
            data={
                "type": "attendance_shortfall",
                "offering_id": str(subject_offering_id),
                "attendance_percentage": f"{attendance_percentage:.1f}",
                "click_action": "/dashboard/attendance",
            },
        )


push_notification_service = PushNotificationService()

