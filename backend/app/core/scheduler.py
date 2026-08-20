"""
scheduler.py — jadwal auto-sync harian Meta Ads.
Jalan setiap hari jam 02.00 WIB (19.00 UTC) untuk sync data kemarin.
"""

import logging
from datetime import date, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.meta_sync_worker import sync_all_active_accounts

log = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="UTC")


def _register_jobs():
    # Setiap hari jam 19:00 UTC (= 02:00 WIB) — sync data kemarin
    scheduler.add_job(
        _daily_sync,
        trigger=CronTrigger(hour=19, minute=0, timezone="UTC"),
        id="daily_meta_sync",
        replace_existing=True,
        misfire_grace_time=3600,  # toleransi 1 jam kalau server sempat mati
    )
    log.info("Scheduler: job daily_meta_sync terdaftar (19:00 UTC setiap hari)")


async def _daily_sync():
    kemarin = date.today() - timedelta(days=1)
    log.info("auto-sync harian dimulai untuk tanggal %s", kemarin)
    try:
        await sync_all_active_accounts(dari=kemarin, sampai=kemarin)
    except Exception as e:
        log.exception("auto-sync harian gagal: %s", e)


def start_scheduler():
    _register_jobs()
    scheduler.start()
    log.info("Scheduler dimulai")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        log.info("Scheduler dihentikan")
