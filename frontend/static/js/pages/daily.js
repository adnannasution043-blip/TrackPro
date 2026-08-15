import { apiFetch } from '../api.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const num = n => n != null ? Number(n).toLocaleString('id-ID') : '-';
const pct = n => n != null ? Number(n).toFixed(2) + '%' : '-';

function fmtDate(d) {
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const dt = new Date(d);
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

export class DailyPage {
  constructor(container) {
    this.container = container;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    this.dari = new Date(y, m, 1).toISOString().split('T')[0];
    this.sampai = now.toISOString().split('T')[0];
    this._sort = { col: 'tanggal', dir: 'desc' };
    this._rows = [];
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Laporan Harian</h1>
          <p>Performa harian — klik baris untuk melihat detail produk terlaris.</p>
        </div>
        <div class="page-header-right">
          <input type="date" id="inp-dari" value="${this.dari}" style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;">
          <span style="color:#6b7280;">—</span>
          <input type="date" id="inp-sampai" value="${this.sampai}" style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;">
          <button class="btn btn-primary" id="btn-apply">Tampilkan</button>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;

    this.container.querySelector('#btn-apply').addEventListener('click', () => {
      this.dari = this.container.querySelector('#inp-dari').value;
      this.sampai = this.container.querySelector('#inp-sampai').value;
      this._load();
    });

    await this._load();
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';
    try {
      const data = await apiFetch(`/dashboard?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}`);
      if (!data) return;
      this._rows = data.harian || [];
      this._renderTable(el);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _renderTable(el) {
    const rows = [...this._rows].sort((a, b) => {
      const { col, dir } = this._sort;
      let va = a[col], vb = b[col];
      if (typeof va === 'string') va = va.localeCompare(vb);
      else va = (va || 0) - (vb || 0);
      return dir === 'asc' ? va : -va;
    });

    const cols = [
      { key: 'tanggal', label: 'Tanggal' },
      { key: 'spend_idr', label: 'Biaya' },
      { key: 'clicks_meta', label: 'Klik Meta' },
      { key: 'clicks_shopee', label: 'Klik Shopee' },
      { key: 'komisi', label: 'Komisi' },
      { key: 'penjualan', label: 'Penjualan' },
      { key: 'orders_selesai', label: 'Selesai' },
      { key: 'orders_tertunda', label: 'Pending' },
      { key: 'laba', label: 'Laba' },
      { key: 'cr_persen', label: 'CR' },
    ];

    const sortArrow = (k) => {
      if (this._sort.col !== k) return '';
      return this._sort.dir === 'asc' ? ' ↑' : ' ↓';
    };

    el.innerHTML = `
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                ${cols.map(c => `<th class="sortable" data-col="${c.key}">${c.label}${sortArrow(c.key)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0
                ? `<tr><td colspan="${cols.length}" class="empty">Tidak ada data.<br><span style="font-size:12px;">Upload data harian terlebih dahulu.</span></td></tr>`
                : rows.map(r => `
                  <tr style="cursor:pointer;" data-date="${r.tanggal}" class="daily-row">
                    <td style="font-weight:600;color:#2563eb;">${r.tanggal}</td>
                    <td>${rp(r.spend_idr)}</td>
                    <td>${num(r.clicks_meta)}</td>
                    <td>${num(r.clicks_shopee)}</td>
                    <td>${rp(r.komisi)}</td>
                    <td>${rp(r.penjualan)}</td>
                    <td style="color:#16a34a;font-weight:600;">${r.orders_selesai}</td>
                    <td style="color:#d97706;">${r.orders_tertunda}</td>
                    <td class="${Number(r.laba) >= 0 ? 'positive' : 'negative'}" style="font-weight:600;">${rp(r.laba)}</td>
                    <td>${pct(r.cr_persen)}</td>
                  </tr>`).join('')
              }
            </tbody>
          </table>
        </div>
        <div class="pagination" style="margin-top:10px;">
          <div style="font-size:12.5px;color:#6b7280;">Menampilkan ${rows.length} baris</div>
        </div>
      </div>
    `;

    el.querySelectorAll('[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (this._sort.col === col) {
          this._sort.dir = this._sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          this._sort = { col, dir: 'desc' };
        }
        this._renderTable(el);
      });
    });

    el.querySelectorAll('.daily-row').forEach(row => {
      row.addEventListener('click', () => {
        const date = row.dataset.date;
        const r = this._rows.find(x => x.tanggal === date);
        if (r) this._showModal(r);
      });
    });
  }

  _showModal(r) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <div>
            <h2>${r.tanggal}</h2>
            <p>Detail performa hari ini</p>
          </div>
          <button class="modal-close" id="modal-close">×</button>
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
              <div class="modal-komisi-label">KOMISI</div>
              <div class="modal-komisi-value">${rp(r.komisi)}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
            <div style="padding:12px;border:1px solid #e5e7eb;border-radius:6px;">
              <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Biaya Iklan</div>
              <div style="font-size:16px;font-weight:700;">${rp(r.spend_idr)}</div>
            </div>
            <div style="padding:12px;border:1px solid #e5e7eb;border-radius:6px;">
              <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Laba</div>
              <div style="font-size:16px;font-weight:700;" class="${Number(r.laba) >= 0 ? 'positive' : 'negative'}">${rp(r.laba)}</div>
            </div>
            <div style="padding:12px;border:1px solid #e5e7eb;border-radius:6px;">
              <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Klik Meta</div>
              <div style="font-size:16px;font-weight:700;">${num(r.clicks_meta)}</div>
            </div>
            <div style="padding:12px;border:1px solid #e5e7eb;border-radius:6px;">
              <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Klik Shopee</div>
              <div style="font-size:16px;font-weight:700;">${num(r.clicks_shopee)}</div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  destroy() {}
}
