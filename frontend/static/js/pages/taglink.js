import { apiFetch } from '../api.js';
import { filterQS } from '../filter-state.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const num = n => Number(n || 0).toLocaleString('id-ID');

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtRangeLabel(dari, sampai) {
  const d1 = new Date(dari + 'T00:00:00'), d2 = new Date(sampai + 'T00:00:00');
  const f = d => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  return `${f(d1)} — ${f(d2)}`;
}

function appendFilter(url) {
  const fqs = filterQS ? filterQS() : '';
  if (!fqs) return url;
  return url + (url.includes('?') ? fqs : '?' + fqs.slice(1));
}

const SVG_EDIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const SVG_TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
const SVG_SORT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10" style="opacity:.45;"><path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/></svg>`;
const SVG_SORT_ASC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><path d="M8 9l4-4 4 4"/></svg>`;
const SVG_SORT_DESC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><path d="M16 15l-4 4-4-4"/></svg>`;

export class TaglinkPage {
  constructor(container) {
    this.container = container;
    const now = new Date();
    const d7 = new Date(now); d7.setDate(d7.getDate() - 6);
    this.dari = d7.toISOString().split('T')[0];
    this.sampai = now.toISOString().split('T')[0];
    this._filter = 'all';
    this._search = '';
    this._sortCol = 'campaign_name';
    this._sortDir = 'asc';
    this._allRows = [];
    this._campaigns = [];
    this._tags = [];
    this._shopeeAccounts = [];
    this._onDocClick = this._onDocClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Hubungkan Taglink</h1>
          <p>Petakan campaign Meta ke tag link Shopee agar biaya, klik, pesanan, komisi, dan ROI terbaca benar.</p>
        </div>
        <div class="page-header-right" style="position:relative;display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
          <button id="btn-range" class="date-range-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span id="range-label">${fmtRangeLabel(this.dari, this.sampai)}</span>
          </button>
          <div id="range-picker" style="display:none;position:absolute;top:44px;right:0;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.13);z-index:200;min-width:260px;"></div>
          <div style="font-size:11px;color:var(--text-muted,#9ca3af);">Menampilkan ${this.dari} → ${this.sampai} (WIB)</div>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;
    this._initRangePicker();
    document.addEventListener('click', this._onDocClick);
    document.addEventListener('keydown', this._onKeyDown);
    await this._load();
  }

  _onDocClick(e) {
    const picker = this.container.querySelector('#range-picker');
    const btn = this.container.querySelector('#btn-range');
    if (picker && !picker.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
      picker.style.display = 'none';
    }
  }

  _onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      this.container.querySelector('#inp-search')?.focus();
    }
  }

  _initRangePicker() {
    const btn = this.container.querySelector('#btn-range');
    const picker = this.container.querySelector('#range-picker');

    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (picker.style.display !== 'none') { picker.style.display = 'none'; return; }

      const PRESETS = [
        { label: '7 hari', fn: () => { const d = new Date(); d.setDate(d.getDate()-6); return [d.toISOString().split('T')[0], new Date().toISOString().split('T')[0]]; } },
        { label: '30 hari', fn: () => { const d = new Date(); d.setDate(d.getDate()-29); return [d.toISOString().split('T')[0], new Date().toISOString().split('T')[0]]; } },
        { label: '60 hari', fn: () => { const d = new Date(); d.setDate(d.getDate()-59); return [d.toISOString().split('T')[0], new Date().toISOString().split('T')[0]]; } },
        { label: '3 bulan', fn: () => { const d = new Date(); d.setDate(d.getDate()-89); return [d.toISOString().split('T')[0], new Date().toISOString().split('T')[0]]; } },
        { label: 'Bulan ini', fn: () => { const n = new Date(); return [`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`, n.toISOString().split('T')[0]]; } },
      ];

      picker.innerHTML = `
        <div style="padding:14px 16px 8px;">
          <div style="font-size:10.5px;font-weight:700;color:var(--text-muted,#9ca3af);letter-spacing:.06em;margin-bottom:8px;">RENTANG TANGGAL</div>
          <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
            ${PRESETS.map(p => `<button class="btn preset-btn" data-preset="${p.label}" style="font-size:11.5px;padding:4px 10px;">${p.label}</button>`).join('')}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
            <div>
              <div style="font-size:10.5px;color:var(--text-muted,#9ca3af);margin-bottom:3px;">DARI</div>
              <input type="date" id="dp-dari" value="${this.dari}" style="width:100%;padding:6px 8px;border:1px solid var(--border,#e5e7eb);border-radius:6px;font-size:12.5px;box-sizing:border-box;">
            </div>
            <div>
              <div style="font-size:10.5px;color:var(--text-muted,#9ca3af);margin-bottom:3px;">SAMPAI</div>
              <input type="date" id="dp-sampai" value="${this.sampai}" style="width:100%;padding:6px 8px;border:1px solid var(--border,#e5e7eb);border-radius:6px;font-size:12.5px;box-sizing:border-box;">
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:8px;border-top:1px solid var(--border,#e5e7eb);">
            <button class="btn" id="dp-batal" style="padding:6px 14px;">Batal</button>
            <button class="btn btn-primary" id="dp-ok" style="padding:6px 14px;">Terapkan</button>
          </div>
        </div>`;
      picker.style.display = 'block';
      picker.addEventListener('click', ev => ev.stopPropagation());

      picker.querySelector('#dp-batal').addEventListener('click', () => picker.style.display = 'none');
      picker.querySelector('#dp-ok').addEventListener('click', () => {
        const dari = picker.querySelector('#dp-dari').value;
        const sampai = picker.querySelector('#dp-sampai').value;
        if (dari && sampai) { this.dari = dari; this.sampai = sampai; this._applyRange(); }
      });
      picker.querySelectorAll('.preset-btn').forEach(b => {
        b.addEventListener('click', () => {
          const preset = PRESETS.find(p => p.label === b.dataset.preset);
          if (preset) { [this.dari, this.sampai] = preset.fn(); this._applyRange(); }
        });
      });
    });
  }

  _applyRange() {
    this.container.querySelector('#range-picker').style.display = 'none';
    this.container.querySelector('#range-label').textContent = fmtRangeLabel(this.dari, this.sampai);
    const sub = this.container.querySelector('#range-sub');
    if (sub) sub.textContent = `Menampilkan ${this.dari} → ${this.sampai} (WIB)`;
    this._load();
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';
    try {
      const [campaigns, maps, tags, shopee] = await Promise.all([
        apiFetch(appendFilter('/taglink/campaigns')),
        apiFetch(appendFilter('/taglink/map')),
        apiFetch(appendFilter('/taglink/tags')),
        apiFetch('/accounts/shopee'),
      ]);

      this._campaigns = campaigns || [];
      this._tags = tags || [];
      this._shopeeAccounts = shopee || [];

      const mapList = maps || [];
      const mappedCampaignIds = new Set(mapList.map(m => m.campaign_id));
      const campaignById = {};
      for (const c of this._campaigns) campaignById[c.id] = c;

      const mappedRows = mapList.map(m => ({
        _kind: 'mapped',
        _campaign_status: campaignById[m.campaign_id]?.status || 'aktif',
        ...m,
      }));

      const unmappedRows = this._campaigns
        .filter(c => !mappedCampaignIds.has(c.id))
        .map(c => ({
          _kind: 'unmapped',
          _campaign_status: c.status || 'aktif',
          campaign_id: c.id,
          campaign_name: c.nama_campaign,
          tag_link_id: null,
          tag: null,
          shopee_account_id: null,
          akun_shopee: null,
          sumber: null,
          catatan: null,
          created_at: null,
        }));

      this._allRows = [...mappedRows, ...unmappedRows];
      this._renderContent(el);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _getFilteredRows() {
    let rows = this._allRows;

    if (this._filter === 'mapped') {
      rows = rows.filter(r => r._kind === 'mapped' && r._campaign_status === 'aktif');
    } else if (this._filter === 'unmapped') {
      rows = rows.filter(r => r._kind === 'unmapped' && r._campaign_status === 'aktif');
    } else if (this._filter === 'inactive') {
      rows = rows.filter(r => r._campaign_status !== 'aktif');
    } else {
      rows = rows.filter(r => r._campaign_status === 'aktif');
    }

    const q = this._search.toLowerCase();
    if (q) {
      rows = rows.filter(r =>
        r.campaign_name?.toLowerCase().includes(q) ||
        r.tag?.toLowerCase().includes(q) ||
        r.akun_shopee?.toLowerCase().includes(q)
      );
    }

    return this._sortRows(rows);
  }

  _sortRows(rows) {
    const col = this._sortCol;
    const dir = this._sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = a[col] ?? '';
      const vb = b[col] ?? '';
      if (typeof va === 'string') return va.localeCompare(vb, 'id') * dir;
      return (va > vb ? 1 : va < vb ? -1 : 0) * dir;
    });
  }

  _renderContent(el) {
    const all = this._allRows;
    const aktif = all.filter(r => r._campaign_status === 'aktif');
    const mappedCount = aktif.filter(r => r._kind === 'mapped').length;
    const unmappedCount = aktif.filter(r => r._kind === 'unmapped').length;
    const inactiveCount = all.filter(r => r._campaign_status !== 'aktif').length;
    const semaCount = aktif.length;

    const totalCampaign = this._campaigns.length;
    const sudahDipetakan = this._allRows.filter(r => r._kind === 'mapped').length;
    const belumDipetakan = this._campaigns.filter(c => this._allRows.find(r => r._kind === 'unmapped' && r.campaign_id === c.id)).length;
    const tagLinkShopee = new Set(this._allRows.filter(r => r.tag_link_id).map(r => r.tag_link_id)).size;

    el.innerHTML = `
      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px;">
        <div class="stat-card">
          <div class="stat-label">TOTAL CAMPAIGN</div>
          <div class="stat-value">${num(totalCampaign)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">SUDAH DIPETAKAN</div>
          <div class="stat-value" style="color:#16a34a;">${num(sudahDipetakan)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">BELUM DIPETAKAN</div>
          <div class="stat-value" style="color:${belumDipetakan > 0 ? '#dc2626' : 'var(--text,#374151)'};">${num(belumDipetakan)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">TAG LINK SHOPEE</div>
          <div class="stat-value">${num(tagLinkShopee)}</div>
        </div>
      </div>

      <div class="card" style="padding:0;">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border,#e5e7eb);display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:200px;max-width:340px;background:var(--surface-alt,#f9fafb);border:1px solid var(--border,#e5e7eb);border-radius:7px;padding:6px 10px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="color:var(--text-muted,#9ca3af);flex-shrink:0;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="inp-search" placeholder="Cari campaign atau tag link…" value="${this._search}"
              style="flex:1;border:none;outline:none;background:transparent;font-size:13px;color:var(--text,#374151);">
            <span style="font-size:10.5px;color:var(--text-muted,#9ca3af);background:var(--surface,#fff);padding:2px 6px;border-radius:4px;border:1px solid var(--border,#e5e7eb);white-space:nowrap;">Ctrl+K</span>
          </div>
          <div class="filter-tabs" style="flex-shrink:0;">
            <button class="filter-tab${this._filter==='all'?' active':''}" data-f="all">Semua (${semaCount})</button>
            <button class="filter-tab${this._filter==='mapped'?' active':''}" data-f="mapped">Sudah dipetakan (${mappedCount})</button>
            <button class="filter-tab${this._filter==='unmapped'?' active':''}" data-f="unmapped">Belum dipetakan (${unmappedCount})</button>
            <button class="filter-tab${this._filter==='inactive'?' active':''}" data-f="inactive">Nonaktif (${inactiveCount})</button>
          </div>
        </div>
        <div class="table-wrap" style="overflow-x:auto;" id="tl-table"></div>
      </div>
    `;

    this._renderTable(el.querySelector('#tl-table'));

    el.querySelector('#inp-search').addEventListener('input', e => {
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

  _sortIcon(col) {
    if (this._sortCol !== col) return SVG_SORT;
    return this._sortDir === 'asc' ? SVG_SORT_ASC : SVG_SORT_DESC;
  }

  _thSort(col, label) {
    const active = this._sortCol === col;
    return `<th style="cursor:pointer;white-space:nowrap;user-select:none;" data-sort="${col}">
      <span style="display:inline-flex;align-items:center;gap:4px;">
        ${label}
        <span style="color:${active ? 'var(--primary,#1d4ed8)' : 'var(--text-muted,#9ca3af)'};">${this._sortIcon(col)}</span>
      </span>
    </th>`;
  }

  _renderTable(el) {
    const rows = this._getFilteredRows();

    if (rows.length === 0) {
      el.innerHTML = `<div class="empty" style="padding:32px;text-align:center;">
        Tidak ada data.<br><span style="font-size:12px;color:var(--text-muted,#9ca3af);">Coba ubah filter atau upload data Meta Ads terlebih dahulu.</span>
      </div>`;
      this._bindSort(el);
      return;
    }

    el.innerHTML = `
      <table class="data-table" style="font-size:12.5px;">
        <thead>
          <tr>
            ${this._thSort('campaign_name', 'Nama Campaign')}
            ${this._thSort('tag', 'Tag Link (Shopee)')}
            ${this._thSort('akun_shopee', 'Akun Shopee')}
            ${this._thSort('sumber', 'Sumber')}
            <th>Catatan</th>
            ${this._thSort('created_at', 'Dibuat')}
            <th style="width:80px;text-align:center;">AKSI</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => this._renderRow(r)).join('')}
        </tbody>
      </table>
    `;

    this._bindSort(el);
    this._bindActions(el, rows);
  }

  _renderRow(r) {
    const name = r.campaign_name || r.nama_campaign || '—';
    const tag = r.tag ? `<code style="font-size:11.5px;background:var(--surface-alt,#f9fafb);padding:2px 6px;border-radius:4px;color:#2563eb;">${r.tag}</code>` : '<span style="color:var(--text-muted,#9ca3af);">—</span>';
    const akun = r.akun_shopee || '<span style="color:var(--text-muted,#9ca3af);">—</span>';
    const sumber = r.sumber
      ? `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:#fee2e2;color:#dc2626;">${r.sumber}</span>`
      : '<span style="color:var(--text-muted,#9ca3af);">—</span>';
    const catatan = r.catatan || '<span style="color:var(--text-muted,#9ca3af);">—</span>';
    const dibuat = r.created_at ? fmtDate(r.created_at) : '<span style="color:var(--text-muted,#9ca3af);">—</span>';

    const mapId = r.id || null;
    const editBtn = `<button class="btn-icon" data-action="edit" data-map-id="${mapId || ''}" data-campaign-id="${r.campaign_id}" data-campaign-name="${(r.campaign_name || r.nama_campaign || '').replace(/"/g, '&quot;')}" title="Edit" style="color:#374151;padding:4px;">${SVG_EDIT}</button>`;
    const deleteBtn = mapId ? `<button class="btn-icon" data-action="delete" data-map-id="${mapId}" style="color:#dc2626;padding:4px;" title="Hapus">${SVG_TRASH}</button>` : '';

    return `<tr>
      <td style="font-weight:500;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${name}">${name}</td>
      <td>${tag}</td>
      <td style="color:var(--text,#374151);">${akun}</td>
      <td>${sumber}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${catatan}</td>
      <td style="white-space:nowrap;color:var(--text-muted,#6b7280);">${dibuat}</td>
      <td style="text-align:center;">
        <div style="display:flex;gap:4px;justify-content:center;align-items:center;">
          ${editBtn}${deleteBtn}
        </div>
      </td>
    </tr>`;
  }

  _bindSort(el) {
    el.querySelectorAll('[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (this._sortCol === col) {
          this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this._sortCol = col;
          this._sortDir = 'asc';
        }
        this._renderTable(el);
      });
    });
  }

  _bindActions(el, rows) {
    el.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mapId = btn.dataset.mapId || null;
        const row = mapId ? rows.find(r => r.id === mapId) : null;
        const campaignId = btn.dataset.campaignId;
        const campaignName = btn.dataset.campaignName;
        this._showEditModal(mapId, row, campaignId, campaignName);
      });
    });

    el.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const mapId = btn.dataset.mapId;
        const tr = btn.closest('tr');
        const campaignCell = tr?.querySelector('td:first-child');
        const name = campaignCell?.title || 'pemetaan ini';
        if (!confirm(`Hapus pemetaan "${name}"?`)) return;
        btn.disabled = true;
        try {
          await apiFetch(`/taglink/map/${mapId}`, { method: 'DELETE' });
          await this._load();
        } catch (e) {
          alert(e.message);
          btn.disabled = false;
        }
      });
    });
  }

  async _showEditModal(mapId, row, campaignId, campaignName) {
    const isNew = !mapId;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:480px;width:95vw;">
        <div class="modal-header">
          <div>
            <h2 style="font-size:16px;font-weight:700;margin:0;">Petakan Tag Link</h2>
            <p style="font-size:12px;color:var(--text-muted,#9ca3af);margin:3px 0 0;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${campaignName}">${campaignName}</p>
          </div>
          <button class="modal-close" id="em-close">×</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <div style="margin-bottom:14px;">
            <label style="font-size:11px;font-weight:700;color:var(--text-muted,#6b7280);letter-spacing:.05em;display:block;margin-bottom:5px;">AKUN SHOPEE</label>
            <select id="em-shopee" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e5e7eb);border-radius:7px;font-size:13px;background:var(--surface,#fff);color:var(--text,#374151);">
              <option value="">Pilih akun Shopee…</option>
              ${this._shopeeAccounts.map(s => `<option value="${s.id}"${row?.shopee_account_id === s.id ? ' selected' : ''}>${s.nama_akun}</option>`).join('')}
            </select>
          </div>
          <div style="margin-bottom:8px;">
            <label style="font-size:11px;font-weight:700;color:var(--text-muted,#6b7280);letter-spacing:.05em;display:block;margin-bottom:5px;">TAG LINK</label>
            <select id="em-tag" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e5e7eb);border-radius:7px;font-size:13px;background:var(--surface,#fff);color:var(--text,#374151);">
              <option value="">Pilih tag link…</option>
            </select>
          </div>
          <div id="em-preview" style="margin-bottom:14px;padding:10px 12px;border-radius:7px;background:var(--surface-alt,#f9fafb);border:1px solid var(--border,#e5e7eb);display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:12px;">
            <div><div style="font-size:10px;color:var(--text-muted,#9ca3af);font-weight:600;letter-spacing:.05em;margin-bottom:2px;">ORDER</div><div id="prev-order" style="font-weight:700;">—</div></div>
            <div><div style="font-size:10px;color:var(--text-muted,#9ca3af);font-weight:600;letter-spacing:.05em;margin-bottom:2px;">KOMISI</div><div id="prev-komisi" style="font-weight:700;">—</div></div>
            <div><div style="font-size:10px;color:var(--text-muted,#9ca3af);font-weight:600;letter-spacing:.05em;margin-bottom:2px;">ROI</div><div id="prev-roi" style="font-weight:700;">—</div></div>
          </div>
          <div style="margin-bottom:18px;">
            <label style="font-size:11px;font-weight:700;color:var(--text-muted,#6b7280);letter-spacing:.05em;display:block;margin-bottom:5px;">CATATAN <span style="font-weight:400;text-transform:none;">(opsional)</span></label>
            <textarea id="em-catatan" rows="3" placeholder="Tambahkan catatan opsional…" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e5e7eb);border-radius:7px;font-size:13px;resize:vertical;background:var(--surface,#fff);color:var(--text,#374151);box-sizing:border-box;">${row?.catatan || ''}</textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button class="btn" id="em-batal" style="padding:8px 20px;">Batal</button>
            <button class="btn" id="em-simpan" style="padding:8px 20px;background:#dc2626;color:#fff;border-color:#dc2626;">Simpan</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#em-close').addEventListener('click', close);
    overlay.querySelector('#em-batal').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    const shopeeEl = overlay.querySelector('#em-shopee');
    const tagEl = overlay.querySelector('#em-tag');

    const populateTags = (shopeeId, selectedTagId) => {
      const filtered = shopeeId ? this._tags.filter(t => t.shopee_account_id === shopeeId) : [];
      tagEl.innerHTML = `<option value="">Pilih tag link…</option>` +
        filtered.map(t => `<option value="${t.id}"${t.id === selectedTagId ? ' selected' : ''}>${t.tag}</option>`).join('');
      const preview = overlay.querySelector('#em-preview');
      if (selectedTagId) {
        this._loadTagStats(selectedTagId, overlay);
      } else {
        overlay.querySelector('#prev-order').textContent = '—';
        overlay.querySelector('#prev-komisi').textContent = '—';
        overlay.querySelector('#prev-roi').textContent = '—';
      }
    };

    // Init: populate tags for currently selected shopee account
    if (row?.shopee_account_id) {
      populateTags(row.shopee_account_id, row.tag_link_id);
    }

    shopeeEl.addEventListener('change', () => {
      populateTags(shopeeEl.value, null);
    });

    tagEl.addEventListener('change', () => {
      if (tagEl.value) this._loadTagStats(tagEl.value, overlay);
      else {
        overlay.querySelector('#prev-order').textContent = '—';
        overlay.querySelector('#prev-komisi').textContent = '—';
        overlay.querySelector('#prev-roi').textContent = '—';
      }
    });

    overlay.querySelector('#em-simpan').addEventListener('click', async () => {
      const tagId = tagEl.value;
      if (!tagId) { alert('Pilih tag link terlebih dahulu.'); return; }
      const catatanVal = overlay.querySelector('#em-catatan').value.trim() || null;

      const btn = overlay.querySelector('#em-simpan');
      btn.disabled = true; btn.textContent = 'Menyimpan…';
      try {
        if (isNew) {
          await apiFetch('/taglink/map', {
            method: 'POST',
            body: JSON.stringify({ campaign_id: campaignId, tag_link_id: tagId }),
          });
        } else {
          await apiFetch(`/taglink/map/${mapId}`, {
            method: 'PATCH',
            body: JSON.stringify({ tag_link_id: tagId, catatan: catatanVal }),
          });
        }
        close();
        await this._load();
      } catch (e) {
        alert(e.message);
        btn.disabled = false; btn.textContent = 'Simpan';
      }
    });
  }

  async _loadTagStats(tagId, overlay) {
    overlay.querySelector('#prev-order').textContent = '…';
    overlay.querySelector('#prev-komisi').textContent = '…';
    overlay.querySelector('#prev-roi').textContent = '—';
    try {
      const qs = `tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}`;
      const data = await apiFetch(`/taglink/tag-stats/${tagId}?${qs}`);
      if (!overlay.isConnected) return;
      overlay.querySelector('#prev-order').textContent = num(data.orders);
      overlay.querySelector('#prev-komisi').textContent = rp(Math.round(Number(data.komisi)));
      overlay.querySelector('#prev-roi').textContent = '—';
    } catch {
      if (!overlay.isConnected) return;
      overlay.querySelector('#prev-order').textContent = '—';
      overlay.querySelector('#prev-komisi').textContent = '—';
    }
  }

  destroy() {
    document.removeEventListener('click', this._onDocClick);
    document.removeEventListener('keydown', this._onKeyDown);
  }
}
