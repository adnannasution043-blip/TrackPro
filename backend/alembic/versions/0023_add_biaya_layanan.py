"""tambah tabel biaya_layanan — input manual per tanggal, dikurangi dari
komisi sebelum PPh 21 dihitung di halaman Pembayaran WD.

Revision ID: 0023
Revises: 0022
Create Date: 2026-09-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "biaya_layanan",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tanggal", sa.Date(), nullable=False),
        sa.Column("jumlah", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "tanggal", name="uq_biaya_layanan_user_tanggal"),
    )


def downgrade() -> None:
    op.drop_table("biaya_layanan")
