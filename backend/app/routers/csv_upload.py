"""
Router upload CSV — 3 jenis file:
1. Meta Ads        → daily_metrics (campaign_id, spend_idr, clicks_meta)
2. Shopee Commission → daily_metrics (tag_link_id, orders_*, commission_idr, sales_idr)
                       + order_snapshots (per order_id, append-only)
3. Shopee Click    → daily_metrics (tag_link_id, clicks_shopee)

Upsert strategy:
- Tiap jenis CSV hanya update kolom miliknya sendiri, kolom lain tidak disentuh.
  Ini agar upload Meta dan upload Shopee untuk tanggal yang sama tidak saling
  menimpa (schema mengizinkan satu baris DailyMetric per (campaign_id, date)
  dan satu per (tag_link_id, date)).
- Re-upload CSV yang sama untuk tanggal yang sama akan mengganti nilai lama
  (bukan akumulasi), karena CSV adalah sumber kebenaran untuk periode itu.
"""

from collections import defaultdict
from datetime import date, datetime, timezone
from uuid import UUID

import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, Query, UploadFile, status
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.csv_parser import (
    CsvParseError,
    MetaAdsRow,
    ShopeeClickRow,
    ShopeeCommissionRow,
    parse_meta_ads_csv,
    parse_shopee_click_csv,
    parse_shopee_commission_csv,
)
from app.core.deps import DB, CurrentUser
from app.models.account import MetaAccount, ShopeeAccount
from app.models.campaign import Campaign, TagLink
from app.models.import_log import CsvImport
from app.models.metrics import DailyMetric, OrderSnapshot
from app.schemas.upload import UploadResponse

router = APIRouter()


# ===========================================================================
# Endpoint publik
# ===========================================================================

@router.post("/meta-ads", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_meta_ads(
    file: UploadFile,
    current_user: CurrentUser,
    db: DB,
    meta_account_id: UUID = Query(...),
):
    await _assert_meta_account_owned(meta_account_id, current_user.id, db)
    raw = await file.read()

    import_log = _start_import(current_user.id, "meta_ads", file.filename, db)

    try:
        rows = parse_meta_ads_csv(raw)
    except CsvParseError as exc:
        return await _fail_import(import_log, db, str(exc))

    ok, fail = 0, 0
    for row in rows:
        try:
            campaign = await _get_or_create_campaign(row, meta_account_id, db)
            await _upsert_meta_metric(campaign.id, row.tanggal, row.spend_idr, row.clicks_meta, db)
            ok += 1
        except Exception:
            fail += 1

    return await _finish_import(import_log, ok, fail, db)


@router.post("/shopee-commission", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_shopee_commission(
    file: UploadFile,
    current_user: CurrentUser,
    db: DB,
    shopee_account_id: UUID = Query(...),
):
    await _assert_shopee_account_owned(shopee_account_id, current_user.id, db)
    raw = await file.read()

    import_log = _start_import(current_user.id, "shopee_commission", file.filename, db,
                               shopee_account_id=shopee_account_id)

    try:
        rows = parse_shopee_commission_csv(raw)
    except CsvParseError as exc:
        return await _fail_import(import_log, db, str(exc))

    ok, fail = 0, 0

    # Agregasi per (tag, tanggal) untuk DailyMetric
    grouped: dict[tuple[str, date], list[ShopeeCommissionRow]] = defaultdict(list)
    for row in rows:
        grouped[(row.tag, row.tanggal_order)].append(row)

    for (tag, tanggal), group in grouped.items():
        try:
            tag_link = await _get_or_create_tag_link(tag, shopee_account_id, db)
            selesai = sum(1 for r in group if r.status == "completed")
            # pending dan unpaid digabung ke tertunda (skema tidak pisahkan keduanya)
            tertunda = sum(1 for r in group if r.status in ("pending", "unpaid"))
            batal = sum(1 for r in group if r.status == "cancelled")
            commission = sum(r.commission_idr for r in group)
            sales = sum(r.sales_idr for r in group)
            await _upsert_commission_metric(
                tag_link.id, tanggal, selesai, tertunda, batal, commission, sales, db
            )
            ok += len(group)
        except Exception:
            fail += len(group)
            continue

    # Order snapshots — append-only per order_id
    for row in rows:
        try:
            tag_link = await _get_or_create_tag_link(row.tag, shopee_account_id, db)
            snapshot = OrderSnapshot(
                shopee_account_id=shopee_account_id,
                order_id=row.order_id,
                tanggal_snapshot=row.tanggal_order,
                status=row.status,
                commission_from_idr=None,   # baseline diisi fitur "Perbarui Data Lama" (Fase 2)
                commission_to_idr=row.commission_idr,
            )
            db.add(snapshot)
        except Exception:
            pass

    await db.flush()
    return await _finish_import(import_log, ok, fail, db)


@router.post("/shopee-click", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_shopee_click(
    file: UploadFile,
    current_user: CurrentUser,
    db: DB,
    shopee_account_id: UUID = Query(...),
):
    await _assert_shopee_account_owned(shopee_account_id, current_user.id, db)
    raw = await file.read()

    import_log = _start_import(current_user.id, "shopee_click", file.filename, db,
                               shopee_account_id=shopee_account_id)

    try:
        rows = parse_shopee_click_csv(raw)
    except CsvParseError as exc:
        return await _fail_import(import_log, db, str(exc))

    ok, fail = 0, 0

    # Agregasi per (tag, tanggal) karena satu tag bisa punya beberapa baris sumber traffic
    grouped: dict[tuple[str, date], int] = defaultdict(int)
    for row in rows:
        grouped[(row.tag, row.tanggal)] += row.clicks

    for (tag, tanggal), total_clicks in grouped.items():
        try:
            tag_link = await _get_or_create_tag_link(tag, shopee_account_id, db)
            await _upsert_click_metric(tag_link.id, tanggal, total_clicks, db)
            ok += 1
        except Exception:
            fail += 1

    return await _finish_import(import_log, ok, fail, db)


# ===========================================================================
# Upsert helpers — masing-masing hanya update kolom miliknya
# ===========================================================================

async def _upsert_meta_metric(
    campaign_id: UUID, tanggal: date, spend_idr, clicks_meta: int, db: AsyncSession
) -> None:
    stmt = pg_insert(DailyMetric).values(
        campaign_id=campaign_id,
        tanggal=tanggal,
        spend_idr=spend_idr,
        clicks_meta=clicks_meta,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["campaign_id", "tanggal"],
        index_where=sa.text("campaign_id IS NOT NULL"),
        set_={"spend_idr": stmt.excluded.spend_idr, "clicks_meta": stmt.excluded.clicks_meta},
    )
    await db.execute(stmt)


async def _upsert_commission_metric(
    tag_link_id: UUID, tanggal: date,
    selesai: int, tertunda: int, batal: int, commission_idr, sales_idr,
    db: AsyncSession,
) -> None:
    stmt = pg_insert(DailyMetric).values(
        tag_link_id=tag_link_id,
        tanggal=tanggal,
        orders_selesai=selesai,
        orders_tertunda=tertunda,
        orders_batal=batal,
        commission_idr=commission_idr,
        sales_idr=sales_idr,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["tag_link_id", "tanggal"],
        index_where=sa.text("tag_link_id IS NOT NULL"),
        set_={
            "orders_selesai": stmt.excluded.orders_selesai,
            "orders_tertunda": stmt.excluded.orders_tertunda,
            "orders_batal": stmt.excluded.orders_batal,
            "commission_idr": stmt.excluded.commission_idr,
            "sales_idr": stmt.excluded.sales_idr,
        },
    )
    await db.execute(stmt)


async def _upsert_click_metric(
    tag_link_id: UUID, tanggal: date, clicks_shopee: int, db: AsyncSession
) -> None:
    stmt = pg_insert(DailyMetric).values(
        tag_link_id=tag_link_id,
        tanggal=tanggal,
        clicks_shopee=clicks_shopee,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["tag_link_id", "tanggal"],
        index_where=sa.text("tag_link_id IS NOT NULL"),
        set_={"clicks_shopee": stmt.excluded.clicks_shopee},
    )
    await db.execute(stmt)


# ===========================================================================
# Find-or-create: Campaign & TagLink
# ===========================================================================

async def _get_or_create_campaign(row: MetaAdsRow, meta_account_id: UUID, db: AsyncSession) -> Campaign:
    result = await db.execute(
        sa.select(Campaign).where(
            Campaign.meta_account_id == meta_account_id,
            Campaign.meta_campaign_id == row.meta_campaign_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if campaign:
        # Update nama kalau berubah di Meta
        if campaign.nama_campaign != row.nama_campaign:
            campaign.nama_campaign = row.nama_campaign
        return campaign

    campaign = Campaign(
        meta_account_id=meta_account_id,
        meta_campaign_id=row.meta_campaign_id,
        nama_campaign=row.nama_campaign,
    )
    db.add(campaign)
    await db.flush()  # dapat ID sebelum dipakai di upsert
    return campaign


async def _get_or_create_tag_link(tag: str, shopee_account_id: UUID, db: AsyncSession) -> TagLink:
    result = await db.execute(
        sa.select(TagLink).where(
            TagLink.shopee_account_id == shopee_account_id,
            TagLink.tag == tag,
        )
    )
    tag_link = result.scalar_one_or_none()
    if tag_link:
        return tag_link

    tag_link = TagLink(shopee_account_id=shopee_account_id, tag=tag)
    db.add(tag_link)
    await db.flush()
    return tag_link


# ===========================================================================
# Import log helpers
# ===========================================================================

def _start_import(
    user_id, tipe: str, nama_file: str, db: AsyncSession,
    shopee_account_id: UUID | None = None,
) -> CsvImport:
    log = CsvImport(
        user_id=user_id,
        shopee_account_id=shopee_account_id,
        tipe=tipe,
        nama_file=nama_file or "unknown.csv",
        file_ref=nama_file or "unknown.csv",   # MVP: simpan nama file saja, belum ada object storage
        status="diproses",
    )
    db.add(log)
    return log


async def _finish_import(log: CsvImport, ok: int, fail: int, db: AsyncSession) -> CsvImport:
    log.baris_diproses = ok
    log.baris_gagal = fail
    log.status = "selesai"
    log.processed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(log)
    return log


async def _fail_import(log: CsvImport, db: AsyncSession, detail: str) -> None:
    log.status = "gagal"
    log.catatan = detail
    log.processed_at = datetime.now(timezone.utc)
    await db.commit()
    raise HTTPException(status_code=422, detail=detail)


# ===========================================================================
# Guard: pastikan akun milik user yang request
# ===========================================================================

async def _assert_meta_account_owned(account_id: UUID, user_id, db: AsyncSession) -> None:
    result = await db.execute(
        sa.select(MetaAccount).where(MetaAccount.id == account_id, MetaAccount.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Akun Meta tidak ditemukan.")


async def _assert_shopee_account_owned(account_id: UUID, user_id, db: AsyncSession) -> None:
    result = await db.execute(
        sa.select(ShopeeAccount).where(ShopeeAccount.id == account_id, ShopeeAccount.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Akun Shopee tidak ditemukan.")
