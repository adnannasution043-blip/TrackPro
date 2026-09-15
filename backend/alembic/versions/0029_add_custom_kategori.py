"""tambah tabel custom_kategori (kategori tambahan Laporan Harian, manual)

Revision ID: 0029
Revises: 0028
Create Date: 2026-09-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "custom_kategori",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nama", sa.String(60), nullable=False),
        sa.Column("keyword", sa.String(60), nullable=False),
        sa.Column("ikut_total_kotor", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("urutan", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "nama", name="uq_custom_kategori_user_nama"),
    )


def downgrade() -> None:
    op.drop_table("custom_kategori")
