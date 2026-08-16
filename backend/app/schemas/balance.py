from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class BalanceItem(BaseModel):
    meta_account_id: UUID
    nama_akun: str
    ad_account_id: str
    dikelola_oleh: str | None
    sisa_saldo: Decimal
    total_limit: Decimal
    terpakai: Decimal
    persen_terpakai: Decimal
    kemarin: Decimal
    cukup_hari: float | None
    topup_date: date | None
    status: str  # Habis | Segera | Aman
    updated_at: datetime | None


class BalanceSummary(BaseModel):
    sisa_saldo: Decimal
    total_limit: Decimal
    terpakai: Decimal
    persen_terpakai: Decimal
    jumlah_akun: int
    perlu_topup: int
    saldo_nol: int


class BalanceResponse(BaseModel):
    summary: BalanceSummary
    accounts: list[BalanceItem]
    terakhir_refresh: datetime | None


class BalanceUpsert(BaseModel):
    sisa_saldo: Decimal
    total_limit: Decimal
    dikelola_oleh: str | None = None
