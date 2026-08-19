import { apiFetch } from '../api.js';
import { filterQS } from '../filter-state.js';

const TAX = 0.025;
const net = n => Number(n || 0) * (1 - TAX);

const rp  = n => 'Rp ' + Math.round(Number(n || 0)).toLocaleString('id-ID');
const rpS = n => (n >= 0 ? '+Rp ' : '-Rp ') + Math.abs(Math.round(n)).toLocaleString('id-ID');

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
function fmtDate(s) {
  const [y, m, d] = s.split('-');
  return `${d}-${MONTHS_SHORT[+m - 1]}-${y.slice(2)}`;
}
function todayStr()    { return new Date().toISOString().split('T')[0]; }
function firstOfMonth(){ const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]; }

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'iklan',     label: 'Analisis Iklan' },
  { key: 'bersih',    label: 'Total Bersih' },
];

export class KomisiBersihPage {
  constructor(container) {
    this.container = container;
    this.dari      = firstOfMonth();
    this.sampai    = todayStr();
    this._bdMap    = {};
    this._spendMap = {};
    this._dates    = [];
    this._tab      = 'ringkasan';
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Komisi Bersih</h1>
          <p>Komisi setelah pajak 2,5% — Live, Organik, dan Iklan per hari.</p>
        </div>
        <div class="page-header-right" style="display:flex;gap:8px;align-items:center;">
          <input type="date" id="inp-dari"   class="form-input" style="width:140px;" value="${this.dari}">
          <span style="color:var(--text-muted)">–</span>
          <input type="date" id="inp-sampai" class="form-input" style="width:140px;" value="${this.sampai}">
          <button class="btn btn-primary" id="btn-terapkan">Terapkan</button>
        </div>
      </div>

      <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px;" id="tab-bar">
        ${TABS.map((t, i) => `
          <button class="kb-tab" data-tab="${t.key}"
            style="padding:10px 20px;border:none;background:none;cursor:pointer;font-size:13.5px;font-weight:600;
            color:${i === 0 ? '#dc2626' : 'var(--text-muted)'};
            border-bottom:${i === 0 ? '2px solid #dc2626' : '2px solid transparent'};margin-bottom:-2px;">
            ${t.label}
          </button>`).join('')}
        <div style="margin-left:auto;padding:8px 12px;font-size:11px;color:var(--text-muted);font-style:italic;align-self:center;">
          Pajak 2,5% sudah dikurangi
        </div>
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

    this.container.querySelector('#tab-bar').addEventListener('click', e => {
      const btn = e.target.closest('.kb-tab');
      if (!btn) return;
      this._tab = btn.dataset.tab;
      this.container.querySelectorAll('.kb-tab').forEach(b => {
        const on = b.dataset.tab === this._tab;
        b.style.color       = on ? '#dc2626' : 'var(--text-muted)';
        b.style.borderBottom = on ? '2px solid #dc2626' : '2px solid transparent';
      });
      this._render();
    });

    this._load();
  }

  async _load() {
    const wrap = this.container.querySelector('#tbl-wrap');
    wrap.innerHTML = '<div class="loading" style="padding:32px;text-align:center;">Memuat…</div>';
    try {
      const qs = filterQS ? filterQS() : '';
      const [dash, bd] = await Promise.all([
        apiFetch(`/dashboard?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}${qs}`),
        apiFetch(`/dashboard/laporan-harian2?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}${qs}`),
      ]);

      this._bdMap    = {};
      this._spendMap = {};
      this._dates    = [];

      const dateSet = new Set();
      for (const row of (bd || [])) {
        this._bdMap[row.tanggal] = row;
        dateSet.add(row.tanggal);
      }
      for (const row of (dash?.harian || [])) {
        this._spendMap[row.tanggal] = Number(row.spend_idr || 0);
        dateSet.add(row.tanggal);
      }
      this._dates = [...dateSet].sort();
      this._render();
    } catch (e) {
      wrap.innerHTML = `<div class="alert alert-error" style="margin:16px;">${e.message}</div>`;
    }
  }

  _render() {
    const wrap = this.container.querySelector('#tbl-wrap');
    if (!this._dates.length) {
      wrap.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);">Tidak ada data untuk rentang tanggal ini.</div>';
      return;
    }

    const rows = this._dates.map(tgl => {
      const bd    = this._bdMap[tgl]    || {};
      const spend = this._spendMap[tgl] || 0;

      const live    = net(bd.komisi_live  || 0);
      const story   = net(bd.komisi_story || 0);
      const feed    = net(bd.komisi_feed  || 0);
      const organik = story + feed;
      const iklan   = net((Number(bd.komisi_meta||0) + Number(bd.komisi_adu||0) + Number(bd.komisi_terra||0)));
      const total   = live + organik + iklan;
      const profitIklan = iklan - spend;
      const bersih  = organik + profitIklan;

      return { tgl, live, organik, iklan, total, spend, profitIklan, bersih };
    });

    const tot = rows.reduce((a, r) => ({
      live:        a.live        + r.live,
      organik:     a.organik     + r.organik,
      iklan:       a.iklan       + r.iklan,
      total:       a.total       + r.total,
      spend:       a.spend       + r.spend,
      profitIklan: a.profitIklan + r.profitIklan,
      bersih:      a.bersih      + r.bersih,
    }), { live:0, organik:0, iklan:0, total:0, spend:0, profitIklan:0, bersih:0 });

    const thS = 'padding:9px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;';

    if (this._tab === 'ringkasan') {
      wrap.innerHTML = `
        <table class="data-table" style="min-width:600px;">
          <thead>
            <tr>
              <th style="${thS}min-width:85px;">TGL</th>
              <th style="${thS}color:#f97316;">KOMISI LIVE</th>
              <th style="${thS}color:#7c3aed;">KOMISI ORGANIK</th>
              <th style="${thS}color:#dc2626;">KOMISI IKLAN</th>
              <th style="${thS}color:#10b981;background:#f0fdf4;">TOTAL KOMISI MASUK</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `<tr style="${i%2===1?'background:var(--bg-muted);':''}">
              <td style="font-weight:600;white-space:nowrap;padding:7px 12px;">${fmtDate(r.tgl)}</td>
              <td style="color:#f97316;">${rp(r.live)}</td>
              <td style="color:#7c3aed;">${rp(r.organik)}</td>
              <td style="color:#dc2626;">${rp(r.iklan)}</td>
              <td style="font-weight:700;color:#10b981;background:#f0fdf4;">${rp(r.total)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:800;background:var(--bg-muted);border-top:2px solid var(--border);">
              <td style="padding:8px 12px;">TOTAL</td>
              <td style="color:#f97316;">${rp(tot.live)}</td>
              <td style="color:#7c3aed;">${rp(tot.organik)}</td>
              <td style="color:#dc2626;">${rp(tot.iklan)}</td>
              <td style="color:#10b981;background:#f0fdf4;">${rp(tot.total)}</td>
            </tr>
          </tfoot>
        </table>`;

    } else if (this._tab === 'iklan') {
      wrap.innerHTML = `
        <table class="data-table" style="min-width:520px;">
          <thead>
            <tr>
              <th style="${thS}min-width:85px;">TGL</th>
              <th style="${thS}color:#dc2626;">KOMISI IKLAN</th>
              <th style="${thS}color:#6b7280;">BUDGET IKLAN</th>
              <th style="${thS}color:#2563eb;background:#eff6ff;">PROFIT IKLAN</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `<tr style="${i%2===1?'background:var(--bg-muted);':''}">
              <td style="font-weight:600;white-space:nowrap;padding:7px 12px;">${fmtDate(r.tgl)}</td>
              <td style="color:#dc2626;">${rp(r.iklan)}</td>
              <td style="color:#6b7280;">${rp(r.spend)}</td>
              <td style="font-weight:700;color:${r.profitIklan>=0?'#16a34a':'#dc2626'};background:#eff6ff;">${rpS(r.profitIklan)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:800;background:var(--bg-muted);border-top:2px solid var(--border);">
              <td style="padding:8px 12px;">TOTAL</td>
              <td style="color:#dc2626;">${rp(tot.iklan)}</td>
              <td style="color:#6b7280;">${rp(tot.spend)}</td>
              <td style="color:${tot.profitIklan>=0?'#16a34a':'#dc2626'};background:#eff6ff;">${rpS(tot.profitIklan)}</td>
            </tr>
          </tfoot>
        </table>`;

    } else {
      wrap.innerHTML = `
        <table class="data-table" style="min-width:480px;">
          <thead>
            <tr>
              <th style="${thS}min-width:85px;">TGL</th>
              <th style="${thS}color:#7c3aed;">KOMISI ORGANIK</th>
              <th style="${thS}color:${tot.profitIklan>=0?'#16a34a':'#dc2626'};">PROFIT IKLAN</th>
              <th style="${thS}color:#10b981;background:#f0fdf4;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `<tr style="${i%2===1?'background:var(--bg-muted);':''}">
              <td style="font-weight:600;white-space:nowrap;padding:7px 12px;">${fmtDate(r.tgl)}</td>
              <td style="color:#7c3aed;">${rp(r.organik)}</td>
              <td style="font-weight:600;color:${r.profitIklan>=0?'#16a34a':'#dc2626'};">${rpS(r.profitIklan)}</td>
              <td style="font-weight:700;color:#10b981;background:#f0fdf4;">${rp(r.bersih)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:800;background:var(--bg-muted);border-top:2px solid var(--border);">
              <td style="padding:8px 12px;">TOTAL</td>
              <td style="color:#7c3aed;">${rp(tot.organik)}</td>
              <td style="color:${tot.profitIklan>=0?'#16a34a':'#dc2626'};">${rpS(tot.profitIklan)}</td>
              <td style="color:#10b981;background:#f0fdf4;">${rp(tot.bersih)}</td>
            </tr>
          </tfoot>
        </table>`;
    }
  }

  destroy() {}
}
