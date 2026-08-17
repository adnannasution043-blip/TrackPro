"""add jenis_iklan to campaigns

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-17
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("jenis_iklan", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("campaigns", "jenis_iklan")
