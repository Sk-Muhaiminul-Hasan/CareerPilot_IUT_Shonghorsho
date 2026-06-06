"""preferred_model_and_user_api_key

Revision ID: 20260606180000_preferred_model_and_user_api_key
Revises: 20260606_user_id_multitenancy
Create Date: 2026-06-06 18:00:00.000000
"""

from typing import Any

from alembic import op
import sqlalchemy as sa

revision: str = "20260606180000_preferred_model_and_user_api_key"
down_revision: str = "20260606_user_id_multitenancy"
branch_labels: Any = None
depends_on: Any = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column("preferred_model", sa.String(length=100), nullable=True, server_default=None),
    )
    op.add_column(
        "user_settings",
        sa.Column("user_api_key", sa.String(length=255), nullable=True, server_default=None),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "user_api_key")
    op.drop_column("user_settings", "preferred_model")
