"""Academic structure and student enrollment

Revision ID: 003_academic_structure
Revises: 002_user_roles_and_resp
Create Date: 2026-09-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_academic_structure"
down_revision: Union[str, None] = "002_user_roles_and_resp"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Create courses table if not exists
    if not insp.has_table("courses"):
        op.create_table(
            "courses",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("college_id", sa.Integer(), nullable=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("code", sa.String(length=50), nullable=False),
            sa.Column("duration_years", sa.Integer(), server_default="4", nullable=False),
            sa.Column("total_semesters", sa.Integer(), server_default="8", nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["college_id"], ["colleges.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("code"),
        )
        op.create_index(op.f("ix_courses_college_id"), "courses", ["college_id"], unique=False)

    # 2. Modify departments table (add course_id, college_id)
    dept_cols = [c["name"] for c in insp.get_columns("departments")]
    if "course_id" not in dept_cols:
        op.add_column("departments", sa.Column("course_id", sa.Integer(), nullable=True))
        op.create_foreign_key("fk_departments_course_id", "departments", "courses", ["course_id"], ["id"])
        op.create_index(op.f("ix_departments_course_id"), "departments", ["course_id"], unique=False)
    if "college_id" not in dept_cols:
        op.add_column("departments", sa.Column("college_id", sa.Integer(), nullable=True))
        op.create_foreign_key("fk_departments_college_id", "departments", "colleges", ["college_id"], ["id"])
        op.create_index(op.f("ix_departments_college_id"), "departments", ["college_id"], unique=False)
    op.alter_column("departments", "campus_id", existing_type=sa.Integer(), nullable=True)

    # 3. Create branches table if not exists
    if not insp.has_table("branches"):
        op.create_table(
            "branches",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("department_id", sa.Integer(), nullable=False),
            sa.Column("course_id", sa.Integer(), nullable=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("code", sa.String(length=50), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
            sa.ForeignKeyConstraint(["department_id"], ["departments.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("department_id", "code", name="uq_branch_department_code"),
        )
        op.create_index(op.f("ix_branches_department_id"), "branches", ["department_id"], unique=False)
        op.create_index(op.f("ix_branches_course_id"), "branches", ["course_id"], unique=False)

    # 4. Create batches table if not exists
    if not insp.has_table("batches"):
        op.create_table(
            "batches",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("branch_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("start_year", sa.Integer(), nullable=False),
            sa.Column("end_year", sa.Integer(), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["branch_id"], ["branches.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("branch_id", "name", name="uq_batch_branch_name"),
        )
        op.create_index(op.f("ix_batches_branch_id"), "batches", ["branch_id"], unique=False)

    # 5. Migrate existing data from programs -> courses, branches, batches, and update sections
    sec_cols = [c["name"] for c in insp.get_columns("sections")]
    if "batch_id" not in sec_cols:
        op.add_column("sections", sa.Column("batch_id", sa.Integer(), nullable=True))
    if "capacity" not in sec_cols:
        op.add_column("sections", sa.Column("capacity", sa.Integer(), server_default="60", nullable=False))

    # Check if legacy programs exist to migrate data
    if insp.has_table("programs"):
        programs = bind.execute(sa.text("SELECT id, department_id, name, code, duration_years FROM programs")).fetchall()
        for prog in programs:
            prog_id, dept_id, prog_name, prog_code, duration = prog
            # Create Course if not exists
            course_row = bind.execute(sa.text("SELECT id FROM courses WHERE code = :code"), {"code": prog_code}).fetchone()
            if not course_row:
                bind.execute(
                    sa.text("INSERT INTO courses (name, code, duration_years, total_semesters, is_active, created_at, updated_at) VALUES (:name, :code, :dur, :sem, 1, NOW(), NOW())"),
                    {"name": prog_name, "code": prog_code, "dur": duration, "sem": duration * 2},
                )
                course_id = bind.execute(sa.text("SELECT LAST_INSERT_ID()")).scalar()
            else:
                course_id = course_row[0]

            # Create Branch if not exists
            branch_row = bind.execute(
                sa.text("SELECT id FROM branches WHERE department_id = :dept_id AND code = :code"),
                {"dept_id": dept_id, "code": prog_code},
            ).fetchone()
            if not branch_row:
                bind.execute(
                    sa.text("INSERT INTO branches (department_id, course_id, name, code, is_active, created_at, updated_at) VALUES (:dept_id, :course_id, :name, :code, 1, NOW(), NOW())"),
                    {"dept_id": dept_id, "course_id": course_id, "name": prog_name, "code": prog_code},
                )
                branch_id = bind.execute(sa.text("SELECT LAST_INSERT_ID()")).scalar()
            else:
                branch_id = branch_row[0]

            # Create default Batch for branch
            batch_row = bind.execute(
                sa.text("SELECT id FROM batches WHERE branch_id = :branch_id AND name = '2024-2028'"),
                {"branch_id": branch_id},
            ).fetchone()
            if not batch_row:
                bind.execute(
                    sa.text("INSERT INTO batches (branch_id, name, start_year, end_year, is_active, created_at, updated_at) VALUES (:branch_id, '2024-2028', 2024, 2028, 1, NOW(), NOW())"),
                    {"branch_id": branch_id},
                )
                batch_id = bind.execute(sa.text("SELECT LAST_INSERT_ID()")).scalar()
            else:
                batch_id = batch_row[0]

            # Update sections linked to this program if program_id column still exists
            sec_cols_curr = [c["name"] for c in insp.get_columns("sections")]
            if "program_id" in sec_cols_curr:
                bind.execute(
                    sa.text("UPDATE sections SET batch_id = :batch_id WHERE program_id = :prog_id"),
                    {"batch_id": batch_id, "prog_id": prog_id},
                )

    # Clean up sections table foreign keys and columns
    sec_fks = insp.get_foreign_keys("sections")
    for fk in sec_fks:
        if "program_id" in fk.get("constrained_columns", []):
            op.drop_constraint(fk["name"], "sections", type_="foreignkey")

    sec_indexes = [idx["name"] for idx in insp.get_indexes("sections")]
    if "uq_section_program_batch" in sec_indexes:
        op.drop_index("uq_section_program_batch", table_name="sections")
    if "ix_sections_program_id" in sec_indexes:
        op.drop_index("ix_sections_program_id", table_name="sections")

    sec_cols_after = [c["name"] for c in insp.get_columns("sections")]
    if "program_id" in sec_cols_after:
        op.drop_column("sections", "program_id")
    if "batch_year" in sec_cols_after:
        op.drop_column("sections", "batch_year")

    # Add foreign key constraint and unique index on sections.batch_id
    sec_fks_after = [fk["name"] for fk in insp.get_foreign_keys("sections")]
    if "fk_sections_batch_id" not in sec_fks_after:
        op.create_foreign_key("fk_sections_batch_id", "sections", "batches", ["batch_id"], ["id"])
    
    sec_indexes_after = [idx["name"] for idx in insp.get_indexes("sections")]
    if "ix_sections_batch_id" not in sec_indexes_after:
        op.create_index(op.f("ix_sections_batch_id"), "sections", ["batch_id"], unique=False)
    if "uq_section_batch_name" not in sec_indexes_after:
        op.create_unique_constraint("uq_section_batch_name", "sections", ["batch_id", "name"])

    # Drop legacy programs table if exists
    if insp.has_table("programs"):
        op.drop_table("programs")

    # 6. Create student_groups table (B1, B2)
    if not insp.has_table("student_groups"):
        op.create_table(
            "student_groups",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("section_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=50), nullable=False),
            sa.Column("description", sa.String(length=255), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["section_id"], ["sections.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("section_id", "name", name="uq_student_group_section_name"),
        )
        op.create_index(op.f("ix_student_groups_section_id"), "student_groups", ["section_id"], unique=False)

    # 7. Modify students table (add current_group_id)
    stud_cols = [c["name"] for c in insp.get_columns("students")]
    if "current_group_id" not in stud_cols:
        op.add_column("students", sa.Column("current_group_id", sa.Integer(), nullable=True))
        op.create_foreign_key("fk_students_current_group_id", "students", "student_groups", ["current_group_id"], ["id"])
        op.create_index(op.f("ix_students_current_group_id"), "students", ["current_group_id"], unique=False)

    # 8. Create academic_enrollments table
    if not insp.has_table("academic_enrollments"):
        op.create_table(
            "academic_enrollments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("student_id", sa.Integer(), nullable=False),
            sa.Column("course_id", sa.Integer(), nullable=False),
            sa.Column("branch_id", sa.Integer(), nullable=False),
            sa.Column("batch_id", sa.Integer(), nullable=False),
            sa.Column("section_id", sa.Integer(), nullable=False),
            sa.Column("student_group_id", sa.Integer(), nullable=True),
            sa.Column("semester", sa.Integer(), nullable=False),
            sa.Column("academic_year", sa.String(length=20), nullable=False),
            sa.Column(
                "status",
                sa.Enum("active", "completed", "dropped", "suspended", name="enrollmentstatus"),
                server_default="active",
                nullable=False,
            ),
            sa.Column("is_current", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("enrolled_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["batch_id"], ["batches.id"]),
            sa.ForeignKeyConstraint(["branch_id"], ["branches.id"]),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
            sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
            sa.ForeignKeyConstraint(["student_group_id"], ["student_groups.id"]),
            sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("student_id", "semester", "academic_year", name="uq_enrollment_student_semester_year"),
        )
        op.create_index(op.f("ix_academic_enrollments_student_id"), "academic_enrollments", ["student_id"], unique=False)
        op.create_index(op.f("ix_academic_enrollments_course_id"), "academic_enrollments", ["course_id"], unique=False)
        op.create_index(op.f("ix_academic_enrollments_branch_id"), "academic_enrollments", ["branch_id"], unique=False)
        op.create_index(op.f("ix_academic_enrollments_batch_id"), "academic_enrollments", ["batch_id"], unique=False)
        op.create_index(op.f("ix_academic_enrollments_section_id"), "academic_enrollments", ["section_id"], unique=False)
        op.create_index(op.f("ix_academic_enrollments_student_group_id"), "academic_enrollments", ["student_group_id"], unique=False)
        op.create_index(op.f("ix_academic_enrollments_semester"), "academic_enrollments", ["semester"], unique=False)
        op.create_index(op.f("ix_academic_enrollments_academic_year"), "academic_enrollments", ["academic_year"], unique=False)
        op.create_index(op.f("ix_academic_enrollments_status"), "academic_enrollments", ["status"], unique=False)
        op.create_index(op.f("ix_academic_enrollments_is_current"), "academic_enrollments", ["is_current"], unique=False)


def downgrade() -> None:
    op.drop_table("academic_enrollments")
    op.execute("DROP TYPE IF EXISTS enrollmentstatus")
    op.drop_table("student_groups")
    op.drop_column("students", "current_group_id")
    op.drop_table("batches")
    op.drop_table("branches")
    op.drop_column("departments", "college_id")
    op.drop_column("departments", "course_id")
    op.drop_table("courses")
