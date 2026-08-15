import { apiFetch } from '../api.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const num = n => n != null ? Number(n).toLocaleString('id-ID') : '-';

export class ClicksPage {
  constructor(container) {
    this.container = container;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    this.dari = new Date(y, m, 1).toISOString().split('T')[0];
    this.sampai = now.toISOString().split('T')[0];
    this._tab = 'taglink';
    this._search = '';
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Laporan Klik</h1>
          <p>Volume click dan konversi per tag link. Klik baris untuk lihat rincian per-channel.</p>
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
      this._renderContent(el, data);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _renderContent(el, data) {
    const s = data.summary || {};
    const totalClicks = Number(s.total_clicks_meta || 0) + Number(s.total_clicks_shopee || 0);

    el.innerHTML = `
      <div class="stat-grid" style="margin-bottom:16px;">
        <div class="stat-card">
          <div class="stat-label">Total Click</div>
          <div class="stat-value">${num(totalClicks)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tag Link</div>
          <div class="stat-value">-</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pesanan</div>
          <div class="stat-value">${num(s.total_orders_selesai)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Komisi</div>
          <div class="stat-value" style="font-size:16px;">${rp(s.total_komisi)}</div>
          <div class="stat-sub">CR -</div>
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <div class="filter-tabs" style="margin-bottom:12px;">
            <button class="filter-tab ${this._tab==='taglink'?'active':''}" data-t="taglink">Per Tag Link</button>
            <button class="filter-tab ${this._tab==='source'?'active':''}" data-t="source">Per Sumber</button>
          </div>
        </div>
        <div class="toolbar">
          <div class="search-box" style="flex:1;max-width:320px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="inp-search" placeholder="Cari…" value="${this._search}" style="width:100%;padding:7px 12px 7px 32px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;">
          </div>
        </div>
        <div class="table-wrap" id="click-table"></div>
      </div>
    `;

    this._renderTable(el.querySelector('#click-table'));

    el.querySelectorAll('[data-t]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._tab = btn.dataset.t;
        el.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('active', b.dataset.t === this._tab));
        this._renderTable(el.querySelector('#click-table'));
      });
    });

    el.querySelector('#inp-search')?.addEventListener('input', (e) => {
      this._search = e.target.value;
      this._renderTable(el.querySelector('#click-table'));
    });
  }

  _renderTable(el) {
    if (this._tab === 'source') {
      el.innerHTML = `
        <table class="data-table">
          <thead>
            <tr><th>SUMBER</th><th>CLICK</th><th>PESANAN</th><th>CR</th><th>KOMISI</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Facebook</td>
              <td>-</td><td>-</td><td>-</td><td>-</td>
            </tr>
            <tr>
              <td>Instagram</td>
              <td>-</td><td>-</td><td>-</td><td>-</td>
            </tr>
            <tr>
              <td>Others</td>
              <td>-</td><td>-</td><td>-</td><td>-</td>
            </tr>
          </tbody>
        </table>
        <div class="pagination" style="margin-top:10px;">
          <div style="font-size:12.5px;color:#6b7280;">Upload data untuk melihat data per sumber</div>
        </div>
      `;
    } else {
      el.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>TAG LINK</th><th>CLICK</th><th>PESANAN</th><th>CR</th><th>KOMISI</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="6" class="empty">Belum ada data klik.<br><span style="font-size:12px;">Upload data Shopee Click untuk melihat laporan klik per tag link.</span></td></tr>
          </tbody>
        </table>
        <div class="pagination" style="margin-top:10px;">
          <div style="font-size:12.5px;color:#6b7280;">0 - 0 dari 0</div>
        </div>
      `;
    }
  }

  destroy() {}
}
