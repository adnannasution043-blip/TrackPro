"""add meta_breakdown to tipe_import enum

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-16
"""
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE tipe_import ADD VALUE IF NOT EXISTS 'meta_breakdown'")


def downgrade() -> None:
    # PostgreSQL tidak support menghapus nilai dari enum — downgrade tidak bisa otomatis
    pass
