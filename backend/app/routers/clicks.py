from collections import defaultdict
from datetime import date
from decimal import Decimal
from uuid import UUID

import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, Query

from app.core.deps import DB, CurrentUser
from app.models.account import ShopeeAccount
from app.models.campaign import TagLink
from app.models.metrics import ClickBySource, DailyMetric
from app.schemas.clicks import (
    ChannelBreakdownResponse, ChannelRow, ClickSummary,
    SourceClickRow, SourceClicksResponse,
    TaglinkClickRow, TaglinkClicksResponse,
)

router = APIRouter()
_ZERO = Decimal("0")


def _taglink_filter(user_id, shopee_account_id):
    q = (
        sa.select(
            DailyMetric.tag_link_id,
            sa.func.sum(DailyMetric.clicks_shopee).label("click"),
            sa.func.sum(DailyMetric.orders_selesai + DailyMetric.orders_tertunda).label("pesanan"),
            sa.func.sum(DailyMetric.commission_idr).label("komisi"),
        )
        .join(TagLink, DailyMetric.tag_link_id == TagLink.id)
        .join(ShopeeAccount, TagLink.shopee_account_id == ShopeeAccount.id)
        .where(
            ShopeeAccount.user_id == user_id,
            DailyMetric.tag_link_id.isnot(None),
        )
        .group_by(DailyMetric.tag_link_id)
    )
    if shopee_account_id:
        q = q.where(TagLink.shopee_account_id == shopee_account_id)
    return q


@router.get("/taglinks", response_model=TaglinkClicksResponse)
async def get_taglinks(
    current_user: CurrentUser,
    db: DB,
    tanggal_dari: date = Query(...),
    tanggal_sampai: date = Query(...),
    shopee_account_id: UUID | None = Query(None),
):
    metric_q = _taglink_filter(current_user.id, shopee_account_id).where(
        DailyMetric.tanggal.between(tanggal_dari, tanggal_sampai)
    )
    metric_rows = (await db.execute(metric_q)).all()

    # Get tag names
    tag_ids = [r.tag_link_id for r in metric_rows]
    tag_map: dict[UUID, str] = {}
    if tag_ids:
        tag_rows = (await db.execute(
            sa.select(TagLink.id, TagLink.tag).where(TagLink.id.in_(tag_ids))
        )).all()
        tag_map = {r.id: r.tag for r in tag_rows}

    taglinks: list[TaglinkClickRow] = []
    total_click = 0
    total_pesanan = 0
    total_komisi = _ZERO

    for r in metric_rows:
        click = r.click or 0
        pesanan = r.pesanan or 0
        komisi = r.komisi or _ZERO
        cr = (Decimal(pesanan) / click * 100).quantize(Decimal("0.01")) if click else None
        total_click += click
        total_pesanan += pesanan
        total_komisi += komisi
        taglinks.append(TaglinkClickRow(
            tag_link_id=r.tag_link_id,
            tag=tag_map.get(r.tag_link_id, "—"),
            click=click,
            pesanan=pesanan,
            cr_persen=cr,
            komisi=komisi,
        ))

    taglinks.sort(key=lambda x: x.click, reverse=True)
    cr_total = (Decimal(total_pesanan) / total_click * 100).quantize(Decimal("0.01")) if total_click else None

    return TaglinkClicksResponse(
        summary=ClickSummary(
            total_click=total_click,
            tag_link_count=len(taglinks),
            total_pesanan=total_pesanan,
            total_komisi=total_komisi,
            cr_persen=cr_total,
        ),
        taglinks=taglinks,
    )


@router.get("/sources", response_model=SourceClicksResponse)
async def get_sources(
    current_user: CurrentUser,
    db: DB,
    tanggal_dari: date = Query(...),
    tanggal_sampai: date = Query(...),
    shopee_account_id: UUID | None = Query(None),
):
    src_q = (
        sa.select(
            ClickBySource.sumber,
            sa.func.sum(ClickBySource.clicks).label("click"),
        )
        .join(TagLink, ClickBySource.tag_link_id == TagLink.id)
        .join(ShopeeAccount, TagLink.shopee_account_id == ShopeeAccount.id)
        .where(
            ShopeeAccount.user_id == current_user.id,
            ClickBySource.tanggal.between(tanggal_dari, tanggal_sampai),
        )
        .group_by(ClickBySource.sumber)
        .order_by(sa.func.sum(ClickBySource.clicks).desc())
    )
    if shopee_account_id:
        src_q = src_q.where(TagLink.shopee_account_id == shopee_account_id)

    src_rows = (await db.execute(src_q)).all()
    total_click = sum(r.click or 0 for r in src_rows)

    # Get total komisi for apportionment
    komisi_q = _taglink_filter(current_user.id, shopee_account_id).where(
        DailyMetric.tanggal.between(tanggal_dari, tanggal_sampai)
    )
    komisi_rows = (await db.execute(komisi_q)).all()
    total_komisi = sum((r.komisi or _ZERO) for r in komisi_rows)

    sources: list[SourceClickRow] = []
    for r in src_rows:
        click = r.click or 0
        share = (Decimal(click) / total_click * 100).quantize(Decimal("0.01")) if total_click else _ZERO
        komisi = (total_komisi * Decimal(click) / total_click).quantize(Decimal("1")) if total_click else _ZERO
        sources.append(SourceClickRow(sumber=r.sumber, click=click, share_persen=share, komisi=komisi))

    return SourceClicksResponse(
        sources=sources,
        total_click=total_click,
        total_komisi=total_komisi,
        source_count=len(sources),
    )


@router.get("/taglink/{tag_link_id}/channels", response_model=ChannelBreakdownResponse)
async def get_taglink_channels(
    tag_link_id: UUID,
    current_user: CurrentUser,
    db: DB,
    tanggal_dari: date = Query(...),
    tanggal_sampai: date = Query(...),
):
    # Verify ownership
    tl = (await db.execute(
        sa.select(TagLink)
        .join(ShopeeAccount, TagLink.shopee_account_id == ShopeeAccount.id)
        .where(TagLink.id == tag_link_id, ShopeeAccount.user_id == current_user.id)
    )).scalar_one_or_none()
    if not tl:
        raise HTTPException(404, "Tag link tidak ditemukan.")

    # Total komisi for this tag in date range
    komisi_row = (await db.execute(
        sa.select(sa.func.coalesce(sa.func.sum(DailyMetric.commission_idr), _ZERO))
        .where(DailyMetric.tag_link_id == tag_link_id, DailyMetric.tanggal.between(tanggal_dari, tanggal_sampai))
    )).scalar_one()
    total_komisi = komisi_row or _ZERO

    # Channel breakdown
    src_rows = (await db.execute(
        sa.select(
            ClickBySource.sumber,
            sa.func.sum(ClickBySource.clicks).label("click"),
        )
        .where(
            ClickBySource.tag_link_id == tag_link_id,
            ClickBySource.tanggal.between(tanggal_dari, tanggal_sampai),
        )
        .group_by(ClickBySource.sumber)
        .order_by(sa.func.sum(ClickBySource.clicks).desc())
    )).all()

    total_click = sum(r.click or 0 for r in src_rows)

    channels: list[ChannelRow] = []
    for r in src_rows:
        click = r.click or 0
        share = (Decimal(click) / total_click * 100).quantize(Decimal("0.01")) if total_click else _ZERO
        komisi = (total_komisi * Decimal(click) / total_click).quantize(Decimal("1")) if total_click else _ZERO
        channels.append(ChannelRow(sumber=r.sumber, click=click, share_persen=share, komisi=komisi))

    return ChannelBreakdownResponse(
        tag=tl.tag,
        tanggal_dari=tanggal_dari,
        tanggal_sampai=tanggal_sampai,
        total_click=total_click,
        total_komisi=total_komisi,
        channels=channels,
    )
