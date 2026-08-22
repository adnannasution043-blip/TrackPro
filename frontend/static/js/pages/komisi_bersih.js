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

// ─── PPh 21 progresif (per bulan, DPP = komisi×50%) ───────────────────────
function progressiveTax(x) {
  if (x <= 0)                return 0;
  if (x <= 60_000_000)       return x * 0.05;
  if (x <= 250_000_000)      return 60_000_000*0.05  + (x-60_000_000)*0.15;
  if (x <= 500_000_000)      return 60_000_000*0.05  + 190_000_000*0.15 + (x-250_000_000)*0.25;
  if (x <= 5_000_000_000)    return 60_000_000*0.05  + 190_000_000*0.15 + 250_000_000*0.25 + (x-500_000_000)*0.30;
  return                            60_000_000*0.05  + 190_000_000*0.15 + 250_000_000*0.25 + 4_500_000_000*0.30 + (x-5_000_000_000)*0.35;
}
function tarifLabel(cumDpp) {
  if (cumDpp <= 60_000_000)    return '5%';
  if (cumDpp <= 250_000_000)   return '15%';
  if (cumDpp <= 500_000_000)   return '25%';
  if (cumDpp <= 5_000_000_000) return '30%';
  return '35%';
}

function calcWdTax(wdRows) {
  // kelompok per bulan → akumulasi DPP per bulan
  const cumByMonth = {};
  return wdRows.map(r => {
    const bulan  = r.tanggal.slice(0, 7);  // yyyy-mm
    const komisi = Number(r.total_komisi || 0);
    const dpp    = komisi * 0.5;
    const prevCum = cumByMonth[bulan] || 0;
    const currCum = prevCum + dpp;
    cumByMonth[bulan] = currCum;
    const pajak   = progressiveTax(currCum) - progressiveTax(prevCum);
    const bersih  = komisi - pajak;
    return { ...r, dpp, cumDpp: currCum, tarif: tarifLabel(currCum), pajak, bersih };
  });
}

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'iklan',     label: 'Analisis Iklan' },
  { key: 'bersih',    label: 'Total Bersih' },
  { key: 'pajak',     label: 'Pajak WD' },
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
      const [dash, bd, wd] = await Promise.all([
        apiFetch(`/dashboard?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}${qs}`),
        apiFetch(`/dashboard/laporan-harian2?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}${qs}`),
        apiFetch(`/upload/wd-payment?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}`),
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
      this._dates   = [...dateSet].sort();
      this._wdRows  = calcWdTax((wd || []).sort((a, b) => a.tanggal.localeCompare(b.tanggal)));
      this._render();
    } catch (e) {
      wrap.innerHTML = `<div class="alert alert-error" style="margin:16px;">${e.message}</div>`;
    }
  }

  _render() {
    const wrap = this.container.querySelector('#tbl-wrap');
    const thS = 'padding:9px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;';

    if (this._tab === 'pajak') {
      this._renderPajak(wrap, thS);
      return;
    }

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

  _renderPajak(wrap, thS) {
    if (!this._wdRows.length) {
      wrap.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--text-muted);">
          <p>Belum ada data Pembayaran WD.</p>
          <p style="font-size:12px;margin-top:6px;">Upload <strong>BillConversionReport</strong> di halaman <a href="#/upload" style="color:#dc2626;">Upload Data</a>.</p>
        </div>`;
      return;
    }

    const totKomisi = this._wdRows.reduce((s, r) => s + Number(r.total_komisi), 0);
    const totDpp    = this._wdRows.reduce((s, r) => s + r.dpp, 0);
    const totPajak  = this._wdRows.reduce((s, r) => s + r.pajak, 0);
    const totBersih = this._wdRows.reduce((s, r) => s + r.bersih, 0);

    let prevBulan = '';
    const bodyRows = this._wdRows.map((r, i) => {
      const bulan = r.tanggal.slice(0, 7);
      let header = '';
      if (bulan !== prevBulan) {
        const [y, m] = bulan.split('-');
        header = `<tr style="background:var(--bg-muted);">
          <td colspan="7" style="padding:6px 12px;font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.5px;text-transform:uppercase;">
            ${MONTHS_SHORT[+m-1]} ${y}
          </td>
        </tr>`;
        prevBulan = bulan;
      }
      return header + `<tr style="${i%2===1?'background:var(--bg-muted);':''}">
        <td style="font-weight:600;white-space:nowrap;padding:7px 12px;">${fmtDate(r.tanggal)}</td>
        <td>${rp(r.total_komisi)}</td>
        <td style="color:#6b7280;">${rp(r.dpp)}</td>
        <td style="color:#6b7280;font-size:11px;">${rp(r.cumDpp)}</td>
        <td style="text-align:center;">
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;background:#fef3c7;color:#92400e;">${r.tarif}</span>
        </td>
        <td style="color:#dc2626;">${rp(r.pajak)}</td>
        <td style="font-weight:700;color:#10b981;background:#f0fdf4;">${rp(r.bersih)}</td>
      </tr>`;
    }).join('');

    wrap.innerHTML = `
      <div style="padding:10px 16px;background:#fffbeb;border-bottom:1px solid var(--border);font-size:12px;color:#92400e;">
        <strong>PPh 21 Progresif</strong> — DPP = Komisi × 50%, tarif dihitung kumulatif per bulan:
        ≤60 jt → 5% · 60–250 jt → 15% · 250–500 jt → 25% · 500 jt–5 M → 30% · >5 M → 35%
      </div>
      <table class="data-table" style="min-width:680px;">
        <thead>
          <tr>
            <th style="${thS}min-width:85px;">TGL</th>
            <th style="${thS}">KOMISI WD</th>
            <th style="${thS}color:#6b7280;">DPP (50%)</th>
            <th style="${thS}color:#6b7280;">KUM. DPP BULAN</th>
            <th style="${thS}text-align:center;">TARIF</th>
            <th style="${thS}color:#dc2626;">POTONGAN PAJAK</th>
            <th style="${thS}color:#10b981;background:#f0fdf4;">KOMISI BERSIH</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
        <tfoot>
          <tr style="font-weight:800;background:var(--bg-muted);border-top:2px solid var(--border);">
            <td style="padding:8px 12px;">TOTAL</td>
            <td>${rp(totKomisi)}</td>
            <td style="color:#6b7280;">${rp(totDpp)}</td>
            <td></td>
            <td></td>
            <td style="color:#dc2626;">${rp(totPajak)}</td>
            <td style="color:#10b981;background:#f0fdf4;">${rp(totBersih)}</td>
          </tr>
        </tfoot>
      </table>`;
  }

  destroy() {}
}
