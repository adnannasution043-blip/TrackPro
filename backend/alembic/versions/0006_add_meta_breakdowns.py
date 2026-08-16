"""add meta_breakdowns table

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "meta_breakdowns",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("campaign_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tanggal", sa.Date(), nullable=False),
        sa.Column("tipe", sa.String(length=20), nullable=False),
        sa.Column("nilai", sa.String(length=150), nullable=False),
        sa.Column("spend_idr", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("impressions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("clicks", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campaign_id", "tanggal", "tipe", "nilai", name="uq_meta_breakdown"),
    )
    op.create_index("ix_meta_breakdowns_campaign_tipe", "meta_breakdowns", ["campaign_id", "tipe", "tanggal"])


def downgrade():
    op.drop_index("ix_meta_breakdowns_campaign_tipe", table_name="meta_breakdowns")
    op.drop_table("meta_breakdowns")
