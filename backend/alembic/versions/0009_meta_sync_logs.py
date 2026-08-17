"""tambah tabel meta_sync_logs

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-17
"""
import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "meta_sync_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("meta_account_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("tanggal_dari", sa.Date(), nullable=False),
        sa.Column("tanggal_sampai", sa.Date(), nullable=False),
        sa.Column("rows_fetched", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rows_upserted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rows_gagal", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="selesai"),
        sa.Column("catatan", sa.Text(), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["meta_account_id"], ["meta_accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("meta_sync_logs")
