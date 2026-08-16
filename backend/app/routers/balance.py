from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, status

from app.core.deps import DB, CurrentUser
from app.models.account import MetaAccount
from app.models.balance import AccountBalance
from app.models.campaign import Campaign
from app.models.metrics import DailyMetric
from app.schemas.balance import BalanceItem, BalanceResponse, BalanceSummary, BalanceUpsert

router = APIRouter()
_ZERO = Decimal("0")


def _compute_item(
    meta: MetaAccount,
    bal: AccountBalance | None,
    kemarin: Decimal,
) -> BalanceItem:
    sisa = bal.sisa_saldo if bal else _ZERO
    limit = bal.total_limit if bal else _ZERO
    terpakai = max(limit - sisa, _ZERO)
    persen = (terpakai / limit * 100).quantize(Decimal("0.01")) if limit else _ZERO

    if sisa <= _ZERO:
        cukup_hari = 0.0
        status = "Habis"
        topup_date = date.today()
    elif kemarin > _ZERO:
        cukup_hari = round(float(sisa / kemarin), 1)
        topup_date = date.today() + timedelta(days=int(cukup_hari))
        status = "Segera" if cukup_hari <= 3 else "Aman"
    else:
        cukup_hari = None
        topup_date = None
        status = "Aman"

    return BalanceItem(
        meta_account_id=meta.id,
        nama_akun=meta.nama_tampilan,
        ad_account_id=meta.ad_account_id,
        dikelola_oleh=bal.dikelola_oleh if bal else None,
        sisa_saldo=sisa,
        total_limit=limit,
        terpakai=terpakai,
        persen_terpakai=persen,
        kemarin=kemarin,
        cukup_hari=cukup_hari,
        topup_date=topup_date,
        status=status,
        updated_at=bal.updated_at if bal else None,
    )


@router.get("/", response_model=BalanceResponse)
async def list_balances(current_user: CurrentUser, db: DB):
    meta_rows = (await db.execute(
        sa.select(MetaAccount)
        .where(MetaAccount.user_id == current_user.id)
        .order_by(MetaAccount.nama_tampilan)
    )).scalars().all()

    if not meta_rows:
        return BalanceResponse(
            summary=BalanceSummary(
                sisa_saldo=_ZERO, total_limit=_ZERO, terpakai=_ZERO,
                persen_terpakai=_ZERO, jumlah_akun=0, perlu_topup=0, saldo_nol=0,
            ),
            accounts=[],
            terakhir_refresh=None,
        )

    meta_ids = [m.id for m in meta_rows]

    bal_rows = (await db.execute(
        sa.select(AccountBalance).where(AccountBalance.meta_account_id.in_(meta_ids))
    )).scalars().all()
    bal_by_meta = {b.meta_account_id: b for b in bal_rows}

    yesterday = date.today() - timedelta(days=1)
    kemarin_rows = (await db.execute(
        sa.select(
            Campaign.meta_account_id,
            sa.func.coalesce(sa.func.sum(DailyMetric.spend_idr), _ZERO).label("spend"),
        )
        .join(DailyMetric, DailyMetric.campaign_id == Campaign.id)
        .where(
            Campaign.meta_account_id.in_(meta_ids),
            DailyMetric.tanggal == yesterday,
        )
        .group_by(Campaign.meta_account_id)
    )).all()
    kemarin_by_meta = {r.meta_account_id: r.spend for r in kemarin_rows}

    items: list[BalanceItem] = []
    for m in meta_rows:
        kemarin = kemarin_by_meta.get(m.id, _ZERO)
        items.append(_compute_item(m, bal_by_meta.get(m.id), kemarin))

    total_sisa = sum((i.sisa_saldo for i in items), _ZERO)
    total_limit = sum((i.total_limit for i in items), _ZERO)
    total_terpakai = sum((i.terpakai for i in items), _ZERO)
    persen = (total_terpakai / total_limit * 100).quantize(Decimal("0.01")) if total_limit else _ZERO
    perlu_topup = sum(1 for i in items if i.status == "Segera")
    saldo_nol = sum(1 for i in items if i.sisa_saldo <= _ZERO)

    terakhir = max((b.updated_at for b in bal_rows), default=None) if bal_rows else None

    return BalanceResponse(
        summary=BalanceSummary(
            sisa_saldo=total_sisa,
            total_limit=total_limit,
            terpakai=total_terpakai,
            persen_terpakai=persen,
            jumlah_akun=len(items),
            perlu_topup=perlu_topup,
            saldo_nol=saldo_nol,
        ),
        accounts=items,
        terakhir_refresh=terakhir,
    )


@router.post("/{meta_account_id}", response_model=BalanceItem, status_code=status.HTTP_200_OK)
async def upsert_balance(meta_account_id: UUID, body: BalanceUpsert, current_user: CurrentUser, db: DB):
    meta = (await db.execute(
        sa.select(MetaAccount).where(
            MetaAccount.id == meta_account_id,
            MetaAccount.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if not meta:
        raise HTTPException(404, "Akun Meta tidak ditemukan.")

    bal = (await db.execute(
        sa.select(AccountBalance).where(AccountBalance.meta_account_id == meta_account_id)
    )).scalar_one_or_none()

    if bal:
        bal.sisa_saldo = body.sisa_saldo
        bal.total_limit = body.total_limit
        if body.dikelola_oleh is not None:
            bal.dikelola_oleh = body.dikelola_oleh
    else:
        bal = AccountBalance(
            id=uuid4(),
            meta_account_id=meta_account_id,
            sisa_saldo=body.sisa_saldo,
            total_limit=body.total_limit,
            dikelola_oleh=body.dikelola_oleh,
        )
        db.add(bal)

    await db.commit()
    await db.refresh(bal)

    yesterday = date.today() - timedelta(days=1)
    kemarin_row = (await db.execute(
        sa.select(
            sa.func.coalesce(sa.func.sum(DailyMetric.spend_idr), _ZERO)
        )
        .join(Campaign, DailyMetric.campaign_id == Campaign.id)
        .where(Campaign.meta_account_id == meta_account_id, DailyMetric.tanggal == yesterday)
    )).scalar_one()
    kemarin = kemarin_row or _ZERO

    return _compute_item(meta, bal, kemarin)
