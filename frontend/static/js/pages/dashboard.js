import { apiFetch } from '../api.js';

const rp = n => 'Rp ' + Number(n).toLocaleString('id-ID');
const pct = n => n != null ? Number(n).toFixed(2) + '%' : '-';
const num = n => n != null ? Number(n).toLocaleString('id-ID') : '-';
const dash = v => v != null ? v : '-';

export class DashboardPage {
  constructor(container) {
    this.container = container;
    const today = new Date();
    const y = today.getFullYear(), m = today.getMonth();
    this.dari = new Date(y, m, 1).toISOString().split('T')[0];
    this.sampai = today.toISOString().split('T')[0];
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <h1>Dashboard</h1>
        <div class="filter-row">
          <input type="date" id="dari" value="${this.dari}">
          <span class="filter-sep">s/d</span>
          <input type="date" id="sampai" value="${this.sampai}">
          <button id="btn-filter" class="btn-primary">Tampilkan</button>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat…</div></div>
    `;
    this.container.querySelector('#btn-filter').addEventListener('click', () => {
      this.dari = this.container.querySelector('#dari').value;
      this.sampai = this.container.querySelector('#sampai').value;
      this._load();
    });
    await this._load();
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat…</div>';
    try {
      const data = await apiFetch(`/dashboard?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}`);
      if (!data) return;
      el.innerHTML = this._render(data);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _render({ summary: s, harian }) {
    const labaClass = n => Number(n) >= 0 ? 'positive' : 'negative';
    return `
      <div class="card-grid">
        <div class="card stat-card">
          <div class="stat-label">Total Biaya</div>
          <div class="stat-value">${rp(s.total_biaya)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">Total Komisi</div>
          <div class="stat-value">${rp(s.total_komisi)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">Laba</div>
          <div class="stat-value ${labaClass(s.total_laba)}">${rp(s.total_laba)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">ROI</div>
          <div class="stat-value ${labaClass(s.total_laba)}">${pct(s.roi_persen)}</div>
        </div>
      </div>

      <div class="card-grid grid-3">
        <div class="card stat-card sm">
          <div class="stat-label">Penjualan</div>
          <div class="stat-value">${rp(s.total_penjualan)}</div>
        </div>
        <div class="card stat-card sm">
          <div class="stat-label">Orders (Selesai / Tertunda / Batal)</div>
          <div class="stat-value">${s.total_orders_selesai} <span class="muted">/</span> ${s.total_orders_tertunda} <span class="muted">/</span> ${s.total_orders_batal}</div>
        </div>
        <div class="card stat-card sm">
          <div class="stat-label">Klik (Meta / Shopee)</div>
          <div class="stat-value">${num(s.total_clicks_meta)} <span class="muted">/</span> ${num(s.total_clicks_shopee)}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Breakdown Komisi</div>
        <div class="breakdown-grid">
          <div class="breakdown-item">
            <span>Terpetakan (Campaign)</span>
            <strong>${rp(s.total_komisi_terpetakan)}</strong>
          </div>
          <div class="breakdown-item">
            <span class="muted">Non-Meta / Belum Dipetakan</span>
            <strong class="muted">${rp(s.total_komisi_nonmeta)}</strong>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Laporan Harian</div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th><th>Biaya</th><th>Klik Meta</th><th>Klik Shopee</th>
                <th>Komisi</th><th>Penjualan</th><th>Selesai</th><th>Tertunda</th>
                <th>Laba</th><th>EPC</th><th>CR</th>
              </tr>
            </thead>
            <tbody>
              ${harian.length === 0
                ? `<tr><td colspan="11" class="empty">Tidak ada data untuk periode ini.</td></tr>`
                : harian.map(r => `
                  <tr>
                    <td>${r.tanggal}</td>
                    <td>${rp(r.spend_idr)}</td>
                    <td>${num(r.clicks_meta)}</td>
                    <td>${num(r.clicks_shopee)}</td>
                    <td>${rp(r.komisi)}</td>
                    <td>${rp(r.penjualan)}</td>
                    <td>${r.orders_selesai}</td>
                    <td>${r.orders_tertunda}</td>
                    <td class="${labaClass(r.laba)}">${rp(r.laba)}</td>
                    <td>${r.epc != null ? rp(r.epc) : '-'}</td>
                    <td>${r.cr_persen != null ? r.cr_persen + '%' : '-'}</td>
                  </tr>`).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  destroy() {}
}
