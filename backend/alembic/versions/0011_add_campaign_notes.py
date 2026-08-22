"""tambah tabel campaign_notes

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-22
"""
import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "campaign_notes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("campaign_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("teks", sa.Text(), nullable=False),
        sa.Column("tipe", sa.String(30), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_campaign_notes_campaign_id", "campaign_notes", ["campaign_id"])


def downgrade() -> None:
    op.drop_index("ix_campaign_notes_campaign_id")
    op.drop_table("campaign_notes")
