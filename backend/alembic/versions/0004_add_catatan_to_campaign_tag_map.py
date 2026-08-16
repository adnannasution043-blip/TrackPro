"""add catatan to campaign_tag_map

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("campaign_tag_map", sa.Column("catatan", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("campaign_tag_map", "catatan")
