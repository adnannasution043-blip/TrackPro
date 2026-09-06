"""Router Biaya Layanan — input manual per tanggal (bukan dari CSV).

Dikurangi dari komisi (Live + Organik + Iklan) SEBELUM PPh 21 dihitung di
halaman Pembayaran WD > Komisi & Profit — lihat komisi_bersih.js.
"""
from datetime import date
from decimal import Decimal

import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.deps import DB, CurrentUser
from app.models.biaya_layanan import BiayaLayanan

router = APIRouter()


class BiayaLayananIn(BaseModel):
    tanggal: date
    jumlah: Decimal


@router.get("")
async def list_biaya_layanan(
    current_user: CurrentUser,
    db: DB,
    tanggal_dari: date = Query(...),
    tanggal_sampai: date = Query(...),
):
    rows = (await db.execute(
        sa.select(BiayaLayanan)
        .where(
            BiayaLayanan.user_id == current_user.id,
            BiayaLayanan.tanggal.between(tanggal_dari, tanggal_sampai),
        )
        .order_by(BiayaLayanan.tanggal)
    )).scalars().all()
    return [{"tanggal": str(r.tanggal), "jumlah": float(r.jumlah)} for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def upsert_biaya_layanan(body: BiayaLayananIn, current_user: CurrentUser, db: DB):
    if body.jumlah < 0:
        raise HTTPException(422, "Biaya layanan tidak boleh negatif.")

    stmt = pg_insert(BiayaLayanan).values(
        user_id=current_user.id,
        tanggal=body.tanggal,
        jumlah=body.jumlah,
    ).on_conflict_do_update(
        constraint="uq_biaya_layanan_user_tanggal",
        set_={"jumlah": body.jumlah, "updated_at": sa.text("now()")},
    )
    await db.execute(stmt)
    await db.commit()
    return {"tanggal": str(body.tanggal), "jumlah": float(body.jumlah)}


@router.delete("/{tanggal}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_biaya_layanan(tanggal: date, current_user: CurrentUser, db: DB):
    await db.execute(sa.delete(BiayaLayanan).where(
        BiayaLayanan.user_id == current_user.id,
        BiayaLayanan.tanggal == tanggal,
    ))
    await db.commit()
