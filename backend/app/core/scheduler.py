"""
scheduler.py — jadwal auto-sync harian Meta Ads (pure asyncio, no extra deps).
Loop async yang tidur sampai jam 02.00 WIB (19.00 UTC) berikutnya lalu sync.
"""

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from app.core.meta_sync_worker import sync_all_active_accounts
from app.core.adu_sync_worker import sync_all_active_accounts as sync_all_adu_accounts
from app.core.terra_sync_worker import sync_all_active_accounts as sync_all_terra_accounts

log = logging.getLogger(__name__)

_task: asyncio.Task | None = None


def start_scheduler():
    global _task
    _task = asyncio.create_task(_loop())
    log.info("Scheduler dimulai (daily 19:00 UTC)")


def stop_scheduler():
    global _task
    if _task and not _task.done():
        _task.cancel()
        log.info("Scheduler dihentikan")


async def _loop():
    while True:
        delay = _seconds_until_next_run(hour=19, minute=0)
        log.info("Scheduler: tidur %.0f detik hingga run berikutnya", delay)
        await asyncio.sleep(delay)
        kemarin = date.today() - timedelta(days=1)
        log.info("auto-sync harian dimulai untuk tanggal %s", kemarin)
        try:
            await sync_all_active_accounts(dari=kemarin, sampai=kemarin)
        except Exception as e:
            log.exception("auto-sync harian Meta gagal: %s", e)
        try:
            await sync_all_adu_accounts(dari=kemarin, sampai=kemarin)
        except Exception as e:
            log.exception("auto-sync harian Adu gagal: %s", e)
        try:
            await sync_all_terra_accounts(dari=kemarin, sampai=kemarin)
        except Exception as e:
            log.exception("auto-sync harian Terra gagal: %s", e)


def _seconds_until_next_run(hour: int, minute: int) -> float:
    """Hitung detik sampai jam HH:MM UTC berikutnya."""
    now = datetime.now(tz=timezone.utc)
    next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if next_run <= now:
        next_run += timedelta(days=1)
    return (next_run - now).total_seconds()
