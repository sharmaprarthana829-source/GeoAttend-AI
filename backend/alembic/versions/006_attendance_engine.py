"""006_attendance_engine

Revision ID: 006_attendance_engine
Revises: 005_timetable_engine
Create Date: 2026-09-01

Adds timetable-linked attendance columns to attendance_sessions,
verification_json to attendance_records, and COMPLETED status
to the sessionstatus enum.
"""

from alembic import op
import sqlalchemy as sa

revision = "006_attendance_engine"
down_revision = "005_timetable_engine"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Add COMPLETED to sessionstatus enum (MySQL) ───────────────
    op.execute("ALTER TABLE attendance_sessions MODIFY COLUMN status ENUM('scheduled','active','completed','closed','cancelled') NOT NULL DEFAULT 'active'")

    # ── 2. Add new columns to attendance_sessions ────────────────────
    op.add_column("attendance_sessions", sa.Column("timetable_entry_id", sa.Integer(), nullable=True))
    op.add_column("attendance_sessions", sa.Column("subject_offering_id", sa.Integer(), nullable=True))
    op.add_column("attendance_sessions", sa.Column("faculty_assignment_id", sa.Integer(), nullable=True))
    op.add_column("attendance_sessions", sa.Column("student_group_id", sa.Integer(), nullable=True))
    op.add_column("attendance_sessions", sa.Column("class_type", sa.Enum("theory", "lab", name="classtype"), nullable=True))
    op.add_column("attendance_sessions", sa.Column("room_number", sa.String(50), nullable=True))

    # Make previously non-nullable columns nullable for backward compat
    op.alter_column("attendance_sessions", "subject_id", existing_type=sa.Integer(), nullable=True)
    op.alter_column("attendance_sessions", "campus_id", existing_type=sa.Integer(), nullable=True)
    op.alter_column("attendance_sessions", "geofence_latitude", existing_type=sa.Float(), nullable=True)
    op.alter_column("attendance_sessions", "geofence_longitude", existing_type=sa.Float(), nullable=True)
    op.alter_column("attendance_sessions", "geofence_radius_meters", existing_type=sa.Integer(), nullable=True)

    # Foreign keys
    op.create_foreign_key("fk_attsess_timetable", "attendance_sessions", "timetable_entries", ["timetable_entry_id"], ["id"])
    op.create_foreign_key("fk_attsess_offering", "attendance_sessions", "subject_offerings", ["subject_offering_id"], ["id"])
    op.create_foreign_key("fk_attsess_facasgn", "attendance_sessions", "faculty_assignments", ["faculty_assignment_id"], ["id"])
    op.create_foreign_key("fk_attsess_group", "attendance_sessions", "student_groups", ["student_group_id"], ["id"])

    # Indexes
    op.create_index("ix_attsess_timetable_entry_id", "attendance_sessions", ["timetable_entry_id"])
    op.create_index("ix_attsess_subject_offering_id", "attendance_sessions", ["subject_offering_id"])
    op.create_index("ix_attsess_faculty_assignment_id", "attendance_sessions", ["faculty_assignment_id"])
    op.create_index("ix_attsess_student_group_id", "attendance_sessions", ["student_group_id"])
    op.create_index("ix_attsess_class_type", "attendance_sessions", ["class_type"])

    # ── 3. Add verification_json to attendance_records ───────────────
    op.add_column("attendance_records", sa.Column("verification_json", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("attendance_records", "verification_json")

    op.drop_index("ix_attsess_class_type", table_name="attendance_sessions")
    op.drop_index("ix_attsess_student_group_id", table_name="attendance_sessions")
    op.drop_index("ix_attsess_faculty_assignment_id", table_name="attendance_sessions")
    op.drop_index("ix_attsess_subject_offering_id", table_name="attendance_sessions")
    op.drop_index("ix_attsess_timetable_entry_id", table_name="attendance_sessions")

    op.drop_constraint("fk_attsess_group", "attendance_sessions", type_="foreignkey")
    op.drop_constraint("fk_attsess_facasgn", "attendance_sessions", type_="foreignkey")
    op.drop_constraint("fk_attsess_offering", "attendance_sessions", type_="foreignkey")
    op.drop_constraint("fk_attsess_timetable", "attendance_sessions", type_="foreignkey")

    op.alter_column("attendance_sessions", "geofence_radius_meters", existing_type=sa.Integer(), nullable=False)
    op.alter_column("attendance_sessions", "geofence_longitude", existing_type=sa.Float(), nullable=False)
    op.alter_column("attendance_sessions", "geofence_latitude", existing_type=sa.Float(), nullable=False)
    op.alter_column("attendance_sessions", "campus_id", existing_type=sa.Integer(), nullable=False)
    op.alter_column("attendance_sessions", "subject_id", existing_type=sa.Integer(), nullable=False)

    op.drop_column("attendance_sessions", "room_number")
    op.drop_column("attendance_sessions", "class_type")
    op.drop_column("attendance_sessions", "student_group_id")
    op.drop_column("attendance_sessions", "faculty_assignment_id")
    op.drop_column("attendance_sessions", "subject_offering_id")
    op.drop_column("attendance_sessions", "timetable_entry_id")

    op.execute("ALTER TABLE attendance_sessions MODIFY COLUMN status ENUM('scheduled','active','closed','cancelled') NOT NULL DEFAULT 'active'")
