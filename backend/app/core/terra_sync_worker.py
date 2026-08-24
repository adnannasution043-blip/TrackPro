"""
terra_sync_worker.py — Sync statistik placement Terra Ads (Adsterra Advertiser API)
ke tabel terra_placements. Bisa dipanggil dari scheduler maupun endpoint manual.

Beda dengan Clickadu, endpoint Adsterra mendukung group_by[] GANDA (date + placement
sekaligus) dalam satu request, jadi breakdown per (tanggal, placement) bisa didapat
langsung dari satu API call untuk seluruh rentang tanggal — tidak perlu loop per hari.
"""

import logging
from datetime import date
from decimal import Decimal, InvalidOperation
from uuid import UUID

import httpx
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import AsyncSessionLocal
from app.models.terra import TerraPlacement
from app.models.terra_account import TerraAccount
from app.models.terra_sync_log import TerraSyncLog

log = logging.getLogger(__name__)

TERRA_API_BASE = "https://api3.adsterratools.com"
STATS_PATH = "/advertiser/stats.json"
_TERRA_KURS = 19_000  # 1 USD = Rp 19.000, sama seperti upload CSV manual

_DATE_KEYS      = ("date",)
_PLACEMENT_KEYS = ("placement", "placementId", "placement_id")
_SPENT_KEYS     = ("spent", "cost")
_IMP_KEYS       = ("impressions", "impression")
_CLICK_KEYS     = ("clicks", "click")


async def sync_account(account_id: UUID, dari: date, sampai: date) -> dict:
    """Sync satu TerraAccount untuk rentang tanggal tertentu. Membuat DB session sendiri."""
    async with AsyncSessionLocal() as db:
        account = (await db.execute(
            sa.select(TerraAccount).where(TerraAccount.id == account_id)
        )).scalar_one_or_none()

        if not account or not account.api_key_enc:
            log.warning("terra sync_account: akun %s tidak ditemukan atau belum ada API key", account_id)
            return {"status": "skip", "rows_fetched": 0, "rows_upserted": 0, "rows_gagal": 0}

        fetched = upserted = gagal = 0
        status  = "selesai"
        catatan = None

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                rows = await _fetch_stats(client, account.api_key_enc, dari, sampai)
            fetched = len(rows)
            for row in rows:
                try:
                    await _upsert_terra_row(account.user_id, row, db)
                    upserted += 1
                except Exception as e:
                    log.exception("terra upsert gagal: %s", e)
                    gagal += 1
            account.status_koneksi = "terhubung"
        except httpx.HTTPStatusError as exc:
            catatan = _parse_error(exc.response.text)
            if exc.response.status_code == 401:
                account.status_koneksi = "token_expired"
            status = "gagal"
            log.error("Adsterra API error untuk akun %s: %s", account_id, catatan)
        except Exception as exc:
            catatan = str(exc)
            status = "gagal"
            log.exception("terra sync_account gagal untuk akun %s", account_id)

        db.add(TerraSyncLog(
            terra_account_id=account_id,
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
    """Sync semua TerraAccount yang punya API key aktif. Dipanggil oleh scheduler."""
    async with AsyncSessionLocal() as db:
        accounts = (await db.execute(
            sa.select(TerraAccount).where(
                TerraAccount.api_key_enc.isnot(None),
                TerraAccount.status_koneksi != "token_expired",
            )
        )).scalars().all()

    log.info("terra auto-sync: %d akun, %s – %s", len(accounts), dari, sampai)
    for acc in accounts:
        try:
            result = await sync_account(acc.id, dari, sampai)
            log.info("terra auto-sync akun %s: %s", acc.id, result)
        except Exception as e:
            log.exception("terra auto-sync akun %s gagal: %s", acc.id, e)


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _fetch_stats(client: httpx.AsyncClient, api_key: str, dari: date, sampai: date) -> list[dict]:
    params = {
        "start_date": str(dari),
        "finish_date": str(sampai),
        "group_by[]": ["date", "placement"],
    }
    resp = await client.get(
        f"{TERRA_API_BASE}{STATS_PATH}",
        params=params,
        headers={"X-API-Key": api_key, "Accept": "application/json"},
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("items", []) if isinstance(data, dict) else (data or [])


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


async def _upsert_terra_row(user_id: UUID, row: dict, db) -> None:
    tanggal_raw = _pick(row, _DATE_KEYS)
    if not tanggal_raw:
        raise ValueError(f"Field date tidak ditemukan di response: {list(row.keys())}")
    tanggal = date.fromisoformat(str(tanggal_raw)[:10])

    placement_id = _pick(row, _PLACEMENT_KEYS)
    if placement_id is None:
        raise ValueError(f"Field placement tidak ditemukan di response: {list(row.keys())}")

    spent_raw = _pick(row, _SPENT_KEYS)
    try:
        spent_usd = Decimal(str(spent_raw)) if spent_raw is not None else Decimal("0")
    except InvalidOperation:
        spent_usd = Decimal("0")

    budget_rupiah = round(spent_usd * _TERRA_KURS)

    stmt = pg_insert(TerraPlacement).values(
        user_id=user_id,
        tanggal=tanggal,
        placement_id=str(placement_id),
        impressions=_to_int(_pick(row, _IMP_KEYS)),
        clicks=_to_int(_pick(row, _CLICK_KEYS)),
        spent_usd=spent_usd,
        budget_rupiah=budget_rupiah,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_terra_placement",
        set_={
            "impressions": stmt.excluded.impressions,
            "clicks": stmt.excluded.clicks,
            "spent_usd": stmt.excluded.spent_usd,
            "budget_rupiah": stmt.excluded.budget_rupiah,
            "uploaded_at": sa.text("now()"),
        },
    )
    await db.execute(stmt)


def _parse_error(body: str) -> str:
    try:
        import json
        err = json.loads(body)
        return err.get("message") or err.get("error") or body
    except Exception:
        return body
