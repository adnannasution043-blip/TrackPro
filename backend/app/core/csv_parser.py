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
    # Buang komponen waktu kalau ada (misal "2026-08-14 23:54:14" → "2026-08-14")
    date_part = raw.strip().split(" ")[0]
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d-%b-%y"):
        try:
            return datetime.strptime(date_part, fmt).date()
        except ValueError:
            continue
    raise CsvParseError(f"Format tanggal tidak dikenali: {raw!r}")


def _read_rows(file_bytes: bytes) -> Iterable[dict]:
    text = file_bytes.decode("utf-8-sig")  # utf-8-sig untuk handle BOM dari Excel
    if not text.strip():
        raise CsvParseError("File CSV kosong atau tidak punya header.")

    # Excel di regional Windows Indonesia nyimpen ".csv" pakai titik-koma
    # (karena koma dipakai sebagai pemisah desimal), bukan koma asli. Deteksi
    # dari baris header supaya file hasil "Save As" dari Excel tetap kebaca.
    first_line = text.split("\n", 1)[0]
    delimiter = ";" if first_line.count(";") > first_line.count(",") else ","

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if reader.fieldnames is None:
        raise CsvParseError("File CSV kosong atau tidak punya header.")
    n_cols = len(reader.fieldnames)
    for i, row in enumerate(reader, start=2):
        # Baris dengan jumlah kolom tidak sesuai header (mis. ada delimiter
        # nyasar di dalam data) masuk sebagai list di key None oleh
        # DictReader — lewati field itu daripada nge-crash di .strip().
        if None in row:
            raise CsvParseError(
                f"Baris {i}: jumlah kolom lebih dari header ({n_cols} kolom). "
                f"Kemungkinan file rusak saat di-save ulang lewat Excel — coba export ulang "
                f"langsung dari Shopee Affiliate, jangan lewat Excel dulu."
            )
        yield {(k or "").strip(): (v or "").strip() for k, v in row.items() if v is not None}


# ---------------------------------------------------------------------------
# 1. Meta Ads export
# ---------------------------------------------------------------------------

# Setiap alias adalah nama kolom yang diterima (English & Bahasa Indonesia)
_META_ALIAS: dict[str, list[str]] = {
    "campaign_name": ["Campaign name", "Nama kampanye"],
    "campaign_id":   ["Campaign ID"],                                           # opsional
    "day":           ["Day", "Awal pelaporan", "Akhir pelaporan"],
    "spend":         ["Amount spent (IDR)", "Jumlah yang dibelanjakan (IDR)"],
    "clicks":        ["Link clicks", "Klik Tautan Unik"],
}


def _resolve_col(row: dict, aliases: list[str]) -> str | None:
    """Kembalikan nilai kolom pertama yang ditemukan di aliases, atau None."""
    for a in aliases:
        if a in row:
            return row[a]
    return None


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

    # Validasi: pastikan minimal kolom wajib tersedia (salah satu alias-nya)
    header = set(rows[0].keys())
    required_keys = ["campaign_name", "day", "spend", "clicks"]
    for key in required_keys:
        if not any(a in header for a in _META_ALIAS[key]):
            raise CsvParseError(
                f"Kolom wajib '{key}' tidak ditemukan. "
                f"Diharapkan salah satu dari: {_META_ALIAS[key]}"
            )

    parsed: list[MetaAdsRow] = []
    for i, row in enumerate(rows, start=2):
        try:
            nama = _resolve_col(row, _META_ALIAS["campaign_name"]) or ""
            if not nama:
                continue  # skip baris kosong / total

            # Campaign ID opsional — fallback ke nama kampanye sebagai identifier
            campaign_id = _resolve_col(row, _META_ALIAS["campaign_id"]) or nama

            spend_raw = _resolve_col(row, _META_ALIAS["spend"]) or "0"
            clicks_raw = _resolve_col(row, _META_ALIAS["clicks"]) or "0"
            day_raw = _resolve_col(row, _META_ALIAS["day"]) or ""

            parsed.append(
                MetaAdsRow(
                    meta_campaign_id=campaign_id,
                    nama_campaign=nama,
                    tanggal=_to_date(day_raw),
                    spend_idr=_to_decimal(spend_raw),
                    clicks_meta=int(clicks_raw.split(".")[0] or 0),
                )
            )
        except CsvParseError as exc:
            raise CsvParseError(f"Baris {i}: {exc}") from exc
    return parsed


# ---------------------------------------------------------------------------
# 2. Shopee Commission export
# ---------------------------------------------------------------------------

_COMMISSION_ALIAS: dict[str, list[str]] = {
    "order_id":    ["Order ID", "ID Pemesanan"],
    "order_status":["Order Status", "Status Pesanan"],
    "commission":  ["Commission", "Komisi Bersih Affiliate (Rp)", "Total Komisi per Pesanan(Rp)"],
    "sales":       ["Sales Amount", "Nilai Pembelian(Rp)"],
    "sub_id":      ["Sub ID", "Tag_link1"],
    "order_time":  ["Order Time", "Waktu Pemesanan"],
}

# Kolom opsional — nama bervariasi tergantung bahasa Shopee Affiliate
_PRODUK_COLS   = ("Product Name", "Nama Produk", "Product", "Nama Barange", "Nama Barang")
_TOKO_COLS     = ("Shop Name", "Seller Name", "Nama Toko", "Toko")
_QTY_COLS      = ("Quantity", "Qty", "Jumlah")
_PLATFORM_COLS = ("Platform",)


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
    tag: str              # dari kolom "Sub ID" / "Tag_link1" -> jadi tag_link
    tanggal_order: date
    nama_produk: str | None = None
    nama_toko: str | None = None
    qty: int = 1
    platform: str | None = None  # kolom "Platform" — sumber traffic, mis. "ShopeeLive-Shopee"


_STATUS_MAP = {
    "completed": "completed",
    "selesai": "completed",
    "pending": "pending",
    "tertunda": "pending",
    "unpaid": "unpaid",
    "belum dibayar": "unpaid",
    "cancelled": "cancelled",
    "canceled": "cancelled",
    "dibatalkan": "cancelled",
    "ada": "pending",  # kolom "Status Pemebelian" kadang isi "Ada"
}


def _normalize_status(raw: str) -> str:
    key = raw.strip().lower()
    if key not in _STATUS_MAP:
        raise CsvParseError(f"Status order tidak dikenali: {raw!r}")
    return _STATUS_MAP[key]


def is_live_platform(platform: str | None) -> bool:
    """Order dianggap dari Shopee Live kalau kolom Platform mengandung 'live'
    (mis. "ShopeeLive-Shopee"), case-insensitive."""
    return bool(platform) and "live" in platform.strip().lower()


def parse_shopee_commission_csv(file_bytes: bytes, tag_slot: int = 1) -> list[ShopeeCommissionRow]:
    rows = list(_read_rows(file_bytes))
    if not rows:
        return []

    # Bangun alias sub_id: utamakan kolom slot yang dipilih, lalu fallback ke yang lain
    slot_col = f"Tag_link{tag_slot}"
    other_slots = [f"Tag_link{i}" for i in range(1, 6) if i != tag_slot]
    sub_id_aliases = [slot_col, "Sub ID"] + other_slots

    alias = {**_COMMISSION_ALIAS, "sub_id": sub_id_aliases}

    header = set(rows[0].keys())
    for key, aliases in alias.items():
        if not any(a in header for a in aliases):
            raise CsvParseError(
                f"Kolom wajib '{key}' tidak ditemukan. "
                f"Diharapkan salah satu dari: {aliases}"
            )

    parsed: list[ShopeeCommissionRow] = []
    for i, row in enumerate(rows, start=2):
        try:
            order_id = _resolve_col(row, alias["order_id"]) or ""
            if not order_id:
                continue

            qty_raw = _find_col(row, _QTY_COLS)
            tag_raw = _resolve_col(row, alias["sub_id"]) or "non-meta"
            # Shopee sering kirim tag dengan suffix "----", bersihkan
            tag = tag_raw.rstrip("-").strip() or "non-meta"

            parsed.append(
                ShopeeCommissionRow(
                    order_id=order_id,
                    status=_normalize_status(_resolve_col(row, alias["order_status"]) or ""),
                    commission_idr=_to_decimal(_resolve_col(row, alias["commission"]) or "0"),
                    sales_idr=_to_decimal(_resolve_col(row, alias["sales"]) or "0"),
                    tag=tag,
                    tanggal_order=_to_date(_resolve_col(row, alias["order_time"]) or ""),
                    nama_produk=_find_col(row, _PRODUK_COLS),
                    nama_toko=_find_col(row, _TOKO_COLS),
                    qty=int(qty_raw) if qty_raw and qty_raw.isdigit() else 1,
                    platform=_find_col(row, _PLATFORM_COLS),
                )
            )
        except CsvParseError as exc:
            raise CsvParseError(f"Baris {i}: {exc}") from exc
    return parsed


# ---------------------------------------------------------------------------
# 3. Shopee Click export
#
# Dua format yang diterima:
# A. Aggregated (lama): Sub ID, Date, Clicks, Source    → 1 baris per (tag, tanggal, sumber)
# B. Raw log  (baru):   Tag_link, Waktu Klik, Perujuk   → 1 baris per klik, perlu digroup
# ---------------------------------------------------------------------------

REQUIRED_SHOPEE_CLICK_COLUMNS = {"Sub ID", "Date", "Clicks", "Source"}
_SHOPEE_CLICK_RAW_COLS = {"Tag_link", "Waktu Klik", "Perujuk"}


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

    # --- Format B: raw click log per baris ---
    if _SHOPEE_CLICK_RAW_COLS <= header:
        counts: dict[tuple[str, date, str], int] = {}
        for i, row in enumerate(rows, start=2):
            try:
                tag_raw = row.get("Tag_link", "") or "non-meta"
                # Hapus suffix "----" yang ditambah Shopee pada tag
                tag = tag_raw.rstrip("-").strip() or "non-meta"

                waktu_raw = row.get("Waktu Klik", "")
                if not waktu_raw:
                    continue
                # Format "2026-08-14 23:59:54" → ambil tanggal saja
                tanggal = _to_date(waktu_raw.split(" ")[0])

                sumber = row.get("Perujuk", "") or "Others"
                key = (tag, tanggal, sumber)
                counts[key] = counts.get(key, 0) + 1
            except CsvParseError as exc:
                raise CsvParseError(f"Baris {i}: {exc}") from exc

        return [
            ShopeeClickRow(tag=tag, tanggal=tgl, clicks=n, sumber=src)
            for (tag, tgl, src), n in counts.items()
        ]

    # --- Format A: aggregated ---
    missing = REQUIRED_SHOPEE_CLICK_COLUMNS - header
    if missing:
        raise CsvParseError(
            f"Kolom wajib hilang di file Shopee Click: {sorted(missing)}. "
            f"Pastikan file adalah laporan klik Shopee Affiliate."
        )

    parsed: list[ShopeeClickRow] = []
    for i, row in enumerate(rows, start=2):
        try:
            tag_raw = row.get("Sub ID", "") or "non-meta"
            tag = tag_raw.rstrip("-").strip() or "non-meta"
            parsed.append(
                ShopeeClickRow(
                    tag=tag,
                    tanggal=_to_date(row["Date"]),
                    clicks=int(row["Clicks"] or 0),
                    sumber=row["Source"] or "Others",
                )
            )
        except CsvParseError as exc:
            raise CsvParseError(f"Baris {i}: {exc}") from exc
    return parsed


# ---------------------------------------------------------------------------
# 4. Meta Ads Breakdown exports (Placement / Platform / Usia & Gender)
# ---------------------------------------------------------------------------

REQUIRED_BREAKDOWN_BASE = {"Campaign name", "Campaign ID", "Day", "Amount spent (IDR)", "Impressions", "Link clicks"}


@dataclass
class MetaBreakdownRow:
    meta_campaign_id: str
    nama_campaign: str
    tanggal: date
    tipe: str    # 'placement' | 'platform' | 'age_gender'
    nilai: str   # e.g. "Facebook Feed" / "Instagram" / "18-24 / Male"
    spend_idr: Decimal
    impressions: int
    clicks: int


def parse_meta_breakdown_csv(file_bytes: bytes) -> list[MetaBreakdownRow]:
    """
    Auto-detect tipe breakdown dari header CSV:
    - Ada kolom "Placement" → tipe=placement
    - Ada kolom "Platform"  → tipe=platform
    - Ada kolom "Age" DAN "Gender" → tipe=age_gender
    """
    rows = list(_read_rows(file_bytes))
    if not rows:
        return []

    header = set(rows[0].keys())
    missing_base = REQUIRED_BREAKDOWN_BASE - header
    if missing_base:
        raise CsvParseError(f"Kolom wajib hilang di file Breakdown: {sorted(missing_base)}")

    if "Placement" in header:
        tipe = "placement"
        nilai_col = "Placement"
    elif "Platform" in header:
        tipe = "platform"
        nilai_col = "Platform"
    elif "Age" in header and "Gender" in header:
        tipe = "age_gender"
        nilai_col = None  # gabung dua kolom
    else:
        raise CsvParseError("Kolom breakdown tidak ditemukan. Tambahkan kolom Placement, Platform, atau Age+Gender.")

    parsed: list[MetaBreakdownRow] = []
    for i, row in enumerate(rows, start=2):
        try:
            if tipe == "age_gender":
                nilai = f"{row['Age']} / {row['Gender']}"
            else:
                nilai = row[nilai_col] or "Unknown"
            parsed.append(MetaBreakdownRow(
                meta_campaign_id=row["Campaign ID"],
                nama_campaign=row["Campaign name"],
                tanggal=_to_date(row["Day"]),
                tipe=tipe,
                nilai=nilai,
                spend_idr=_to_decimal(row["Amount spent (IDR)"]),
                impressions=int(row["Impressions"] or 0),
                clicks=int(row["Link clicks"] or 0),
            ))
        except CsvParseError as exc:
            raise CsvParseError(f"Baris {i}: {exc}") from exc
    return parsed


# ---------------------------------------------------------------------------
# 5. Diff engine — untuk fitur "Perbarui Data Lama" (CLAUDE.md §2.8, §4 order_snapshots)
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
