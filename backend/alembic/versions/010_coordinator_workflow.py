"""010_coordinator_workflow

Revision ID: 010_coordinator_workflow
Revises: 009_notices_notifications
Create Date: 2026-10-27

Adds Section Coordinator review stage to attendance_applications table and updates
workflow status enum to include pending_coordinator, approved, and rejected.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "010_coordinator_workflow"
down_revision = "009_notices_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = Inspector.from_engine(bind)
    cols = [c["name"] for c in insp.get_columns("attendance_applications")]

    if "coordinator_reviewer_id" not in cols:
        op.add_column("attendance_applications", sa.Column("coordinator_reviewer_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_app_coordinator_rev",
            "attendance_applications",
            "faculty",
            ["coordinator_reviewer_id"],
            ["id"],
        )
        op.create_index("ix_app_coordinator_reviewer_id", "attendance_applications", ["coordinator_reviewer_id"])

    if "coordinator_decision" not in cols:
        op.add_column(
            "attendance_applications",
            sa.Column(
                "coordinator_decision",
                sa.Enum("approved", "rejected", name="reviewdecision"),
                nullable=True,
            ),
        )

    if "coordinator_remarks" not in cols:
        op.add_column("attendance_applications", sa.Column("coordinator_remarks", sa.Text(), nullable=True))

    if "coordinator_reviewed_at" not in cols:
        op.add_column("attendance_applications", sa.Column("coordinator_reviewed_at", sa.DateTime(timezone=True), nullable=True))

    op.execute(
        "ALTER TABLE attendance_applications MODIFY COLUMN status "
        "ENUM('pending_faculty','pending_coordinator','pending_hod','approved','rejected',"
        "'faculty_approved','faculty_rejected','hod_approved','hod_rejected') "
        "NOT NULL DEFAULT 'pending_faculty'"
    )


def downgrade() -> None:
    op.drop_constraint("fk_app_coordinator_rev", "attendance_applications", type_="foreignkey")
    op.drop_index("ix_app_coordinator_reviewer_id", table_name="attendance_applications")
    op.drop_column("attendance_applications", "coordinator_reviewed_at")
    op.drop_column("attendance_applications", "coordinator_remarks")
    op.drop_column("attendance_applications", "coordinator_decision")
    op.drop_column("attendance_applications", "coordinator_reviewer_id")
    op.execute(
        "ALTER TABLE attendance_applications MODIFY COLUMN status "
        "ENUM('pending_faculty','faculty_approved','faculty_rejected','pending_hod','hod_approved','hod_rejected') "
        "NOT NULL DEFAULT 'pending_faculty'"
    )
