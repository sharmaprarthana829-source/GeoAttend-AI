"""007_suspicious_activity

Revision ID: 007_suspicious_activity
Revises: 006_attendance_engine
Create Date: 2026-09-01

Creates suspicious_activities table for rule-based attendance anomaly detection,
deterministic risk scoring, and faculty/admin review workflows.
"""

from alembic import op
import sqlalchemy as sa

revision = "007_suspicious_activity"
down_revision = "006_attendance_engine"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "suspicious_activities",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("attendance_record_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column(
            "detection_method",
            sa.Enum("gps", "wifi", "bluetooth", "device", "timing", "multi_signal", name="detectionmethod"),
            nullable=False,
        ),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("raw_signals", sa.Text(), nullable=True),
        sa.Column(
            "review_status",
            sa.Enum("pending", "reviewed", "dismissed", "confirmed", name="reviewstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewer_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["attendance_record_id"], ["attendance_records.id"], name="fk_susp_att_record"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], name="fk_susp_student"),
        sa.ForeignKeyConstraint(["session_id"], ["attendance_sessions.id"], name="fk_susp_session"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], name="fk_susp_reviewer"),
    )

    op.create_index("ix_susp_att_record_id", "suspicious_activities", ["attendance_record_id"])
    op.create_index("ix_susp_student_id", "suspicious_activities", ["student_id"])
    op.create_index("ix_susp_session_id", "suspicious_activities", ["session_id"])
    op.create_index("ix_susp_detection_method", "suspicious_activities", ["detection_method"])
    op.create_index("ix_susp_review_status", "suspicious_activities", ["review_status"])
    op.create_index("ix_susp_reviewed_by", "suspicious_activities", ["reviewed_by"])


def downgrade() -> None:
    op.drop_index("ix_susp_reviewed_by", table_name="suspicious_activities")
    op.drop_index("ix_susp_review_status", table_name="suspicious_activities")
    op.drop_index("ix_susp_detection_method", table_name="suspicious_activities")
    op.drop_index("ix_susp_session_id", table_name="suspicious_activities")
    op.drop_index("ix_susp_student_id", table_name="suspicious_activities")
    op.drop_index("ix_susp_att_record_id", table_name="suspicious_activities")
    op.drop_table("suspicious_activities")
