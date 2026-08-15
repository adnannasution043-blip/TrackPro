import { apiFetch } from '../api.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const num = n => n != null ? Number(n).toLocaleString('id-ID') : '-';

export class CommissionPage {
  constructor(container) {
    this.container = container;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    this.dari = new Date(y, m, 1).toISOString().split('T')[0];
    this.sampai = now.toISOString().split('T')[0];
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Laporan Komisi</h1>
          <p>Ringkasan komisi Shopee Affiliate per tag link dan akun.</p>
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
      this._render(el, data);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _render(el, data) {
    const s = data.summary || {};
    const harian = data.harian || [];

    el.innerHTML = `
      <div class="stat-grid" style="margin-bottom:16px;">
        <div class="stat-card">
          <div class="stat-label">Total Komisi</div>
          <div class="stat-value">${rp(s.total_komisi)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Terpetakan (Meta)</div>
          <div class="stat-value" style="color:#16a34a;">${rp(s.total_komisi_terpetakan)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Non-Meta</div>
          <div class="stat-value" style="color:#6b7280;">${rp(s.total_komisi_nonmeta)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Pesanan Selesai</div>
          <div class="stat-value">${s.total_orders_selesai || 0}</div>
        </div>
      </div>

      <div class="card">
        <div style="font-size:14px;font-weight:700;margin-bottom:14px;">Rincian Komisi Harian</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>TANGGAL</th>
                <th>KOMISI</th>
                <th>PESANAN SELESAI</th>
                <th>PESANAN PENDING</th>
                <th>PENJUALAN</th>
                <th>BIAYA IKLAN</th>
                <th>LABA</th>
              </tr>
            </thead>
            <tbody>
              ${harian.length === 0
                ? `<tr><td colspan="7" class="empty">Tidak ada data untuk periode ini.</td></tr>`
                : harian.map(r => `
                  <tr>
                    <td style="font-weight:500;">${r.tanggal}</td>
                    <td style="font-weight:600;">${rp(r.komisi)}</td>
                    <td style="color:#16a34a;">${r.orders_selesai}</td>
                    <td style="color:#d97706;">${r.orders_tertunda}</td>
                    <td>${rp(r.penjualan)}</td>
                    <td>${rp(r.spend_idr)}</td>
                    <td class="${Number(r.laba||0)>=0?'positive':'negative'}" style="font-weight:600;">${rp(r.laba)}</td>
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
