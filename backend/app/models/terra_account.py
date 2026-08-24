import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TerraAccount(Base):
    """Akun Adsterra (Terra Ads) — API Key untuk tarik statistik placement via API."""
    __tablename__ = "terra_accounts"
    __table_args__ = (UniqueConstraint("user_id", "nama_tampilan"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    nama_tampilan: Mapped[str] = mapped_column(String(120), nullable=False)
    api_key_enc: Mapped[str | None] = mapped_column(Text)
    status_koneksi: Mapped[str] = mapped_column(String(20), nullable=False, server_default="terhubung")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
