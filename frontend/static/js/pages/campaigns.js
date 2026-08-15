import { apiFetch } from '../api.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

export class CampaignsPage {
  constructor(container) {
    this.container = container;
    this._rows = [];
    this._filter = 'all';
    this._search = '';
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kampanye Meta</h1>
          <p>Performa kampanye Meta Ads yang terhubung ke tag link Shopee.</p>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;
    await this._load();
  }

  async _load() {
    const el = this.container.querySelector('#content');
    try {
      const data = await apiFetch('/dashboard/campaigns');
      if (!data) { this._renderEmpty(el); return; }
      this._rows = data.campaigns || [];
      this._renderTable(el);
    } catch (_) {
      this._renderEmpty(el);
    }
  }

  _renderEmpty(el) {
    el.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Cari kampanye…">
          </div>
          <div class="filter-tabs">
            <button class="filter-tab active">Semua (0)</button>
            <button class="filter-tab">Aktif (0)</button>
            <button class="filter-tab">Paused (0)</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>NAMA CAMPAIGN</th><th>STATUS</th><th>TAG LINK</th>
                <th>BIAYA</th><th>KLIK</th><th>KOMISI</th><th>LABA</th><th>ROI</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="8" class="empty">Belum ada data kampanye.<br><span style="font-size:12px;">Upload data harian dan hubungkan taglink untuk melihat performa kampanye.</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  _renderTable(el) {
    const filtered = this._rows.filter(r => {
      const matchSearch = !this._search || r.nama_campaign?.toLowerCase().includes(this._search.toLowerCase()) || r.tag_link?.toLowerCase().includes(this._search.toLowerCase());
      const matchFilter = this._filter === 'all' ||
        (this._filter === 'active' && r.status === 'ACTIVE') ||
        (this._filter === 'paused' && r.status === 'PAUSED');
      return matchSearch && matchFilter;
    });

    const countAll = this._rows.length;
    const countActive = this._rows.filter(r => r.status === 'ACTIVE').length;
    const countPaused = this._rows.filter(r => r.status === 'PAUSED').length;

    el.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div class="search-box" style="flex:1;max-width:320px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="inp-search" placeholder="Cari kampanye atau tag link…" value="${this._search}" style="width:100%;padding:7px 12px 7px 32px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;">
          </div>
          <div class="filter-tabs">
            <button class="filter-tab ${this._filter==='all'?'active':''}" data-f="all">Semua (${countAll})</button>
            <button class="filter-tab ${this._filter==='active'?'active':''}" data-f="active">Aktif (${countActive})</button>
            <button class="filter-tab ${this._filter==='paused'?'active':''}" data-f="paused">Paused (${countPaused})</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>NAMA CAMPAIGN</th><th>STATUS</th><th>TAG LINK</th>
                <th>BIAYA</th><th>KLIK</th><th>KOMISI</th><th>LABA</th><th>ROI</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0
                ? `<tr><td colspan="8" class="empty">Tidak ada data kampanye.</td></tr>`
                : filtered.map(r => `
                  <tr>
                    <td style="font-weight:500;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.nama_campaign || '-'}</td>
                    <td><span class="badge ${r.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}">${r.status || '-'}</span></td>
                    <td><span class="tag-link">${r.tag_link || '-'}</span></td>
                    <td>${rp(r.spend_idr)}</td>
                    <td>${Number(r.clicks_meta || 0).toLocaleString('id-ID')}</td>
                    <td>${rp(r.komisi)}</td>
                    <td class="${Number(r.laba||0)>=0?'positive':'negative'}" style="font-weight:600;">${rp(r.laba)}</td>
                    <td class="${Number(r.roi_persen||0)>=0?'positive':'negative'}">${r.roi_persen != null ? Number(r.roi_persen).toFixed(1)+'%' : '-'}</td>
                  </tr>`).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    el.querySelector('#inp-search')?.addEventListener('input', (e) => {
      this._search = e.target.value;
      this._renderTable(el);
    });

    el.querySelectorAll('[data-f]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._filter = btn.dataset.f;
        this._renderTable(el);
      });
    });
  }

  destroy() {}
}
