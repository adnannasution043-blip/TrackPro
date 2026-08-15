from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class OrderCalendarDay(BaseModel):
    tanggal: date
    completed: int
    pending: int
    unpaid: int
    cancelled: int
    komisi: Decimal
    komisi_completed: Decimal
    komisi_pending: Decimal
    updated_at: datetime | None


class OrderCalendarResponse(BaseModel):
    days: list[OrderCalendarDay]
    total_completed: int
    total_pending: int
    total_unpaid: int
    total_cancelled: int
    total_komisi: Decimal
    total_komisi_completed: Decimal
    total_komisi_pending: Decimal
    days_with_orders: int
    days_settled: int
    days_berjalan: int


class OrderRow(BaseModel):
    order_id: str
    item_count: int
    status: str
    komisi_dari: Decimal | None
    komisi_ke: Decimal
    delta: Decimal
    tercatat_at: datetime


class OrderDayStats(BaseModel):
    completed: int
    pending: int
    unpaid: int
    cancelled: int
    komisi: Decimal
    updated_at: datetime | None


class OrderDayResponse(BaseModel):
    stats: OrderDayStats
    rows: list[OrderRow]
    total: int
    page: int
    size: int


class OrderItemRow(BaseModel):
    nama_produk: str | None
    nama_toko: str | None
    status: str
    komisi_dari: Decimal | None
    komisi_ke: Decimal
    delta: Decimal


class OrderItemsResponse(BaseModel):
    order_id: str
    items: list[OrderItemRow]
    total_komisi: Decimal
