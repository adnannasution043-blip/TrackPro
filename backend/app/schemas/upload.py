from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class UploadResponse(BaseModel):
    id: UUID
    tipe: str
    nama_file: str
    baris_diproses: int
    baris_gagal: int
    status: str
    processed_at: datetime | None

    model_config = {"from_attributes": True}
