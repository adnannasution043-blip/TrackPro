"""
Router "Hubungkan Taglink" — mapping manual Campaign Meta ↔ Tag Link Shopee.

Endpoint:
  GET  /campaigns                   list campaign milik user (+ status dipetakan)
  GET  /tags                        list tag_link milik user
  GET  /map                         list semua mapping dengan detail
  POST /map                         buat mapping baru
  PATCH /map/{map_id}               update tag_link + catatan pada mapping
  DELETE /map/{map_id}              hapus mapping
  GET  /tag-stats/{tag_link_id}     statistik orders & komisi untuk preview modal
"""

from datetime import date
from decimal import Decimal
from uuid import UUID

import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import DB, CurrentUser
from app.models.account import MetaAccount, ShopeeAccount
from app.models.campaign import Campaign, CampaignTagMap, TagLink
from app.models.metrics import DailyMetric
from app.schemas.taglink import (
    CampaignResponse, MapCreate, MapPatch, MapResponse,
    TagLinkResponse, TagStatsResponse,
)

router = APIRouter()

_ZERO = Decimal("0")

# ---------------------------------------------------------------------------
# Helper — SELECT dengan join ShopeeAccount (dipakai di beberapa endpoint)
# ---------------------------------------------------------------------------

def _map_select():
    return sa.select(
        CampaignTagMap.id,
        CampaignTagMap.campaign_id,
        Campaign.nama_campaign,
        Campaign.meta_campaign_id,
        CampaignTagMap.tag_link_id,
        TagLink.tag,
        TagLink.shopee_account_id,
        ShopeeAccount.nama_akun.label("akun_shopee"),
        CampaignTagMap.sumber,
        CampaignTagMap.catatan,
        CampaignTagMap.created_at,
    ).join(
        Campaign, CampaignTagMap.campaign_id == Campaign.id
    ).join(
        TagLink, CampaignTagMap.tag_link_id == TagLink.id
    ).join(
        ShopeeAccount, TagLink.shopee_account_id == ShopeeAccount.id
    ).join(
        MetaAccount, Campaign.meta_account_id == MetaAccount.id
    )


# ---------------------------------------------------------------------------
# Campaigns — list dengan status dipetakan
# ---------------------------------------------------------------------------

@router.get("/campaigns", response_model=list[CampaignResponse])
async def list_campaigns(
    current_user: CurrentUser,
    db: DB,
    meta_account_id: UUID | None = Query(None),
    dipetakan: bool | None = Query(None),
):
    mapped_ids_sq = sa.select(CampaignTagMap.campaign_id).distinct().subquery()

    q = (
        sa.select(
            Campaign,
            sa.case((Campaign.id.in_(sa.select(mapped_ids_sq.c.campaign_id)), True), else_=False).label("dipetakan"),
        )
        .join(MetaAccount, Campaign.meta_account_id == MetaAccount.id)
        .where(MetaAccount.user_id == current_user.id)
        .order_by(Campaign.nama_campaign)
    )

    if meta_account_id:
        q = q.where(Campaign.meta_account_id == meta_account_id)
    if dipetakan is True:
        q = q.where(Campaign.id.in_(sa.select(mapped_ids_sq.c.campaign_id)))
    elif dipetakan is False:
        q = q.where(Campaign.id.not_in(sa.select(mapped_ids_sq.c.campaign_id)))

    rows = (await db.execute(q)).all()
    return [
        CampaignResponse(**{c.key: getattr(campaign, c.key) for c in Campaign.__table__.columns}, dipetakan=is_mapped)
        for campaign, is_mapped in rows
    ]


# ---------------------------------------------------------------------------
# Tag Links — list
# ---------------------------------------------------------------------------

@router.get("/tags", response_model=list[TagLinkResponse])
async def list_tag_links(
    current_user: CurrentUser,
    db: DB,
    shopee_account_id: UUID | None = Query(None),
):
    q = (
        sa.select(TagLink)
        .join(ShopeeAccount, TagLink.shopee_account_id == ShopeeAccount.id)
        .where(ShopeeAccount.user_id == current_user.id)
        .order_by(TagLink.tag)
    )
    if shopee_account_id:
        q = q.where(TagLink.shopee_account_id == shopee_account_id)

    result = await db.execute(q)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Mapping — CRUD
# ---------------------------------------------------------------------------

@router.get("/map", response_model=list[MapResponse])
async def list_map(
    current_user: CurrentUser,
    db: DB,
    campaign_id: UUID | None = Query(None),
    tag_link_id: UUID | None = Query(None),
):
    q = (
        _map_select()
        .where(MetaAccount.user_id == current_user.id)
        .order_by(Campaign.nama_campaign, TagLink.tag)
    )
    if campaign_id:
        q = q.where(CampaignTagMap.campaign_id == campaign_id)
    if tag_link_id:
        q = q.where(CampaignTagMap.tag_link_id == tag_link_id)

    rows = (await db.execute(q)).mappings().all()
    return [MapResponse(**dict(r)) for r in rows]


@router.post("/map", response_model=MapResponse, status_code=status.HTTP_201_CREATED)
async def create_map(body: MapCreate, current_user: CurrentUser, db: DB):
    await _assert_campaign_owned(body.campaign_id, current_user.id, db)
    await _assert_tag_link_owned(body.tag_link_id, current_user.id, db)

    existing = await db.execute(
        sa.select(CampaignTagMap).where(
            CampaignTagMap.campaign_id == body.campaign_id,
            CampaignTagMap.tag_link_id == body.tag_link_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Pemetaan ini sudah ada.")

    mapping = CampaignTagMap(
        campaign_id=body.campaign_id,
        tag_link_id=body.tag_link_id,
        sumber="manual",
    )
    db.add(mapping)
    await db.flush()

    result = await db.execute(
        _map_select().where(CampaignTagMap.id == mapping.id)
    )
    row = result.mappings().one()
    await db.commit()
    return MapResponse(**dict(row))


@router.patch("/map/{map_id}", response_model=MapResponse)
async def patch_map(map_id: UUID, body: MapPatch, current_user: CurrentUser, db: DB):
    result = await db.execute(
        sa.select(CampaignTagMap)
        .join(Campaign, CampaignTagMap.campaign_id == Campaign.id)
        .join(MetaAccount, Campaign.meta_account_id == MetaAccount.id)
        .where(CampaignTagMap.id == map_id, MetaAccount.user_id == current_user.id)
    )
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise HTTPException(status_code=404, detail="Pemetaan tidak ditemukan.")

    await _assert_tag_link_owned(body.tag_link_id, current_user.id, db)
    mapping.tag_link_id = body.tag_link_id
    mapping.catatan = body.catatan

    await db.flush()

    result = await db.execute(
        _map_select().where(CampaignTagMap.id == map_id)
    )
    row = result.mappings().one()
    await db.commit()
    return MapResponse(**dict(row))


@router.delete("/map/{map_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_map(map_id: UUID, current_user: CurrentUser, db: DB):
    result = await db.execute(
        sa.select(CampaignTagMap)
        .join(Campaign, CampaignTagMap.campaign_id == Campaign.id)
        .join(MetaAccount, Campaign.meta_account_id == MetaAccount.id)
        .where(CampaignTagMap.id == map_id, MetaAccount.user_id == current_user.id)
    )
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise HTTPException(status_code=404, detail="Pemetaan tidak ditemukan.")

    await db.delete(mapping)
    await db.commit()


# ---------------------------------------------------------------------------
# Tag stats — dipakai oleh preview modal
# ---------------------------------------------------------------------------

@router.get("/tag-stats/{tag_link_id}", response_model=TagStatsResponse)
async def get_tag_stats(
    tag_link_id: UUID,
    current_user: CurrentUser,
    db: DB,
    tanggal_dari: date = Query(...),
    tanggal_sampai: date = Query(...),
):
    tl = (await db.execute(
        sa.select(TagLink)
        .join(ShopeeAccount, TagLink.shopee_account_id == ShopeeAccount.id)
        .where(TagLink.id == tag_link_id, ShopeeAccount.user_id == current_user.id)
    )).scalar_one_or_none()
    if not tl:
        raise HTTPException(404, "Tag link tidak ditemukan.")

    row = (await db.execute(
        sa.select(
            sa.func.coalesce(
                sa.func.sum(DailyMetric.orders_selesai + DailyMetric.orders_tertunda), 0
            ).label("orders"),
            sa.func.coalesce(sa.func.sum(DailyMetric.commission_idr), _ZERO).label("komisi"),
        )
        .where(
            DailyMetric.tag_link_id == tag_link_id,
            DailyMetric.tanggal.between(tanggal_dari, tanggal_sampai),
        )
    )).one()

    return TagStatsResponse(orders=int(row.orders or 0), komisi=row.komisi or _ZERO)


# ---------------------------------------------------------------------------
# Guards kepemilikan
# ---------------------------------------------------------------------------

async def _assert_campaign_owned(campaign_id: UUID, user_id, db: DB) -> None:
    result = await db.execute(
        sa.select(Campaign)
        .join(MetaAccount, Campaign.meta_account_id == MetaAccount.id)
        .where(Campaign.id == campaign_id, MetaAccount.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Campaign tidak ditemukan.")


async def _assert_tag_link_owned(tag_link_id: UUID, user_id, db: DB) -> None:
    result = await db.execute(
        sa.select(TagLink)
        .join(ShopeeAccount, TagLink.shopee_account_id == ShopeeAccount.id)
        .where(TagLink.id == tag_link_id, ShopeeAccount.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Tag link tidak ditemukan.")
