"""Timetable engine and conflict validation

Revision ID: 005_timetable_engine
Revises: 004_subject_master_and_offerings
Create Date: 2026-09-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_timetable_engine"
down_revision: Union[str, None] = "004_subject_master_and_offerings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if not insp.has_table("timetable_entries"):
        op.create_table(
            "timetable_entries",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("subject_offering_id", sa.Integer(), nullable=False),
            sa.Column("faculty_assignment_id", sa.Integer(), nullable=False),
            sa.Column("section_id", sa.Integer(), nullable=False),
            sa.Column("student_group_id", sa.Integer(), nullable=True),
            sa.Column(
                "class_type",
                sa.Enum("theory", "lab", name="classtype"),
                server_default="theory",
                nullable=False,
            ),
            sa.Column(
                "day_of_week",
                sa.Enum("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", name="dayofweek"),
                nullable=False,
            ),
            sa.Column("start_time", sa.Time(), nullable=False),
            sa.Column("end_time", sa.Time(), nullable=False),
            sa.Column("room_number", sa.String(length=50), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["faculty_assignment_id"], ["faculty_assignments.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
            sa.ForeignKeyConstraint(["student_group_id"], ["student_groups.id"]),
            sa.ForeignKeyConstraint(["subject_offering_id"], ["subject_offerings.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_timetable_entries_subject_offering_id"), "timetable_entries", ["subject_offering_id"], unique=False)
        op.create_index(op.f("ix_timetable_entries_faculty_assignment_id"), "timetable_entries", ["faculty_assignment_id"], unique=False)
        op.create_index(op.f("ix_timetable_entries_section_id"), "timetable_entries", ["section_id"], unique=False)
        op.create_index(op.f("ix_timetable_entries_student_group_id"), "timetable_entries", ["student_group_id"], unique=False)
        op.create_index(op.f("ix_timetable_entries_class_type"), "timetable_entries", ["class_type"], unique=False)
        op.create_index(op.f("ix_timetable_entries_day_of_week"), "timetable_entries", ["day_of_week"], unique=False)
        op.create_index(op.f("ix_timetable_entries_start_time"), "timetable_entries", ["start_time"], unique=False)
        op.create_index(op.f("ix_timetable_entries_end_time"), "timetable_entries", ["end_time"], unique=False)
        op.create_index(op.f("ix_timetable_entries_room_number"), "timetable_entries", ["room_number"], unique=False)
        op.create_index(op.f("ix_timetable_entries_is_active"), "timetable_entries", ["is_active"], unique=False)


def downgrade() -> None:
    op.drop_table("timetable_entries")
    op.execute("DROP TYPE IF EXISTS dayofweek")
