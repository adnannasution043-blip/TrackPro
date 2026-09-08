"""
meta_sync_worker.py — fungsi sync Meta yang bisa dipanggil dari scheduler
maupun OAuth callback (tanpa FastAPI dependency injection).
"""

import asyncio
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
from app.models.balance import AccountBalance
from app.models.campaign import Campaign
from app.models.meta_sync_log import MetaSyncLog
from app.models.metrics import DailyMetric

log = logging.getLogger(__name__)

# Sentinel "unbounded" historis Meta buat spend_cap yang ga di-set eksplisit
# oleh user — jauh lebih besar dari limit rupiah manapun yang masuk akal.
_SPEND_CAP_UNBOUNDED = Decimal("1000000000000")  # Rp 1 triliun

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


# ===========================================================================
# Sisa Saldo — dihitung dari spend_cap - amount_spent (Graph API), BUKAN
# field "balance" (itu tagihan yang belum di-charge untuk akun kartu kredit,
# bukan sisa saldo — sudah divalidasi manual lewat endpoint test-balance).
# Cuma berlaku buat akun yang beneran punya spend_cap ter-set; kalau tidak,
# dilewati dan nilai manual yang sudah ada dibiarkan apa adanya.
# ===========================================================================

async def fetch_and_update_balance(account_id: UUID) -> dict:
    """Tarik spend_cap & amount_spent dari Graph API buat satu akun, hitung
    sisa_saldo = spend_cap - amount_spent, upsert ke account_balances.
    Buat DB session sendiri (bisa dipanggil dari scheduler/batch)."""
    async with AsyncSessionLocal() as db:
        account = (await db.execute(
            sa.select(MetaAccount).where(MetaAccount.id == account_id)
        )).scalar_one_or_none()
        if not account or not account.access_token_enc:
            return {"status": "skip", "alasan": "tidak ada token"}

        ad_acc = account.ad_account_id
        if not ad_acc.startswith("act_"):
            ad_acc = f"act_{ad_acc}"

        params = {"fields": "spend_cap,amount_spent", "access_token": account.access_token_enc}
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(f"{META_API_BASE}/{ad_acc}", params=params)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in (400, 401):
                account.status_koneksi = "token_expired"
                await db.commit()
            return {"status": "gagal", "alasan": _parse_meta_error(exc.response.text)}
        except Exception as exc:
            return {"status": "gagal", "alasan": str(exc)}

        data = resp.json()
        if data.get("spend_cap") is None or data.get("amount_spent") is None:
            return {"status": "skip", "alasan": "spend_cap tidak diset di akun ini"}

        try:
            spend_cap = Decimal(str(data["spend_cap"]))
            amount_spent = Decimal(str(data["amount_spent"]))
        except Exception:
            return {"status": "skip", "alasan": "format angka tidak dikenali"}

        if spend_cap <= 0 or spend_cap >= _SPEND_CAP_UNBOUNDED:
            return {"status": "skip", "alasan": "spend_cap tidak masuk akal / tidak diset"}

        sisa = max(spend_cap - amount_spent, Decimal("0"))

        stmt = pg_insert(AccountBalance).values(
            meta_account_id=account_id,
            sisa_saldo=sisa,
            total_limit=spend_cap,
        ).on_conflict_do_update(
            index_elements=["meta_account_id"],
            set_={"sisa_saldo": sisa, "total_limit": spend_cap, "updated_at": sa.text("now()")},
        )
        await db.execute(stmt)
        await db.commit()
        return {"status": "ok", "sisa_saldo": float(sisa), "total_limit": float(spend_cap)}


async def sync_all_balances(meta_account_ids: list[UUID] | None = None) -> dict:
    """Sync Sisa Saldo buat banyak akun sekaligus (default: semua akun yang
    punya token), dengan concurrency terbatas biar tidak lama & tidak
    langsung tembak 178 request bersamaan ke Meta."""
    async with AsyncSessionLocal() as db:
        q = sa.select(MetaAccount.id).where(MetaAccount.access_token_enc.isnot(None))
        if meta_account_ids is not None:
            q = q.where(MetaAccount.id.in_(meta_account_ids))
        ids = [r[0] for r in (await db.execute(q)).all()]

    sem = asyncio.Semaphore(8)

    async def _one(acc_id):
        async with sem:
            try:
                return await fetch_and_update_balance(acc_id)
            except Exception as e:
                log.exception("sync saldo akun %s gagal: %s", acc_id, e)
                return {"status": "gagal", "alasan": str(e)}

    results = await asyncio.gather(*(_one(i) for i in ids)) if ids else []
    ok    = sum(1 for r in results if r["status"] == "ok")
    skip  = sum(1 for r in results if r["status"] == "skip")
    gagal = sum(1 for r in results if r["status"] == "gagal")
    log.info("sync saldo: %d ok, %d skip, %d gagal (dari %d akun)", ok, skip, gagal, len(ids))
    return {"ok": ok, "skip": skip, "gagal": gagal, "total": len(ids)}
