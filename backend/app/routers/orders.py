from collections import defaultdict
from datetime import date
from decimal import Decimal
from uuid import UUID

import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, Query

from app.core.deps import DB, CurrentUser
from app.models.account import ShopeeAccount
from app.models.metrics import OrderSnapshot
from app.schemas.orders import (
    OrderCalendarDay, OrderCalendarResponse,
    OrderDayResponse, OrderDayStats, OrderItemRow, OrderItemsResponse, OrderRow,
)

router = APIRouter()
_ZERO = Decimal("0")


def _base_query(user_id, shopee_account_id):
    q = (
        sa.select(OrderSnapshot)
        .join(ShopeeAccount, OrderSnapshot.shopee_account_id == ShopeeAccount.id)
        .where(ShopeeAccount.user_id == user_id)
    )
    if shopee_account_id:
        q = q.where(OrderSnapshot.shopee_account_id == shopee_account_id)
    return q


@router.get("/calendar", response_model=OrderCalendarResponse)
async def get_order_calendar(
    current_user: CurrentUser,
    db: DB,
    tanggal_dari: date = Query(...),
    tanggal_sampai: date = Query(...),
    shopee_account_id: UUID | None = Query(None),
):
    q = _base_query(current_user.id, shopee_account_id).where(
        OrderSnapshot.tanggal_snapshot.between(tanggal_dari, tanggal_sampai)
    )
    rows = (await db.execute(q)).scalars().all()

    by_date: dict[date, list] = defaultdict(list)
    for r in rows:
        by_date[r.tanggal_snapshot].append(r)

    days: list[OrderCalendarDay] = []
    total_completed = total_pending = total_unpaid = total_cancelled = 0
    total_komisi = total_komisi_completed = total_komisi_pending = _ZERO
    days_with_orders = days_settled = days_berjalan = 0

    for tanggal in sorted(by_date):
        grp = by_date[tanggal]
        comp = sum(1 for r in grp if r.status == "completed")
        pend = sum(1 for r in grp if r.status == "pending")
        unp  = sum(1 for r in grp if r.status == "unpaid")
        canc = sum(1 for r in grp if r.status == "cancelled")
        k_comp = sum((r.commission_to_idr or _ZERO) for r in grp if r.status == "completed")
        k_pend = sum((r.commission_to_idr or _ZERO) for r in grp if r.status in ("pending", "unpaid"))
        k_total = k_comp + k_pend
        updated_at = max((r.tercatat_at for r in grp), default=None)

        days.append(OrderCalendarDay(
            tanggal=tanggal, completed=comp, pending=pend, unpaid=unp, cancelled=canc,
            komisi=k_total, komisi_completed=k_comp, komisi_pending=k_pend,
            updated_at=updated_at,
        ))

        total_completed += comp; total_pending += pend
        total_unpaid += unp;    total_cancelled += canc
        total_komisi += k_total; total_komisi_completed += k_comp; total_komisi_pending += k_pend

        total = comp + pend + unp + canc
        if total > 0:
            days_with_orders += 1
            if pend == 0 and unp == 0:
                days_settled += 1
            else:
                days_berjalan += 1

    return OrderCalendarResponse(
        days=days,
        total_completed=total_completed, total_pending=total_pending,
        total_unpaid=total_unpaid, total_cancelled=total_cancelled,
        total_komisi=total_komisi, total_komisi_completed=total_komisi_completed,
        total_komisi_pending=total_komisi_pending,
        days_with_orders=days_with_orders, days_settled=days_settled, days_berjalan=days_berjalan,
    )


@router.get("/day/{tanggal}", response_model=OrderDayResponse)
async def get_order_day(
    tanggal: date,
    current_user: CurrentUser,
    db: DB,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    shopee_account_id: UUID | None = Query(None),
):
    q = _base_query(current_user.id, shopee_account_id).where(
        OrderSnapshot.tanggal_snapshot == tanggal
    )
    all_rows = (await db.execute(q)).scalars().all()

    comp = sum(1 for r in all_rows if r.status == "completed")
    pend = sum(1 for r in all_rows if r.status == "pending")
    unp  = sum(1 for r in all_rows if r.status == "unpaid")
    canc = sum(1 for r in all_rows if r.status == "cancelled")
    komisi = sum((r.commission_to_idr or _ZERO) for r in all_rows if r.status in ("completed", "pending", "unpaid"))
    updated_at = max((r.tercatat_at for r in all_rows), default=None)

    # Group by order_id
    grp: dict[str, list] = defaultdict(list)
    for r in all_rows:
        grp[r.order_id].append(r)

    order_rows: list[OrderRow] = []
    for order_id, items in grp.items():
        item_count = len(items)
        items_sorted = sorted(items, key=lambda r: r.tercatat_at)
        status = items_sorted[0].status
        komisi_dari = items_sorted[0].commission_from_idr
        komisi_ke = sum((r.commission_to_idr or _ZERO) for r in items)
        delta = sum((r.delta_idr or _ZERO) for r in items)
        tercatat_at = max(r.tercatat_at for r in items)
        order_rows.append(OrderRow(
            order_id=order_id, item_count=item_count, status=status,
            komisi_dari=komisi_dari, komisi_ke=komisi_ke,
            delta=delta, tercatat_at=tercatat_at,
        ))

    order_rows.sort(key=lambda r: r.tercatat_at, reverse=True)
    total = len(order_rows)
    paginated = order_rows[(page - 1) * size: page * size]

    return OrderDayResponse(
        stats=OrderDayStats(completed=comp, pending=pend, unpaid=unp, cancelled=canc,
                            komisi=komisi, updated_at=updated_at),
        rows=paginated, total=total, page=page, size=size,
    )


@router.get("/items/{tanggal}/{order_id}", response_model=OrderItemsResponse)
async def get_order_items(
    tanggal: date,
    order_id: str,
    current_user: CurrentUser,
    db: DB,
    shopee_account_id: UUID | None = Query(None),
):
    q = _base_query(current_user.id, shopee_account_id).where(
        OrderSnapshot.tanggal_snapshot == tanggal,
        OrderSnapshot.order_id == order_id,
    )
    items = (await db.execute(q)).scalars().all()
    if not items:
        raise HTTPException(404, "Order tidak ditemukan.")

    total_komisi = sum((r.commission_to_idr or _ZERO) for r in items)
    return OrderItemsResponse(
        order_id=order_id,
        items=[
            OrderItemRow(
                nama_produk=r.nama_produk,
                nama_toko=r.nama_toko,
                status=r.status,
                komisi_dari=r.commission_from_idr,
                komisi_ke=r.commission_to_idr or _ZERO,
                delta=r.delta_idr or _ZERO,
            )
            for r in items
        ],
        total_komisi=total_komisi,
    )
