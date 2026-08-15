"""
Router Dashboard — agregasi dari daily_metrics.

daily_metrics punya dua dimensi yang terpisah:
  - baris campaign_id: spend_idr, clicks_meta  (dari Meta Ads CSV)
  - baris tag_link_id: clicks_shopee, orders_*, commission_idr, sales_idr  (dari Shopee CSV)

Query dijalankan dua kali (meta + shopee) lalu digabung by tanggal di Python.
Ini lebih eksplisit daripada FULL OUTER JOIN yang sulit di-maintain.
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal
from uuid import UUID

import sqlalchemy as sa
from fastapi import APIRouter, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import DB, CurrentUser
from app.models.account import MetaAccount, ShopeeAccount
from app.models.campaign import Campaign, CampaignTagMap, TagLink
from app.models.metrics import DailyMetric
from app.schemas.dashboard import DashboardResponse, DashboardSummary, HarianRow

router = APIRouter()

_ZERO = Decimal("0")


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    current_user: CurrentUser,
    db: DB,
    tanggal_dari: date = Query(...),
    tanggal_sampai: date = Query(...),
    meta_account_id: UUID | None = Query(None),
    shopee_account_id: UUID | None = Query(None),
):
    meta_rows = await _query_meta(db, current_user.id, tanggal_dari, tanggal_sampai, meta_account_id)
    shopee_rows = await _query_shopee(db, current_user.id, tanggal_dari, tanggal_sampai, shopee_account_id)
    komisi_nonmeta = await _query_nonmeta_commission(db, current_user.id, tanggal_dari, tanggal_sampai, shopee_account_id)

    # Gabung by tanggal
    by_date: dict[date, dict] = defaultdict(lambda: {
        "spend_idr": _ZERO, "clicks_meta": 0,
        "clicks_shopee": 0, "orders_selesai": 0, "orders_tertunda": 0,
        "orders_batal": 0, "commission_idr": _ZERO, "sales_idr": _ZERO,
    })

    for r in meta_rows:
        d = by_date[r.tanggal]
        d["spend_idr"] += r.spend_idr or _ZERO
        d["clicks_meta"] += r.clicks_meta or 0

    for r in shopee_rows:
        d = by_date[r.tanggal]
        d["clicks_shopee"] += r.clicks_shopee or 0
        d["orders_selesai"] += r.orders_selesai or 0
        d["orders_tertunda"] += r.orders_tertunda or 0
        d["orders_batal"] += r.orders_batal or 0
        d["commission_idr"] += r.commission_idr or _ZERO
        d["sales_idr"] += r.sales_idr or _ZERO

    # Bangun baris harian (urut by tanggal)
    harian: list[HarianRow] = []
    for tanggal in sorted(by_date):
        d = by_date[tanggal]
        spend = d["spend_idr"]
        komisi = d["commission_idr"]
        clicks_s = d["clicks_shopee"]
        selesai = d["orders_selesai"]

        laba = komisi - spend
        epc = (komisi / clicks_s).quantize(Decimal("0.01")) if clicks_s else None
        cr = (Decimal(selesai) / clicks_s * 100).quantize(Decimal("0.01")) if clicks_s else None

        harian.append(HarianRow(
            tanggal=tanggal,
            spend_idr=spend,
            clicks_meta=d["clicks_meta"],
            clicks_shopee=clicks_s,
            komisi=komisi,
            penjualan=d["sales_idr"],
            orders_selesai=selesai,
            orders_tertunda=d["orders_tertunda"],
            orders_batal=d["orders_batal"],
            laba=laba,
            epc=epc,
            cr_persen=cr,
        ))

    # Summary agregat
    total_biaya = sum((r.spend_idr or _ZERO for r in meta_rows), _ZERO)
    total_komisi = sum((r.commission_idr or _ZERO for r in shopee_rows), _ZERO)
    total_penjualan = sum((r.sales_idr or _ZERO for r in shopee_rows), _ZERO)
    total_selesai = sum(r.orders_selesai or 0 for r in shopee_rows)
    total_tertunda = sum(r.orders_tertunda or 0 for r in shopee_rows)
    total_batal = sum(r.orders_batal or 0 for r in shopee_rows)
    total_clicks_meta = sum(r.clicks_meta or 0 for r in meta_rows)
    total_clicks_shopee = sum(r.clicks_shopee or 0 for r in shopee_rows)

    total_laba = total_komisi - total_biaya
    roi = (total_laba / total_biaya * 100).quantize(Decimal("0.01")) if total_biaya else None
    total_terpetakan = total_komisi - komisi_nonmeta

    summary = DashboardSummary(
        total_biaya=total_biaya,
        total_penjualan=total_penjualan,
        total_komisi=total_komisi,
        total_komisi_terpetakan=total_terpetakan,
        total_komisi_nonmeta=komisi_nonmeta,
        total_laba=total_laba,
        roi_persen=roi,
        total_orders=total_selesai + total_tertunda,
        total_orders_selesai=total_selesai,
        total_orders_tertunda=total_tertunda,
        total_orders_batal=total_batal,
        total_clicks_meta=total_clicks_meta,
        total_clicks_shopee=total_clicks_shopee,
    )

    return DashboardResponse(summary=summary, harian=harian)


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------

async def _query_meta(db: AsyncSession, user_id, dari: date, sampai: date, meta_account_id=None):
    q = (
        sa.select(
            DailyMetric.tanggal,
            sa.func.sum(DailyMetric.spend_idr).label("spend_idr"),
            sa.func.sum(DailyMetric.clicks_meta).label("clicks_meta"),
        )
        .join(Campaign, DailyMetric.campaign_id == Campaign.id)
        .join(MetaAccount, Campaign.meta_account_id == MetaAccount.id)
        .where(
            MetaAccount.user_id == user_id,
            DailyMetric.campaign_id.isnot(None),
            DailyMetric.tanggal.between(dari, sampai),
        )
        .group_by(DailyMetric.tanggal)
        .order_by(DailyMetric.tanggal)
    )
    if meta_account_id:
        q = q.where(Campaign.meta_account_id == meta_account_id)
    return (await db.execute(q)).all()


async def _query_shopee(db: AsyncSession, user_id, dari: date, sampai: date, shopee_account_id=None):
    q = (
        sa.select(
            DailyMetric.tanggal,
            sa.func.sum(DailyMetric.clicks_shopee).label("clicks_shopee"),
            sa.func.sum(DailyMetric.orders_selesai).label("orders_selesai"),
            sa.func.sum(DailyMetric.orders_tertunda).label("orders_tertunda"),
            sa.func.sum(DailyMetric.orders_batal).label("orders_batal"),
            sa.func.sum(DailyMetric.commission_idr).label("commission_idr"),
            sa.func.sum(DailyMetric.sales_idr).label("sales_idr"),
        )
        .join(TagLink, DailyMetric.tag_link_id == TagLink.id)
        .join(ShopeeAccount, TagLink.shopee_account_id == ShopeeAccount.id)
        .where(
            ShopeeAccount.user_id == user_id,
            DailyMetric.tag_link_id.isnot(None),
            DailyMetric.tanggal.between(dari, sampai),
        )
        .group_by(DailyMetric.tanggal)
        .order_by(DailyMetric.tanggal)
    )
    if shopee_account_id:
        q = q.where(TagLink.shopee_account_id == shopee_account_id)
    return (await db.execute(q)).all()


async def _query_nonmeta_commission(
    db: AsyncSession, user_id, dari: date, sampai: date, shopee_account_id=None
) -> Decimal:
    """Komisi dari tag link yang belum di-map ke campaign manapun."""
    mapped_sq = sa.select(CampaignTagMap.tag_link_id).distinct().scalar_subquery()

    q = (
        sa.select(sa.func.coalesce(sa.func.sum(DailyMetric.commission_idr), _ZERO))
        .join(TagLink, DailyMetric.tag_link_id == TagLink.id)
        .join(ShopeeAccount, TagLink.shopee_account_id == ShopeeAccount.id)
        .where(
            ShopeeAccount.user_id == user_id,
            DailyMetric.tag_link_id.isnot(None),
            DailyMetric.tanggal.between(dari, sampai),
            DailyMetric.tag_link_id.not_in(mapped_sq),
        )
    )
    if shopee_account_id:
        q = q.where(TagLink.shopee_account_id == shopee_account_id)

    return (await db.execute(q)).scalar_one() or _ZERO
