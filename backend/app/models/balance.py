import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AccountBalance(Base):
    """Snapshot saldo akun Meta Ads — di-update manual via POST /balance/{id}."""

    __tablename__ = "account_balances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meta_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meta_accounts.id", ondelete="CASCADE"),
        nullable=False, unique=True,
    )
    sisa_saldo: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")
    total_limit: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")
    dikelola_oleh: Mapped[str | None] = mapped_column(String(200))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
