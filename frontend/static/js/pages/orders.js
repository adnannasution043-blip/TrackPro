import { apiFetch } from '../api.js';
import { filterQS } from '../filter-state.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function qs(base, params) {
  const pairs = Object.entries(params).filter(([,v]) => v != null && v !== '');
  if (!pairs.length) return base;
  return base + '?' + pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

function appendFilter(url) {
  const fqs = filterQS ? filterQS() : '';
  if (!fqs) return url;
  return url + (url.includes('?') ? fqs : '?' + fqs.slice(1));
}

function fmtTime(dt) {
  if (!dt) return null;
  const d = new Date(dt);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} · ${DD}/${MM}`;
}

function fmtDatetime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const DD = String(d.getDate()).padStart(2, '0');
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const YYYY = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${DD}/${MM}/${YYYY} ${hh}:${mi}`;
}

function statusBadge(s) {
  const label = (s || 'unknown').toUpperCase();
  const styles = {
    completed: 'background:#f0fdf4;color:#16a34a;border-color:#86efac;',
    pending:   'background:#fffbeb;color:#d97706;border-color:#fcd34d;',
    unpaid:    'background:#f9fafb;color:#6b7280;border-color:#d1d5db;',
    cancelled: 'background:#fef2f2;color:#dc2626;border-color:#fca5a5;',
  };
  const css = styles[s] || 'background:#f3f4f6;color:#6b7280;border-color:#d1d5db;';
  return `<span style="font-size:10.5px;font-weight:700;padding:2px 7px;border:1px solid;border-radius:4px;letter-spacing:.03em;${css}">${label}</span>`;
}

export class OrdersPage {
  constructor(container) {
    this.container = container;
    const now = new Date();
    this.year = now.getFullYear();
    this.month = now.getMonth();
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Laporan Pesanan</h1>
          <p>Snapshot status harian — pilih tanggal untuk lihat order mana yang berubah.</p>
        </div>
        <div class="page-header-right" style="display:flex;align-items:center;gap:6px;">
          <button class="btn" id="btn-prev" style="padding:6px 10px;">‹</button>
          <button class="btn" id="btn-month" style="display:flex;align-items:center;gap:6px;padding:6px 14px;font-weight:600;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            BULAN <span id="month-label">${MONTHS_SHORT[this.month]} ${this.year}</span>
          </button>
          <button class="btn" id="btn-next" style="padding:6px 10px;">›</button>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;

    this.container.querySelector('#btn-prev').addEventListener('click', () => {
      this.month--;
      if (this.month < 0) { this.month = 11; this.year--; }
      this._updateLabel();
      this._load();
    });
    this.container.querySelector('#btn-next').addEventListener('click', () => {
      this.month++;
      if (this.month > 11) { this.month = 0; this.year++; }
      this._updateLabel();
      this._load();
    });

    await this._load();
  }

  _updateLabel() {
    this.container.querySelector('#month-label').textContent = `${MONTHS_SHORT[this.month]} ${this.year}`;
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';
    const y = this.year, m = this.month;
    const dari = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const sampai = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    try {
      const url = appendFilter(`/orders/calendar?tanggal_dari=${dari}&tanggal_sampai=${sampai}`);
      const data = await apiFetch(url);
      this._renderCalendar(el, y, m, lastDay, data || { days: [], total_completed: 0, total_pending: 0, total_unpaid: 0, total_cancelled: 0, total_komisi: 0, total_komisi_completed: 0, total_komisi_pending: 0, days_with_orders: 0, days_settled: 0, days_berjalan: 0 });
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _renderCalendar(el, year, month, lastDay, data) {
    const dayMap = {};
    for (const d of (data.days || [])) dayMap[d.tanggal] = d;

    const allDates = Object.keys(dayMap).sort();

    // TOTAL card
    const totalCard = `
      <div class="card" style="margin-bottom:12px;padding:16px 20px;">
        <div style="font-size:10.5px;font-weight:700;color:var(--text-muted,#9ca3af);letter-spacing:.07em;margin-bottom:12px;">${MONTHS[month].toUpperCase()} ${year} · TOTAL</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;">
          ${[
            { label:'COMPLETED', val: data.total_completed, komisi: data.total_komisi_completed, color:'#16a34a' },
            { label:'PENDING',   val: data.total_pending,   komisi: data.total_komisi_pending,   color:'#d97706' },
            { label:'UNPAID',    val: data.total_unpaid,    komisi: 0,                           color:'#6b7280' },
            { label:'CANCELLED', val: data.total_cancelled, komisi: 0,                           color:'#dc2626' },
          ].map(s => `
            <div>
              <div style="font-size:10px;font-weight:700;color:${s.color};letter-spacing:.05em;">${s.label}</div>
              <div style="font-size:22px;font-weight:700;color:${s.color};">${Number(s.val).toLocaleString('id-ID')}</div>
              <div style="font-size:11.5px;color:var(--text-muted,#9ca3af);">${rp(s.komisi)}</div>
            </div>`).join('')}
        </div>
        <div style="padding:10px 14px;background:var(--surface-alt,#f9fafb);border-radius:6px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted,#9ca3af);letter-spacing:.05em;margin-bottom:2px;">KOMISI SAAT INI</div>
            <div style="font-size:19px;font-weight:700;color:var(--text,#111827);">${rp(data.total_komisi)}</div>
          </div>
          <div style="font-size:11.5px;color:var(--text-muted,#6b7280);text-align:right;">
            ${data.days_with_orders} hari ada order · ${data.days_settled} hari sudah selesai · ${data.days_berjalan} hari masih ada pending/unpaid
          </div>
        </div>
      </div>`;

    // Legend
    const legend = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;font-size:11.5px;color:var(--text-muted,#6b7280);flex-wrap:wrap;">
        <span style="font-weight:600;">Legenda border:</span>
        <span style="display:flex;align-items:center;gap:4px;"><span style="width:13px;height:13px;border:2px solid #22c55e;border-radius:3px;display:inline-block;background:#f0fdf4;"></span> Sudah settle</span>
        <span style="display:flex;align-items:center;gap:4px;"><span style="width:13px;height:13px;border:2px solid #f59e0b;border-radius:3px;display:inline-block;background:#fffbeb;"></span> Ada pending / unpaid</span>
        <span style="display:flex;align-items:center;gap:4px;"><span style="width:13px;height:13px;border:2px solid var(--border,#e5e7eb);border-radius:3px;display:inline-block;"></span> Tidak ada order</span>
      </div>`;

    // Build cells
    const DOW = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
    const firstDow = new Date(year, month, 1).getDay();
    const offset = firstDow === 0 ? 6 : firstDow - 1;
    let cells = Array(offset).fill('<div></div>');

    for (let d = 1; d <= lastDay; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const r = dayMap[key];

      if (r) {
        const settled = r.pending === 0 && r.unpaid === 0;
        const berjalan = r.pending > 0 || r.unpaid > 0;
        const borderColor = settled ? '#22c55e' : berjalan ? '#f59e0b' : '#e5e7eb';
        const bgColor    = settled ? '#f0fdf4' : berjalan ? '#fffbeb' : 'var(--surface,#fff)';
        const badgeLabel = berjalan ? 'BERJALAN' : settled ? 'SELESAI' : '-';
        const badgeColor = berjalan ? '#d97706' : settled ? '#16a34a' : '#9ca3af';
        const updTime = r.updated_at ? fmtTime(r.updated_at) : null;

        cells.push(`
          <div class="cal-card" data-date="${key}"
            style="cursor:pointer;background:${bgColor};border:1.5px solid ${borderColor};border-radius:8px;padding:8px;min-height:130px;display:flex;flex-direction:column;gap:3px;transition:box-shadow .15s;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:17px;font-weight:700;color:var(--text,#111827);">${d}</span>
              <span style="font-size:9.5px;font-weight:700;color:${badgeColor};letter-spacing:.04em;">${badgeLabel}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;font-size:10.5px;margin-top:2px;line-height:1.5;">
              <div style="color:#16a34a;">COMP <strong>${r.completed.toLocaleString('id-ID')}</strong></div>
              <div style="color:#d97706;">PEND <strong>${r.pending.toLocaleString('id-ID')}</strong></div>
              <div style="color:#6b7280;">UNPD <strong>${r.unpaid.toLocaleString('id-ID')}</strong></div>
              <div style="color:#dc2626;">CANC <strong>${r.cancelled.toLocaleString('id-ID')}</strong></div>
            </div>
            <div style="font-size:9.5px;color:var(--text-muted,#9ca3af);margin-top:3px;">KOMISI SAAT INI</div>
            <div style="font-size:12.5px;font-weight:700;color:var(--text,#111827);">${rp(r.komisi)}</div>
            ${updTime ? `<div style="font-size:9px;color:var(--text-muted,#9ca3af);margin-top:auto;">Diperbarui ${updTime}</div>` : ''}
          </div>`);
      } else {
        cells.push(`
          <div class="cal-card" data-date="${key}"
            style="border:1.5px solid var(--border,#e5e7eb);border-radius:8px;padding:8px;min-height:130px;display:flex;flex-direction:column;">
            <div style="display:flex;justify-content:space-between;">
              <span style="font-size:17px;font-weight:700;color:var(--text-muted,#9ca3af);">${d}</span>
              <span style="font-size:9.5px;color:var(--text-muted,#9ca3af);">-</span>
            </div>
            <div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted,#9ca3af);">Tidak ada order</div>
          </div>`);
      }
    }

    el.innerHTML = `
      ${totalCard}
      <div class="card" style="padding:14px 16px;">
        ${legend}
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:5px;">
          ${DOW.map(h => `<div style="text-align:center;font-size:11px;font-weight:700;color:var(--text-muted,#6b7280);padding:3px 0;text-transform:uppercase;">${h}</div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;" id="cal-grid">
          ${cells.join('')}
        </div>
      </div>`;

    el.querySelectorAll('.cal-card[data-date]').forEach(card => {
      const dateKey = card.dataset.date;
      const dayData = dayMap[dateKey];
      if (!dayData) return;
      card.addEventListener('mouseenter', () => card.style.boxShadow = '0 2px 12px rgba(0,0,0,.1)');
      card.addEventListener('mouseleave', () => card.style.boxShadow = '');
      card.addEventListener('click', () => this._showDayModal(dateKey, dayData, allDates));
    });
  }

  _prevDate(dateStr, allDates) {
    const idx = allDates.indexOf(dateStr);
    return idx > 0 ? allDates[idx - 1] : null;
  }
  _nextDate(dateStr, allDates) {
    const idx = allDates.indexOf(dateStr);
    return idx < allDates.length - 1 ? allDates[idx + 1] : null;
  }
  _shortDate(dateStr) {
    if (!dateStr) return '—/—';
    const [, m, d] = dateStr.split('-');
    return `${d}/${m}`;
  }

  async _showDayModal(dateStr, dayData, allDates) {
    const [y, m, d] = dateStr.split('-');
    const title = `${parseInt(d)} ${MONTHS[parseInt(m) - 1]} ${y}`;
    const updLabel = dayData?.updated_at ? fmtDatetime(dayData.updated_at) : '—';

    const prevDate = this._prevDate(dateStr, allDates);
    const nextDate = this._nextDate(dateStr, allDates);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:820px;width:96vw;">
        <div class="modal-header" style="padding:14px 20px 12px;">
          <div>
            <h2 style="font-size:18px;font-weight:700;margin:0;">${title}</h2>
            <p style="font-size:11.5px;color:var(--text-muted,#9ca3af);margin:2px 0 0;">Update terakhir: ${updLabel}</p>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button id="day-prev" class="btn" style="font-size:11.5px;padding:5px 10px;" ${!prevDate ? 'disabled' : ''}>‹ Sebelumnya ${this._shortDate(prevDate)}</button>
            <button id="day-next" class="btn" style="font-size:11.5px;padding:5px 10px;" ${!nextDate ? 'disabled' : ''}>${this._shortDate(nextDate)}: Berikutnya ›</button>
            <button class="modal-close" id="modal-close">×</button>
          </div>
        </div>
        <div class="modal-body" id="day-body" style="padding:0 20px 20px;max-height:75vh;overflow-y:auto;">
          <div class="loading" style="padding:24px;">Memuat order…</div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#day-prev').addEventListener('click', () => {
      if (prevDate) { overlay.remove(); this._showDayModal(prevDate, null, allDates); }
    });
    overlay.querySelector('#day-next').addEventListener('click', () => {
      if (nextDate) { overlay.remove(); this._showDayModal(nextDate, null, allDates); }
    });

    await this._loadDayOrders(dateStr, overlay.querySelector('#day-body'), 1, 10);
  }

  async _loadDayOrders(dateStr, bodyEl, page, size) {
    bodyEl.innerHTML = '<div class="loading" style="padding:24px;">Memuat order…</div>';
    try {
      const url = appendFilter(`/orders/day/${dateStr}?page=${page}&size=${size}`);
      const data = await apiFetch(url);
      this._renderDayOrders(bodyEl, dateStr, data, page, size);
    } catch (e) {
      bodyEl.innerHTML = `<div class="alert alert-error" style="margin:12px;">${e.message}</div>`;
    }
  }

  _renderDayOrders(bodyEl, dateStr, data, page, size) {
    const s = data.stats;
    const rows = data.rows || [];
    const total = data.total;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const start = total > 0 ? (page - 1) * size + 1 : 0;
    const end = Math.min(page * size, total);

    const rowHtml = r => {
      const hasItems = r.item_count > 1;
      const kDari = r.komisi_dari != null ? rp(Math.round(Number(r.komisi_dari))) : '—';
      const kKe   = rp(Math.round(Number(r.komisi_ke)));
      const delta  = Number(r.delta || 0);
      const tercatat = fmtDatetime(r.tercatat_at);
      return `<tr class="order-row" data-order-id="${r.order_id}" data-multi="${hasItems}"
        style="cursor:${hasItems ? 'pointer' : 'default'};">
        <td style="font-size:12px;">
          <span style="font-family:monospace;">${r.order_id}</span>
          ${hasItems ? `<span style="margin-left:5px;font-size:9.5px;font-weight:700;padding:1px 5px;background:#dbeafe;color:#2563eb;border-radius:3px;">${r.item_count} item</span>` : ''}
        </td>
        <td>${statusBadge(r.status)}</td>
        <td style="white-space:nowrap;font-size:12px;">${kDari} → ${kKe}</td>
        <td style="white-space:nowrap;font-size:12px;color:${delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : '#9ca3af'};">
          ${delta !== 0 ? rp(Math.round(Math.abs(delta))) : 'Rp 0'}
        </td>
        <td style="font-size:11px;color:var(--text-muted,#9ca3af);white-space:nowrap;">${tercatat}</td>
      </tr>`;
    };

    const sizeSel = [10, 25, 50, 100].map(n =>
      `<option value="${n}" ${n === size ? 'selected' : ''}>${n}</option>`
    ).join('');

    bodyEl.innerHTML = `
      <div class="modal-stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px;">
        <div class="modal-stat"><div class="modal-stat-label">COMPLETED</div><div class="modal-stat-value" style="color:#16a34a;">${Number(s.completed).toLocaleString('id-ID')}</div></div>
        <div class="modal-stat"><div class="modal-stat-label">PENDING</div><div class="modal-stat-value" style="color:#d97706;">${Number(s.pending).toLocaleString('id-ID')}</div></div>
        <div class="modal-stat"><div class="modal-stat-label">UNPAID</div><div class="modal-stat-value">${Number(s.unpaid).toLocaleString('id-ID')}</div></div>
        <div class="modal-stat"><div class="modal-stat-label">CANCELLED</div><div class="modal-stat-value" style="color:#dc2626;">${Number(s.cancelled).toLocaleString('id-ID')}</div></div>
      </div>
      <div class="modal-komisi-row" style="margin-bottom:14px;">
        <div>
          <div class="modal-komisi-label">KOMISI SAAT INI</div>
          <div class="modal-komisi-value">${rp(s.komisi)} <span style="font-size:12px;font-weight:400;color:var(--text-muted,#9ca3af);">(setelah update terbaru)</span></div>
        </div>
        ${(s.pending > 0 || s.unpaid > 0)
          ? '<div class="modal-komisi-status">● Masih berjalan</div>'
          : '<div class="modal-komisi-status" style="color:#16a34a;">● Sudah selesai</div>'}
      </div>
      <div class="table-wrap" style="overflow-x:auto;">
        <table class="data-table" style="font-size:12.5px;">
          <thead><tr>
            <th>ORDER ID</th>
            <th>STATUS</th>
            <th style="white-space:nowrap;">KOMISI (DARI → KE)</th>
            <th>Δ</th>
            <th>TERCATAT</th>
          </tr></thead>
          <tbody>
            ${rows.length === 0
              ? `<tr><td colspan="5" class="empty" style="padding:24px;">Belum ada data order — upload data Shopee untuk melihat detail.</td></tr>`
              : rows.map(rowHtml).join('')}
          </tbody>
        </table>
      </div>
      ${total > 0 ? `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;flex-wrap:wrap;gap:8px;">
          <div style="font-size:11.5px;color:var(--text-muted,#6b7280);">
            Klik baris untuk lihat rincian per-item. Tabel menampilkan semua order pada tanggal ini.
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:12px;">
            Tampilkan baris
            <select id="size-sel" style="padding:3px 6px;border:1px solid var(--border,#e5e7eb);border-radius:4px;font-size:12px;">${sizeSel}</select>
            <span>${start}-${end} dari ${total}</span>
            <button class="btn" id="pg-first" style="padding:3px 8px;" ${page <= 1 ? 'disabled' : ''}>«</button>
            <button class="btn" id="pg-prev"  style="padding:3px 8px;" ${page <= 1 ? 'disabled' : ''}>‹</button>
            <button class="btn" id="pg-next"  style="padding:3px 8px;" ${page >= totalPages ? 'disabled' : ''}>›</button>
            <button class="btn" id="pg-last"  style="padding:3px 8px;" ${page >= totalPages ? 'disabled' : ''}>»</button>
          </div>
        </div>` : ''}`;

    if (total > 0) {
      bodyEl.querySelector('#size-sel')?.addEventListener('change', e =>
        this._loadDayOrders(dateStr, bodyEl, 1, parseInt(e.target.value)));
      bodyEl.querySelector('#pg-first')?.addEventListener('click', () => this._loadDayOrders(dateStr, bodyEl, 1, size));
      bodyEl.querySelector('#pg-prev')?.addEventListener('click',  () => this._loadDayOrders(dateStr, bodyEl, page - 1, size));
      bodyEl.querySelector('#pg-next')?.addEventListener('click',  () => this._loadDayOrders(dateStr, bodyEl, page + 1, size));
      bodyEl.querySelector('#pg-last')?.addEventListener('click',  () => this._loadDayOrders(dateStr, bodyEl, totalPages, size));
    }

    bodyEl.querySelectorAll('.order-row[data-multi="true"]').forEach(tr => {
      tr.addEventListener('click', () => this._showItemsModal(dateStr, tr.dataset.orderId));
      tr.title = 'Klik untuk lihat rincian per-item';
    });
  }

  async _showItemsModal(dateStr, orderId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:640px;width:96vw;">
        <div class="modal-header">
          <div>
            <h2 style="font-size:16px;font-weight:700;">Rincian per-item</h2>
            <p style="font-size:11.5px;color:var(--text-muted,#9ca3af);margin:2px 0 0;">${orderId}</p>
          </div>
          <button class="modal-close" id="items-close">×</button>
        </div>
        <div class="modal-body" id="items-body">
          <div class="loading" style="padding:16px;">Memuat…</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#items-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    try {
      const url = appendFilter(`/orders/items/${dateStr}/${encodeURIComponent(orderId)}`);
      const data = await apiFetch(url);
      const items = data.items || [];

      overlay.querySelector('#items-body').innerHTML = `
        <p style="font-size:12px;color:var(--text-muted,#9ca3af);margin:0 0 12px;">
          Komisi dipindahkan antar-item — total pesanan tidak berubah.
        </p>
        <div class="table-wrap" style="overflow-x:auto;">
          <table class="data-table" style="font-size:12.5px;">
            <thead><tr>
              <th>PRODUK</th>
              <th>STATUS</th>
              <th style="white-space:nowrap;">KOMISI (DARI → KE)</th>
            </tr></thead>
            <tbody>
              ${items.map(it => {
                const dari = it.komisi_dari != null ? rp(Math.round(Number(it.komisi_dari))) : 'Rp 0';
                const ke   = rp(Math.round(Number(it.komisi_ke)));
                const produk = it.nama_produk
                  ? `<span title="${it.nama_produk}" style="display:block;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${it.nama_produk}</span>`
                  : '<span style="color:var(--text-muted,#9ca3af);">—</span>';
                return `<tr>
                  <td>${produk}</td>
                  <td>${statusBadge(it.status)}</td>
                  <td style="white-space:nowrap;font-size:12px;">${dari} → ${ke}</td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--surface-alt,#f9fafb);">
                <td colspan="2" style="font-weight:700;padding:8px 12px;">Total pesanan</td>
                <td style="font-weight:700;padding:8px 12px;">${rp(Math.round(Number(data.total_komisi)))}</td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    } catch (e) {
      overlay.querySelector('#items-body').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  destroy() {}
}
