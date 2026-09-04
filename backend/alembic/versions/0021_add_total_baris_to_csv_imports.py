"""tambah kolom total_baris ke csv_imports buat progress bar upload

Revision ID: 0021
Revises: 0020
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "csv_imports",
        sa.Column("total_baris", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("csv_imports", "total_baris")
