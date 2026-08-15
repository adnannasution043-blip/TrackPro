import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MetaAccount(Base):
    __tablename__ = "meta_accounts"
    __table_args__ = (UniqueConstraint("user_id", "ad_account_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ad_account_id: Mapped[str] = mapped_column(String(60), nullable=False)
    nama_tampilan: Mapped[str] = mapped_column(String(120), nullable=False)
    mata_uang: Mapped[str] = mapped_column(String(10), nullable=False, server_default="IDR")
    access_token_enc: Mapped[str | None] = mapped_column(Text)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status_koneksi: Mapped[str] = mapped_column(String(20), nullable=False, server_default="terhubung")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ShopeeAccount(Base):
    __tablename__ = "shopee_accounts"
    __table_args__ = (UniqueConstraint("user_id", "nama_akun"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    nama_akun: Mapped[str] = mapped_column(String(120), nullable=False)
    catatan: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AccountLink(Base):
    __tablename__ = "account_links"

    meta_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("meta_accounts.id", ondelete="CASCADE"), primary_key=True)
    shopee_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shopee_accounts.id", ondelete="CASCADE"), primary_key=True)
