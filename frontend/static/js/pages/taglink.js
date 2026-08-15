import { apiFetch } from '../api.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

export class TaglinkPage {
  constructor(container) {
    this.container = container;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    this.dari = new Date(y, m - 1 >= 0 ? m - 1 : 11, 1).toISOString().split('T')[0];
    this.sampai = now.toISOString().split('T')[0];
    this._rows = [];
    this._filter = 'all';
    this._search = '';
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Hubungkan Taglink</h1>
          <p>Petakan campaign Meta ke tag link Shopee agar biaya, klik, pesanan, komisi, dan ROI terbaca benar.</p>
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
      const data = await apiFetch(`/taglinks?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}`);
      this._rows = data || [];
      this._renderContent(el);
    } catch (_) {
      this._rows = [];
      this._renderContent(el);
    }
  }

  _renderContent(el) {
    const total = this._rows.length;
    const mapped = this._rows.filter(r => r.tag_link).length;
    const unmapped = total - mapped;

    el.innerHTML = `
      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px;">
        <div class="stat-card">
          <div class="stat-label">Total Campaign</div>
          <div class="stat-value">${total}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Sudah Dipetakan</div>
          <div class="stat-value" style="color:#16a34a;">${mapped}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Belum Dipetakan</div>
          <div class="stat-value" style="color:#dc2626;">${unmapped}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tag Link Shopee</div>
          <div class="stat-value">-</div>
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <div class="search-box" style="flex:1;max-width:340px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="inp-search" placeholder="Cari campaign atau tag link…" value="${this._search}" style="width:100%;padding:7px 12px 7px 32px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;">
          </div>
          <div class="filter-tabs">
            <button class="filter-tab ${this._filter==='all'?'active':''}" data-f="all">Semua (${total})</button>
            <button class="filter-tab ${this._filter==='mapped'?'active':''}" data-f="mapped">Sudah dipetakan (${mapped})</button>
            <button class="filter-tab ${this._filter==='unmapped'?'active':''}" data-f="unmapped">Belum dipetakan (${unmapped})</button>
          </div>
        </div>

        <div class="table-wrap" id="tl-table"></div>
      </div>
    `;

    this._renderTable(el.querySelector('#tl-table'));

    el.querySelector('#inp-search')?.addEventListener('input', (e) => {
      this._search = e.target.value;
      this._renderTable(el.querySelector('#tl-table'));
    });

    el.querySelectorAll('[data-f]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._filter = btn.dataset.f;
        el.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('active', b.dataset.f === this._filter));
        this._renderTable(el.querySelector('#tl-table'));
      });
    });
  }

  _renderTable(el) {
    const filtered = this._rows.filter(r => {
      const matchSearch = !this._search ||
        (r.campaign_name || '').toLowerCase().includes(this._search.toLowerCase()) ||
        (r.tag_link || '').toLowerCase().includes(this._search.toLowerCase());
      const matchFilter = this._filter === 'all' ||
        (this._filter === 'mapped' && r.tag_link) ||
        (this._filter === 'unmapped' && !r.tag_link);
      return matchSearch && matchFilter;
    });

    el.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th class="sortable">Nama Campaign ↑</th>
            <th class="sortable">Tag Link (Shopee) ↕</th>
            <th class="sortable">Akun Shopee ↕</th>
            <th>Sum… ↕</th>
            <th>Catatan</th>
            <th class="sortable">Dibuat ↕</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0
            ? `<tr><td colspan="7" class="empty">Tidak ada data kampanye.<br><span style="font-size:12px;">Upload data Meta Ads terlebih dahulu untuk melihat kampanye yang bisa dipetakan.</span></td></tr>`
            : filtered.map(r => `
              <tr>
                <td style="font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.campaign_name || r.nama_campaign || '-'}</td>
                <td>
                  ${r.tag_link
                    ? `<span class="tag-link">${r.tag_link}</span>`
                    : `<input type="text" class="form-input" style="width:140px;padding:4px 8px;font-size:12px;" placeholder="Tag link…" value="">`
                  }
                </td>
                <td style="font-size:12.5px;">${r.shopee_account || '-'}</td>
                <td>
                  ${r.tag_link
                    ? `<span class="badge badge-red" style="font-size:10px;">manual</span>`
                    : '-'
                  }
                </td>
                <td style="font-size:12.5px;color:#6b7280;">-</td>
                <td style="font-size:12px;color:#6b7280;">${r.dibuat || r.created_at?.split('T')[0] || '-'}</td>
                <td>
                  <div style="display:flex;gap:4px;">
                    <button class="btn btn-sm btn-icon" title="Edit">✏️</button>
                    <button class="btn btn-sm btn-icon" title="Hapus">🗑️</button>
                  </div>
                </td>
              </tr>`).join('')
          }
        </tbody>
      </table>
      <div class="pagination" style="margin-top:10px;">
        <div style="font-size:12.5px;color:#6b7280;">Menampilkan ${filtered.length} dari ${this._rows.length} campaign</div>
      </div>
    `;
  }

  destroy() {}
}
