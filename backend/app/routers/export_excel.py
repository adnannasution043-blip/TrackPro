"""
Router Export Excel — generate laporan .xlsx per tahap campaign.

Format Excel:
- Sheet "TOTAL OFF"  : ringkasan semua tag per tanggal + baris TOTAL
- Sheet per tag link : data harian + rumus Excel (spend, komisi, profit, CPC, dll)
"""

import io
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

import sqlalchemy as sa
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from app.core.deps import DB, CurrentUser
from app.models.account import MetaAccount, ShopeeAccount
from app.models.campaign import Campaign, CampaignTagMap, TagLink
from app.models.metrics import DailyMetric

router = APIRouter()

_ZERO = Decimal("0")

# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------

def _hdr_font():  return Font(bold=True, size=10)
def _hdr_fill():  return PatternFill("solid", fgColor="1F4E79")  # navy
def _hdr_font_w(): return Font(bold=True, color="FFFFFF", size=10)

def _total_fill():   return PatternFill("solid", fgColor="D6E4F0")
def _total_font():   return Font(bold=True, size=10)

def _thin_border():
    s = Side(style="thin", color="C0C0C0")
    return Border(left=s, right=s, top=s, bottom=s)


def _apply_header(ws, cols: list[str], row: int = 1):
    for c, label in enumerate(cols, start=1):
        cell = ws.cell(row=row, column=c, value=label)
        cell.font = _hdr_font_w()
        cell.fill = _hdr_fill()
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = _thin_border()


def _apply_total_row(ws, row: int, n_cols: int):
    for c in range(1, n_cols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = _total_font()
        cell.fill = _total_fill()
        cell.border = _thin_border()


# ---------------------------------------------------------------------------
# Main endpoint
# ---------------------------------------------------------------------------

@router.get("/laporan-off")
async def export_laporan_off(
    current_user: CurrentUser,
    db: DB,
    tanggal_dari: date = Query(...),
    tanggal_sampai: date = Query(...),
    meta_account_id: UUID | None = Query(None),
    shopee_account_id: UUID | None = Query(None),
):
    dates = [tanggal_dari + timedelta(days=i)
             for i in range((tanggal_sampai - tanggal_dari).days + 1)]

    # 1. Kampanye tahap="off" milik user ini
    q_camp = (
        sa.select(Campaign)
        .join(MetaAccount, Campaign.meta_account_id == MetaAccount.id)
        .where(MetaAccount.user_id == current_user.id, Campaign.tahap == "off")
    )
    if meta_account_id:
        q_camp = q_camp.where(Campaign.meta_account_id == meta_account_id)
    campaigns = (await db.execute(q_camp)).scalars().all()

    if not campaigns:
        from fastapi import HTTPException
        raise HTTPException(404, "Tidak ada campaign dengan tahap OFF untuk periode ini.")

    camp_ids = [c.id for c in campaigns]

    # 2. Mapping campaign → tag_link(s)
    maps = (await db.execute(
        sa.select(CampaignTagMap)
        .where(CampaignTagMap.campaign_id.in_(camp_ids))
    )).scalars().all()

    # tag_link_id → campaign_id (ambil pertama jika ada lebih dari 1)
    tag_to_camp: dict[UUID, UUID] = {}
    camp_to_tags: dict[UUID, list[UUID]] = defaultdict(list)
    for m in maps:
        tag_to_camp[m.tag_link_id] = m.campaign_id
        camp_to_tags[m.campaign_id].append(m.tag_link_id)

    tag_ids = list(tag_to_camp.keys())

    # 3. Fetch tag names
    tag_objs = (await db.execute(
        sa.select(TagLink).where(TagLink.id.in_(tag_ids))
    )).scalars().all() if tag_ids else []
    tag_name: dict[UUID, str] = {t.id: t.tag for t in tag_objs}

    # 4. Daily metrics Meta (per campaign)
    meta_rows = (await db.execute(
        sa.select(DailyMetric)
        .where(
            DailyMetric.campaign_id.in_(camp_ids),
            DailyMetric.tanggal >= tanggal_dari,
            DailyMetric.tanggal <= tanggal_sampai,
        )
    )).scalars().all()

    # camp_id → tanggal → {spend, clicks_meta}
    meta_by: dict[UUID, dict[date, dict]] = defaultdict(dict)
    for r in meta_rows:
        meta_by[r.campaign_id][r.tanggal] = {
            "spend": r.spend_idr or _ZERO,
            "clicks_meta": r.clicks_meta or 0,
        }

    # 5. Daily metrics Shopee (per tag_link)
    shopee_rows = (await db.execute(
        sa.select(DailyMetric)
        .where(
            DailyMetric.tag_link_id.in_(tag_ids),
            DailyMetric.tanggal >= tanggal_dari,
            DailyMetric.tanggal <= tanggal_sampai,
        )
    )).scalars().all() if tag_ids else []

    # tag_id → tanggal → {komisi, clicks_shopee}
    shopee_by: dict[UUID, dict[date, dict]] = defaultdict(dict)
    for r in shopee_rows:
        shopee_by[r.tag_link_id][r.tanggal] = {
            "komisi": r.commission_idr or _ZERO,
            "clicks_shopee": r.clicks_shopee or 0,
        }

    # 6. Build Excel
    wb = Workbook()
    wb.remove(wb.active)  # hapus sheet default

    COLS = ["TGL", "Spend", "(+) 5%", "KOMISI", "PROFIT", "% PROFIT",
            "Klik FP", "Klik Shp", "(%) Klik", "CPC FP", "CPC Shp", "Tag Link", "Status", "Note"]
    N = len(COLS)

    # Data per tag untuk TOTAL sheet
    total_by_date: dict[date, dict] = defaultdict(lambda: {
        "spend": _ZERO, "komisi": _ZERO, "clicks_meta": 0, "clicks_shopee": 0
    })

    # Tentukan urutan sheets: per tag_link yang sudah dipetakan
    # Kampanye tanpa tag tetap masuk, tapi tanpa data Shopee
    sheets_order = []
    # Tag yang dipetakan
    for tag_id in tag_ids:
        sheets_order.append(("tag", tag_id))
    # Kampanye tanpa tag
    unmapped = [c for c in campaigns if c.id not in {tag_to_camp[t] for t in tag_ids}]
    for c in unmapped:
        sheets_order.append(("camp", c.id))

    for kind, eid in sheets_order:
        if kind == "tag":
            tag_id = eid
            camp_id = tag_to_camp[tag_id]
            sheet_name = (tag_name.get(tag_id, str(tag_id)[:30]))[:31]
            camp = next((c for c in campaigns if c.id == camp_id), None)
        else:
            camp_id = eid
            tag_id = None
            camp = next((c for c in campaigns if c.id == camp_id), None)
            sheet_name = (camp.nama_campaign[:31] if camp else str(camp_id)[:31])

        ws = wb.create_sheet(title=sheet_name)
        _apply_header(ws, COLS)

        data_rows = len(dates)
        for i, d in enumerate(dates, start=2):
            m = meta_by[camp_id].get(d, {}) if camp_id else {}
            s = shopee_by[tag_id].get(d, {}) if tag_id else {}

            spend = float(m.get("spend", 0))
            komisi = float(s.get("komisi", 0))
            clicks_meta = m.get("clicks_meta", 0)
            clicks_shopee = s.get("clicks_shopee", 0)

            ws.cell(row=i, column=1, value=d.strftime("%Y-%m-%d"))
            ws.cell(row=i, column=2, value=spend if spend else None)
            ws.cell(row=i, column=3, value=f"=B{i}+(B{i}*5%)" if spend else None)
            ws.cell(row=i, column=4, value=komisi if komisi else None)
            ws.cell(row=i, column=5, value=f"=D{i}-C{i}")
            ws.cell(row=i, column=6, value=f"=IF(C{i}=0,\"\",E{i}/C{i})")
            ws.cell(row=i, column=7, value=clicks_meta if clicks_meta else None)
            ws.cell(row=i, column=8, value=clicks_shopee if clicks_shopee else None)
            ws.cell(row=i, column=9, value=f"=IF(G{i}=0,\"\",H{i}/G{i})")
            ws.cell(row=i, column=10, value=f"=IF(G{i}=0,\"\",C{i}/G{i})")
            ws.cell(row=i, column=11, value=f"=IF(H{i}=0,\"\",D{i}/H{i})")
            ws.cell(row=i, column=12, value=tag_name.get(tag_id, "") if tag_id else "")
            # Status & Note kosong — diisi user manual
            ws.cell(row=i, column=13, value=None)
            ws.cell(row=i, column=14, value=None)

            # Kumpulkan untuk TOTAL sheet
            if tag_id:
                td = total_by_date[d]
                td["spend"] += Decimal(str(spend))
                td["komisi"] += Decimal(str(komisi))
                td["clicks_meta"] += clicks_meta
                td["clicks_shopee"] += clicks_shopee

        # Baris TOTAL
        total_row = data_rows + 2
        ws.cell(row=total_row, column=1, value="TOTAL")
        ws.cell(row=total_row, column=2, value=f"=SUM(B2:B{data_rows + 1})")
        ws.cell(row=total_row, column=3, value=f"=B{total_row}+(B{total_row}*5%)")
        ws.cell(row=total_row, column=4, value=f"=SUM(D2:D{data_rows + 1})")
        ws.cell(row=total_row, column=5, value=f"=D{total_row}-C{total_row}")
        ws.cell(row=total_row, column=6, value=f"=IF(C{total_row}=0,\"\",E{total_row}/C{total_row})")
        ws.cell(row=total_row, column=7, value=f"=SUM(G2:G{data_rows + 1})")
        ws.cell(row=total_row, column=8, value=f"=SUM(H2:H{data_rows + 1})")
        ws.cell(row=total_row, column=9, value=f"=IF(G{total_row}=0,\"\",H{total_row}/G{total_row})")
        ws.cell(row=total_row, column=10, value=f"=IF(G{total_row}=0,\"\",C{total_row}/G{total_row})")
        ws.cell(row=total_row, column=11, value=f"=IF(H{total_row}=0,\"\",D{total_row}/H{total_row})")
        _apply_total_row(ws, total_row, N)

        # Format kolom %
        for i in range(2, data_rows + 2):
            ws.cell(row=i, column=6).number_format = "0.00%"
            ws.cell(row=i, column=9).number_format = "0.00%"
        ws.cell(row=total_row, column=6).number_format = "0.00%"
        ws.cell(row=total_row, column=9).number_format = "0.00%"

        # Lebar kolom
        ws.column_dimensions["A"].width = 12
        ws.column_dimensions["B"].width = 14
        ws.column_dimensions["C"].width = 14
        ws.column_dimensions["D"].width = 14
        ws.column_dimensions["E"].width = 14
        ws.column_dimensions["F"].width = 10
        ws.column_dimensions["G"].width = 10
        ws.column_dimensions["H"].width = 10
        ws.column_dimensions["I"].width = 10
        ws.column_dimensions["J"].width = 12
        ws.column_dimensions["K"].width = 12
        ws.column_dimensions["L"].width = 22
        ws.column_dimensions["M"].width = 10
        ws.column_dimensions["N"].width = 20
        ws.freeze_panes = "B2"

    # ── Sheet TOTAL OFF ──────────────────────────────────────────────────────
    TOTAL_COLS = ["TGL", "Spend", "(+) 5%", "KOMISI", "PROFIT", "% PROFIT",
                  "Klik FP", "Klik Shp", "(%) Klik", "CPC FP", "CPC Shp"]
    ws_total = wb.create_sheet(title="TOTAL OFF", index=0)
    _apply_header(ws_total, TOTAL_COLS)

    for i, d in enumerate(dates, start=2):
        td = total_by_date[d]
        spend = float(td["spend"])
        komisi = float(td["komisi"])
        clicks_meta = td["clicks_meta"]
        clicks_shopee = td["clicks_shopee"]

        ws_total.cell(row=i, column=1, value=d.strftime("%Y-%m-%d"))
        ws_total.cell(row=i, column=2, value=spend if spend else None)
        ws_total.cell(row=i, column=3, value=f"=B{i}+(B{i}*5%)" if spend else None)
        ws_total.cell(row=i, column=4, value=komisi if komisi else None)
        ws_total.cell(row=i, column=5, value=f"=D{i}-C{i}")
        ws_total.cell(row=i, column=6, value=f"=IF(C{i}=0,\"\",E{i}/C{i})")
        ws_total.cell(row=i, column=7, value=clicks_meta if clicks_meta else None)
        ws_total.cell(row=i, column=8, value=clicks_shopee if clicks_shopee else None)
        ws_total.cell(row=i, column=9, value=f"=IF(G{i}=0,\"\",H{i}/G{i})")
        ws_total.cell(row=i, column=10, value=f"=IF(G{i}=0,\"\",C{i}/G{i})")
        ws_total.cell(row=i, column=11, value=f"=IF(H{i}=0,\"\",D{i}/H{i})")

        ws_total.cell(row=i, column=6).number_format = "0.00%"
        ws_total.cell(row=i, column=9).number_format = "0.00%"

    n_data = len(dates)
    tr = n_data + 2
    ws_total.cell(row=tr, column=1, value="TOTAL")
    ws_total.cell(row=tr, column=2, value=f"=SUM(B2:B{n_data + 1})")
    ws_total.cell(row=tr, column=3, value=f"=B{tr}+(B{tr}*5%)")
    ws_total.cell(row=tr, column=4, value=f"=SUM(D2:D{n_data + 1})")
    ws_total.cell(row=tr, column=5, value=f"=D{tr}-C{tr}")
    ws_total.cell(row=tr, column=6, value=f"=IF(C{tr}=0,\"\",E{tr}/C{tr})")
    ws_total.cell(row=tr, column=7, value=f"=SUM(G2:G{n_data + 1})")
    ws_total.cell(row=tr, column=8, value=f"=SUM(H2:H{n_data + 1})")
    ws_total.cell(row=tr, column=9, value=f"=IF(G{tr}=0,\"\",H{tr}/G{tr})")
    ws_total.cell(row=tr, column=10, value=f"=IF(G{tr}=0,\"\",C{tr}/G{tr})")
    ws_total.cell(row=tr, column=11, value=f"=IF(H{tr}=0,\"\",D{tr}/H{tr})")
    _apply_total_row(ws_total, tr, len(TOTAL_COLS))
    ws_total.cell(row=tr, column=6).number_format = "0.00%"
    ws_total.cell(row=tr, column=9).number_format = "0.00%"

    for col, w in zip("ABCDEFGHIJK", [12,14,14,14,14,10,10,10,10,12,12]):
        ws_total.column_dimensions[col].width = w
    ws_total.freeze_panes = "B2"

    # ── Stream response ──────────────────────────────────────────────────────
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    bulan = tanggal_dari.strftime("%B %Y").upper()
    filename = f"OFF FILTER META {bulan}.xlsx"

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
