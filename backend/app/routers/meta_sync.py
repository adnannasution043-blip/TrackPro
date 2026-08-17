"""
meta_sync.py — Ambil data Meta Ads via Graph API dan simpan ke daily_metrics.

Strategi:
- Upsert ke daily_metrics HANYA kolom Meta (spend_idr, clicks_meta).
  Kolom Shopee (commission, clicks_shopee, orders) tidak disentuh.
  Artinya data Shopee dari CSV tetap aman walau sync Meta dijalankan ulang.
- Sama persis dengan logika upload CSV Meta Ads, cuma sumbernya API bukan file.
- Pagination otomatis lewat cursor "next" dari Meta API.
"""

import json
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

import httpx
import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.deps import DB, CurrentUser
from app.models.account import MetaAccount
from app.models.campaign import Campaign
from app.models.meta_sync_log import MetaSyncLog
from app.models.metrics import DailyMetric

router = APIRouter()

META_API_BASE = "https://graph.facebook.com/v19.0"
META_FIELDS = "campaign_id,campaign_name,spend,clicks,date_start"


# ===========================================================================
# Schemas
# ===========================================================================

class SyncRequest(BaseModel):
    tanggal_dari: date
    tanggal_sampai: date


class SyncResponse(BaseModel):
    rows_fetched: int
    rows_upserted: int
    rows_gagal: int
    status: str
    catatan: str | None = None


# ===========================================================================
# Endpoints
# ===========================================================================

@router.post("/{account_id}", response_model=SyncResponse)
async def sync_meta_ads(
    account_id: UUID,
    body: SyncRequest,
    current_user: CurrentUser,
    db: DB,
):
    """Tarik data insights dari Meta API untuk rentang tanggal tertentu."""
    account = await _get_account(account_id, current_user.id, db)

    if not account.access_token_enc:
        raise HTTPException(
            422, "Akun ini belum punya token Meta. Tambahkan token dulu di halaman Akun."
        )

    # Pastikan format ad_account_id: "act_XXXXXXX"
    ad_acc = account.ad_account_id
    if not ad_acc.startswith("act_"):
        ad_acc = f"act_{ad_acc}"

    # Fetch dari Meta API
    try:
        rows = await _fetch_insights(ad_acc, account.access_token_enc, body.tanggal_dari, body.tanggal_sampai)
    except httpx.HTTPStatusError as exc:
        detail = _parse_meta_error(exc.response.text)
        # Token expired / invalid → tandai di DB
        if exc.response.status_code in (400, 401):
            account.status_koneksi = "token_expired"
            await db.commit()
        await _log_sync(db, account_id, current_user.id, body, 0, 0, 0, "gagal", detail)
        raise HTTPException(502, f"Meta API error: {detail}")
    except httpx.RequestError as exc:
        msg = f"Gagal terhubung ke Meta API: {exc}"
        await _log_sync(db, account_id, current_user.id, body, 0, 0, 0, "gagal", msg)
        raise HTTPException(502, msg)

    # Upsert ke daily_metrics
    ok, fail = 0, 0
    for row in rows:
        try:
            campaign = await _get_or_create_campaign(
                meta_account_id=account_id,
                meta_campaign_id=row["campaign_id"],
                nama_campaign=row.get("campaign_name", row["campaign_id"]),
                db=db,
            )
            await _upsert_meta_metric(
                campaign_id=campaign.id,
                tanggal=date.fromisoformat(row["date_start"]),
                spend_idr=Decimal(row.get("spend", "0")),
                clicks_meta=int(row.get("clicks", 0)),
                db=db,
            )
            ok += 1
        except Exception:
            fail += 1

    account.status_koneksi = "terhubung"
    await _log_sync(db, account_id, current_user.id, body, len(rows), ok, fail, "selesai")

    return SyncResponse(rows_fetched=len(rows), rows_upserted=ok, rows_gagal=fail, status="selesai")


@router.get("/{account_id}/logs")
async def get_sync_logs(
    account_id: UUID,
    current_user: CurrentUser,
    db: DB,
    limit: int = Query(20, ge=1, le=100),
):
    """Riwayat sync Meta API untuk satu akun."""
    await _get_account(account_id, current_user.id, db)
    result = await db.execute(
        sa.select(MetaSyncLog)
        .where(MetaSyncLog.meta_account_id == account_id)
        .order_by(MetaSyncLog.synced_at.desc())
        .limit(limit)
    )
    return [
        {
            "id": log.id,
            "tanggal_dari": log.tanggal_dari,
            "tanggal_sampai": log.tanggal_sampai,
            "rows_fetched": log.rows_fetched,
            "rows_upserted": log.rows_upserted,
            "rows_gagal": log.rows_gagal,
            "status": log.status,
            "catatan": log.catatan,
            "synced_at": log.synced_at,
        }
        for log in result.scalars().all()
    ]


# ===========================================================================
# Meta Graph API
# ===========================================================================

async def _fetch_insights(
    ad_account_id: str, token: str, dari: date, sampai: date
) -> list[dict]:
    """Fetch per-campaign daily insights, auto-paginate lewat cursor."""
    params = {
        "fields": META_FIELDS,
        "time_increment": "1",
        "level": "campaign",
        "time_range": json.dumps({"since": str(dari), "until": str(sampai)}),
        "access_token": token,
        "limit": "500",
    }
    url: str | None = f"{META_API_BASE}/{ad_account_id}/insights"
    all_rows: list[dict] = []

    async with httpx.AsyncClient(timeout=30) as client:
        while url:
            if params:
                resp = await client.get(url, params=params)
                params = None
            else:
                resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            all_rows.extend(data.get("data", []))
            url = data.get("paging", {}).get("next")

    return all_rows


def _parse_meta_error(body: str) -> str:
    try:
        err = json.loads(body).get("error", {})
        return err.get("message", body)
    except Exception:
        return body


# ===========================================================================
# DB helpers — disengaja diduplikasi dari csv_upload.py agar tidak coupling
# ===========================================================================

async def _get_or_create_campaign(
    meta_account_id: UUID, meta_campaign_id: str, nama_campaign: str, db
) -> Campaign:
    result = await db.execute(
        sa.select(Campaign).where(
            Campaign.meta_account_id == meta_account_id,
            Campaign.meta_campaign_id == meta_campaign_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if campaign:
        if campaign.nama_campaign != nama_campaign:
            campaign.nama_campaign = nama_campaign
        return campaign
    campaign = Campaign(
        meta_account_id=meta_account_id,
        meta_campaign_id=meta_campaign_id,
        nama_campaign=nama_campaign,
    )
    db.add(campaign)
    await db.flush()
    return campaign


async def _upsert_meta_metric(
    campaign_id: UUID, tanggal: date, spend_idr: Decimal, clicks_meta: int, db
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


async def _get_account(account_id: UUID, user_id, db) -> MetaAccount:
    result = await db.execute(
        sa.select(MetaAccount).where(
            MetaAccount.id == account_id,
            MetaAccount.user_id == user_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Akun Meta tidak ditemukan.")
    return account


async def _log_sync(
    db, meta_account_id, user_id, body: SyncRequest,
    fetched: int, upserted: int, gagal: int,
    status: str, catatan: str | None = None,
) -> None:
    log = MetaSyncLog(
        meta_account_id=meta_account_id,
        user_id=user_id,
        tanggal_dari=body.tanggal_dari,
        tanggal_sampai=body.tanggal_sampai,
        rows_fetched=fetched,
        rows_upserted=upserted,
        rows_gagal=gagal,
        status=status,
        catatan=catatan,
    )
    db.add(log)
    await db.commit()
