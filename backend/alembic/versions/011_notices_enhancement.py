"""011_notices_enhancement

Revision ID: 011_notices_enhancement
Revises: 010_coordinator_workflow
Create Date: 2026-10-29

Enhances Notice Board with category and expiry dates, adds coordinators to audience_type enum,
and safely cleans up duplicate notice records.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "011_notices_enhancement"
down_revision = "010_coordinator_workflow"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = Inspector.from_engine(bind)
    cols = [c["name"] for c in insp.get_columns("notices")]

    # 1. Add category column if not present
    if "category" not in cols:
        op.add_column(
            "notices",
            sa.Column("category", sa.String(50), nullable=True, server_default="General"),
        )
        op.create_index("ix_notice_category", "notices", ["category"])

    # 2. Add expires_at column if not present
    if "expires_at" not in cols:
        op.add_column(
            "notices",
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        )

    # 3. Extend audience_type enum to include 'coordinators'
    dialect = bind.dialect.name
    if dialect == "mysql":
        op.execute(
            "ALTER TABLE notices MODIFY COLUMN audience_type "
            "ENUM('all', 'students', 'faculty', 'department', 'branch', 'group', 'coordinators') NOT NULL"
        )

    # 4. Safe cleanup of confirmed duplicate notice records
    # Preserves canonical notice (ID 163) and removes identical duplicate (ID 164)
    # Re-points any notifications referencing ID 164 to 163 before deletion
    try:
        op.execute(
            "UPDATE notifications SET related_entity_id = 163 "
            "WHERE related_entity_id = 164 AND notification_type = 'notice'"
        )
        op.execute("DELETE FROM notices WHERE id = 164")
    except Exception:
        pass


def downgrade() -> None:
    bind = op.get_bind()
    insp = Inspector.from_engine(bind)
    cols = [c["name"] for c in insp.get_columns("notices")]

    if "category" in cols:
        op.drop_index("ix_notice_category", table_name="notices")
        op.drop_column("notices", "category")

    if "expires_at" in cols:
        op.drop_column("notices", "expires_at")

    dialect = bind.dialect.name
    if dialect == "mysql":
        op.execute(
            "ALTER TABLE notices MODIFY COLUMN audience_type "
            "ENUM('all', 'students', 'faculty', 'department', 'branch', 'group') NOT NULL"
        )
