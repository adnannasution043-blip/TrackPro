import { apiFetch } from '../api.js';
import { filterQS } from '../filter-state.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const num = n => Number(n || 0).toLocaleString('id-ID');

const TAHAP_LABELS = {
  pra_filter: 'Pra Filter',
  filter: 'Filter',
  fix_scale_up: 'Fix / Scale Up',
  off: 'Off',
};
const TAHAP_KEYS = ['pra_filter', 'filter', 'fix_scale_up', 'off'];

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function fmtLabel(d) {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
}

export class AnalysisPage {
  constructor(container) {
    this.container = container;
    const today = new Date().toISOString().split('T')[0];
    this.dari = today;
    this.sampai = today;
    this._rows = [];
    this._search = '';
    this._filter = 'all';
    this._activeDropPanel = null;
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Analisis Iklan</h1>
          <p>Pantau dan sortir iklan berdasarkan tahap testing.</p>
        </div>
        <div class="page-header-right" style="position:relative;display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
          <button id="btn-date" class="date-range-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span id="date-label">${fmtLabel(this.dari)}</span>
          </button>
          <div id="date-picker" style="display:none;position:absolute;top:44px;right:0;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.13);z-index:200;min-width:220px;"></div>
          <div style="font-size:11px;color:var(--text-muted,#9ca3af);">${this.dari} - ${this.sampai} WIB</div>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;

    this._initDatePicker();
    document.addEventListener('click', this._closeDropPanels.bind(this));
    await this._load();
  }

  _initDatePicker() {
    const btn = this.container.querySelector('#btn-date');
    const picker = this.container.querySelector('#date-picker');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (picker.style.display !== 'none') { picker.style.display = 'none'; return; }
      picker.innerHTML = `
        <div style="padding:16px 16px 12px;">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted,#9ca3af);letter-spacing:.05em;margin-bottom:10px;">PILIH TANGGAL</div>
          <input type="date" id="dp-date" value="${this.dari}"
            style="width:100%;padding:8px 10px;border:1px solid var(--border,#e5e7eb);border-radius:6px;font-size:13px;box-sizing:border-box;">
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
            <button id="dp-batal" class="btn" style="padding:6px 14px;">Batal</button>
            <button id="dp-ok" class="btn btn-primary" style="padding:6px 14px;">Terapkan</button>
          </div>
        </div>`;
      picker.style.display = 'block';
      picker.querySelector('#dp-batal').addEventListener('click', () => picker.style.display = 'none');
      picker.querySelector('#dp-ok').addEventListener('click', () => {
        const val = picker.querySelector('#dp-date').value;
        if (!val) return;
        this.dari = val; this.sampai = val;
        this.container.querySelector('#date-label').textContent = fmtLabel(val);
        this.container.querySelector('#date-picker').previousElementSibling.textContent = '';
        picker.style.display = 'none';
        this._load();
      });
      picker.addEventListener('click', e => e.stopPropagation());
    });
  }

  _closeDropPanels() {
    document.querySelectorAll('.tahap-panel').forEach(p => p.remove());
    const picker = this.container.querySelector('#date-picker');
    if (picker) picker.style.display = 'none';
    this._activeDropPanel = null;
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';
    try {
      const qs = filterQS ? filterQS() : '';
      const data = await apiFetch(
        `/dashboard/campaigns?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}${qs}`
      );
      this._rows = (data?.campaigns) || [];
      this._renderContent(el);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _renderContent(el) {
    const counts = { all: this._rows.length };
    TAHAP_KEYS.forEach(k => { counts[k] = this._rows.filter(r => r.tahap === k).length; });

    const TAB_DEFS = [
      { key: 'all',          label: `Semua (${counts.all})` },
      { key: 'pra_filter',   label: `Pra Filter (${counts.pra_filter})` },
      { key: 'filter',       label: `Filter (${counts.filter})` },
      { key: 'fix_scale_up', label: `Fix / Scale Up (${counts.fix_scale_up})` },
      { key: 'off',          label: `Off (${counts.off})` },
    ];

    const visible = this._rows.filter(r => {
      const s = this._search.toLowerCase();
      const matchS = !s || (r.nama_campaign || '').toLowerCase().includes(s) || (r.tag_link || '').toLowerCase().includes(s);
      const matchF = this._filter === 'all' || r.tahap === this._filter;
      return matchS && matchF;
    });

    const rowHtml = (r, i) => {
      const spend = Number(r.spend_idr || 0);
      const komisi = Number(r.komisi || 0);
      const laba = Number(r.laba || 0);
      const roi = r.roi_persen != null ? Number(r.roi_persen) : null;
      const epc = Number(r.clicks_shopee) > 0 ? komisi / Number(r.clicks_shopee) : null;
      const tahapLabel = TAHAP_LABELS[r.tahap] || 'Pra Filter';
      const labaColor = laba >= 0 ? 'var(--color-success,#16a34a)' : 'var(--color-danger,#dc2626)';
      const roiColor = roi != null && roi >= 0 ? 'var(--color-success,#16a34a)' : 'var(--color-danger,#dc2626)';

      return `<tr class="analysis-row" data-id="${r.id}">
        <td style="color:var(--text-muted,#9ca3af);font-size:12px;text-align:center;width:32px;">${i + 1}</td>
        <td style="min-width:220px;max-width:260px;">
          <div style="font-weight:600;font-size:13px;color:#2563eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${r.nama_campaign}">${r.nama_campaign}</div>
          <div style="font-size:11px;color:var(--text-muted,#9ca3af);margin-top:2px;">
            Meta
            ${r.tag_link ? `· <span style="font-size:10.5px;padding:1px 6px;background:#f0fdf4;color:#16a34a;border-radius:4px;border:1px solid #bbf7d0;">${r.tag_link}</span>` : ''}
          </div>
        </td>
        <td style="min-width:155px;">
          <div class="tahap-drop-wrap" style="position:relative;">
            <button class="tahap-btn" data-id="${r.id}" data-tahap="${r.tahap || 'pra_filter'}"
              style="display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;padding:5px 10px;border:1px solid var(--border,#e5e7eb);border-radius:6px;background:var(--surface,#fff);cursor:pointer;font-size:12.5px;font-weight:600;color:var(--text,#374151);">
              <span>${tahapLabel}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </td>
        <td style="white-space:nowrap;">${rp(spend)}</td>
        <td style="white-space:nowrap;">${r.cpc != null ? rp(Math.round(Number(r.cpc))) : '—'}</td>
        <td style="color:var(--text-muted,#9ca3af);">—</td>
        <td style="white-space:nowrap;">${num(r.clicks_meta)}</td>
        <td style="white-space:nowrap;">${num(r.clicks_shopee)}</td>
        <td style="white-space:nowrap;">${num(r.orders)}</td>
        <td style="color:#10b981;white-space:nowrap;">${rp(Math.round(komisi))}</td>
        <td style="font-weight:600;color:${labaColor};white-space:nowrap;">${laba >= 0 ? '' : '-'}${rp(Math.abs(Math.round(laba)))}</td>
        <td style="white-space:nowrap;">${epc != null ? rp(Math.round(epc)) : '—'}</td>
        <td style="font-weight:600;color:${roiColor};white-space:nowrap;">${roi != null ? roi.toFixed(0) + '%' : '—'}</td>
      </tr>`;
    };

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <div style="flex:1;min-width:200px;max-width:520px;position:relative;">
          <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted,#9ca3af);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="inp-search" placeholder="Cari iklan" value="${this._search}"
            style="width:100%;padding:8px 12px 8px 34px;border:1px solid var(--border,#e5e7eb);border-radius:6px;font-size:13px;background:var(--surface,#fff);color:var(--text,#374151);box-sizing:border-box;">
        </div>
        <button class="btn btn-primary" id="btn-cari" style="padding:8px 20px;flex-shrink:0;">Cari</button>
      </div>
      <div class="filter-tabs" style="margin-bottom:12px;">
        ${TAB_DEFS.map(t => `<button class="filter-tab${this._filter === t.key ? ' active' : ''}" data-f="${t.key}">${t.label}</button>`).join('')}
      </div>
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="table-wrap" style="overflow-x:auto;">
          <table class="data-table" style="font-size:12.5px;min-width:900px;">
            <thead>
              <tr>
                <th style="width:32px;text-align:center;">#</th>
                <th style="min-width:220px;">NAMA IKLAN</th>
                <th style="min-width:155px;">STATUS</th>
                <th>SPEND</th>
                <th>CPC</th>
                <th>BUDGET</th>
                <th style="white-space:nowrap;">CLICK META</th>
                <th style="white-space:nowrap;">CLICK SHOPEE</th>
                <th>ORDER</th>
                <th>KOMISI</th>
                <th>PROFIT</th>
                <th>EPC</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody>
              ${visible.length === 0
                ? `<tr><td colspan="13" class="empty">Tidak ada data iklan.<br><span style="font-size:12px;">Upload data Meta Ads terlebih dahulu.</span></td></tr>`
                : visible.map(rowHtml).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    // Search
    const inpSearch = el.querySelector('#inp-search');
    inpSearch?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { this._search = inpSearch.value; this._renderContent(el); }
    });
    el.querySelector('#btn-cari')?.addEventListener('click', () => {
      this._search = inpSearch?.value || ''; this._renderContent(el);
    });

    // Filter tabs
    el.querySelectorAll('[data-f]').forEach(btn => {
      btn.addEventListener('click', () => { this._filter = btn.dataset.f; this._renderContent(el); });
    });

    // Tahap dropdown
    el.querySelectorAll('.tahap-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('.tahap-panel').forEach(p => p.remove());

        const id = btn.dataset.id;
        const curTahap = btn.dataset.tahap;
        const panel = document.createElement('div');
        panel.className = 'tahap-panel';
        panel.style.cssText = 'position:absolute;top:calc(100% + 4px);left:0;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.12);z-index:300;min-width:160px;padding:4px 0;';

        TAHAP_KEYS.forEach(key => {
          const isActive = key === curTahap;
          const item = document.createElement('div');
          item.style.cssText = `padding:8px 14px;cursor:pointer;font-size:12.5px;font-weight:500;display:flex;align-items:center;justify-content:space-between;gap:8px;${isActive ? 'background:#fef2f2;color:#dc2626;' : 'color:var(--text,#374151);'}`;
          item.innerHTML = `<span>${TAHAP_LABELS[key]}</span>${isActive ? '<span style="font-size:10px;font-weight:700;padding:1px 5px;background:#dc2626;color:#fff;border-radius:3px;letter-spacing:.03em;">AKTIF</span>' : ''}`;
          item.addEventListener('mouseenter', () => { if (!isActive) item.style.background = 'var(--surface-alt,#f9fafb)'; });
          item.addEventListener('mouseleave', () => { if (!isActive) item.style.background = ''; });
          item.addEventListener('click', e => {
            e.stopPropagation();
            panel.remove();
            if (key !== curTahap) {
              const r = this._rows.find(x => x.id === id);
              if (r) this._confirmTahap(r, key, el);
            }
          });
          panel.appendChild(item);
        });

        btn.closest('.tahap-drop-wrap').appendChild(panel);
        panel.addEventListener('click', e => e.stopPropagation());
      });
    });
  }

  _confirmTahap(r, newTahap, tableEl) {
    const newLabel = TAHAP_LABELS[newTahap];
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px;">
        <div class="modal-body" style="padding:28px 24px 24px;">
          <h2 style="font-size:16px;font-weight:700;margin:0 0 8px;">Ubah status iklan?</h2>
          <p style="font-size:13px;color:var(--text-muted,#6b7280);margin:0 0 16px;">Iklan ini akan dipindahkan ke status <strong>${newLabel}</strong>.</p>
          <div style="padding:10px 14px;background:var(--surface-alt,#f9fafb);border:1px solid var(--border,#e5e7eb);border-radius:6px;font-size:13px;font-weight:500;color:var(--text,#374151);margin-bottom:20px;">${r.nama_campaign}</div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button class="btn" id="cfm-batal" style="padding:7px 18px;">Batal</button>
            <button class="btn btn-primary" id="cfm-ok" style="padding:7px 18px;background:#dc2626;border-color:#dc2626;">Ya, ubah</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#cfm-batal').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#cfm-ok').addEventListener('click', async () => {
      close();
      try {
        await apiFetch(`/dashboard/campaigns/${r.id}/tahap`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tahap: newTahap }),
        });
        const row = this._rows.find(x => x.id === r.id);
        if (row) row.tahap = newTahap;
        this._renderContent(tableEl);
      } catch (e) {
        alert(e.message || 'Gagal mengubah status iklan.');
      }
    });
  }

  destroy() {
    document.removeEventListener('click', this._closeDropPanels.bind(this));
  }
}
