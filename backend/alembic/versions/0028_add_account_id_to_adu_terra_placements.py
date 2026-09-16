"""tambah adu_account_id/terra_account_id ke placements + backfill

Backfill cuma jalan buat user yang punya TEPAT 1 akun Adu/Terra (kasus
paling umum) — semua data lama otomatis ditandai milik akun itu. Kalau
user punya lebih dari 1 akun, data lama dibiarkan NULL (tidak bisa
dipisah retroaktif tanpa histori tambahan) dan tetap ikut dihitung di
Budget Adu/Terra versi "Semua Akun", cuma gak ikut ke-scope kalau Filter
Akun di-set ke Shopee tertentu.

Revision ID: 0028
Revises: 0027
Create Date: 2026-09-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "adu_placements",
        sa.Column("adu_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("adu_accounts.id", ondelete="CASCADE"), nullable=True),
    )
    op.add_column(
        "terra_placements",
        sa.Column("terra_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("terra_accounts.id", ondelete="CASCADE"), nullable=True),
    )

    # Postgres tidak punya MIN()/MAX() bawaan buat tipe uuid — cast ke text
    # dulu buat agregasi, lalu cast balik. HAVING COUNT(*) = 1 menjamin cuma
    # ada tepat satu baris per grup, jadi MAX/MIN mana pun hasilnya sama.
    op.execute("""
        UPDATE adu_placements ap
        SET adu_account_id = sub.only_id
        FROM (
            SELECT user_id, MAX(id::text)::uuid AS only_id
            FROM adu_accounts
            GROUP BY user_id
            HAVING COUNT(*) = 1
        ) sub
        WHERE ap.user_id = sub.user_id AND ap.adu_account_id IS NULL
    """)
    op.execute("""
        UPDATE terra_placements tp
        SET terra_account_id = sub.only_id
        FROM (
            SELECT user_id, MAX(id::text)::uuid AS only_id
            FROM terra_accounts
            GROUP BY user_id
            HAVING COUNT(*) = 1
        ) sub
        WHERE tp.user_id = sub.user_id AND tp.terra_account_id IS NULL
    """)


def downgrade() -> None:
    op.drop_column("terra_placements", "terra_account_id")
    op.drop_column("adu_placements", "adu_account_id")
