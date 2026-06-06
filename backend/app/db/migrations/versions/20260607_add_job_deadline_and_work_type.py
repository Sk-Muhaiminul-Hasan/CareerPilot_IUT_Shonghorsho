"""add_job_deadline_and_work_type

Revision ID: 20260607_add_job_deadline_and_work_type
Revises: 20260606_user_id_multitenancy
Create Date: 2026-06-07 00:00:00.000000

Adds two new columns to the ``jobs`` table so the scrapers can store the
information they now extract (full description, salary range, deadline,
and work arrangement).

``work_type`` is constrained to one of: ``""`` (unknown), ``"remote"``,
``"hybrid"``, or ``"onsite"`` — enforced at the DB level via a CHECK
constraint so the frontend can rely on a stable enum.
"""
from typing import Any

from alembic import op
import sqlalchemy as sa


revision: str = "20260607_add_job_deadline_and_work_type"
down_revision: str = "20260606_user_id_multitenancy"
branch_labels: Any = None
depends_on: Any = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("deadline", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "work_type",
            sa.String(length=20),
            nullable=False,
            server_default="",
        ),
    )
    op.create_check_constraint(
        "ck_job_work_type",
        "jobs",
        "work_type IN ('', 'remote', 'hybrid', 'onsite')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_job_work_type", "jobs", type_="check")
    op.drop_column("jobs", "work_type")
    op.drop_column("jobs", "deadline")
