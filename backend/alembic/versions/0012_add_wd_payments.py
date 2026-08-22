"""tambah tabel wd_payments

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-22
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "wd_payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("shopee_account_id", UUID(as_uuid=True), sa.ForeignKey("shopee_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tanggal", sa.Date, nullable=False),
        sa.Column("total_komisi", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("jumlah_orders", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("shopee_account_id", "tanggal", name="uq_wd_payments_account_tanggal"),
    )
    op.create_index("ix_wd_payments_shopee_account_id", "wd_payments", ["shopee_account_id"])


def downgrade():
    op.drop_table("wd_payments")
