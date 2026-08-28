"""job listings table

Revision ID: 7a1c9f2d8e4b
Revises: b6f959828a7b
Create Date: 2026-08-06 07:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7a1c9f2d8e4b"
down_revision: str | Sequence[str] | None = "b6f959828a7b"
branch_labels: str | Sequence[str] | None = ("job_listings",)
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the jobs table."""
    op.create_table(
        "jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("dedupe_key", sa.String(length=300), nullable=False),
        sa.Column("company", sa.String(length=200), nullable=False),
        sa.Column("role", sa.String(length=200), nullable=False),
        sa.Column("location", sa.String(length=200), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("posted_days_ago", sa.Integer(), nullable=False),
        sa.Column("skills", sa.JSON(), nullable=True),
        sa.Column("ai_summary", sa.Text(), nullable=False),
        sa.Column("match", sa.Integer(), nullable=False),
        sa.Column("ai_recommendation", sa.String(length=20), nullable=False),
        sa.Column("salary", sa.JSON(), nullable=True),
        sa.Column("visa_sponsor", sa.Boolean(), nullable=False),
        sa.Column("remote", sa.String(length=20), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_jobs_dedupe_key"), "jobs", ["dedupe_key"], unique=True)


def downgrade() -> None:
    """Drop the jobs table."""
    op.drop_index(op.f("ix_jobs_dedupe_key"), table_name="jobs")
    op.drop_table("jobs")
