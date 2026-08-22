import { apiFetch } from '../api.js';
import { filterQS } from '../filter-state.js';

const rp   = n => Math.round(Number(n || 0)).toLocaleString('id-ID');
const rpParen = n => {
  const v = Math.round(Number(n || 0));
  return v < 0 ? `(${Math.abs(v).toLocaleString('id-ID')})` : v.toLocaleString('id-ID');
};

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
function fmtDate(s) {
  const [y, m, d] = s.split('-');
  return `${d}-${MONTHS_SHORT[+m-1]}-${y.slice(2)}`;
}
function todayStr()    { return new Date().toISOString().split('T')[0]; }
function firstOfMonth(){ const n=new Date(); return new Date(n.getFullYear(),n.getMonth(),1).toISOString().split('T')[0]; }

// ─── PPh 21 progresif ────────────────────────────────────────────────────────
function progressiveTax(x) {
  if (x <= 0)             return 0;
  if (x <= 60e6)          return x * 0.05;
  if (x <= 250e6)         return 60e6*0.05  + (x-60e6)*0.15;
  if (x <= 500e6)         return 60e6*0.05  + 190e6*0.15 + (x-250e6)*0.25;
  if (x <= 5e9)           return 60e6*0.05  + 190e6*0.15 + 250e6*0.25 + (x-500e6)*0.30;
  return                         60e6*0.05  + 190e6*0.15 + 250e6*0.25 + 4.5e9*0.30 + (x-5e9)*0.35;
}
function tarifLabel(cumDpp) {
  if (cumDpp <= 60e6)  return '5%';
  if (cumDpp <= 250e6) return '15%';
  if (cumDpp <= 500e6) return '25%';
  if (cumDpp <= 5e9)   return '30%';
  return '35%';
}
function calcWdTax(wdRows) {
  const cumByMonth = {};
  return wdRows.map(r => {
    const bulan  = r.tanggal.slice(0, 7);
    const komisi = Number(r.total_komisi || 0);
    const dpp    = komisi * 0.5;
    const prevCum = cumByMonth[bulan] || 0;
    const currCum = prevCum + dpp;
    cumByMonth[bulan] = currCum;
    const pajak  = progressiveTax(currCum) - progressiveTax(prevCum);
    return { ...r, dpp, cumDpp: currCum, tarif: tarifLabel(currCum), pajak, bersih: komisi - pajak };
  });
}

const TABS = [
  { key: 'komisi', label: 'Komisi & Profit' },
  { key: 'pajak',  label: 'Pajak WD' },
];

export class KomisiBersihPage {
  constructor(container) {
    this.container = container;
    this.dari      = firstOfMonth();
    this.sampai    = todayStr();
    this._bdMap    = {};
    this._spendMap = {};
    this._dates    = [];
    this._wdRows   = [];
    this._tab      = 'komisi';
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Pembayaran WD</h1>
          <p>Komisi after tax 2,5% — Organik, Iklan, dan Profit per hari.</p>
        </div>
        <div class="page-header-right" style="display:flex;gap:8px;align-items:center;">
          <input type="date" id="inp-dari"   class="form-input" style="width:140px;" value="${this.dari}">
          <span style="color:var(--text-muted)">–</span>
          <input type="date" id="inp-sampai" class="form-input" style="width:140px;" value="${this.sampai}">
          <button class="btn btn-primary" id="btn-terapkan">Terapkan</button>
        </div>
      </div>

      <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px;" id="tab-bar">
        ${TABS.map((t,i) => `
          <button class="kb-tab" data-tab="${t.key}"
            style="padding:10px 20px;border:none;background:none;cursor:pointer;font-size:13.5px;font-weight:600;
            color:${i===0?'#dc2626':'var(--text-muted)'};
            border-bottom:${i===0?'2px solid #dc2626':'2px solid transparent'};margin-bottom:-2px;">
            ${t.label}
          </button>`).join('')}
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
        b.style.color        = on ? '#dc2626' : 'var(--text-muted)';
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
      const [dash, bd, wd] = await Promise.all([
        apiFetch(`/dashboard?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}${qs}`),
        apiFetch(`/dashboard/laporan-harian2?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}${qs}`),
        apiFetch(`/upload/wd-payment?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}`),
      ]);

      this._bdMap    = {};
      this._spendMap = {};
      const dateSet  = new Set();

      for (const row of (bd || [])) {
        this._bdMap[row.tanggal] = row;
        dateSet.add(row.tanggal);
      }
      for (const row of (dash?.harian || [])) {
        this._spendMap[row.tanggal] = Number(row.spend_idr || 0);
        dateSet.add(row.tanggal);
      }
      this._dates  = [...dateSet].sort();
      this._wdRows = calcWdTax((wd || []).sort((a,b) => a.tanggal.localeCompare(b.tanggal)));
      this._render();
    } catch (e) {
      wrap.innerHTML = `<div class="alert alert-error" style="margin:16px;">${e.message}</div>`;
    }
  }

  _render() {
    if (this._tab === 'pajak') { this._renderPajak(); return; }
    this._renderKomisi();
  }

  _renderKomisi() {
    const wrap = this.container.querySelector('#tbl-wrap');
    if (!this._dates.length) {
      wrap.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);">Tidak ada data untuk rentang tanggal ini.</div>';
      return;
    }

    // Hitung pajak progresif kumulatif per bulan dari data harian
    const cumByMonth = {};
    const rows = this._dates.map(tgl => {
      const bd    = this._bdMap[tgl]    || {};
      const spend = this._spendMap[tgl] || 0;

      const grossOrganik = Number(bd.komisi_live||0) + Number(bd.komisi_story||0) + Number(bd.komisi_feed||0);
      const grossIklan   = Number(bd.komisi_meta||0) + Number(bd.komisi_adu||0) + Number(bd.komisi_terra||0);
      const grossTotal   = grossOrganik + grossIklan;

      const bulan  = tgl.slice(0, 7);
      const dpp    = grossTotal * 0.5;
      const prevCum = cumByMonth[bulan] || 0;
      const currCum = prevCum + dpp;
      cumByMonth[bulan] = currCum;
      const pajak  = progressiveTax(currCum) - progressiveTax(prevCum);

      // distribusi pajak proporsional ke organik & iklan
      const ratio   = grossTotal > 0 ? grossOrganik / grossTotal : 0.5;
      const organik = grossOrganik - pajak * ratio;
      const iklan   = grossIklan   - pajak * (1 - ratio);

      const totalMasuk  = organik + iklan;
      const profitIklan = iklan - spend;
      const totalBersih = organik + profitIklan;

      return { tgl, organik, iklan, totalMasuk, spend, profitIklan, totalBersih, pajak };
    });

    const tot = rows.reduce((a, r) => ({
      organik:      a.organik     + r.organik,
      iklan:        a.iklan       + r.iklan,
      totalMasuk:   a.totalMasuk  + r.totalMasuk,
      spend:        a.spend       + r.spend,
      profitIklan:  a.profitIklan + r.profitIklan,
      totalBersih:  a.totalBersih + r.totalBersih,
      pajak:        a.pajak       + r.pajak,
    }), { organik:0, iklan:0, totalMasuk:0, spend:0, profitIklan:0, totalBersih:0, pajak:0 });

    // ── styles ────────────────────────────────────────────────────────────────
    const thBase = 'padding:8px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;text-align:right;';
    const tdBase = 'padding:7px 10px;text-align:right;white-space:nowrap;';
    const GRP1   = { bg:'#f5f3ff', border:'#7c3aed', color:'#7c3aed' }; // organik – ungu
    const GRP2   = { bg:'#fef2f2', border:'#dc2626', color:'#dc2626' }; // profit iklan – merah
    const GRP3   = { bg:'#f0fdf4', border:'#16a34a', color:'#16a34a' }; // bersih – hijau
    // label tarif per baris
    const tarifRow = r => tarifLabel(
      (() => { const b = r.tgl.slice(0,7); return cumByMonth[b] || 0; })()
    );
    const grpHdr = (g, label, cols) =>
      `<th colspan="${cols}" style="${thBase}background:${g.bg};color:${g.color};border-bottom:2px solid ${g.border};text-align:center;">${label}</th>`;

    const bodyRows = rows.map((r, i) => {
      const stripe = i%2===1 ? 'background:var(--bg-muted);' : '';
      const pColor = r.profitIklan >= 0 ? '#16a34a' : '#dc2626';
      const tColor = r.totalBersih >= 0 ? '#16a34a' : '#dc2626';
      const tarif  = tarifLabel(cumByMonth[r.tgl.slice(0,7)] || 0);
      return `<tr style="${stripe}">
        <td style="padding:7px 10px;font-weight:600;white-space:nowrap;">${fmtDate(r.tgl)}</td>
        <td style="text-align:center;padding:7px 8px;">
          <span style="display:inline-block;padding:2px 7px;border-radius:9999px;font-size:11px;font-weight:700;background:#fef3c7;color:#92400e;">${tarif}</span>
        </td>
        <td style="${tdBase}color:#7c3aed;">${rp(r.organik)}</td>
        <td style="${tdBase}color:#7c3aed;">${rp(r.iklan)}</td>
        <td style="${tdBase}font-weight:700;color:#7c3aed;">${rp(r.totalMasuk)}</td>
        <td style="${tdBase}color:#dc2626;">${rp(r.iklan)}</td>
        <td style="${tdBase}color:#6b7280;">${rp(r.spend)}</td>
        <td style="${tdBase}font-weight:700;color:${pColor};">${rpParen(r.profitIklan)}</td>
        <td style="${tdBase}color:#16a34a;">${rp(r.organik)}</td>
        <td style="${tdBase}color:${pColor};">${rpParen(r.profitIklan)}</td>
        <td style="${tdBase}font-weight:700;color:${tColor};background:#f0fdf4;">${rpParen(r.totalBersih)}</td>
      </tr>`;
    }).join('');

    const pTotColor = tot.profitIklan >= 0 ? '#16a34a' : '#dc2626';
    const tTotColor = tot.totalBersih >= 0 ? '#16a34a' : '#dc2626';

    wrap.innerHTML = `
      <table class="data-table" style="min-width:900px;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:none;">
            <th rowspan="2" style="${thBase}text-align:left;vertical-align:bottom;min-width:80px;">TGL</th>
            <th rowspan="2" style="${thBase}vertical-align:bottom;text-align:center;background:#fffbeb;color:#92400e;">TARIF</th>
            ${grpHdr(GRP1, 'Komisi Bersih after Tax (PPh 21)', 3)}
            ${grpHdr(GRP2, 'Profit Iklan', 3)}
            ${grpHdr(GRP3, 'Komisi Bersih', 3)}
          </tr>
          <tr>
            <th style="${thBase}background:${GRP1.bg};color:${GRP1.color};">Komisi Organik</th>
            <th style="${thBase}background:${GRP1.bg};color:${GRP1.color};">Komisi Iklan</th>
            <th style="${thBase}background:${GRP1.bg};color:${GRP1.color};">Total Komisi Masuk</th>
            <th style="${thBase}background:${GRP2.bg};color:${GRP2.color};">Komisi Iklan</th>
            <th style="${thBase}background:${GRP2.bg};color:#6b7280;">Budget Iklan</th>
            <th style="${thBase}background:${GRP2.bg};color:${GRP2.color};">Profit Iklan</th>
            <th style="${thBase}background:${GRP3.bg};color:${GRP3.color};">Komisi Organik</th>
            <th style="${thBase}background:${GRP3.bg};color:${GRP3.color};">Profit Iklan</th>
            <th style="${thBase}background:${GRP3.bg};color:${GRP3.color};">Total</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
        <tfoot>
          <tr style="font-weight:800;background:var(--bg-muted);border-top:2px solid var(--border);">
            <td style="padding:8px 10px;font-weight:800;">TOTAL</td>
            <td></td>
            <td style="${tdBase}color:#7c3aed;">${rp(tot.organik)}</td>
            <td style="${tdBase}color:#7c3aed;">${rp(tot.iklan)}</td>
            <td style="${tdBase}font-weight:800;color:#7c3aed;">${rp(tot.totalMasuk)}</td>
            <td style="${tdBase}color:#dc2626;">${rp(tot.iklan)}</td>
            <td style="${tdBase}color:#6b7280;">${rp(tot.spend)}</td>
            <td style="${tdBase}font-weight:800;color:${pTotColor};">${rpParen(tot.profitIklan)}</td>
            <td style="${tdBase}color:#16a34a;">${rp(tot.organik)}</td>
            <td style="${tdBase}color:${pTotColor};">${rpParen(tot.profitIklan)}</td>
            <td style="${tdBase}font-weight:800;color:${tTotColor};background:#f0fdf4;">${rpParen(tot.totalBersih)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="padding:8px 14px;background:#fffbeb;border-top:1px solid var(--border);font-size:12px;color:#92400e;">
        <strong>PPh 21 Progresif</strong> — DPP = Komisi × 50%, kumulatif per bulan:
        ≤60 jt → 5% · 60–250 jt → 15% · 250–500 jt → 25% · 500 jt–5 M → 30% · >5 M → 35%
        &nbsp;·&nbsp; Total pajak periode ini: <strong>Rp ${rp(tot.pajak)}</strong>
      </div>`;
  }

  _renderPajak() {
    const wrap = this.container.querySelector('#tbl-wrap');
    if (!this._wdRows.length) {
      wrap.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--text-muted);">
          <p>Belum ada data Pembayaran WD.</p>
          <p style="font-size:12px;margin-top:6px;">Upload <strong>BillConversionReport</strong> di halaman <a href="#/upload" style="color:#dc2626;">Upload Data</a>.</p>
        </div>`;
      return;
    }

    const thS = 'padding:9px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;';
    const totKomisi = this._wdRows.reduce((s,r) => s+Number(r.total_komisi),0);
    const totDpp    = this._wdRows.reduce((s,r) => s+r.dpp,0);
    const totPajak  = this._wdRows.reduce((s,r) => s+r.pajak,0);
    const totBersih = this._wdRows.reduce((s,r) => s+r.bersih,0);

    let prevBulan = '';
    const bodyRows = this._wdRows.map((r,i) => {
      const bulan = r.tanggal.slice(0,7);
      let header = '';
      if (bulan !== prevBulan) {
        const [y,m] = bulan.split('-');
        header = `<tr style="background:var(--bg-muted);">
          <td colspan="7" style="padding:6px 12px;font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.5px;text-transform:uppercase;">
            ${MONTHS_SHORT[+m-1]} ${y}
          </td></tr>`;
        prevBulan = bulan;
      }
      return header + `<tr style="${i%2===1?'background:var(--bg-muted);':''}">
        <td style="padding:7px 12px;font-weight:600;white-space:nowrap;">${fmtDate(r.tanggal)}</td>
        <td style="text-align:right;">${rp(r.total_komisi)}</td>
        <td style="text-align:right;color:#6b7280;">${rp(r.dpp)}</td>
        <td style="text-align:right;color:#6b7280;font-size:11px;">${rp(r.cumDpp)}</td>
        <td style="text-align:center;">
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;background:#fef3c7;color:#92400e;">${r.tarif}</span>
        </td>
        <td style="text-align:right;color:#dc2626;">${rp(r.pajak)}</td>
        <td style="text-align:right;font-weight:700;color:#10b981;background:#f0fdf4;">${rp(r.bersih)}</td>
      </tr>`;
    }).join('');

    wrap.innerHTML = `
      <table class="data-table" style="min-width:680px;">
        <thead>
          <tr>
            <th style="${thS}min-width:85px;">TGL</th>
            <th style="${thS}text-align:right;">KOMISI WD</th>
            <th style="${thS}text-align:right;color:#6b7280;">DPP (50%)</th>
            <th style="${thS}text-align:right;color:#6b7280;">KUM. DPP BULAN</th>
            <th style="${thS}text-align:center;">TARIF</th>
            <th style="${thS}text-align:right;color:#dc2626;">POTONGAN PAJAK</th>
            <th style="${thS}text-align:right;color:#10b981;background:#f0fdf4;">KOMISI BERSIH</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
        <tfoot>
          <tr style="font-weight:800;background:var(--bg-muted);border-top:2px solid var(--border);">
            <td style="padding:8px 12px;">TOTAL</td>
            <td style="text-align:right;">${rp(totKomisi)}</td>
            <td style="text-align:right;color:#6b7280;">${rp(totDpp)}</td>
            <td></td><td></td>
            <td style="text-align:right;color:#dc2626;">${rp(totPajak)}</td>
            <td style="text-align:right;color:#10b981;background:#f0fdf4;">${rp(totBersih)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="padding:8px 14px;background:#fffbeb;border-top:1px solid var(--border);font-size:12px;color:#92400e;">
        <strong>PPh 21 Progresif</strong> — DPP = Komisi × 50%, tarif kumulatif per bulan:
        ≤60 jt → 5% · 60–250 jt → 15% · 250–500 jt → 25% · 500 jt–5 M → 30% · >5 M → 35%
      </div>`;
  }

  destroy() {}
}
