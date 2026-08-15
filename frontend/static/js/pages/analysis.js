import { apiFetch } from '../api.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const STAGES = ['Pra Filter', 'Filter', 'Fix Scale Up', 'Off'];

export class AnalysisPage {
  constructor(container) {
    this.container = container;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    this.dari = new Date(y, m, 1).toISOString().split('T')[0];
    this.sampai = now.toISOString().split('T')[0];
    this._rows = [];
    this._search = '';
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Analisis Iklan</h1>
          <p>Pantau dan kategorikan performa setiap iklan.</p>
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
      const data = await apiFetch(`/dashboard/campaigns`);
      if (!data) { this._renderEmpty(el); return; }
      this._rows = (data.campaigns || []).flatMap(c =>
        (c.ads || []).length > 0 ? c.ads.map(a => ({ ...a, campaign_name: c.nama_campaign })) : [c]
      );
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
            <input type="text" placeholder="Cari iklan…">
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>NAMA IKLAN</th><th>CAMPAIGN</th><th>STATUS</th>
                <th>BIAYA</th><th>KLIK</th><th>KOMISI</th><th>LABA</th><th>TAHAP</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="8" class="empty">Belum ada data analisis iklan.<br><span style="font-size:12px;">Upload data Meta Ads untuk melihat performa per iklan.</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  _renderTable(el) {
    const filtered = this._rows.filter(r =>
      !this._search ||
      (r.nama_ad || r.nama_campaign || '').toLowerCase().includes(this._search.toLowerCase())
    );

    el.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div class="search-box" style="flex:1;max-width:320px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="inp-search" placeholder="Cari iklan atau kampanye…" value="${this._search}" style="width:100%;padding:7px 12px 7px 32px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;">
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>NAMA IKLAN</th><th>CAMPAIGN</th><th>STATUS</th>
                <th>BIAYA</th><th>KLIK</th><th>KOMISI</th><th>LABA</th><th>TAHAP</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0
                ? `<tr><td colspan="8" class="empty">Tidak ada data iklan.<br><span style="font-size:12px;">Upload data Meta Ads terlebih dahulu.</span></td></tr>`
                : filtered.map((r, i) => `
                  <tr>
                    <td style="font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.nama_ad || r.nama_campaign || '-'}</td>
                    <td style="font-size:12px;color:#6b7280;">${r.campaign_name || '-'}</td>
                    <td><span class="badge ${r.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}">${r.status || 'PAUSED'}</span></td>
                    <td>${rp(r.spend_idr)}</td>
                    <td>${Number(r.clicks_meta || 0).toLocaleString('id-ID')}</td>
                    <td>${rp(r.komisi)}</td>
                    <td class="${Number(r.laba||0)>=0?'positive':'negative'}" style="font-weight:600;">${rp(r.laba)}</td>
                    <td>
                      <select class="stage-select" data-idx="${i}">
                        ${STAGES.map(s => `<option ${r.tahap === s ? 'selected' : ''}>${s}</option>`).join('')}
                      </select>
                    </td>
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
  }

  destroy() {}
}
