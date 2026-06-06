"""add_user_id_columns

Revision ID: 20260606_user_id_multitenancy
Revises: a1b2c3d4e5f6
Create Date: 2026-06-06 13:41:00.000000
"""
from typing import Any

from alembic import op
import sqlalchemy as sa

revision: str = "20260606_user_id_multitenancy"
down_revision: str = "a1b2c3d4e5f6"
branch_labels: Any = None
depends_on: Any = None


def upgrade() -> None:
    op.add_column(
        "resumes",
        sa.Column("user_id", sa.String(32), nullable=False, server_default="default_user"),
    )
    op.add_column(
        "jobs",
        sa.Column("user_id", sa.String(32), nullable=False, server_default="default_user"),
    )
    op.add_column(
        "applications",
        sa.Column("user_id", sa.String(32), nullable=False, server_default="default_user"),
    )
    op.add_column(
        "llm_usage",
        sa.Column("user_id", sa.String(32), nullable=False, server_default="default_user"),
    )
    op.drop_constraint("ck_user_settings_singleton", "user_settings")
    op.alter_column(
        "user_settings",
        "id",
        existing_type=sa.String(20),
        nullable=False,
        server_default=None,
    )

    op.create_index("ix_resumes_user_id", "resumes", ["user_id"])
    op.create_index("ix_jobs_user_id", "jobs", ["user_id"])
    op.create_index("ix_applications_user_id", "applications", ["user_id"])
    op.create_index("ix_llm_usage_user_id", "llm_usage", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_llm_usage_user_id", "llm_usage")
    op.drop_index("ix_applications_user_id", "applications")
    op.drop_index("ix_jobs_user_id", "jobs")
    op.drop_index("ix_resumes_user_id", "resumes")

    op.add_column(
        "user_settings",
        sa.Column(
            "id",
            sa.String(20),
            nullable=False,
            server_default="singleton",
            primary_key=True,
        ),
    )
    op.create_check_constraint(
        "ck_user_settings_singleton",
        "user_settings",
        "id = 'singleton'",
    )
    op.drop_column("llm_usage", "user_id")
    op.drop_column("applications", "user_id")
    op.drop_column("jobs", "user_id")
    op.drop_column("resumes", "user_id")
