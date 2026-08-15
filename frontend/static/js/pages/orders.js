import { apiFetch } from '../api.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

export class OrdersPage {
  constructor(container) {
    this.container = container;
    const now = new Date();
    this.year = now.getFullYear();
    this.month = now.getMonth(); // 0-indexed
    this._dailyData = {};
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Laporan Pesanan</h1>
          <p>Snapshot status harian — pilih tanggal untuk lihat order mana yang berubah.</p>
        </div>
        <div class="page-header-right">
          <button class="btn" id="btn-prev">‹</button>
          <span id="month-label" style="font-size:14px;font-weight:600;min-width:140px;text-align:center;">${MONTHS[this.month]} ${this.year}</span>
          <button class="btn" id="btn-next">›</button>
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
    this.container.querySelector('#month-label').textContent = `${MONTHS[this.month]} ${this.year}`;
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';

    const y = this.year;
    const m = this.month;
    const dari = `${y}-${String(m+1).padStart(2,'0')}-01`;
    const lastDay = new Date(y, m+1, 0).getDate();
    const sampai = `${y}-${String(m+1).padStart(2,'0')}-${lastDay}`;

    try {
      const data = await apiFetch(`/dashboard?tanggal_dari=${dari}&tanggal_sampai=${sampai}`);
      if (!data) return;

      this._dailyData = {};
      for (const r of (data.harian || [])) {
        this._dailyData[r.tanggal] = r;
      }
      this._renderCalendar(el, y, m, lastDay);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _renderCalendar(el, year, month, lastDay) {
    const firstDay = new Date(year, month, 1).getDay();
    const adjustedFirst = (firstDay === 0 ? 6 : firstDay - 1);

    const dayHeaders = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
    const headerHtml = dayHeaders.map(d => `
      <div style="text-align:center;font-size:11px;font-weight:700;color:#6b7280;padding:4px 0;text-transform:uppercase;">${d}</div>
    `).join('');

    let cells = Array(adjustedFirst).fill('<div></div>');

    for (let d = 1; d <= lastDay; d++) {
      const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const row = this._dailyData[key];

      if (row) {
        const isGood = Number(row.laba || 0) >= 0;
        const bgClass = isGood ? 'background:#f0fdf4;border-color:#bbf7d0;' : 'background:#fef2f2;border-color:#fecaca;';
        cells.push(`
          <div class="calendar-day-card" style="${bgClass}cursor:pointer;" data-date="${key}">
            <div class="calendar-day-num">${d}</div>
            <div class="calendar-day-detail">
              <div>Selesai: <strong>${row.orders_selesai}</strong></div>
              <div>Pending: <strong>${row.orders_tertunda}</strong></div>
              <div style="margin-top:3px;font-weight:600;color:${isGood ? '#16a34a' : '#dc2626'};">${rp(row.laba)}</div>
            </div>
          </div>
        `);
      } else {
        cells.push(`
          <div class="calendar-day-card" style="opacity:0.5;">
            <div class="calendar-day-num" style="color:#9ca3af;">${d}</div>
          </div>
        `);
      }
    }

    el.innerHTML = `
      <div class="card">
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px;">
          ${headerHtml}
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;" id="cal-grid">
          ${cells.join('')}
        </div>
      </div>
    `;

    el.querySelectorAll('[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        const key = cell.dataset.date;
        const row = this._dailyData[key];
        if (row) this._showModal(key, row);
      });
    });
  }

  _showModal(dateStr, r) {
    const [y, m, d] = dateStr.split('-');
    const title = `${parseInt(d)} ${MONTHS_SHORT[parseInt(m)-1]} ${y}`;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:560px;">
        <div class="modal-header">
          <div>
            <h2>${title}</h2>
            <p>Update terakhir: hari ini</p>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="modal-close" id="modal-close">×</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="modal-stat-grid">
            <div class="modal-stat completed">
              <div class="modal-stat-label">COMPLETED</div>
              <div class="modal-stat-value">${r.orders_selesai}</div>
            </div>
            <div class="modal-stat pending">
              <div class="modal-stat-label">PENDING</div>
              <div class="modal-stat-value">${r.orders_tertunda}</div>
            </div>
            <div class="modal-stat">
              <div class="modal-stat-label">UNPAID</div>
              <div class="modal-stat-value">0</div>
            </div>
            <div class="modal-stat cancelled">
              <div class="modal-stat-label">CANCELLED</div>
              <div class="modal-stat-value">${r.orders_batal || 0}</div>
            </div>
          </div>
          <div class="modal-komisi-row">
            <div>
              <div class="modal-komisi-label">KOMISI SAAT INI</div>
              <div class="modal-komisi-value">${rp(r.komisi)}</div>
            </div>
            <div class="modal-komisi-status">● Masih berjalan</div>
          </div>
          <table class="data-table" style="margin-top:12px;">
            <thead>
              <tr>
                <th>ORDER ID</th>
                <th>STATUS</th>
                <th>KOMISI</th>
                <th>TERCATAT</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="4" class="empty" style="padding:24px;">Detail order tidak tersedia — upload data Shopee untuk melihat perubahan.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  destroy() {}
}
