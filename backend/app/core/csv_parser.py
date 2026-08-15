"""
csv_parser.py — Parser CSV untuk AdCommTrack
=============================================

Menangani 3 jenis file upload (lihat CLAUDE.md §2.8 "Data Pipeline"):

1. Meta Ads export         -> baris per (campaign, tanggal): spend, clicks
2. Shopee Commission export -> baris per order: status, komisi, tag link
3. Shopee Click export      -> baris per (tag link, tanggal): click, sumber traffic

Catatan penting:
- Nama kolom di sini adalah ASUMSI berdasarkan pola umum export Meta Ads
  Manager & Shopee Affiliate. WAJIB divalidasi ulang dengan file CSV asli
  sebelum dipakai produksi (lihat CLAUDE.md §7 "Yang Perlu Digali Lagi").
- Semua fungsi mengembalikan list of dict yang siap di-bulk-insert, bukan
  langsung insert ke DB — biar gampang di-unit-test terpisah dari DB layer.
- Uang selalu diproses sebagai Decimal, bukan float, untuk menghindari
  floating point drift pada agregasi ribuan baris.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Iterable


# ---------------------------------------------------------------------------
# Util umum
# ---------------------------------------------------------------------------

class CsvParseError(Exception):
    """Dilempar kalau format file tidak sesuai skema yang diharapkan."""


def _to_decimal(raw: str) -> Decimal:
    """
    Parse angka Rupiah dari CSV yang sering berformat "Rp 1.234.567" atau
    "1,234,567.00" tergantung locale export. Normalisasi dulu.
    """
    if raw is None:
        return Decimal("0")
    cleaned = (
        raw.strip()
        .replace("Rp", "")
        .replace(" ", "")
    )
    # Deteksi separator ribuan ala Indonesia (titik) vs desimal (koma)
    if "," in cleaned and "." in cleaned:
        # asumsi format 1.234.567,89 -> hapus titik, ganti koma jadi titik
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif cleaned.count(".") > 1:
        # 1.234.567 (tanpa desimal) -> titik semua sebagai ribuan
        cleaned = cleaned.replace(".", "")
    cleaned = cleaned.replace(",", "")
    if cleaned in ("", "-"):
        return Decimal("0")
    try:
        return Decimal(cleaned)
    except InvalidOperation as exc:
        raise CsvParseError(f"Nilai uang tidak valid: {raw!r}") from exc


def _to_date(raw: str) -> date:
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d-%b-%y"):
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    raise CsvParseError(f"Format tanggal tidak dikenali: {raw!r}")


def _read_rows(file_bytes: bytes) -> Iterable[dict]:
    text = file_bytes.decode("utf-8-sig")  # utf-8-sig untuk handle BOM dari Excel
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise CsvParseError("File CSV kosong atau tidak punya header.")
    for row in reader:
        yield {(k or "").strip(): (v or "").strip() for k, v in row.items()}


# ---------------------------------------------------------------------------
# 1. Meta Ads export
# ---------------------------------------------------------------------------

REQUIRED_META_COLUMNS = {"Campaign name", "Campaign ID", "Day", "Amount spent (IDR)", "Link clicks"}


@dataclass
class MetaAdsRow:
    meta_campaign_id: str
    nama_campaign: str
    tanggal: date
    spend_idr: Decimal
    clicks_meta: int


def parse_meta_ads_csv(file_bytes: bytes) -> list[MetaAdsRow]:
    rows = list(_read_rows(file_bytes))
    if not rows:
        return []

    header = set(rows[0].keys())
    missing = REQUIRED_META_COLUMNS - header
    if missing:
        raise CsvParseError(f"Kolom wajib hilang di file Meta Ads: {sorted(missing)}")

    parsed: list[MetaAdsRow] = []
    for i, row in enumerate(rows, start=2):  # baris 1 = header
        try:
            parsed.append(
                MetaAdsRow(
                    meta_campaign_id=row["Campaign ID"],
                    nama_campaign=row["Campaign name"],
                    tanggal=_to_date(row["Day"]),
                    spend_idr=_to_decimal(row["Amount spent (IDR)"]),
                    clicks_meta=int(row["Link clicks"] or 0),
                )
            )
        except CsvParseError as exc:
            raise CsvParseError(f"Baris {i}: {exc}") from exc
    return parsed


# ---------------------------------------------------------------------------
# 2. Shopee Commission export
# ---------------------------------------------------------------------------

REQUIRED_SHOPEE_COMMISSION_COLUMNS = {
    "Order ID", "Order Status", "Commission", "Sales Amount", "Sub ID", "Order Time",
}

# Kolom opsional — nama bervariasi tergantung setting bahasa Shopee Affiliate
_PRODUK_COLS = ("Product Name", "Nama Produk", "Product")
_TOKO_COLS   = ("Shop Name", "Seller Name", "Nama Toko", "Toko")
_QTY_COLS    = ("Quantity", "Qty", "Jumlah")


def _find_col(row: dict, candidates: tuple) -> str | None:
    for c in candidates:
        if c in row and row[c]:
            return row[c]
    return None


@dataclass
class ShopeeCommissionRow:
    order_id: str
    status: str          # dinormalisasi ke: completed / pending / unpaid / cancelled
    commission_idr: Decimal
    sales_idr: Decimal
    tag: str              # dari kolom "Sub ID" -> ini yang jadi tag_link
    tanggal_order: date
    nama_produk: str | None = None
    nama_toko: str | None = None
    qty: int = 1


_STATUS_MAP = {
    "completed": "completed",
    "selesai": "completed",
    "pending": "pending",
    "tertunda": "pending",
    "unpaid": "unpaid",
    "cancelled": "cancelled",
    "canceled": "cancelled",
    "dibatalkan": "cancelled",
}


def _normalize_status(raw: str) -> str:
    key = raw.strip().lower()
    if key not in _STATUS_MAP:
        raise CsvParseError(f"Status order tidak dikenali: {raw!r}")
    return _STATUS_MAP[key]


def parse_shopee_commission_csv(file_bytes: bytes) -> list[ShopeeCommissionRow]:
    rows = list(_read_rows(file_bytes))
    if not rows:
        return []

    header = set(rows[0].keys())
    missing = REQUIRED_SHOPEE_COMMISSION_COLUMNS - header
    if missing:
        raise CsvParseError(f"Kolom wajib hilang di file Shopee Commission: {sorted(missing)}")

    parsed: list[ShopeeCommissionRow] = []
    for i, row in enumerate(rows, start=2):
        try:
            qty_raw = _find_col(row, _QTY_COLS)
            parsed.append(
                ShopeeCommissionRow(
                    order_id=row["Order ID"],
                    status=_normalize_status(row["Order Status"]),
                    commission_idr=_to_decimal(row["Commission"]),
                    sales_idr=_to_decimal(row["Sales Amount"]),
                    tag=row["Sub ID"] or "non-meta",
                    tanggal_order=_to_date(row["Order Time"]),
                    nama_produk=_find_col(row, _PRODUK_COLS),
                    nama_toko=_find_col(row, _TOKO_COLS),
                    qty=int(qty_raw) if qty_raw and qty_raw.isdigit() else 1,
                )
            )
        except CsvParseError as exc:
            raise CsvParseError(f"Baris {i}: {exc}") from exc
    return parsed


# ---------------------------------------------------------------------------
# 3. Shopee Click export
# ---------------------------------------------------------------------------

REQUIRED_SHOPEE_CLICK_COLUMNS = {"Sub ID", "Date", "Clicks", "Source"}


@dataclass
class ShopeeClickRow:
    tag: str
    tanggal: date
    clicks: int
    sumber: str  # Facebook / Instagram / Websites / EdgeBrowser / Others


def parse_shopee_click_csv(file_bytes: bytes) -> list[ShopeeClickRow]:
    rows = list(_read_rows(file_bytes))
    if not rows:
        return []

    header = set(rows[0].keys())
    missing = REQUIRED_SHOPEE_CLICK_COLUMNS - header
    if missing:
        raise CsvParseError(f"Kolom wajib hilang di file Shopee Click: {sorted(missing)}")

    parsed: list[ShopeeClickRow] = []
    for i, row in enumerate(rows, start=2):
        try:
            parsed.append(
                ShopeeClickRow(
                    tag=row["Sub ID"] or "non-meta",
                    tanggal=_to_date(row["Date"]),
                    clicks=int(row["Clicks"] or 0),
                    sumber=row["Source"] or "Others",
                )
            )
        except CsvParseError as exc:
            raise CsvParseError(f"Baris {i}: {exc}") from exc
    return parsed


# ---------------------------------------------------------------------------
# 4. Diff engine — untuk fitur "Perbarui Data Lama" (CLAUDE.md §2.8, §4 order_snapshots)
# ---------------------------------------------------------------------------

@dataclass
class OrderDelta:
    order_id: str
    tanggal_snapshot: date
    status: str
    commission_from_idr: Decimal | None
    commission_to_idr: Decimal
    delta_idr: Decimal = field(init=False)

    def __post_init__(self):
        base = self.commission_from_idr or Decimal("0")
        self.delta_idr = self.commission_to_idr - base


def diff_commission_snapshots(
    baseline_rows: list[ShopeeCommissionRow],
    baru_rows: list[ShopeeCommissionRow],
    tanggal_snapshot: date,
) -> list[OrderDelta]:
    """
    Bandingkan file komisi lama (baseline) vs file baru untuk mendeteksi
    order yang statusnya berubah atau komisinya bergeser.
    Ini yang mengisi tabel order_snapshots dan menjadi sumber delta yang
    ditampilkan di modal "Laporan Pesanan" (CLAUDE.md §2.6).

    Order yang ada di baru tapi TIDAK ada di baseline -> commission_from = None
    (order baru pertama kali terdeteksi).
    Order yang ada di baseline tapi TIDAK ada di baru -> diabaikan (tidak
    dianggap hilang; kemungkinan besar file baru cuma cakupan window waktu
    yang lebih sempit — jangan asumsikan "dibatalkan").
    """
    baseline_by_id = {r.order_id: r for r in baseline_rows}

    deltas: list[OrderDelta] = []
    for row in baru_rows:
        prev = baseline_by_id.get(row.order_id)
        commission_from = prev.commission_idr if prev else None

        # Skip kalau tidak ada perubahan sama sekali (status sama & komisi sama)
        if prev and prev.status == row.status and prev.commission_idr == row.commission_idr:
            continue

        deltas.append(
            OrderDelta(
                order_id=row.order_id,
                tanggal_snapshot=tanggal_snapshot,
                status=row.status,
                commission_from_idr=commission_from,
                commission_to_idr=row.commission_idr,
            )
        )
    return deltas


# ---------------------------------------------------------------------------
# Contoh pemakaian (bukan bagian dari library, hanya ilustrasi alur)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Simulasi: upload pertama (baseline) lalu upload kedua (update)
    baseline_csv = (
        b"Order ID,Order Status,Commission,Sales Amount,Sub ID,Order Time\n"
        b"ORD001,Pending,10000,100000,pks180626,2026-08-10\n"
    )
    baru_csv = (
        b"Order ID,Order Status,Commission,Sales Amount,Sub ID,Order Time\n"
        b"ORD001,Completed,12000,100000,pks180626,2026-08-10\n"
        b"ORD002,Pending,5000,50000,pks180626,2026-08-11\n"
    )

    baseline = parse_shopee_commission_csv(baseline_csv)
    baru = parse_shopee_commission_csv(baru_csv)
    hasil_delta = diff_commission_snapshots(baseline, baru, tanggal_snapshot=date(2026, 8, 15))

    for d in hasil_delta:
        print(f"{d.order_id}: {d.status} | Rp{d.commission_from_idr} -> Rp{d.commission_to_idr} (Δ Rp{d.delta_idr})")
