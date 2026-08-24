"""tambah tabel terra_placements dan enum value terra

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-24
"""
import sqlalchemy as sa
from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "terra_placements",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("tanggal", sa.Date(), nullable=False),
        sa.Column("placement_id", sa.String(60), nullable=False),
        sa.Column("state", sa.String(10), nullable=True),
        sa.Column("impressions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("clicks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("spent_usd", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("budget_rupiah", sa.Numeric(16, 0), nullable=False, server_default="0"),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "tanggal", "placement_id", name="uq_terra_placement"),
    )
    op.execute("ALTER TYPE tipe_import ADD VALUE IF NOT EXISTS 'terra'")


def downgrade():
    op.drop_table("terra_placements")
