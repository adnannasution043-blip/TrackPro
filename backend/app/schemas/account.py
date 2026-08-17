from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Meta Account
# ---------------------------------------------------------------------------

class MetaAccountCreate(BaseModel):
    ad_account_id: str
    nama_tampilan: str
    mata_uang: str = "IDR"


class MetaAccountUpdate(BaseModel):
    nama_tampilan: str | None = None
    mata_uang: str | None = None
    status_koneksi: str | None = None


class MetaTokenUpdate(BaseModel):
    access_token: str  # long-lived token dari Meta (EAA...)


class MetaAccountResponse(BaseModel):
    id: UUID
    ad_account_id: str
    nama_tampilan: str
    mata_uang: str
    status_koneksi: str
    token_expires_at: datetime | None = None
    has_token: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Shopee Account
# ---------------------------------------------------------------------------

class ShopeeAccountCreate(BaseModel):
    nama_akun: str
    catatan: str | None = None


class ShopeeAccountUpdate(BaseModel):
    nama_akun: str | None = None
    catatan: str | None = None


class ShopeeAccountResponse(BaseModel):
    id: UUID
    nama_akun: str
    catatan: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Account Link (relasi meta <-> shopee)
# ---------------------------------------------------------------------------

class AccountLinkRequest(BaseModel):
    shopee_account_id: UUID


# ---------------------------------------------------------------------------
# Combined account list (dipakai frontend GET /accounts)
# ---------------------------------------------------------------------------

class AccountItem(BaseModel):
    id: UUID
    tipe: str          # "meta" | "shopee"
    nama: str          # nama_tampilan (meta) atau nama_akun (shopee)
    account_id: str | None   # ad_account_id (meta) atau None (shopee)
    status_koneksi: str | None = None


# ---------------------------------------------------------------------------
# Accounts tree (hierarki Meta → Shopee, dipakai sidebar filter)
# ---------------------------------------------------------------------------

class ShopeeLinked(BaseModel):
    id: UUID
    nama: str


class MetaWithShopee(BaseModel):
    id: UUID
    nama: str
    account_id: str
    shopee_accounts: list[ShopeeLinked]


class AccountsTree(BaseModel):
    meta_accounts: list[MetaWithShopee]
    shopee_unlinked: list[ShopeeLinked]
