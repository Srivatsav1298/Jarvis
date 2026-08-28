"""conversation metadata

Revision ID: b6f959828a7b
Revises: cbe2c4024f3d
Create Date: 2026-08-04 00:30:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b6f959828a7b"
down_revision: str | Sequence[str] | None = "cbe2c4024f3d"
branch_labels: str | Sequence[str] | None = ("conversation_metadata",)
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add conversation metadata columns."""
    op.add_column(
        "conversations",
        sa.Column(
            "pinned", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
    )
    op.add_column(
        "conversations", sa.Column("created_by", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "conversations", sa.Column("last_model", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "conversations",
        sa.Column("last_activity", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "conversations",
        sa.Column(
            "message_count", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
    )


def downgrade() -> None:
    """Drop conversation metadata columns."""
    for column in (
        "message_count",
        "last_activity",
        "last_model",
        "created_by",
        "pinned",
    ):
        op.drop_column("conversations", column)
