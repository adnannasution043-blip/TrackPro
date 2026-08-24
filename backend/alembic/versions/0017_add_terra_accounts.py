"""tambah tabel terra_accounts dan terra_sync_logs (sync via Adsterra API)

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-24
"""
import sqlalchemy as sa
from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "terra_accounts",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("nama_tampilan", sa.String(120), nullable=False),
        sa.Column("api_key_enc", sa.Text()),
        sa.Column("status_koneksi", sa.String(20), nullable=False, server_default="terhubung"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "nama_tampilan"),
    )
    op.create_table(
        "terra_sync_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("terra_account_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("tanggal_dari", sa.Date(), nullable=False),
        sa.Column("tanggal_sampai", sa.Date(), nullable=False),
        sa.Column("rows_fetched", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rows_upserted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rows_gagal", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="selesai"),
        sa.Column("catatan", sa.Text()),
        sa.Column("synced_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["terra_account_id"], ["terra_accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )


def downgrade():
    op.drop_table("terra_sync_logs")
    op.drop_table("terra_accounts")
