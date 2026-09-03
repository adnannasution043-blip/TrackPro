"""add commission_live_idr to daily_metrics (komisi dari Shopee Live)

Revision ID: 0018
Revises: 0017
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "daily_metrics",
        sa.Column("commission_live_idr", sa.Numeric(14, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("daily_metrics", "commission_live_idr")
