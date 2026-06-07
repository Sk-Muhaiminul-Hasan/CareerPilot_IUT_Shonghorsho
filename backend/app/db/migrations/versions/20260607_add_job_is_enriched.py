"""add_job_is_enriched

Revision ID: 20260607_add_job_is_enriched
Revises: 20260607_add_job_deadline_and_work_type
Create Date: 2026-06-07 12:30:00.000000

Adds ``is_enriched`` to ``jobs`` to track whether full description
enrichment has completed for a listing.
"""
from typing import Any

from alembic import op
import sqlalchemy as sa


revision: str = "20260607_add_job_is_enriched"
down_revision: str = "20260607_add_job_deadline_and_work_type"
branch_labels: Any = None
depends_on: Any = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("is_enriched", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("jobs", "is_enriched")
