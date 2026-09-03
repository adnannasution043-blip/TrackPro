"""tambah ON DELETE CASCADE ke csv_imports.shopee_account_id

FK ini dulu dibuat tanpa ondelete, jadi hapus akun Shopee gagal (Foreign
Key Violation / 500) kalau akun itu sudah pernah dipakai upload CSV —
padahal endpoint DELETE /accounts/shopee/{id} sudah dimaksudkan cascade
hapus semua data terkait (lihat commit ea5043c). Nama constraint dicari
dinamis dari information_schema karena tidak di-set eksplisit saat dibuat
(0001_initial_schema.py), jadi namanya bergantung penamaan otomatis DB.

Revision ID: 0019
Revises: 0018
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None

_NEW_NAME = "csv_imports_shopee_account_id_fkey"


def _find_fk_name(conn) -> str | None:
    return conn.execute(sa.text("""
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'csv_imports'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'shopee_account_id'
    """)).scalar()


def upgrade() -> None:
    conn = op.get_bind()
    existing = _find_fk_name(conn)
    if existing:
        op.drop_constraint(existing, "csv_imports", type_="foreignkey")
    op.create_foreign_key(
        _NEW_NAME,
        "csv_imports", "shopee_accounts",
        ["shopee_account_id"], ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    conn = op.get_bind()
    existing = _find_fk_name(conn)
    if existing:
        op.drop_constraint(existing, "csv_imports", type_="foreignkey")
    op.create_foreign_key(
        _NEW_NAME,
        "csv_imports", "shopee_accounts",
        ["shopee_account_id"], ["id"],
    )
