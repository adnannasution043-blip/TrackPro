from datetime import date
from decimal import Decimal

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
