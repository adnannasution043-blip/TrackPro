"""tambah kolom breakdown kategori (story/feed/meta/adu/terra/meta_pribadi)
ke wd_payments — biar Komisi Organik & Komisi Iklan di tab "Komisi & Profit"
bisa dihitung murni dari file WD Payment (via Tag_link), bukan dari CSV
Komisi Shopee.

Revision ID: 0022
Revises: 0021
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None

_COLUMNS = ["komisi_story", "komisi_feed", "komisi_meta", "komisi_adu", "komisi_terra", "komisi_meta_pribadi"]


def upgrade() -> None:
    for col in _COLUMNS:
        op.add_column("wd_payments", sa.Column(col, sa.Numeric(15, 2), nullable=False, server_default="0"))


def downgrade() -> None:
    for col in _COLUMNS:
        op.drop_column("wd_payments", col)
