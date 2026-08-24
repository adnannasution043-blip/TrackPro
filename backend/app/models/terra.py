import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Date, DateTime, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TerraPlacement(Base):
    __tablename__ = "terra_placements"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    tanggal: Mapped[date] = mapped_column(Date, nullable=False)
    placement_id: Mapped[str] = mapped_column(String(60), nullable=False)
    state: Mapped[str | None] = mapped_column(String(10))
    impressions: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    clicks: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    spent_usd: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False, server_default="0")
    budget_rupiah: Mapped[Decimal] = mapped_column(Numeric(16, 0), nullable=False, server_default="0")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "tanggal", "placement_id", name="uq_terra_placement"),
    )
