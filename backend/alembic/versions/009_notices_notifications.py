"""009_notices_notifications

Revision ID: 009_notices_notifications
Revises: 008_attendance_applications
Create Date: 2026-09-01

Creates notices and notifications tables for audience-targeted announcements
and user-specific notifications.
"""

from alembic import op
import sqlalchemy as sa

revision = "009_notices_notifications"
down_revision = "008_attendance_applications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Create notices table ──────────────────────────────────────
    op.create_table(
        "notices",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column(
            "audience_type",
            sa.Enum("all", "students", "faculty", "department", "branch", "group", name="audiencetype"),
            nullable=False,
        ),
        sa.Column("department_id", sa.Integer(), nullable=True),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("student_group_id", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_notice_creator"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], name="fk_notice_dept"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], name="fk_notice_branch"),
        sa.ForeignKeyConstraint(["student_group_id"], ["student_groups.id"], name="fk_notice_group"),
    )

    op.create_index("ix_notice_created_by", "notices", ["created_by"])
    op.create_index("ix_notice_audience_type", "notices", ["audience_type"])
    op.create_index("ix_notice_department_id", "notices", ["department_id"])
    op.create_index("ix_notice_branch_id", "notices", ["branch_id"])
    op.create_index("ix_notice_student_group_id", "notices", ["student_group_id"])
    op.create_index("ix_notice_is_active", "notices", ["is_active"])

    # ── 2. Create notifications table ────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "notification_type",
            sa.Enum("notice", "attendance", "application", "system", name="notificationtype"),
            nullable=False,
            server_default="notice",
        ),
        sa.Column("related_entity_id", sa.Integer(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_notif_user"),
    )

    op.create_index("ix_notif_user_id", "notifications", ["user_id"])
    op.create_index("ix_notif_notification_type", "notifications", ["notification_type"])
    op.create_index("ix_notif_related_entity_id", "notifications", ["related_entity_id"])
    op.create_index("ix_notif_is_read", "notifications", ["is_read"])


def downgrade() -> None:
    op.drop_index("ix_notif_is_read", table_name="notifications")
    op.drop_index("ix_notif_related_entity_id", table_name="notifications")
    op.drop_index("ix_notif_notification_type", table_name="notifications")
    op.drop_index("ix_notif_user_id", table_name="notifications")
    op.drop_table("notifications")

    op.drop_index("ix_notice_is_active", table_name="notices")
    op.drop_index("ix_notice_student_group_id", table_name="notices")
    op.drop_index("ix_notice_branch_id", table_name="notices")
    op.drop_index("ix_notice_department_id", table_name="notices")
    op.drop_index("ix_notice_audience_type", table_name="notices")
    op.drop_index("ix_notice_created_by", table_name="notices")
    op.drop_table("notices")
