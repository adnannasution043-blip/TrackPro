import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CustomKategori(Base):
    """Kategori tambahan buat Laporan Harian, dikelola manual oleh user —
    dicocokkan ke tag_link.tag pakai ILIKE %keyword%, sama seperti kategori
    bawaan (Meta/Adu/Terra). Filter pill & kolom tabelnya di-generate
    dinamis dari tabel ini (lihat GET /dashboard/laporan-harian2 dan
    laporan_harian2.js), berdampingan dengan kategori bawaan yang tetap
    hardcode."""
    __tablename__ = "custom_kategori"
    __table_args__ = (UniqueConstraint("user_id", "nama", name="uq_custom_kategori_user_nama"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    nama: Mapped[str] = mapped_column(String(60), nullable=False)
    keyword: Mapped[str] = mapped_column(String(60), nullable=False)
    ikut_total_kotor: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    urutan: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
