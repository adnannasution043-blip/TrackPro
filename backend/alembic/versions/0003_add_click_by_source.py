"""add click_by_source table

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "click_by_source",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("tag_link_id", sa.UUID(as_uuid=True), sa.ForeignKey("tag_links.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tanggal", sa.Date(), nullable=False),
        sa.Column("sumber", sa.String(100), nullable=False),
        sa.Column("clicks", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("tag_link_id", "tanggal", "sumber", name="uq_click_by_source"),
    )
    op.create_index("ix_click_by_source_tag_tanggal", "click_by_source", ["tag_link_id", "tanggal"])


def downgrade() -> None:
    op.drop_table("click_by_source")
