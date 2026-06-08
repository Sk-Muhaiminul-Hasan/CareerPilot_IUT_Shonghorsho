"""add_reasoning_to_applications

Revision ID: 20260604_a1b2c3d4e5f6
Revises: 20260603_fa1d9b61a6ce
Create Date: 2026-06-04 22:08:00.000000
"""
from typing import Any

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: str = "fa1d9b61a6ce"
branch_labels: Any = None
depends_on: Any = None


def upgrade() -> None:
    op.add_column(
        "applications",
        sa.Column("reasoning", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("applications", "reasoning")
