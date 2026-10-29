import json
from typing import Any
from sqlalchemy.orm import Session
from app.models import SystemSetting, User
from app.services.audit import AuditService

DEFAULT_CONFIGS = [
    # Attendance
    {"category": "attendance", "key": "attendance_grace_period_minutes", "value": "10", "value_type": "int", "description": "Grace period after session start for on-time check-in (minutes)"},
    {"category": "attendance", "key": "late_threshold_minutes", "value": "20", "value_type": "int", "description": "Threshold after session start where check-in is marked late (minutes)"},
    {"category": "attendance", "key": "default_session_duration_minutes", "value": "50", "value_type": "int", "description": "Default class session duration (minutes)"},
    {"category": "attendance", "key": "minimum_attendance_percentage", "value": "75.0", "value_type": "float", "description": "Minimum required attendance percentage for exam eligibility"},
    # GPS & Geofence
    {"category": "gps", "key": "default_geofence_radius_meters", "value": "100", "value_type": "int", "description": "Default classroom geofence radius (meters)"},
    {"category": "gps", "key": "max_allowed_gps_accuracy_meters", "value": "50.0", "value_type": "float", "description": "Maximum acceptable GPS accuracy error (meters)"},
    # QR Token
    {"category": "qr", "key": "qr_rotation_interval_seconds", "value": "30", "value_type": "int", "description": "Frequency of dynamic QR code cryptographic token rotation"},
    {"category": "qr", "key": "qr_expiry_grace_seconds", "value": "10", "value_type": "int", "description": "Grace window for newly expired QR token verification"},
    # AI / ML
    {"category": "ml", "key": "rule_score_weight", "value": "0.60", "value_type": "float", "description": "Weight of heuristic rule engine in hybrid risk scoring (0.0 to 1.0)"},
    {"category": "ml", "key": "ml_score_weight", "value": "0.40", "value_type": "float", "description": "Weight of Isolation Forest ML model in hybrid risk scoring (0.0 to 1.0)"},
    {"category": "ml", "key": "high_risk_threshold", "value": "70.0", "value_type": "float", "description": "Risk score above which check-in is flagged for priority faculty review"},
    # Wi-Fi & Indoor Fallback
    {"category": "wifi", "key": "enable_wifi_geofence_fallback", "value": "true", "value_type": "bool", "description": "Enable authorized institutional Wi-Fi matching as fallback for indoor GPS attenuation"},
    {"category": "wifi", "key": "authorized_campus_wifi_ssids", "value": "GeoAttend-Campus,Campus-WiFi,Eduroam,CSD-Dept-Mesh", "value_type": "str", "description": "Comma-separated list of authorized institutional Wi-Fi network SSIDs"},
    {"category": "wifi", "key": "authorized_campus_wifi_bssids", "value": "70:3a:0e:*,00:1a:2b:*,24:f5:a2:*", "value_type": "str", "description": "Comma-separated list of authorized institutional Wi-Fi AP BSSIDs (supports wildcard prefix)"},
    {"category": "gps", "key": "indoor_accuracy_slack_meters", "value": "30.0", "value_type": "float", "description": "Indoor GPS horizontal drift tolerance buffer (meters)"},
    # Device & Security
    {"category": "device", "key": "single_device_binding_enforced", "value": "true", "value_type": "bool", "description": "Enforce strict 1-student-to-1-hardware-UUID binding"},
    {"category": "device", "key": "allow_student_self_reregistration", "value": "false", "value_type": "bool", "description": "Allow students to switch devices without admin reset"},
]


class SystemConfigService:
    @staticmethod
    def initialize_defaults(db: Session) -> None:
        """Seed default configuration settings if they do not exist."""
        for cfg in DEFAULT_CONFIGS:
            existing = db.query(SystemSetting).filter(SystemSetting.key == cfg["key"]).first()
            if not existing:
                db.add(SystemSetting(
                    category=cfg["category"],
                    key=cfg["key"],
                    value=cfg["value"],
                    value_type=cfg["value_type"],
                    description=cfg["description"],
                    is_public=False,
                ))
        db.commit()

    @staticmethod
    def get_all_settings(db: Session) -> list[SystemSetting]:
        SystemConfigService.initialize_defaults(db)
        return db.query(SystemSetting).order_by(SystemSetting.category, SystemSetting.key).all()

    @staticmethod
    def get_setting(db: Session, key: str, default: Any = None) -> Any:
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if not setting:
            return default
        if setting.value_type == "int":
            return int(setting.value)
        if setting.value_type == "float":
            return float(setting.value)
        if setting.value_type == "bool":
            return setting.value.lower() in ("true", "1", "yes")
        if setting.value_type == "json":
            return json.loads(setting.value)
        return setting.value

    @staticmethod
    def update_settings(
        db: Session,
        updates: dict[str, str],
        admin_user: User,
        reason: str | None = None,
    ) -> list[SystemSetting]:
        if not reason or not reason.strip():
            raise ValueError("Administrative reason is mandatory for audit logging.")
        if len(reason.strip()) < 3:
            raise ValueError("Administrative reason must be at least 3 characters long.")

        current_settings = {s.key: s for s in db.query(SystemSetting).all()}
        merged_values = {k: s.value for k, s in current_settings.items()}

        for key, value in updates.items():
            setting = current_settings.get(key)
            if not setting:
                raise ValueError(f"Unknown system configuration key: '{key}'")

            val_str = str(value).strip()
            if not val_str:
                raise ValueError(f"Setting '{key}' cannot be empty.")

            if setting.value_type == "int":
                try:
                    int_val = int(val_str)
                except ValueError:
                    raise ValueError(f"Setting '{key}' must be a valid integer, got '{val_str}'")

                if int_val < 0:
                    raise ValueError(f"Setting '{key}' cannot be negative (got {int_val})")

                if key == "default_session_duration_minutes" and int_val <= 0:
                    raise ValueError("Default session duration must be greater than 0 minutes.")
                if key == "default_geofence_radius_meters" and int_val <= 0:
                    raise ValueError("Default geofence radius must be greater than 0 meters.")
                if key == "qr_rotation_interval_seconds" and int_val < 5:
                    raise ValueError("QR rotation interval must be at least 5 seconds.")

                merged_values[key] = str(int_val)

            elif setting.value_type == "float":
                try:
                    float_val = float(val_str)
                except ValueError:
                    raise ValueError(f"Setting '{key}' must be a valid number, got '{val_str}'")

                if key in ("minimum_attendance_percentage", "high_risk_threshold"):
                    if not (0.0 <= float_val <= 100.0):
                        raise ValueError(f"Setting '{key}' must be between 0.0 and 100.0, got {float_val}")

                elif key in ("rule_score_weight", "ml_score_weight"):
                    if not (0.0 <= float_val <= 1.0):
                        raise ValueError(f"Setting '{key}' must be between 0.0 and 1.0, got {float_val}")

                elif key == "max_allowed_gps_accuracy_meters":
                    if float_val <= 0.0:
                        raise ValueError("Maximum allowed GPS accuracy error must be greater than 0.0 meters.")

                merged_values[key] = str(float_val)

            elif setting.value_type == "bool":
                normalized = val_str.lower()
                if normalized not in ("true", "false", "1", "0", "yes", "no"):
                    raise ValueError(f"Setting '{key}' must be a boolean ('true' or 'false'), got '{val_str}'")
                merged_values[key] = "true" if normalized in ("true", "1", "yes") else "false"

            else:
                merged_values[key] = val_str

        # Check logical relationship between late threshold and grace period
        try:
            grace = int(merged_values.get("attendance_grace_period_minutes", 10))
            late = int(merged_values.get("late_threshold_minutes", 20))
            if late < grace:
                raise ValueError(
                    f"Late threshold ({late}m) cannot be less than the attendance grace period ({grace}m)."
                )
        except ValueError as exc:
            if "cannot be less than" in str(exc):
                raise exc

        updated_records = []
        old_values = {}
        for key, value in updates.items():
            setting = current_settings.get(key)
            if setting:
                old_values[key] = setting.value
                setting.value = merged_values[key]
                setting.updated_by_id = admin_user.id
                updated_records.append(setting)
        db.commit()

        # Audit log the configuration changes
        AuditService.log_action(
            db=db,
            user=admin_user,
            action="UPDATE_SYSTEM_CONFIG",
            entity_type="SYSTEM_SETTING",
            metadata={"updates": updates, "old_values": old_values},
            reason=reason.strip(),
        )
        return updated_records
