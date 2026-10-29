"""Subject master, subject offerings, and faculty assignments

Revision ID: 004_subject_master_and_offerings
Revises: 003_academic_structure
Create Date: 2026-09-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_subject_master_and_offerings"
down_revision: Union[str, None] = "003_academic_structure"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Modify subjects table
    sub_cols = [c["name"] for c in insp.get_columns("subjects")]
    if "description" not in sub_cols:
        op.add_column("subjects", sa.Column("description", sa.Text(), nullable=True))

    op.alter_column("subjects", "department_id", existing_type=sa.Integer(), nullable=True)

    sub_indexes = [idx["name"] for idx in insp.get_indexes("subjects")]
    if "uq_subject_department_code" in sub_indexes:
        op.drop_index("uq_subject_department_code", table_name="subjects")

    # Add unique constraint on subjects.code if not exists
    if "uq_subjects_code" not in sub_indexes and "code" not in [c for idx in insp.get_indexes("subjects") if idx.get("unique") for c in idx.get("column_names", [])]:
        op.create_unique_constraint("uq_subjects_code", "subjects", ["code"])

    # 2. Create subject_offerings table
    if not insp.has_table("subject_offerings"):
        op.create_table(
            "subject_offerings",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("subject_id", sa.Integer(), nullable=False),
            sa.Column("course_id", sa.Integer(), nullable=False),
            sa.Column("semester", sa.Integer(), nullable=False),
            sa.Column("branch_id", sa.Integer(), nullable=False),
            sa.Column("section_id", sa.Integer(), nullable=False),
            sa.Column("student_group_id", sa.Integer(), nullable=True),
            sa.Column(
                "class_type",
                sa.Enum("theory", "lab", name="classtype"),
                server_default="theory",
                nullable=False,
            ),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["branch_id"], ["branches.id"]),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
            sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
            sa.ForeignKeyConstraint(["student_group_id"], ["student_groups.id"]),
            sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "subject_id",
                "section_id",
                "student_group_id",
                "class_type",
                "semester",
                name="uq_subject_offering_unique",
            ),
        )
        op.create_index(op.f("ix_subject_offerings_subject_id"), "subject_offerings", ["subject_id"], unique=False)
        op.create_index(op.f("ix_subject_offerings_course_id"), "subject_offerings", ["course_id"], unique=False)
        op.create_index(op.f("ix_subject_offerings_semester"), "subject_offerings", ["semester"], unique=False)
        op.create_index(op.f("ix_subject_offerings_branch_id"), "subject_offerings", ["branch_id"], unique=False)
        op.create_index(op.f("ix_subject_offerings_section_id"), "subject_offerings", ["section_id"], unique=False)
        op.create_index(op.f("ix_subject_offerings_student_group_id"), "subject_offerings", ["student_group_id"], unique=False)
        op.create_index(op.f("ix_subject_offerings_class_type"), "subject_offerings", ["class_type"], unique=False)
        op.create_index(op.f("ix_subject_offerings_is_active"), "subject_offerings", ["is_active"], unique=False)

    # 3. Create faculty_assignments table
    if not insp.has_table("faculty_assignments"):
        op.create_table(
            "faculty_assignments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("faculty_id", sa.Integer(), nullable=False),
            sa.Column("subject_offering_id", sa.Integer(), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["faculty_id"], ["faculty.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["subject_offering_id"], ["subject_offerings.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("faculty_id", "subject_offering_id", name="uq_faculty_assignment_unique"),
        )
        op.create_index(op.f("ix_faculty_assignments_faculty_id"), "faculty_assignments", ["faculty_id"], unique=False)
        op.create_index(op.f("ix_faculty_assignments_subject_offering_id"), "faculty_assignments", ["subject_offering_id"], unique=False)
        op.create_index(op.f("ix_faculty_assignments_is_active"), "faculty_assignments", ["is_active"], unique=False)


def downgrade() -> None:
    op.drop_table("faculty_assignments")
    op.drop_table("subject_offerings")
    op.execute("DROP TYPE IF EXISTS classtype")
    op.drop_column("subjects", "description")
