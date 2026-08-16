from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class TaglinkClickRow(BaseModel):
    tag_link_id: UUID
    tag: str
    click: int
    pesanan: int
    cr_persen: Decimal | None
    komisi: Decimal


class ClickSummary(BaseModel):
    total_click: int
    tag_link_count: int
    total_pesanan: int
    total_komisi: Decimal
    cr_persen: Decimal | None


class TaglinkClicksResponse(BaseModel):
    summary: ClickSummary
    taglinks: list[TaglinkClickRow]


class SourceClickRow(BaseModel):
    sumber: str
    click: int
    share_persen: Decimal
    komisi: Decimal


class SourceClicksResponse(BaseModel):
    sources: list[SourceClickRow]
    total_click: int
    total_komisi: Decimal
    source_count: int


class ChannelRow(BaseModel):
    sumber: str
    click: int
    share_persen: Decimal
    komisi: Decimal


class ChannelBreakdownResponse(BaseModel):
    tag: str
    tanggal_dari: date
    tanggal_sampai: date
    total_click: int
    total_komisi: Decimal
    channels: list[ChannelRow]
