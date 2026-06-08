"""add_user_settings_is_premium

Revision ID: 20260608_add_user_settings_is_premium
Revises: 20260607_add_job_deadline_and_work_type
Create Date: 2026-06-08 18:30:00.000000

Adds ``is_premium`` to ``user_settings`` to gate premium features
such as Exa AI job search behind an explicit plan selection.
"""
from typing import Any

import sqlalchemy as sa
from alembic import op

revision: str = "20260608_add_user_settings_is_premium"
down_revision: str = "20260607_add_job_deadline_and_work_type"
branch_labels: Any = None
depends_on: Any = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column(
            "is_premium",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "is_premium")
