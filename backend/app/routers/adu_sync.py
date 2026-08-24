"""
adu_sync.py — Trigger manual sync statistik Adu Ads (Clickadu API) untuk satu akun.
"""

from datetime import date
from uuid import UUID

import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.core.adu_sync_worker import sync_account
from app.core.deps import DB, CurrentUser
from app.models.adu_account import AduAccount
from app.models.adu_sync_log import AduSyncLog

router = APIRouter()


class AduSyncRequest(BaseModel):
    tanggal_dari: date
    tanggal_sampai: date


class AduSyncResponse(BaseModel):
    rows_fetched: int
    rows_upserted: int
    rows_gagal: int
    status: str
    catatan: str | None = None


@router.post("/{account_id}", response_model=AduSyncResponse)
async def sync_adu_ads(
    account_id: UUID,
    body: AduSyncRequest,
    current_user: CurrentUser,
    db: DB,
):
    account = await _get_account(account_id, current_user.id, db)
    if not account.api_key_enc:
        raise HTTPException(422, "Akun ini belum punya API key Clickadu. Tambahkan dulu di halaman Akun.")
    if body.tanggal_dari > body.tanggal_sampai:
        raise HTTPException(422, "Tanggal dari tidak boleh lebih dari tanggal sampai.")

    result = await sync_account(account_id, body.tanggal_dari, body.tanggal_sampai)
    if result["status"] == "gagal":
        raise HTTPException(502, "Sync gagal. Cek riwayat sync untuk detail.")
    return AduSyncResponse(**result)


@router.get("/{account_id}/logs")
async def get_adu_sync_logs(
    account_id: UUID,
    current_user: CurrentUser,
    db: DB,
    limit: int = Query(20, ge=1, le=100),
):
    await _get_account(account_id, current_user.id, db)
    result = await db.execute(
        sa.select(AduSyncLog)
        .where(AduSyncLog.adu_account_id == account_id)
        .order_by(AduSyncLog.synced_at.desc())
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


async def _get_account(account_id: UUID, user_id, db: DB) -> AduAccount:
    result = await db.execute(
        sa.select(AduAccount).where(AduAccount.id == account_id, AduAccount.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Akun Adu tidak ditemukan.")
    return account
