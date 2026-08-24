"""
adu_sync_worker.py — Sync statistik zone Adu Ads (Clickadu SSP Advertiser API)
ke tabel adu_placements. Bisa dipanggil dari scheduler maupun endpoint manual.

Clickadu endpoint statistics cuma bisa groupBy SATU dimensi per call (tidak ada
groupBy gabungan "date,zone"). Supaya dapat breakdown per (tanggal, zone) yang
dibutuhkan tabel adu_placements, kita panggil API sekali per tanggal dalam
rentang, masing-masing dengan groupBy=zone (dateFrom == dateTill).
"""

import logging
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from uuid import UUID

import httpx
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import AsyncSessionLocal
from app.models.adu import AduPlacement
from app.models.adu_account import AduAccount
from app.models.adu_sync_log import AduSyncLog

log = logging.getLogger(__name__)

CLICKADU_API_BASE = "https://ssp.clickadu.com"
STATS_PATH = "/v1.0/api/client/statistics/"
_ADU_KURS = 19_000  # 1 USD = Rp 19.000, sama seperti upload CSV manual

_ZONE_KEYS  = ("zoneId", "zone_id", "zone")
_COST_KEYS  = ("cost", "spend", "spentUsd", "spent_usd")
_IMP_KEYS   = ("impressions", "impression")
_CLICK_KEYS = ("clicks", "click")
_CONV_KEYS  = ("conversions", "conversion")


async def sync_account(account_id: UUID, dari: date, sampai: date) -> dict:
    """Sync satu AduAccount untuk rentang tanggal tertentu. Membuat DB session sendiri."""
    async with AsyncSessionLocal() as db:
        account = (await db.execute(
            sa.select(AduAccount).where(AduAccount.id == account_id)
        )).scalar_one_or_none()

        if not account or not account.api_key_enc:
            log.warning("adu sync_account: akun %s tidak ditemukan atau belum ada API key", account_id)
            return {"status": "skip", "rows_fetched": 0, "rows_upserted": 0, "rows_gagal": 0}

        fetched = upserted = gagal = 0
        status  = "selesai"
        catatan = None

        try:
            hari = dari
            async with httpx.AsyncClient(timeout=30) as client:
                while hari <= sampai:
                    rows = await _fetch_statistics(client, account.api_key_enc, hari, hari, "zone")
                    fetched += len(rows)
                    for row in rows:
                        try:
                            await _upsert_adu_row(account.user_id, hari, row, db)
                            upserted += 1
                        except Exception as e:
                            log.exception("adu upsert gagal: %s", e)
                            gagal += 1
                    hari += timedelta(days=1)
            account.status_koneksi = "terhubung"
        except httpx.HTTPStatusError as exc:
            catatan = _parse_error(exc.response.text)
            if exc.response.status_code == 401:
                account.status_koneksi = "token_expired"
            status = "gagal"
            log.error("Clickadu API error untuk akun %s: %s", account_id, catatan)
        except Exception as exc:
            catatan = str(exc)
            status = "gagal"
            log.exception("adu sync_account gagal untuk akun %s", account_id)

        db.add(AduSyncLog(
            adu_account_id=account_id,
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
    """Sync semua AduAccount yang punya API key aktif. Dipanggil oleh scheduler."""
    async with AsyncSessionLocal() as db:
        accounts = (await db.execute(
            sa.select(AduAccount).where(
                AduAccount.api_key_enc.isnot(None),
                AduAccount.status_koneksi != "token_expired",
            )
        )).scalars().all()

    log.info("adu auto-sync: %d akun, %s – %s", len(accounts), dari, sampai)
    for acc in accounts:
        try:
            result = await sync_account(acc.id, dari, sampai)
            log.info("adu auto-sync akun %s: %s", acc.id, result)
        except Exception as e:
            log.exception("adu auto-sync akun %s gagal: %s", acc.id, e)


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _fetch_statistics(
    client: httpx.AsyncClient, api_key: str, date_from: date, date_till: date, group_by: str,
) -> list[dict]:
    """Ambil semua baris statistik (auto-paginate) untuk satu rentang tanggal."""
    all_rows: list[dict] = []
    page = 0
    limit = 150
    while True:
        params = {
            "dateFrom": str(date_from),
            "dateTill": str(date_till),
            "groupBy": group_by,
            "limit": limit,
            "page": page,
        }
        resp = await client.get(
            f"{CLICKADU_API_BASE}{STATS_PATH}",
            params=params,
            headers={"Authorization": api_key},
        )
        resp.raise_for_status()
        data = resp.json()
        page_rows = data.get("result", data) if isinstance(data, dict) else data
        if not page_rows:
            break
        all_rows.extend(page_rows)
        if len(page_rows) < limit:
            break
        page += 1
    return all_rows


def _pick(row: dict, keys: tuple[str, ...]):
    lower_map = {k.lower(): v for k, v in row.items()}
    for k in keys:
        if k.lower() in lower_map:
            return lower_map[k.lower()]
    return None


def _to_int(v) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


async def _upsert_adu_row(user_id: UUID, tanggal: date, row: dict, db) -> None:
    zone_id = _pick(row, _ZONE_KEYS)
    if zone_id is None:
        raise ValueError(f"Field zone id tidak ditemukan di response: {list(row.keys())}")

    cost_raw = _pick(row, _COST_KEYS)
    try:
        cost_usd = Decimal(str(cost_raw)) if cost_raw is not None else Decimal("0")
    except InvalidOperation:
        cost_usd = Decimal("0")

    budget_rupiah = round(cost_usd * _ADU_KURS)

    stmt = pg_insert(AduPlacement).values(
        user_id=user_id,
        tanggal=tanggal,
        zone_id=str(zone_id),
        impressions=_to_int(_pick(row, _IMP_KEYS)),
        clicks=_to_int(_pick(row, _CLICK_KEYS)),
        conversions=_to_int(_pick(row, _CONV_KEYS)),
        cost_usd=cost_usd,
        budget_rupiah=budget_rupiah,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_adu_placement",
        set_={
            "impressions": stmt.excluded.impressions,
            "clicks": stmt.excluded.clicks,
            "conversions": stmt.excluded.conversions,
            "cost_usd": stmt.excluded.cost_usd,
            "budget_rupiah": stmt.excluded.budget_rupiah,
            "uploaded_at": sa.text("now()"),
        },
    )
    await db.execute(stmt)


def _parse_error(body: str) -> str:
    try:
        import json
        err = json.loads(body).get("error", {})
        return err.get("message", body)
    except Exception:
        return body
