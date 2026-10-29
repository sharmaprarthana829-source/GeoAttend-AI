"""008_attendance_applications

Revision ID: 008_attendance_applications
Revises: 007_suspicious_activity
Create Date: 2026-09-01

Creates attendance_applications table for student attendance/debarment application
workflow with multi-stage Faculty and HOD reviews.
"""

from alembic import op
import sqlalchemy as sa

revision = "008_attendance_applications"
down_revision = "007_suspicious_activity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attendance_applications",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("subject_offering_id", sa.Integer(), nullable=False),
        sa.Column("enrollment_id", sa.Integer(), nullable=True),
        sa.Column("reason", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("supporting_document_url", sa.String(500), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "pending_faculty",
                "faculty_approved",
                "faculty_rejected",
                "pending_hod",
                "hod_approved",
                "hod_rejected",
                name="applicationstatus",
            ),
            nullable=False,
            server_default="pending_faculty",
        ),
        sa.Column("faculty_reviewer_id", sa.Integer(), nullable=True),
        sa.Column(
            "faculty_decision",
            sa.Enum("approved", "rejected", name="reviewdecision"),
            nullable=True,
        ),
        sa.Column("faculty_remarks", sa.Text(), nullable=True),
        sa.Column("faculty_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("hod_reviewer_id", sa.Integer(), nullable=True),
        sa.Column(
            "hod_decision",
            sa.Enum("approved", "rejected", name="reviewdecision"),
            nullable=True,
        ),
        sa.Column("hod_remarks", sa.Text(), nullable=True),
        sa.Column("hod_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], name="fk_app_student"),
        sa.ForeignKeyConstraint(["subject_offering_id"], ["subject_offerings.id"], name="fk_app_offering"),
        sa.ForeignKeyConstraint(["enrollment_id"], ["academic_enrollments.id"], name="fk_app_enrollment"),
        sa.ForeignKeyConstraint(["faculty_reviewer_id"], ["faculty.id"], name="fk_app_faculty_rev"),
        sa.ForeignKeyConstraint(["hod_reviewer_id"], ["faculty.id"], name="fk_app_hod_rev"),
    )

    op.create_index("ix_app_student_id", "attendance_applications", ["student_id"])
    op.create_index("ix_app_subject_offering_id", "attendance_applications", ["subject_offering_id"])
    op.create_index("ix_app_enrollment_id", "attendance_applications", ["enrollment_id"])
    op.create_index("ix_app_status", "attendance_applications", ["status"])
    op.create_index("ix_app_faculty_reviewer_id", "attendance_applications", ["faculty_reviewer_id"])
    op.create_index("ix_app_hod_reviewer_id", "attendance_applications", ["hod_reviewer_id"])


def downgrade() -> None:
    op.drop_index("ix_app_hod_reviewer_id", table_name="attendance_applications")
    op.drop_index("ix_app_faculty_reviewer_id", table_name="attendance_applications")
    op.drop_index("ix_app_status", table_name="attendance_applications")
    op.drop_index("ix_app_enrollment_id", table_name="attendance_applications")
    op.drop_index("ix_app_subject_offering_id", table_name="attendance_applications")
    op.drop_index("ix_app_student_id", table_name="attendance_applications")
    op.drop_table("attendance_applications")
