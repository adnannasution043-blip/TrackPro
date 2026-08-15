import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

TahapCampaign = Enum("pra_filter", "filter", "fix_scale_up", "off", name="tahap_campaign")


class Campaign(Base):
    __tablename__ = "campaigns"
    __table_args__ = (UniqueConstraint("meta_account_id", "meta_campaign_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meta_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("meta_accounts.id", ondelete="CASCADE"), nullable=False)
    meta_campaign_id: Mapped[str] = mapped_column(String(60), nullable=False)
    nama_campaign: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="aktif")
    tahap: Mapped[str] = mapped_column(TahapCampaign, nullable=False, server_default="pra_filter")
    catatan: Mapped[str | None] = mapped_column(Text)
    ai_score: Mapped[int | None] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TagLink(Base):
    __tablename__ = "tag_links"
    __table_args__ = (UniqueConstraint("shopee_account_id", "tag"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shopee_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shopee_accounts.id", ondelete="CASCADE"), nullable=False)
    tag: Mapped[str] = mapped_column(String(120), nullable=False)
    catatan: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CampaignTagMap(Base):
    __tablename__ = "campaign_tag_map"
    __table_args__ = (UniqueConstraint("campaign_id", "tag_link_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    tag_link_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tag_links.id", ondelete="CASCADE"), nullable=False)
    sumber: Mapped[str] = mapped_column(String(20), nullable=False, server_default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
