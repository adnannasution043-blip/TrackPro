import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Computed, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DailyMetric(Base):
    __tablename__ = "daily_metrics"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tanggal: Mapped[date] = mapped_column(Date, nullable=False)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"))
    tag_link_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tag_links.id", ondelete="CASCADE"))
    spend_idr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")
    clicks_meta: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    clicks_shopee: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    orders_selesai: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    orders_tertunda: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    orders_batal: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    commission_idr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")
    commission_live_idr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")
    sales_idr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OrderSnapshot(Base):
    __tablename__ = "order_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    shopee_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shopee_accounts.id", ondelete="CASCADE"), nullable=False)
    order_id: Mapped[str] = mapped_column(String(60), nullable=False)
    tanggal_snapshot: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    commission_from_idr: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    commission_to_idr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    delta_idr: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        Computed("commission_to_idr - COALESCE(commission_from_idr, 0)", persisted=True),
    )
    tercatat_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    nama_produk: Mapped[str | None] = mapped_column(String(500))
    nama_toko: Mapped[str | None] = mapped_column(String(200))
    qty: Mapped[int | None] = mapped_column(Integer)
    sales_idr: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))


class ClickBySource(Base):
    """Klik per (tag_link, tanggal, sumber) — diisi dari Shopee Click CSV kolom Source."""
    __tablename__ = "click_by_source"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tag_link_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tag_links.id", ondelete="CASCADE"), nullable=False)
    tanggal: Mapped[date] = mapped_column(Date, nullable=False)
    sumber: Mapped[str] = mapped_column(String(100), nullable=False)
    clicks: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    __table_args__ = (UniqueConstraint("tag_link_id", "tanggal", "sumber", name="uq_click_by_source"),)


class MetaBreakdown(Base):
    """Breakdown Meta Ads per (campaign, tanggal, tipe, nilai) — placement / platform / age_gender."""
    __tablename__ = "meta_breakdowns"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    tanggal: Mapped[date] = mapped_column(Date, nullable=False)
    tipe: Mapped[str] = mapped_column(String(20), nullable=False)   # placement | platform | age_gender
    nilai: Mapped[str] = mapped_column(String(150), nullable=False)  # "Facebook Feed" / "18-24 / Male"
    spend_idr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")
    impressions: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    clicks: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    __table_args__ = (UniqueConstraint("campaign_id", "tanggal", "tipe", "nilai", name="uq_meta_breakdown"),)
