"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-08-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ENUM types — buat dulu sebelum tabel yang memakainya
    tahap_campaign = postgresql.ENUM(
        "pra_filter", "filter", "fix_scale_up", "off",
        name="tahap_campaign", create_type=False,
    )
    tipe_import = postgresql.ENUM(
        "meta_ads", "shopee_commission", "shopee_click",
        name="tipe_import", create_type=False,
    )
    tahap_campaign.create(op.get_bind(), checkfirst=True)
    tipe_import.create(op.get_bind(), checkfirst=True)

    # users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("nama", sa.String(120), nullable=False),
        sa.Column("email", sa.String(160), nullable=False),
        sa.Column("username", sa.String(60), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="user"),
        sa.Column("status_akun", sa.String(20), nullable=False, server_default="aktif"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("username"),
    )

    # plans
    op.create_table(
        "plans",
        sa.Column("id", sa.SmallInteger, primary_key=True, autoincrement=True),
        sa.Column("kode", sa.String(30), nullable=False),
        sa.Column("nama", sa.String(60), nullable=False),
        sa.Column("harga_idr", sa.Integer, nullable=False, server_default="0"),
        sa.Column("durasi_hari", sa.Integer, nullable=False),
        sa.Column("max_akun_meta", sa.Integer, nullable=False),
        sa.Column("max_akun_shopee", sa.Integer, nullable=False),
        sa.Column("limit_import_harian", sa.Integer, nullable=False),
        sa.Column("ai_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("automation_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.UniqueConstraint("kode"),
    )

    # subscriptions
    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", sa.SmallInteger, sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="aktif"),
        sa.Column("mulai_at", sa.Date, nullable=False),
        sa.Column("berakhir_at", sa.Date),
        sa.Column("pembayaran_terakhir_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_subscriptions_user", "subscriptions", ["user_id", "status"])

    # meta_accounts
    op.create_table(
        "meta_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ad_account_id", sa.String(60), nullable=False),
        sa.Column("nama_tampilan", sa.String(120), nullable=False),
        sa.Column("mata_uang", sa.String(10), nullable=False, server_default="IDR"),
        sa.Column("access_token_enc", sa.Text),
        sa.Column("token_expires_at", sa.DateTime(timezone=True)),
        sa.Column("status_koneksi", sa.String(20), nullable=False, server_default="terhubung"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "ad_account_id"),
    )

    # shopee_accounts
    op.create_table(
        "shopee_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nama_akun", sa.String(120), nullable=False),
        sa.Column("catatan", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "nama_akun"),
    )

    # account_links
    op.create_table(
        "account_links",
        sa.Column("meta_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("meta_accounts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("shopee_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shopee_accounts.id", ondelete="CASCADE"), primary_key=True),
    )

    # campaigns
    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("meta_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("meta_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("meta_campaign_id", sa.String(60), nullable=False),
        sa.Column("nama_campaign", sa.String(255), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="aktif"),
        sa.Column("tahap", tahap_campaign, nullable=False, server_default="pra_filter"),
        sa.Column("catatan", sa.Text),
        sa.Column("ai_score", sa.SmallInteger),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("meta_account_id", "meta_campaign_id"),
    )

    # tag_links
    op.create_table(
        "tag_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("shopee_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shopee_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tag", sa.String(120), nullable=False),
        sa.Column("catatan", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("shopee_account_id", "tag"),
    )

    # campaign_tag_map
    op.create_table(
        "campaign_tag_map",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tag_link_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tag_links.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sumber", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("campaign_id", "tag_link_id"),
    )
    op.create_index("idx_campaign_tag_map_tag", "campaign_tag_map", ["tag_link_id"])

    # daily_metrics
    op.create_table(
        "daily_metrics",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("tanggal", sa.Date, nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id", ondelete="CASCADE")),
        sa.Column("tag_link_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tag_links.id", ondelete="CASCADE")),
        sa.Column("spend_idr", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("clicks_meta", sa.Integer, nullable=False, server_default="0"),
        sa.Column("clicks_shopee", sa.Integer, nullable=False, server_default="0"),
        sa.Column("orders_selesai", sa.Integer, nullable=False, server_default="0"),
        sa.Column("orders_tertunda", sa.Integer, nullable=False, server_default="0"),
        sa.Column("orders_batal", sa.Integer, nullable=False, server_default="0"),
        sa.Column("commission_idr", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("sales_idr", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint("campaign_id IS NOT NULL OR tag_link_id IS NOT NULL"),
    )
    op.create_index("idx_daily_metrics_campaign_date", "daily_metrics", ["campaign_id", "tanggal"])
    op.create_index("idx_daily_metrics_tag_date", "daily_metrics", ["tag_link_id", "tanggal"])
    op.create_index(
        "uq_daily_metrics_campaign_day", "daily_metrics", ["campaign_id", "tanggal"],
        unique=True,
        postgresql_where=sa.text("campaign_id IS NOT NULL"),
    )
    op.create_index(
        "uq_daily_metrics_tag_day", "daily_metrics", ["tag_link_id", "tanggal"],
        unique=True,
        postgresql_where=sa.text("tag_link_id IS NOT NULL"),
    )

    # order_snapshots
    op.create_table(
        "order_snapshots",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("shopee_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shopee_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_id", sa.String(60), nullable=False),
        sa.Column("tanggal_snapshot", sa.Date, nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("commission_from_idr", sa.Numeric(14, 2)),
        sa.Column("commission_to_idr", sa.Numeric(14, 2), nullable=False),
        # delta_idr dihitung di level aplikasi, bukan generated column, agar kompatibel dengan semua driver
        sa.Column("delta_idr", sa.Numeric(14, 2), sa.Computed("commission_to_idr - COALESCE(commission_from_idr, 0)", persisted=True)),
        sa.Column("tercatat_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_order_snapshots_lookup", "order_snapshots", ["shopee_account_id", "order_id", "tanggal_snapshot"])
    op.create_index("idx_order_snapshots_date", "order_snapshots", ["tanggal_snapshot"])

    # csv_imports
    op.create_table(
        "csv_imports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shopee_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shopee_accounts.id")),
        sa.Column("tipe", tipe_import, nullable=False),
        sa.Column("nama_file", sa.String(255), nullable=False),
        sa.Column("file_ref", sa.Text, nullable=False),
        sa.Column("baseline_import_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("csv_imports.id")),
        sa.Column("catatan", sa.Text),
        sa.Column("baris_diproses", sa.Integer, nullable=False, server_default="0"),
        sa.Column("baris_gagal", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="diproses"),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_csv_imports_user", "csv_imports", ["user_id", "tipe", "created_at"])


def downgrade() -> None:
    op.drop_table("csv_imports")
    op.drop_table("order_snapshots")
    op.drop_table("daily_metrics")
    op.drop_table("campaign_tag_map")
    op.drop_table("tag_links")
    op.drop_table("campaigns")
    op.drop_table("account_links")
    op.drop_table("shopee_accounts")
    op.drop_table("meta_accounts")
    op.drop_table("subscriptions")
    op.drop_table("plans")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS tipe_import")
    op.execute("DROP TYPE IF EXISTS tahap_campaign")
