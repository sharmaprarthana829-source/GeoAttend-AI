"""User roles consolidation and faculty responsibilities

Revision ID: 002_user_roles_and_resp
Revises: 001_initial
Create Date: 2026-09-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_user_roles_and_resp"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Create faculty_responsibilities table if not exists
    if not insp.has_table("faculty_responsibilities"):
        op.create_table(
            "faculty_responsibilities",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("faculty_id", sa.Integer(), nullable=False),
            sa.Column(
                "responsibility_type",
                sa.Enum("professor", "hod", "dean", "principal", "coordinator", name="responsibilitytype"),
                nullable=False,
            ),
            sa.Column(
                "scope_type",
                sa.Enum("college", "department", name="scopetype"),
                nullable=False,
                server_default="department",
            ),
            sa.Column("college_id", sa.Integer(), nullable=True),
            sa.Column("department_id", sa.Integer(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["faculty_id"], ["faculty.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["college_id"], ["colleges.id"]),
            sa.ForeignKeyConstraint(["department_id"], ["departments.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_faculty_responsibilities_faculty_id"), "faculty_responsibilities", ["faculty_id"], unique=False)
        op.create_index(op.f("ix_faculty_responsibilities_responsibility_type"), "faculty_responsibilities", ["responsibility_type"], unique=False)
        op.create_index(op.f("ix_faculty_responsibilities_is_active"), "faculty_responsibilities", ["is_active"], unique=False)
        op.create_index(op.f("ix_faculty_responsibilities_college_id"), "faculty_responsibilities", ["college_id"], unique=False)
        op.create_index(op.f("ix_faculty_responsibilities_department_id"), "faculty_responsibilities", ["department_id"], unique=False)

    # 2. Drop hod_user_id foreign key and column from departments safely
    dept_cols = [c["name"] for c in insp.get_columns("departments")]
    if "hod_user_id" in dept_cols:
        if bind.dialect.name == "mysql":
            res = bind.execute(
                sa.text(
                    "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE "
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'departments' AND COLUMN_NAME = 'hod_user_id'"
                )
            ).fetchall()
            for row in res:
                op.drop_constraint(row[0], "departments", type_="foreignkey")
        else:
            try:
                op.drop_constraint("departments_ibfk_2", "departments", type_="foreignkey")
            except Exception:
                pass
        op.drop_column("departments", "hod_user_id")

    # 3. Safely migrate ENUM in MySQL:
    # First widen enum to accept 'admin', then update data, then narrow enum to ('admin', 'faculty', 'student')
    if bind.dialect.name == "mysql":
        op.execute(
            "ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'college_admin', 'principal', 'hod', 'faculty', 'student', 'admin') NOT NULL"
        )
        op.execute("UPDATE users SET role = 'admin' WHERE role IN ('super_admin', 'college_admin', 'principal')")
        op.execute("UPDATE users SET role = 'faculty' WHERE role = 'hod'")
        op.execute("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'faculty', 'student') NOT NULL")
    else:
        op.execute("UPDATE users SET role = 'admin' WHERE role IN ('super_admin', 'college_admin', 'principal')")
        op.execute("UPDATE users SET role = 'faculty' WHERE role = 'hod'")
        op.alter_column(
            "users",
            "role",
            existing_type=sa.Enum("super_admin", "college_admin", "principal", "hod", "faculty", "student", name="userrole"),
            type_=sa.Enum("admin", "faculty", "student", name="userrole"),
            nullable=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "mysql":
        op.execute(
            "ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'college_admin', 'principal', 'hod', 'faculty', 'student') NOT NULL"
        )

    op.add_column("departments", sa.Column("hod_user_id", sa.Integer(), nullable=True))
    op.create_foreign_key("departments_ibfk_2", "departments", "users", ["hod_user_id"], ["id"])

    op.drop_table("faculty_responsibilities")
    op.execute("DROP TYPE IF EXISTS responsibilitytype")
    op.execute("DROP TYPE IF EXISTS scopetype")
