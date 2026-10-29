"""012_device_push_tokens

Revision ID: 012_device_push_tokens
Revises: 011_notices_enhancement
Create Date: 2026-10-29

Adds device_push_tokens table to register and manage Firebase Cloud Messaging (FCM)
device tokens per user for cross-platform background push notifications.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "012_device_push_tokens"
down_revision = "011_notices_enhancement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = Inspector.from_engine(bind)
    tables = insp.get_table_names()

    if "device_push_tokens" not in tables:
        op.create_table(
            "device_push_tokens",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("device_id", sa.String(255), nullable=True, index=True),
            sa.Column("fcm_token", sa.String(512), nullable=False, unique=True, index=True),
            sa.Column("platform", sa.String(50), nullable=False, server_default="android"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1"), index=True),
            sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = Inspector.from_engine(bind)
    tables = insp.get_table_names()

    if "device_push_tokens" in tables:
        op.drop_table("device_push_tokens")
