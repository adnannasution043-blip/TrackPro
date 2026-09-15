"""ganti relasi Adu/Terra dari Meta ke Shopee (Adu Nipon <-> Shopee Nipon)

Revision ID: 0026
Revises: 0025
Create Date: 2026-09-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tabel 0025 baru dipakai fitur yang belum dipakai user (salah arah
    # relasi — ke Meta, seharusnya ke Shopee), jadi aman drop & recreate
    # tanpa perlu migrasi data.
    op.drop_table("adu_account_links")
    op.drop_table("terra_account_links")

    op.create_table(
        "adu_account_links",
        sa.Column("shopee_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shopee_accounts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("adu_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("adu_accounts.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "terra_account_links",
        sa.Column("shopee_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shopee_accounts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("terra_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("terra_accounts.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("terra_account_links")
    op.drop_table("adu_account_links")

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
