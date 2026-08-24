"""tambah tabel adu_placements dan enum value adu

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-24
"""
import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "adu_placements",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("tanggal", sa.Date(), nullable=False),
        sa.Column("zone_id", sa.String(60), nullable=False),
        sa.Column("impressions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("clicks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("conversions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("budget_rupiah", sa.Numeric(16, 0), nullable=False, server_default="0"),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "tanggal", "zone_id", name="uq_adu_placement"),
    )
    op.execute("ALTER TYPE tipe_import ADD VALUE IF NOT EXISTS 'adu'")


def downgrade():
    op.drop_table("adu_placements")
