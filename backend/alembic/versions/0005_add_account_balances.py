"""add account_balances table

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "account_balances",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "meta_account_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("meta_accounts.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("sisa_saldo", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_limit", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("dikelola_oleh", sa.String(200), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("account_balances")
