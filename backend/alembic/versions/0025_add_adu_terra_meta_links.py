"""tambah tabel relasi Meta <-> Adu dan Meta <-> Terra

Revision ID: 0025
Revises: 0024
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "adu_account_links",
        sa.Column("meta_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("meta_accounts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("adu_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("adu_accounts.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "terra_account_links",
        sa.Column("meta_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("meta_accounts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("terra_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("terra_accounts.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("terra_account_links")
    op.drop_table("adu_account_links")
