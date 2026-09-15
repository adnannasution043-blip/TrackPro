"""tambah kolom markup_persen ke meta_accounts (markup topup iklan per ADV)

Revision ID: 0027
Revises: 0026
Create Date: 2026-09-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "meta_accounts",
        sa.Column("markup_persen", sa.Numeric(5, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("meta_accounts", "markup_persen")
