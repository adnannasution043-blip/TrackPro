from collections import defaultdict
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select

from app.core.deps import DB, CurrentUser
from app.models.account import AccountLink, MetaAccount, ShopeeAccount
from app.models.adu_account import AduAccount
from datetime import datetime, timedelta, timezone

from app.schemas.account import (
    AccountItem,
    AccountLinkRequest,
    AccountsTree,
    AduAccountCreate,
    AduAccountResponse,
    AduAccountUpdate,
    AduApiKeyUpdate,
    MetaAccountCreate,
    MetaAccountResponse,
    MetaAccountUpdate,
    MetaTokenUpdate,
    ShopeeAccountCreate,
    ShopeeAccountResponse,
    ShopeeAccountUpdate,
)

router = APIRouter()


# ===========================================================================
# Combined list — dipakai frontend
# ===========================================================================

@router.get("", response_model=list[AccountItem])
async def list_all_accounts(current_user: CurrentUser, db: DB):
    meta_res = await db.execute(
        select(MetaAccount)
        .where(MetaAccount.user_id == current_user.id)
        .order_by(MetaAccount.created_at)
    )
    shopee_res = await db.execute(
        select(ShopeeAccount)
        .where(ShopeeAccount.user_id == current_user.id)
        .order_by(ShopeeAccount.created_at)
    )
    items: list[AccountItem] = []
    for m in meta_res.scalars().all():
        items.append(AccountItem(
            id=m.id,
            tipe="meta",
            nama=m.nama_tampilan,
            account_id=m.ad_account_id,
            status_koneksi=m.status_koneksi,
        ))
    for s in shopee_res.scalars().all():
        items.append(AccountItem(
            id=s.id,
            tipe="shopee",
            nama=s.nama_akun,
            account_id=None,
            status_koneksi=None,
        ))
    return items


# ===========================================================================
# Tree: Meta + linked Shopee (untuk sidebar filter & halaman manajemen akun)
# ===========================================================================

@router.get("/tree", response_model=AccountsTree)
async def get_accounts_tree(current_user: CurrentUser, db: DB):
    meta_res = await db.execute(
        select(MetaAccount)
        .where(MetaAccount.user_id == current_user.id)
        .order_by(MetaAccount.created_at)
    )
    meta_list = meta_res.scalars().all()

    shopee_res = await db.execute(
        select(ShopeeAccount)
        .where(ShopeeAccount.user_id == current_user.id)
        .order_by(ShopeeAccount.created_at)
    )
    all_shopee = shopee_res.scalars().all()
    shopee_by_id = {s.id: s for s in all_shopee}

    linked_ids: set = set()
    links_by_meta: dict = defaultdict(list)

    if meta_list:
        meta_ids = [m.id for m in meta_list]
        links_res = await db.execute(
            select(AccountLink).where(AccountLink.meta_account_id.in_(meta_ids))
        )
        for link in links_res.scalars().all():
            links_by_meta[link.meta_account_id].append(link.shopee_account_id)
            linked_ids.add(link.shopee_account_id)

    meta_with_shopee = []
    for m in meta_list:
        shopee_list = []
        for sid in links_by_meta.get(m.id, []):
            if sid in shopee_by_id:
                s = shopee_by_id[sid]
                shopee_list.append({"id": s.id, "nama": s.nama_akun})
        meta_with_shopee.append({
            "id": m.id,
            "nama": m.nama_tampilan,
            "account_id": m.ad_account_id,
            "shopee_accounts": shopee_list,
        })

    unlinked = [
        {"id": s.id, "nama": s.nama_akun}
        for s in all_shopee
        if s.id not in linked_ids
    ]

    return {"meta_accounts": meta_with_shopee, "shopee_unlinked": unlinked}


# ===========================================================================
# Meta Accounts
# ===========================================================================

@router.get("/meta", response_model=list[MetaAccountResponse])
async def list_meta_accounts(current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(MetaAccount)
        .where(MetaAccount.user_id == current_user.id)
        .order_by(MetaAccount.created_at)
    )
    return [_to_meta_response(m) for m in result.scalars().all()]


@router.post("/meta", response_model=MetaAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_meta_account(body: MetaAccountCreate, current_user: CurrentUser, db: DB):
    existing = await db.execute(
        select(MetaAccount).where(
            MetaAccount.user_id == current_user.id,
            MetaAccount.ad_account_id == body.ad_account_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ad account ID sudah terdaftar.")

    account = MetaAccount(user_id=current_user.id, **body.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return _to_meta_response(account)


@router.patch("/meta/{account_id}", response_model=MetaAccountResponse)
async def update_meta_account(account_id: UUID, body: MetaAccountUpdate, current_user: CurrentUser, db: DB):
    account = await _get_meta_account(account_id, current_user.id, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    return _to_meta_response(account)


@router.patch("/meta/{account_id}/token", status_code=status.HTTP_204_NO_CONTENT)
async def update_meta_token(account_id: UUID, body: MetaTokenUpdate, current_user: CurrentUser, db: DB):
    """Simpan long-lived token Meta (berlaku 60 hari)."""
    account = await _get_meta_account(account_id, current_user.id, db)
    account.access_token_enc = body.access_token.strip()
    account.token_expires_at = datetime.now(timezone.utc) + timedelta(days=60)
    account.status_koneksi = "terhubung"
    await db.commit()


@router.delete("/meta/{account_id}/token", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meta_token(account_id: UUID, current_user: CurrentUser, db: DB):
    """Hapus token Meta dari akun."""
    account = await _get_meta_account(account_id, current_user.id, db)
    account.access_token_enc = None
    account.token_expires_at = None
    await db.commit()


@router.delete("/meta/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meta_account(account_id: UUID, current_user: CurrentUser, db: DB):
    account = await _get_meta_account(account_id, current_user.id, db)
    await db.delete(account)
    await db.commit()


# Relasi: tambah / hapus link ke Shopee account

@router.post("/meta/{account_id}/links", status_code=status.HTTP_204_NO_CONTENT)
async def add_account_link(account_id: UUID, body: AccountLinkRequest, current_user: CurrentUser, db: DB):
    await _get_meta_account(account_id, current_user.id, db)
    await _assert_shopee_owned(body.shopee_account_id, current_user.id, db)

    existing = await db.execute(
        select(AccountLink).where(
            AccountLink.meta_account_id == account_id,
            AccountLink.shopee_account_id == body.shopee_account_id,
        )
    )
    if existing.scalar_one_or_none():
        return  # sudah terhubung, idempoten

    db.add(AccountLink(meta_account_id=account_id, shopee_account_id=body.shopee_account_id))
    await db.commit()


@router.delete("/meta/{account_id}/links/{shopee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_account_link(account_id: UUID, shopee_id: UUID, current_user: CurrentUser, db: DB):
    await _get_meta_account(account_id, current_user.id, db)
    await db.execute(
        delete(AccountLink).where(
            AccountLink.meta_account_id == account_id,
            AccountLink.shopee_account_id == shopee_id,
        )
    )
    await db.commit()


# ===========================================================================
# Shopee Accounts
# ===========================================================================

@router.get("/shopee", response_model=list[ShopeeAccountResponse])
async def list_shopee_accounts(current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(ShopeeAccount)
        .where(ShopeeAccount.user_id == current_user.id)
        .order_by(ShopeeAccount.created_at)
    )
    return result.scalars().all()


@router.post("/shopee", response_model=ShopeeAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_shopee_account(body: ShopeeAccountCreate, current_user: CurrentUser, db: DB):
    existing = await db.execute(
        select(ShopeeAccount).where(
            ShopeeAccount.user_id == current_user.id,
            ShopeeAccount.nama_akun == body.nama_akun,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Nama akun Shopee sudah ada.")

    account = ShopeeAccount(user_id=current_user.id, **body.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.patch("/shopee/{account_id}", response_model=ShopeeAccountResponse)
async def update_shopee_account(account_id: UUID, body: ShopeeAccountUpdate, current_user: CurrentUser, db: DB):
    account = await _get_shopee_account(account_id, current_user.id, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/shopee/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shopee_account(account_id: UUID, current_user: CurrentUser, db: DB):
    account = await _get_shopee_account(account_id, current_user.id, db)
    await db.delete(account)
    await db.commit()


# ===========================================================================
# Adu Accounts (Clickadu API)
# ===========================================================================

@router.get("/adu", response_model=list[AduAccountResponse])
async def list_adu_accounts(current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(AduAccount)
        .where(AduAccount.user_id == current_user.id)
        .order_by(AduAccount.created_at)
    )
    return [_to_adu_response(a) for a in result.scalars().all()]


@router.post("/adu", response_model=AduAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_adu_account(body: AduAccountCreate, current_user: CurrentUser, db: DB):
    existing = await db.execute(
        select(AduAccount).where(
            AduAccount.user_id == current_user.id,
            AduAccount.nama_tampilan == body.nama_tampilan,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Nama akun Adu sudah ada.")

    account = AduAccount(user_id=current_user.id, **body.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return _to_adu_response(account)


@router.patch("/adu/{account_id}", response_model=AduAccountResponse)
async def update_adu_account(account_id: UUID, body: AduAccountUpdate, current_user: CurrentUser, db: DB):
    account = await _get_adu_account(account_id, current_user.id, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    return _to_adu_response(account)


@router.patch("/adu/{account_id}/api-key", status_code=status.HTTP_204_NO_CONTENT)
async def update_adu_api_key(account_id: UUID, body: AduApiKeyUpdate, current_user: CurrentUser, db: DB):
    account = await _get_adu_account(account_id, current_user.id, db)
    account.api_key_enc = body.api_key.strip()
    account.status_koneksi = "terhubung"
    await db.commit()


@router.delete("/adu/{account_id}/api-key", status_code=status.HTTP_204_NO_CONTENT)
async def delete_adu_api_key(account_id: UUID, current_user: CurrentUser, db: DB):
    account = await _get_adu_account(account_id, current_user.id, db)
    account.api_key_enc = None
    await db.commit()


@router.delete("/adu/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_adu_account(account_id: UUID, current_user: CurrentUser, db: DB):
    account = await _get_adu_account(account_id, current_user.id, db)
    await db.delete(account)
    await db.commit()


# ===========================================================================
# Helper privat
# ===========================================================================

async def _get_meta_account(account_id: UUID, user_id, db: DB) -> MetaAccount:
    result = await db.execute(
        select(MetaAccount).where(MetaAccount.id == account_id, MetaAccount.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Akun Meta tidak ditemukan.")
    return account


async def _get_shopee_account(account_id: UUID, user_id, db: DB) -> ShopeeAccount:
    result = await db.execute(
        select(ShopeeAccount).where(ShopeeAccount.id == account_id, ShopeeAccount.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Akun Shopee tidak ditemukan.")
    return account


async def _assert_shopee_owned(shopee_id: UUID, user_id, db: DB) -> None:
    result = await db.execute(
        select(ShopeeAccount).where(ShopeeAccount.id == shopee_id, ShopeeAccount.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Akun Shopee tidak ditemukan.")


async def _get_adu_account(account_id: UUID, user_id, db: DB) -> AduAccount:
    result = await db.execute(
        select(AduAccount).where(AduAccount.id == account_id, AduAccount.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Akun Adu tidak ditemukan.")
    return account


def _to_adu_response(a: AduAccount) -> AduAccountResponse:
    return AduAccountResponse(
        id=a.id,
        nama_tampilan=a.nama_tampilan,
        status_koneksi=a.status_koneksi,
        has_api_key=bool(a.api_key_enc),
        created_at=a.created_at,
    )


def _to_meta_response(m: MetaAccount) -> MetaAccountResponse:
    return MetaAccountResponse(
        id=m.id,
        ad_account_id=m.ad_account_id,
        nama_tampilan=m.nama_tampilan,
        mata_uang=m.mata_uang,
        status_koneksi=m.status_koneksi,
        token_expires_at=m.token_expires_at,
        has_token=bool(m.access_token_enc),
        created_at=m.created_at,
    )
