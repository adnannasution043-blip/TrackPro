from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_biaya: Decimal
    total_penjualan: Decimal
    total_komisi: Decimal
    total_komisi_terpetakan: Decimal    # komisi dari tag yang sudah di-map ke campaign
    total_komisi_nonmeta: Decimal       # komisi dari tag yang belum di-map (termasuk tag "non-meta")
    total_laba: Decimal
    roi_persen: Decimal | None          # None jika biaya = 0
    total_orders: int                   # selesai + tertunda (batal tidak dihitung)
    total_orders_selesai: int
    total_orders_tertunda: int
    total_orders_batal: int
    total_clicks_meta: int
    total_clicks_shopee: int


class HarianRow(BaseModel):
    tanggal: date
    spend_idr: Decimal
    clicks_meta: int
    clicks_shopee: int
    komisi: Decimal
    penjualan: Decimal
    orders_selesai: int
    orders_tertunda: int
    orders_batal: int
    laba: Decimal
    epc: Decimal | None         # komisi / clicks_shopee, None jika clicks = 0
    cr_persen: Decimal | None   # orders_selesai / clicks_shopee * 100, None jika clicks = 0


class DashboardResponse(BaseModel):
    summary: DashboardSummary
    harian: list[HarianRow]


class CampaignRow(BaseModel):
    id: UUID
    nama_campaign: str
    status: str
    tahap: str | None
    tag_link: str | None       # tag pertama yang di-map (ringkasan)
    spend_idr: Decimal
    clicks_meta: int
    komisi: Decimal
    laba: Decimal
    roi_persen: Decimal | None
    ads: list = []             # placeholder — ad-level tidak tersedia dari CSV


class CampaignsResponse(BaseModel):
    campaigns: list[CampaignRow]


class TopProdukRow(BaseModel):
    nama_produk: str
    nama_toko: str | None
    qty: int
    penjualan: Decimal
    komisi: Decimal


class TopProdukResponse(BaseModel):
    top_komisi: list[TopProdukRow]
    top_penjualan: list[TopProdukRow]
    top_produk: list[TopProdukRow]
    orders_selesai: int
    orders_tertunda: int
    orders_batal: int
    orders_diproses: int
