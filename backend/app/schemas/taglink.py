from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CampaignResponse(BaseModel):
    id: UUID
    meta_account_id: UUID
    meta_campaign_id: str
    nama_campaign: str
    status: str
    tahap: str
    catatan: str | None
    dipetakan: bool           # True jika sudah punya minimal 1 tag link

    model_config = {"from_attributes": True}


class TagLinkResponse(BaseModel):
    id: UUID
    shopee_account_id: UUID
    tag: str
    catatan: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MapCreate(BaseModel):
    campaign_id: UUID
    tag_link_id: UUID


class MapResponse(BaseModel):
    id: UUID
    campaign_id: UUID
    nama_campaign: str
    meta_campaign_id: str
    tag_link_id: UUID
    tag: str
    shopee_account_id: UUID
    sumber: str
    created_at: datetime
