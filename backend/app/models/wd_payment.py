import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class WdPayment(Base):
    __tablename__ = "wd_payments"
    __table_args__ = (UniqueConstraint("shopee_account_id", "tanggal"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shopee_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shopee_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    tanggal: Mapped[date] = mapped_column(Date, nullable=False)
    total_komisi: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, server_default="0")
    komisi_live: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, server_default="0")
    # Breakdown per kategori Tag_link (sama logic klasifikasi kayak
    # dashboard.py /laporan-harian2, tapi dihitung dari file WD Payment
    # sendiri) — dipakai buat Komisi Organik (story+feed) & Komisi Iklan
    # (meta+adu+terra+meta_pribadi) di tab "Komisi & Profit".
    komisi_story: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, server_default="0")
    komisi_feed: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, server_default="0")
    komisi_meta: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, server_default="0")
    komisi_adu: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, server_default="0")
    komisi_terra: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, server_default="0")
    komisi_meta_pribadi: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, server_default="0")
    jumlah_orders: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
