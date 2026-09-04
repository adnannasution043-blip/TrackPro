"""tambah kolom komisi_live ke wd_payments

Komisi dari order status Selesai yang kolom Platform-nya "Shopeelive-Shopee"
di file BillConversionReport (WD Payment) — sumber terpisah dari
commission_live_idr di daily_metrics (itu dari CSV Komisi Shopee, basis
tanggal order; ini basis tanggal selesai/WD).

Revision ID: 0020
Revises: 0019
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "wd_payments",
        sa.Column("komisi_live", sa.Numeric(15, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("wd_payments", "komisi_live")
