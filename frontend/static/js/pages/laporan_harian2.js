import { apiFetch } from '../api.js';

const rp = n => Number(n || 0).toLocaleString('id-ID');

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
function fmtDate(s) {
  const [y, m, d] = s.split('-');
  return `${d}-${MONTHS_SHORT[+m - 1]}-${y.slice(2)}`;
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
function firstOfMonth() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0];
}

// Definisi filter: key → kolom data yang ditampilkan
const FILTERS = [
  { key: 'semua',  label: 'Semua' },
  { key: 'live',   label: 'Shopee Live' },
  { key: 'meta',   label: 'Meta' },
  { key: 'adu',    label: 'Adu' },
  { key: 'terra',  label: 'Terra' },
];

export class LaporanHarian2Page {
  constructor(container) {
    this.container = container;
    this.dari    = firstOfMonth();
    this.sampai  = todayStr();
    this._rows   = [];
    this._filter = 'semua';
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Laporan Harian 2</h1>
          <p>Komisi harian dikelompokkan per kategori tag link.</p>
        </div>
        <div class="page-header-right" style="display:flex;gap:8px;align-items:center;">
          <input type="date" id="inp-dari"   class="form-input" style="width:140px;" value="${this.dari}">
          <span style="color:var(--text-muted)">–</span>
          <input type="date" id="inp-sampai" class="form-input" style="width:140px;" value="${this.sampai}">
          <button class="btn btn-primary" id="btn-terapkan">Terapkan</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;" id="filter-pills">
        ${FILTERS.map(f => `
          <button class="pill-filter${f.key === this._filter ? ' active' : ''}"
                  data-filter="${f.key}"
                  style="padding:6px 16px;border-radius:20px;border:1.5px solid var(--border);
                         background:${f.key === this._filter ? 'var(--primary)' : 'var(--bg-card)'};
                         color:${f.key === this._filter ? '#fff' : 'var(--text)'};
                         font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;">
            ${f.label}
          </button>
        `).join('')}
      </div>

      <div class="card" style="padding:0;overflow:hidden;">
        <div id="tbl-wrap" style="overflow-x:auto;">
          <div class="loading" style="padding:32px;text-align:center;">Memuat…</div>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-terapkan').addEventListener('click', () => {
      this.dari   = this.container.querySelector('#inp-dari').value;
      this.sampai = this.container.querySelector('#inp-sampai').value;
      this._load();
    });

    this.container.querySelector('#filter-pills').addEventListener('click', e => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      this._filter = btn.dataset.filter;
      // Update pill style
      this.container.querySelectorAll('[data-filter]').forEach(b => {
        const active = b.dataset.filter === this._filter;
        b.style.background = active ? 'var(--primary)' : 'var(--bg-card)';
        b.style.color      = active ? '#fff' : 'var(--text)';
        b.style.borderColor = active ? 'var(--primary)' : 'var(--border)';
      });
      this._render();
    });

    this._load();
  }

  async _load() {
    const wrap = this.container.querySelector('#tbl-wrap');
    wrap.innerHTML = '<div class="loading" style="padding:32px;text-align:center;">Memuat…</div>';
    try {
      this._rows = await apiFetch(
        `/dashboard/laporan-harian2?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}`
      );
      this._render();
    } catch (e) {
      wrap.innerHTML = `<div class="alert alert-error" style="margin:16px;">${e.message}</div>`;
    }
  }

  _render() {
    const rows = this._rows;
    const wrap = this.container.querySelector('#tbl-wrap');

    if (!rows || rows.length === 0) {
      wrap.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);">Tidak ada data untuk rentang tanggal ini.</div>';
      return;
    }

    const f = this._filter;

    // Untuk filter spesifik: tampilkan tabel ringkas 1 kolom + total
    if (f !== 'semua') {
      const colMap = {
        live:  { label: 'Shopee Live',  key: 'komisi_live'  },
        meta:  { label: 'Meta',         key: 'komisi_meta'  },
        adu:   { label: 'Adu',          key: 'komisi_adu'   },
        terra: { label: 'Terra',        key: 'komisi_terra' },
      };
      const col   = colMap[f];
      const total = rows.reduce((s, r) => s + (r[col.key] || 0), 0);

      wrap.innerHTML = `
        <table class="data-table" style="min-width:320px;">
          <thead>
            <tr>
              <th style="text-align:left;">TGL</th>
              <th style="text-align:right;">Komisi ${col.label}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td style="white-space:nowrap;font-weight:500;">${fmtDate(r.tanggal)}</td>
                <td style="text-align:right;font-weight:600;color:var(--primary);">${rp(r[col.key])}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--bg-muted);font-weight:700;">
              <td>TOTAL</td>
              <td style="text-align:right;color:var(--primary);">${rp(total)}</td>
            </tr>
          </tfoot>
        </table>
      `;
      return;
    }

    // Filter "Semua" → tabel lengkap
    const tot = rows.reduce((a, r) => {
      a.live  += r.komisi_live  || 0;
      a.story += r.komisi_story || 0;
      a.feed  += r.komisi_feed  || 0;
      a.fp    += r.total_fp     || 0;
      a.meta  += r.komisi_meta  || 0;
      a.adu   += r.komisi_adu   || 0;
      a.terra += r.komisi_terra || 0;
      a.iklan += r.total_iklan  || 0;
      a.kotor += r.total_kotor  || 0;
      return a;
    }, { live:0, story:0, feed:0, fp:0, meta:0, adu:0, terra:0, iklan:0, kotor:0 });

    const th = (...labels) => labels.map(l => `<th style="text-align:right;">${l}</th>`).join('');
    const td = (...vals)   => vals.map(v => `<td style="text-align:right;">${rp(v)}</td>`).join('');

    wrap.innerHTML = `
      <table class="data-table" style="min-width:900px;">
        <thead>
          <tr style="background:var(--bg-card);">
            <th rowspan="2" style="text-align:left;white-space:nowrap;">TGL</th>
            <th colspan="3" style="text-align:center;border-bottom:1px solid var(--border);">Komisi FP</th>
            <th rowspan="2" style="text-align:right;white-space:nowrap;">Total<br>Komisi FP</th>
            <th colspan="3" style="text-align:center;border-bottom:1px solid var(--border);">Komisi Iklan</th>
            <th rowspan="2" style="text-align:right;white-space:nowrap;">Total<br>Komisi Iklan</th>
            <th rowspan="2" style="text-align:right;white-space:nowrap;">Total<br>Komisi Kotor</th>
          </tr>
          <tr style="background:var(--bg-card);">
            ${th('Live', 'Story', 'Few Feed', 'Meta', 'Adu', 'Terra')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td style="white-space:nowrap;font-weight:500;">${fmtDate(r.tanggal)}</td>
              ${td(r.komisi_live, r.komisi_story, r.komisi_feed)}
              <td style="text-align:right;font-weight:600;">${rp(r.total_fp)}</td>
              ${td(r.komisi_meta, r.komisi_adu, r.komisi_terra)}
              <td style="text-align:right;font-weight:600;">${rp(r.total_iklan)}</td>
              <td style="text-align:right;font-weight:700;color:var(--primary);">${rp(r.total_kotor)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background:var(--bg-muted);font-weight:700;">
            <td>TOTAL</td>
            ${td(tot.live, tot.story, tot.feed)}
            <td style="text-align:right;">${rp(tot.fp)}</td>
            ${td(tot.meta, tot.adu, tot.terra)}
            <td style="text-align:right;">${rp(tot.iklan)}</td>
            <td style="text-align:right;color:var(--primary);">${rp(tot.kotor)}</td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  destroy() {}
}
