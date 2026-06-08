"""replace_preferred_model_with_general_and_extraction_ai_settings

Replaces the old unified ``preferred_model`` / ``user_api_key`` /
``preferred_provider`` columns with six purpose-specific columns and an
``onboarding_complete`` tracker.

Revision ID: 20260606200000_replace_general_extraction_ai
Revises: 20260606180000_preferred_model_and_user_api_key
Create Date: 2026-06-06 20:00:00.000000
"""

from typing import Any

from alembic import op
import sqlalchemy as sa


revision: str = "20260606200000_replace_general_extraction_ai"
down_revision: str = "20260606180000_preferred_model_and_user_api_key"
branch_labels: Any = None
depends_on: Any = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column("general_provider", sa.String(50), nullable=True),
    )
    op.add_column(
        "user_settings",
        sa.Column("general_model", sa.String(200), nullable=True),
    )
    op.add_column(
        "user_settings",
        sa.Column("general_api_key", sa.String(512), nullable=True),
    )
    op.add_column(
        "user_settings",
        sa.Column("extraction_provider", sa.String(50), nullable=True),
    )
    op.add_column(
        "user_settings",
        sa.Column("extraction_model", sa.String(200), nullable=True),
    )
    op.add_column(
        "user_settings",
        sa.Column("extraction_api_key", sa.String(512), nullable=True),
    )
    op.add_column(
        "user_settings",
        sa.Column("onboarding_complete", sa.Boolean(), nullable=False, server_default="false"),
    )

    op.drop_column("user_settings", "preferred_model")
    op.drop_column("user_settings", "user_api_key")
    op.drop_column("user_settings", "preferred_provider")


def downgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column("preferred_provider", sa.String(50), nullable=False, server_default="openai"),
    )
    op.add_column(
        "user_settings",
        sa.Column("preferred_model", sa.String(100), nullable=True),
    )
    op.add_column(
        "user_settings",
        sa.Column("user_api_key", sa.String(255), nullable=True),
    )

    op.drop_column("user_settings", "onboarding_complete")
    op.drop_column("user_settings", "extraction_api_key")
    op.drop_column("user_settings", "extraction_model")
    op.drop_column("user_settings", "extraction_provider")
    op.drop_column("user_settings", "general_api_key")
    op.drop_column("user_settings", "general_model")
    op.drop_column("user_settings", "general_provider")
