import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

TipeImport = Enum("meta_ads", "shopee_commission", "shopee_click", name="tipe_import")


class CsvImport(Base):
    __tablename__ = "csv_imports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shopee_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("shopee_accounts.id"))
    tipe: Mapped[str] = mapped_column(TipeImport, nullable=False)
    nama_file: Mapped[str] = mapped_column(String(255), nullable=False)
    file_ref: Mapped[str] = mapped_column(Text, nullable=False)
    baseline_import_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("csv_imports.id"))
    catatan: Mapped[str | None] = mapped_column(Text)
    baris_diproses: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    baris_gagal: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="diproses")
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
