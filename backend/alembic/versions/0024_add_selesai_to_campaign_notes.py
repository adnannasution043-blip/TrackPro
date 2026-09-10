"""tambah kolom selesai (checklist done) ke campaign_notes

Revision ID: 0024
Revises: 0023
Create Date: 2026-09-10
"""
from alembic import op
import sqlalchemy as sa

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "campaign_notes",
        sa.Column("selesai", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("campaign_notes", "selesai")
