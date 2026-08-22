"""tambah wd_payment ke enum tipe_import

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-22
"""
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE tipe_import ADD VALUE IF NOT EXISTS 'wd_payment'")


def downgrade():
    # PostgreSQL tidak mendukung DROP VALUE dari enum; lewati saja
    pass
