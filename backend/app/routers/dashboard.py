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
from app.models.metrics import DailyMetric, MetaBreakdown, OrderSnapshot
from app.schemas.dashboard import (
    CampaignHarianResponse, CampaignHarianRow, CampaignRow, CampaignsResponse,
    CatatanUpdate, DashboardResponse, DashboardSummary, HarianRow, JenisIklanUpdate, TahapUpdate,
    TopProdukResponse, TopProdukRow,
)

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


@router.get("/top-products", response_model=TopProdukResponse)
async def get_top_products(
    current_user: CurrentUser,
    db: DB,
    tanggal: date = Query(...),
    shopee_account_id: UUID | None = Query(None),
    limit: int = Query(30, ge=1, le=100),
):
    q = (
        sa.select(OrderSnapshot)
        .join(ShopeeAccount, OrderSnapshot.shopee_account_id == ShopeeAccount.id)
        .where(
            ShopeeAccount.user_id == current_user.id,
            OrderSnapshot.tanggal_snapshot == tanggal,
        )
    )
    if shopee_account_id:
        q = q.where(OrderSnapshot.shopee_account_id == shopee_account_id)

    rows = (await db.execute(q)).scalars().all()

    # Agregasi per (nama_produk, nama_toko)
    produk_map: dict[tuple, dict] = {}
    selesai = tertunda = batal = diproses = 0
    for r in rows:
        key = (r.nama_produk or "—", r.nama_toko)
        if key not in produk_map:
            produk_map[key] = {"qty": 0, "penjualan": _ZERO, "komisi": _ZERO}
        produk_map[key]["qty"] += r.qty or 1
        produk_map[key]["penjualan"] += r.sales_idr or _ZERO
        produk_map[key]["komisi"] += r.commission_to_idr or _ZERO

        if r.status == "completed":
            selesai += 1
        elif r.status in ("pending", "unpaid"):
            tertunda += 1
        elif r.status == "cancelled":
            batal += 1
        else:
            diproses += 1

    def to_rows(key_fn) -> list[TopProdukRow]:
        items = sorted(produk_map.items(), key=key_fn, reverse=True)
        return [
            TopProdukRow(
                nama_produk=k[0],
                nama_toko=k[1],
                qty=v["qty"],
                penjualan=v["penjualan"],
                komisi=v["komisi"],
            )
            for k, v in items[:limit]
        ]

    return TopProdukResponse(
        top_komisi=to_rows(lambda kv: kv[1]["komisi"]),
        top_penjualan=to_rows(lambda kv: kv[1]["penjualan"]),
        top_produk=to_rows(lambda kv: kv[1]["qty"]),
        orders_selesai=selesai,
        orders_tertunda=tertunda,
        orders_batal=batal,
        orders_diproses=diproses,
    )


@router.get("/campaigns", response_model=CampaignsResponse)
async def get_campaigns(
    current_user: CurrentUser,
    db: DB,
    tanggal_dari: date | None = Query(None),
    tanggal_sampai: date | None = Query(None),
    meta_account_id: UUID | None = Query(None),
):
    dari = tanggal_dari or date.today().replace(day=1)
    sampai = tanggal_sampai or date.today()

    meta_q = (
        sa.select(
            Campaign.id,
            Campaign.nama_campaign,
            Campaign.status,
            Campaign.tahap,
            Campaign.jenis_iklan,
            Campaign.catatan,
            sa.func.coalesce(sa.func.sum(DailyMetric.spend_idr), _ZERO).label("spend_idr"),
            sa.func.coalesce(sa.func.sum(DailyMetric.clicks_meta), 0).label("clicks_meta"),
            sa.func.count(sa.distinct(DailyMetric.tanggal)).label("hari"),
        )
        .join(MetaAccount, Campaign.meta_account_id == MetaAccount.id)
        .outerjoin(
            DailyMetric,
            sa.and_(DailyMetric.campaign_id == Campaign.id, DailyMetric.tanggal.between(dari, sampai)),
        )
        .where(MetaAccount.user_id == current_user.id)
        .group_by(Campaign.id, Campaign.nama_campaign, Campaign.status, Campaign.tahap, Campaign.jenis_iklan, Campaign.catatan)
        .order_by(sa.func.coalesce(sa.func.sum(DailyMetric.spend_idr), _ZERO).desc())
    )
    if meta_account_id:
        meta_q = meta_q.where(Campaign.meta_account_id == meta_account_id)

    camp_rows = (await db.execute(meta_q)).all()
    if not camp_rows:
        return CampaignsResponse(campaigns=[])

    camp_ids = [r.id for r in camp_rows]

    # Shopee metrics + komisi per campaign via tag map
    shopee_q = (
        sa.select(
            CampaignTagMap.campaign_id,
            sa.func.coalesce(sa.func.sum(DailyMetric.commission_idr), _ZERO).label("komisi"),
            sa.func.coalesce(sa.func.sum(DailyMetric.sales_idr), _ZERO).label("penjualan"),
            sa.func.coalesce(sa.func.sum(DailyMetric.clicks_shopee), 0).label("clicks_shopee"),
            sa.func.coalesce(sa.func.sum(DailyMetric.orders_selesai + DailyMetric.orders_tertunda), 0).label("orders"),
        )
        .join(DailyMetric, DailyMetric.tag_link_id == CampaignTagMap.tag_link_id)
        .where(CampaignTagMap.campaign_id.in_(camp_ids), DailyMetric.tanggal.between(dari, sampai))
        .group_by(CampaignTagMap.campaign_id)
    )
    shopee_map = {r.campaign_id: r for r in (await db.execute(shopee_q)).all()}

    # Tag link (first per campaign)
    tag_q = (
        sa.select(CampaignTagMap.campaign_id, CampaignTagMap.tag_link_id, TagLink.tag)
        .join(TagLink, CampaignTagMap.tag_link_id == TagLink.id)
        .where(CampaignTagMap.campaign_id.in_(camp_ids))
    )
    tag_map: dict[UUID, tuple] = {}
    for r in (await db.execute(tag_q)).all():
        if r.campaign_id not in tag_map:
            tag_map[r.campaign_id] = (r.tag_link_id, r.tag)

    campaigns = []
    for r in camp_rows:
        spend = r.spend_idr or _ZERO
        s = shopee_map.get(r.id)
        komisi = s.komisi if s else _ZERO
        penjualan = s.penjualan if s else _ZERO
        clicks_shopee = s.clicks_shopee if s else 0
        orders = s.orders if s else 0
        laba = komisi - spend
        roi = (laba / spend * 100).quantize(Decimal("0.01")) if spend else None
        cpc = (spend / r.clicks_meta).quantize(Decimal("0.01")) if r.clicks_meta else None
        tag_info = tag_map.get(r.id)
        campaigns.append(CampaignRow(
            id=r.id,
            nama_campaign=r.nama_campaign,
            status=r.status or "ACTIVE",
            tahap=r.tahap,
            jenis_iklan=r.jenis_iklan,
            tag_link=tag_info[1] if tag_info else None,
            tag_link_id=tag_info[0] if tag_info else None,
            spend_idr=spend,
            clicks_meta=r.clicks_meta or 0,
            clicks_shopee=clicks_shopee,
            orders=orders,
            penjualan=penjualan,
            komisi=komisi,
            laba=laba,
            roi_persen=roi,
            cpc=cpc,
            hari=r.hari or 0,
            catatan=r.catatan,
        ))

    return CampaignsResponse(campaigns=campaigns)


@router.get("/campaigns/{campaign_id}/harian", response_model=CampaignHarianResponse)
async def get_campaign_harian(
    campaign_id: UUID,
    current_user: CurrentUser,
    db: DB,
):
    # Verify ownership
    camp = (await db.execute(
        sa.select(Campaign)
        .join(MetaAccount, Campaign.meta_account_id == MetaAccount.id)
        .where(Campaign.id == campaign_id, MetaAccount.user_id == current_user.id)
    )).scalar_one_or_none()
    if not camp:
        from fastapi import HTTPException
        raise HTTPException(404, "Campaign tidak ditemukan.")

    # Meta daily data
    meta_rows = (await db.execute(
        sa.select(DailyMetric)
        .where(DailyMetric.campaign_id == campaign_id)
        .order_by(DailyMetric.tanggal.desc())
    )).scalars().all()

    # Tag link IDs for this campaign
    tag_ids = [r[0] for r in (await db.execute(
        sa.select(CampaignTagMap.tag_link_id).where(CampaignTagMap.campaign_id == campaign_id)
    )).all()]

    # Shopee daily data grouped by date
    shopee_by_date: dict[date, dict] = {}
    if tag_ids:
        shopee_rows = (await db.execute(
            sa.select(
                DailyMetric.tanggal,
                sa.func.sum(DailyMetric.clicks_shopee).label("clicks_shopee"),
                sa.func.sum(DailyMetric.orders_selesai).label("orders_selesai"),
                sa.func.sum(DailyMetric.orders_tertunda).label("orders_tertunda"),
                sa.func.sum(DailyMetric.commission_idr).label("komisi"),
                sa.func.sum(DailyMetric.sales_idr).label("penjualan"),
            )
            .where(DailyMetric.tag_link_id.in_(tag_ids))
            .group_by(DailyMetric.tanggal)
        )).all()
        for r in shopee_rows:
            shopee_by_date[r.tanggal] = {
                "clicks_shopee": r.clicks_shopee or 0,
                "orders": (r.orders_selesai or 0) + (r.orders_tertunda or 0),
                "komisi": r.komisi or _ZERO,
                "penjualan": r.penjualan or _ZERO,
            }

    tag_name = None
    if tag_ids:
        tl = (await db.execute(sa.select(TagLink.tag).where(TagLink.id == tag_ids[0]))).scalar_one_or_none()
        tag_name = tl

    harian = []
    total_biaya = _ZERO
    total_komisi = _ZERO

    for m in meta_rows:
        spend = m.spend_idr or _ZERO
        s = shopee_by_date.get(m.tanggal)
        komisi = s["komisi"] if s else None
        laba = (komisi - spend) if komisi is not None else None
        roi = ((laba / spend * 100).quantize(Decimal("0.01")) if laba is not None and spend > 0 else None)
        cpc = ((spend / m.clicks_meta).quantize(Decimal("0.01")) if m.clicks_meta else None)
        total_biaya += spend
        if komisi:
            total_komisi += komisi
        harian.append(CampaignHarianRow(
            tanggal=m.tanggal,
            spend_idr=spend,
            cpc=cpc,
            clicks_meta=m.clicks_meta or 0,
            clicks_shopee=s["clicks_shopee"] if s else None,
            orders=s["orders"] if s else None,
            penjualan=s["penjualan"] if s else None,
            komisi=komisi,
            laba=laba,
            roi_persen=roi,
        ))

    total_laba = total_komisi - total_biaya
    roi_total = (total_laba / total_biaya * 100).quantize(Decimal("0.01")) if total_biaya else None

    return CampaignHarianResponse(
        nama_campaign=camp.nama_campaign,
        tag_link=tag_name,
        total_biaya=total_biaya,
        total_komisi=total_komisi,
        total_laba=total_laba,
        roi_persen=roi_total,
        harian=harian,
    )


@router.get("/campaigns/{campaign_id}/breakdown")
async def get_campaign_breakdown(
    campaign_id: UUID,
    current_user: CurrentUser,
    db: DB,
    tipe: str = Query(...),  # placement | platform | age_gender
    tanggal_dari: date | None = Query(None),
    tanggal_sampai: date | None = Query(None),
):
    from fastapi import HTTPException
    # Verify ownership
    camp = (await db.execute(
        sa.select(Campaign)
        .join(MetaAccount, Campaign.meta_account_id == MetaAccount.id)
        .where(Campaign.id == campaign_id, MetaAccount.user_id == current_user.id)
    )).scalar_one_or_none()
    if not camp:
        raise HTTPException(404, "Campaign tidak ditemukan.")

    q = (
        sa.select(
            MetaBreakdown.nilai,
            sa.func.sum(MetaBreakdown.spend_idr).label("spend_idr"),
            sa.func.sum(MetaBreakdown.impressions).label("impressions"),
            sa.func.sum(MetaBreakdown.clicks).label("clicks"),
        )
        .where(MetaBreakdown.campaign_id == campaign_id, MetaBreakdown.tipe == tipe)
        .group_by(MetaBreakdown.nilai)
        .order_by(sa.func.sum(MetaBreakdown.spend_idr).desc())
    )
    if tanggal_dari:
        q = q.where(MetaBreakdown.tanggal >= tanggal_dari)
    if tanggal_sampai:
        q = q.where(MetaBreakdown.tanggal <= tanggal_sampai)

    rows = (await db.execute(q)).all()
    total_spend = sum(r.spend_idr or _ZERO for r in rows) or _ZERO
    result = []
    for r in rows:
        spend = r.spend_idr or _ZERO
        impressions = r.impressions or 0
        clicks = r.clicks or 0
        cpm = (spend / impressions * 1000).quantize(Decimal("0.01")) if impressions else None
        cpc = (spend / clicks).quantize(Decimal("0.01")) if clicks else None
        ctr = (Decimal(clicks) / impressions * 100).quantize(Decimal("0.01")) if impressions else None
        persen = (spend / total_spend * 100).quantize(Decimal("0.1")) if total_spend else _ZERO
        result.append({
            "nilai": r.nilai,
            "spend_idr": float(spend),
            "impressions": impressions,
            "clicks": clicks,
            "cpm_idr": float(cpm) if cpm is not None else None,
            "cpc_idr": float(cpc) if cpc is not None else None,
            "ctr_persen": float(ctr) if ctr is not None else None,
            "persen_spend": float(persen),
        })
    return result


@router.get("/laporan-harian2")
async def get_laporan_harian2(
    current_user: CurrentUser,
    db: DB,
    tanggal_dari: date = Query(...),
    tanggal_sampai: date = Query(...),
    shopee_account_id: UUID | None = Query(None),
):
    """Laporan harian komisi dikelompokkan per keyword tag link."""

    def _sum_if(keyword: str):
        return sa.func.coalesce(
            sa.func.sum(
                sa.case(
                    (TagLink.tag.ilike(f"%{keyword}%"), DailyMetric.commission_idr),
                    else_=sa.literal(Decimal("0")),
                )
            ),
            Decimal("0"),
        )

    q = (
        sa.select(
            DailyMetric.tanggal,
            _sum_if("live").label("komisi_live"),
            _sum_if("story").label("komisi_story"),
            _sum_if("feed").label("komisi_feed"),
            _sum_if("meta").label("komisi_meta"),
            _sum_if("adu").label("komisi_adu"),
            _sum_if("terra").label("komisi_terra"),
        )
        .join(TagLink, DailyMetric.tag_link_id == TagLink.id)
        .join(ShopeeAccount, TagLink.shopee_account_id == ShopeeAccount.id)
        .where(
            ShopeeAccount.user_id == current_user.id,
            DailyMetric.tag_link_id.isnot(None),
            DailyMetric.tanggal.between(tanggal_dari, tanggal_sampai),
        )
        .group_by(DailyMetric.tanggal)
        .order_by(DailyMetric.tanggal)
    )
    if shopee_account_id:
        q = q.where(TagLink.shopee_account_id == shopee_account_id)

    rows = (await db.execute(q)).all()

    result = []
    for r in rows:
        live  = r.komisi_live  or _ZERO
        story = r.komisi_story or _ZERO
        feed  = r.komisi_feed  or _ZERO
        meta  = r.komisi_meta  or _ZERO
        adu   = r.komisi_adu   or _ZERO
        terra = r.komisi_terra or _ZERO
        total_fp    = live + story + feed
        total_iklan = meta + adu + terra
        result.append({
            "tanggal":      str(r.tanggal),
            "komisi_live":  float(live),
            "komisi_story": float(story),
            "komisi_feed":  float(feed),
            "total_fp":     float(total_fp),
            "komisi_meta":  float(meta),
            "komisi_adu":   float(adu),
            "komisi_terra": float(terra),
            "total_iklan":  float(total_iklan),
            "total_kotor":  float(total_fp + total_iklan),
        })
    return result


_VALID_TAHAP = {"pra_filter", "filter", "fix_scale_up", "off"}


@router.patch("/campaigns/{campaign_id}/tahap", status_code=204)
async def update_campaign_tahap(
    campaign_id: UUID,
    body: TahapUpdate,
    current_user: CurrentUser,
    db: DB,
):
    from fastapi import HTTPException
    if body.tahap not in _VALID_TAHAP:
        raise HTTPException(422, f"Tahap tidak valid: {body.tahap}")

    camp = (await db.execute(
        sa.select(Campaign)
        .join(MetaAccount, Campaign.meta_account_id == MetaAccount.id)
        .where(Campaign.id == campaign_id, MetaAccount.user_id == current_user.id)
    )).scalar_one_or_none()
    if not camp:
        raise HTTPException(404, "Campaign tidak ditemukan.")

    camp.tahap = body.tahap
    await db.commit()


@router.patch("/campaigns/{campaign_id}/catatan", status_code=204)
async def update_campaign_catatan(
    campaign_id: UUID,
    body: CatatanUpdate,
    current_user: CurrentUser,
    db: DB,
):
    from fastapi import HTTPException
    camp = (await db.execute(
        sa.select(Campaign)
        .join(MetaAccount, Campaign.meta_account_id == MetaAccount.id)
        .where(Campaign.id == campaign_id, MetaAccount.user_id == current_user.id)
    )).scalar_one_or_none()
    if not camp:
        raise HTTPException(404, "Campaign tidak ditemukan.")

    camp.catatan = body.catatan or None
    await db.commit()


_VALID_JENIS = {"GAMBAR", "VIDEO", None}


@router.patch("/campaigns/{campaign_id}/jenis-iklan", status_code=204)
async def update_campaign_jenis_iklan(
    campaign_id: UUID,
    body: JenisIklanUpdate,
    current_user: CurrentUser,
    db: DB,
):
    from fastapi import HTTPException
    if body.jenis_iklan not in _VALID_JENIS:
        raise HTTPException(422, f"Jenis iklan tidak valid: {body.jenis_iklan}")

    camp = (await db.execute(
        sa.select(Campaign)
        .join(MetaAccount, Campaign.meta_account_id == MetaAccount.id)
        .where(Campaign.id == campaign_id, MetaAccount.user_id == current_user.id)
    )).scalar_one_or_none()
    if not camp:
        raise HTTPException(404, "Campaign tidak ditemukan.")

    camp.jenis_iklan = body.jenis_iklan
    await db.commit()


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
