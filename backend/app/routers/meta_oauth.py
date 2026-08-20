"""
Meta OAuth – Phase 1
GET  /api/meta-oauth/config           → ambil App ID + App Secret yang tersimpan
PUT  /api/meta-oauth/config           → simpan App ID + App Secret
GET  /api/meta-oauth/connect          → redirect ke Facebook OAuth dialog
GET  /api/meta-oauth/callback         → tukar code → token, simpan ke MetaAccount
"""

import urllib.parse
import uuid
from datetime import datetime, timezone

import httpx
import sqlalchemy as sa
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import DB, CurrentUser
from app.models.account import MetaAccount
from app.models.meta_app_config import MetaAppConfig

router = APIRouter()

FACEBOOK_OAUTH_URL = "https://www.facebook.com/v19.0/dialog/oauth"
FACEBOOK_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token"
FACEBOOK_EXTEND_URL = "https://graph.facebook.com/v19.0/oauth/access_token"
FACEBOOK_ACCOUNTS_URL = "https://graph.facebook.com/v19.0/me/adaccounts"
META_OAUTH_SCOPE = "ads_read,ads_management,business_management"


# ── Schemas ──────────────────────────────────────────────────────────────────

class AppConfigIn(BaseModel):
    app_id: str
    app_secret: str


class AppConfigOut(BaseModel):
    app_id: str | None
    app_secret_hint: str | None  # hanya 4 karakter terakhir


# ── Helpers ───────────────────────────────────────────────────────────────────

def _redirect_uri(base_url: str) -> str:
    base_url = base_url.rstrip("/")
    return f"{base_url}/api/meta-oauth/callback"


async def _get_or_create_config(user_id: uuid.UUID, db: DB) -> MetaAppConfig:
    cfg = (await db.execute(
        sa.select(MetaAppConfig).where(MetaAppConfig.user_id == user_id)
    )).scalar_one_or_none()
    if not cfg:
        cfg = MetaAppConfig(user_id=user_id)
        db.add(cfg)
        await db.flush()
    return cfg


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/config", response_model=AppConfigOut)
async def get_config(current_user: CurrentUser, db: DB):
    cfg = (await db.execute(
        sa.select(MetaAppConfig).where(MetaAppConfig.user_id == current_user.id)
    )).scalar_one_or_none()
    if not cfg or not cfg.app_id:
        return AppConfigOut(app_id=None, app_secret_hint=None)
    hint = ("*" * (len(cfg.app_secret) - 4) + cfg.app_secret[-4:]) if cfg.app_secret else None
    return AppConfigOut(app_id=cfg.app_id, app_secret_hint=hint)


@router.put("/config", status_code=204)
async def save_config(body: AppConfigIn, current_user: CurrentUser, db: DB):
    cfg = await _get_or_create_config(current_user.id, db)
    cfg.app_id = body.app_id.strip()
    cfg.app_secret = body.app_secret.strip()
    await db.commit()


@router.get("/connect")
async def connect_meta(current_user: CurrentUser, db: DB):
    cfg = (await db.execute(
        sa.select(MetaAppConfig).where(MetaAppConfig.user_id == current_user.id)
    )).scalar_one_or_none()
    if not cfg or not cfg.app_id or not cfg.app_secret:
        raise HTTPException(400, "App ID dan App Secret belum disimpan. Isi dulu di halaman Pengaturan.")

    app_url = settings.APP_URL
    if not app_url:
        raise HTTPException(500, "APP_URL belum dikonfigurasi di environment server.")

    redirect_uri = _redirect_uri(app_url)
    state = str(current_user.id)  # pakai user ID sebagai CSRF state sederhana

    params = {
        "client_id": cfg.app_id,
        "redirect_uri": redirect_uri,
        "scope": META_OAUTH_SCOPE,
        "state": state,
        "response_type": "code",
    }
    url = FACEBOOK_OAUTH_URL + "?" + urllib.parse.urlencode(params)
    return RedirectResponse(url)


@router.get("/callback")
async def oauth_callback(db: DB, code: str | None = None, state: str | None = None,
                          error: str | None = None):
    if error:
        return RedirectResponse(f"/#/pengaturan/meta?error={urllib.parse.quote(error)}")
    if not code or not state:
        return RedirectResponse("/#/pengaturan/meta?error=parameter_tidak_valid")

    # Ambil user dari state (user_id)
    try:
        user_id = uuid.UUID(state)
    except ValueError:
        return RedirectResponse("/#/pengaturan/meta?error=state_tidak_valid")

    cfg = (await db.execute(
        sa.select(MetaAppConfig).where(MetaAppConfig.user_id == user_id)
    )).scalar_one_or_none()
    if not cfg or not cfg.app_id or not cfg.app_secret:
        return RedirectResponse("/#/pengaturan/meta?error=konfigurasi_tidak_ditemukan")

    app_url = settings.APP_URL.rstrip("/")
    redirect_uri = _redirect_uri(app_url)

    async with httpx.AsyncClient(timeout=30) as client:
        # 1. Tukar code → short-lived token
        r = await client.get(FACEBOOK_TOKEN_URL, params={
            "client_id": cfg.app_id,
            "client_secret": cfg.app_secret,
            "redirect_uri": redirect_uri,
            "code": code,
        })
        if r.status_code != 200:
            return RedirectResponse(f"/#/pengaturan/meta?error=token_gagal")
        short_token = r.json().get("access_token")

        # 2. Extend → long-lived token (~60 hari)
        r2 = await client.get(FACEBOOK_EXTEND_URL, params={
            "grant_type": "fb_exchange_token",
            "client_id": cfg.app_id,
            "client_secret": cfg.app_secret,
            "fb_exchange_token": short_token,
        })
        if r2.status_code != 200:
            return RedirectResponse("/#/pengaturan/meta?error=extend_token_gagal")
        data2 = r2.json()
        long_token = data2.get("access_token")
        expires_in = data2.get("expires_in", 5184000)  # default 60 hari

        # 3. Ambil daftar Ad Account
        r3 = await client.get(FACEBOOK_ACCOUNTS_URL, params={
            "access_token": long_token,
            "fields": "id,name,account_status",
        })
        if r3.status_code != 200:
            return RedirectResponse("/#/pengaturan/meta?error=akun_gagal")
        ad_accounts = r3.json().get("data", [])

    if not ad_accounts:
        return RedirectResponse("/#/pengaturan/meta?error=tidak_ada_ad_account")

    # 4. Simpan/update MetaAccount untuk setiap Ad Account yang ditemukan
    expires_at = datetime.fromtimestamp(
        datetime.now(timezone.utc).timestamp() + expires_in, tz=timezone.utc
    )
    added = 0
    for acc in ad_accounts:
        raw_id = acc.get("id", "")           # format: "act_XXXXXXXXX"
        ad_account_id = raw_id.replace("act_", "")
        nama = acc.get("name", raw_id)

        existing = (await db.execute(
            sa.select(MetaAccount).where(
                MetaAccount.user_id == user_id,
                MetaAccount.ad_account_id == ad_account_id,
            )
        )).scalar_one_or_none()

        if existing:
            existing.access_token_enc = long_token
            existing.token_expires_at = expires_at
            existing.status_koneksi = "aktif"
            existing.nama_tampilan = nama
        else:
            db.add(MetaAccount(
                user_id=user_id,
                ad_account_id=ad_account_id,
                nama_tampilan=nama,
                access_token_enc=long_token,
                token_expires_at=expires_at,
                status_koneksi="aktif",
            ))
            added += 1

    await db.commit()
    return RedirectResponse(f"/#/pengaturan/meta?success=1&added={added}")
