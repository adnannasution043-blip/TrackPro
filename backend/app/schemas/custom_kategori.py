from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CustomKategoriCreate(BaseModel):
    nama: str
    keyword: str
    ikut_total_kotor: bool = True


class CustomKategoriUpdate(BaseModel):
    nama: str | None = None
    keyword: str | None = None
    ikut_total_kotor: bool | None = None


class CustomKategoriResponse(BaseModel):
    id: UUID
    nama: str
    keyword: str
    ikut_total_kotor: bool
    urutan: int
    created_at: datetime

    model_config = {"from_attributes": True}
