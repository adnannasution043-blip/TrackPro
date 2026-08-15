"""add product fields to order_snapshots

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("order_snapshots", sa.Column("nama_produk", sa.String(500), nullable=True))
    op.add_column("order_snapshots", sa.Column("nama_toko", sa.String(200), nullable=True))
    op.add_column("order_snapshots", sa.Column("qty", sa.Integer(), nullable=True))
    op.add_column("order_snapshots", sa.Column("sales_idr", sa.Numeric(14, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("order_snapshots", "sales_idr")
    op.drop_column("order_snapshots", "qty")
    op.drop_column("order_snapshots", "nama_toko")
    op.drop_column("order_snapshots", "nama_produk")
