"""Router Kategori Custom — kategori tambahan buat Laporan Harian yang
dikelola manual oleh user, dicocokkan ke tag_link lewat keyword (ILIKE),
berdampingan dengan kategori bawaan (Organic/Meta/Adu/Terra/Meta Pribadi/
Live) yang tetap hardcode di dashboard.py."""
from uuid import UUID

import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, status

from app.core.deps import DB, CurrentUser
from app.models.custom_kategori import CustomKategori
from app.schemas.custom_kategori import CustomKategoriCreate, CustomKategoriResponse, CustomKategoriUpdate

router = APIRouter()


@router.get("", response_model=list[CustomKategoriResponse])
async def list_custom_kategori(current_user: CurrentUser, db: DB):
    rows = (await db.execute(
        sa.select(CustomKategori)
        .where(CustomKategori.user_id == current_user.id)
        .order_by(CustomKategori.urutan, CustomKategori.created_at)
    )).scalars().all()
    return rows


@router.post("", response_model=CustomKategoriResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_kategori(body: CustomKategoriCreate, current_user: CurrentUser, db: DB):
    nama = body.nama.strip()
    keyword = body.keyword.strip()
    if not nama or not keyword:
        raise HTTPException(422, "Nama dan keyword wajib diisi.")

    existing = await db.execute(
        sa.select(CustomKategori).where(
            CustomKategori.user_id == current_user.id,
            CustomKategori.nama == nama,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Nama kategori sudah ada.")

    urutan = (await db.execute(
        sa.select(sa.func.coalesce(sa.func.max(CustomKategori.urutan), -1)).where(CustomKategori.user_id == current_user.id)
    )).scalar_one()

    kategori = CustomKategori(
        user_id=current_user.id,
        nama=nama,
        keyword=keyword,
        ikut_total_kotor=body.ikut_total_kotor,
        urutan=urutan + 1,
    )
    db.add(kategori)
    await db.commit()
    await db.refresh(kategori)
    return kategori


@router.patch("/{kategori_id}", response_model=CustomKategoriResponse)
async def update_custom_kategori(kategori_id: UUID, body: CustomKategoriUpdate, current_user: CurrentUser, db: DB):
    kategori = await _get_owned(kategori_id, current_user.id, db)
    data = body.model_dump(exclude_none=True)
    if "nama" in data:
        data["nama"] = data["nama"].strip()
        if not data["nama"]:
            raise HTTPException(422, "Nama tidak boleh kosong.")
    if "keyword" in data:
        data["keyword"] = data["keyword"].strip()
        if not data["keyword"]:
            raise HTTPException(422, "Keyword tidak boleh kosong.")
    for field, value in data.items():
        setattr(kategori, field, value)
    await db.commit()
    await db.refresh(kategori)
    return kategori


@router.delete("/{kategori_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_kategori(kategori_id: UUID, current_user: CurrentUser, db: DB):
    kategori = await _get_owned(kategori_id, current_user.id, db)
    await db.delete(kategori)
    await db.commit()


async def _get_owned(kategori_id: UUID, user_id, db: DB) -> CustomKategori:
    kategori = (await db.execute(
        sa.select(CustomKategori).where(CustomKategori.id == kategori_id, CustomKategori.user_id == user_id)
    )).scalar_one_or_none()
    if not kategori:
        raise HTTPException(404, "Kategori tidak ditemukan.")
    return kategori
