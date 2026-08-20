"""
meta_sync_worker.py — fungsi sync Meta yang bisa dipanggil dari scheduler
maupun OAuth callback (tanpa FastAPI dependency injection).
"""

import json
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

import httpx
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import AsyncSessionLocal
from app.models.account import MetaAccount
from app.models.campaign import Campaign
from app.models.meta_sync_log import MetaSyncLog
from app.models.metrics import DailyMetric

log = logging.getLogger(__name__)

META_API_BASE = "https://graph.facebook.com/v19.0"
META_FIELDS   = "campaign_id,campaign_name,spend,clicks,date_start"


async def sync_account(account_id: UUID, dari: date, sampai: date) -> dict:
    """Sync satu MetaAccount untuk rentang tanggal tertentu. Membuat DB session sendiri."""
    async with AsyncSessionLocal() as db:
        account = (await db.execute(
            sa.select(MetaAccount).where(MetaAccount.id == account_id)
        )).scalar_one_or_none()

        if not account or not account.access_token_enc:
            log.warning("sync_account: akun %s tidak ditemukan atau belum ada token", account_id)
            return {"status": "skip", "rows_fetched": 0, "rows_upserted": 0, "rows_gagal": 0}

        ad_acc = account.ad_account_id
        if not ad_acc.startswith("act_"):
            ad_acc = f"act_{ad_acc}"

        fetched = upserted = gagal = 0
        status  = "selesai"
        catatan = None

        try:
            rows = await _fetch_insights(ad_acc, account.access_token_enc, dari, sampai)
            fetched = len(rows)
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
                    upserted += 1
                except Exception as e:
                    log.exception("upsert gagal: %s", e)
                    gagal += 1
            account.status_koneksi = "terhubung"
        except httpx.HTTPStatusError as exc:
            catatan = _parse_meta_error(exc.response.text)
            if exc.response.status_code in (400, 401):
                account.status_koneksi = "token_expired"
            status = "gagal"
            log.error("Meta API error untuk akun %s: %s", account_id, catatan)
        except Exception as exc:
            catatan = str(exc)
            status = "gagal"
            log.exception("sync_account gagal untuk akun %s", account_id)

        db.add(MetaSyncLog(
            meta_account_id=account_id,
            user_id=account.user_id,
            tanggal_dari=dari,
            tanggal_sampai=sampai,
            rows_fetched=fetched,
            rows_upserted=upserted,
            rows_gagal=gagal,
            status=status,
            catatan=catatan,
        ))
        await db.commit()

    return {"status": status, "rows_fetched": fetched, "rows_upserted": upserted, "rows_gagal": gagal}


async def sync_all_active_accounts(dari: date, sampai: date) -> None:
    """Sync semua MetaAccount yang punya token aktif. Dipanggil oleh scheduler."""
    async with AsyncSessionLocal() as db:
        accounts = (await db.execute(
            sa.select(MetaAccount).where(
                MetaAccount.access_token_enc.isnot(None),
                MetaAccount.status_koneksi != "token_expired",
            )
        )).scalars().all()

    log.info("auto-sync: %d akun, %s – %s", len(accounts), dari, sampai)
    for acc in accounts:
        try:
            result = await sync_account(acc.id, dari, sampai)
            log.info("auto-sync akun %s: %s", acc.id, result)
        except Exception as e:
            log.exception("auto-sync akun %s gagal: %s", acc.id, e)


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _fetch_insights(ad_account_id: str, token: str, dari: date, sampai: date) -> list[dict]:
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

    async with httpx.AsyncClient(timeout=60) as client:
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


async def _get_or_create_campaign(meta_account_id: UUID, meta_campaign_id: str, nama_campaign: str, db):
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


async def _upsert_meta_metric(campaign_id: UUID, tanggal: date, spend_idr: Decimal, clicks_meta: int, db):
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
