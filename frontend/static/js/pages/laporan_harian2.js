import { apiFetch } from '../api.js';
import { filterQS } from '../filter-state.js';

const rp  = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const num = n => n != null ? Number(n).toLocaleString('id-ID') : '—';
const rpSigned = n => (n >= 0 ? '+Rp ' : '-Rp ') + Math.abs(n).toLocaleString('id-ID');

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const FULL_MONTHS  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const FULL_DAYS    = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

function fmtDate(s) {
  const [y, m, d] = s.split('-');
  return `${d}-${MONTHS_SHORT[+m - 1]}-${y.slice(2)}`;
}
function todayStr()    { return new Date().toISOString().split('T')[0]; }
function firstOfMonth(){ const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]; }

const FILTERS = [
  { key: 'semua', label: 'Semua' },
  { key: 'live',  label: 'Shopee Live' },
  { key: 'meta',  label: 'Meta' },
  { key: 'adu',   label: 'Adu' },
  { key: 'terra', label: 'Terra' },
];

export class LaporanHarian2Page {
  constructor(container) {
    this.container = container;
    this.dari      = firstOfMonth();
    this.sampai    = todayStr();
    this._rows     = [];   // dari /dashboard (metrics harian)
    this._bdMap    = {};   // dari /laporan-harian2 (breakdown kategori)
    this._filter   = 'semua';
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Laporan Harian 2</h1>
          <p>Rekapan komisi harian per kategori. Klik tanggal untuk detail produk.</p>
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
          <button class="pill-filter${f.key === this._filter ? ' active' : ''}" data-filter="${f.key}"
            style="padding:6px 16px;border-radius:20px;border:1.5px solid ${f.key === this._filter ? 'var(--primary)' : 'var(--border)'};
                   background:${f.key === this._filter ? 'var(--primary)' : 'var(--bg-card)'};
                   color:${f.key === this._filter ? '#fff' : 'var(--text)'};
                   font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;">
            ${f.label}
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

    this.container.querySelector('#filter-pills').addEventListener('click', e => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      this._filter = btn.dataset.filter;
      this.container.querySelectorAll('[data-filter]').forEach(b => {
        const on = b.dataset.filter === this._filter;
        b.style.background  = on ? 'var(--primary)' : 'var(--bg-card)';
        b.style.color       = on ? '#fff' : 'var(--text)';
        b.style.borderColor = on ? 'var(--primary)' : 'var(--border)';
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
      this._rows  = dash?.harian || [];
      this._bdMap = {};
      for (const row of (bd || [])) this._bdMap[row.tanggal] = row;
      this._render();
    } catch (e) {
      wrap.innerHTML = `<div class="alert alert-error" style="margin:16px;">${e.message}</div>`;
    }
  }

  _visible() {
    const f = this._filter;
    if (f === 'semua') return this._rows;
    const key = { live:'komisi_live', meta:'komisi_meta', adu:'komisi_adu', terra:'komisi_terra' }[f];
    return this._rows.filter(r => Number((this._bdMap[r.tanggal] || {})[key] || 0) > 0);
  }

  _render() {
    const wrap = this.container.querySelector('#tbl-wrap');
    const rows = this._visible();

    if (!rows.length) {
      wrap.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);">Tidak ada data untuk rentang tanggal ini.</div>';
      return;
    }

    // Aggregat totals
    const tot = {
      spend: 0, clM: 0, clS: 0, ord: 0, komisi: 0, laba: 0,
      live: 0, story: 0, feed: 0, fp: 0,
      meta: 0, adu: 0, terra: 0, iklan: 0, kotor: 0,
    };
    rows.forEach(r => {
      tot.spend  += Number(r.spend_idr    || 0);
      tot.clM    += Number(r.clicks_meta  || 0);
      tot.clS    += Number(r.clicks_shopee|| 0);
      tot.ord    += Number(r.orders_selesai||0) + Number(r.orders_tertunda||0);
      tot.komisi += Number(r.komisi       || 0);
      tot.laba   += Number(r.laba         || 0);
      const bd = this._bdMap[r.tanggal] || {};
      tot.live  += Number(bd.komisi_live  || 0);
      tot.story += Number(bd.komisi_story || 0);
      tot.feed  += Number(bd.komisi_feed  || 0);
      tot.fp    += Number(bd.total_fp     || 0);
      tot.meta  += Number(bd.komisi_meta  || 0);
      tot.adu   += Number(bd.komisi_adu   || 0);
      tot.terra += Number(bd.komisi_terra || 0);
      tot.iklan += Number(bd.total_iklan  || 0);
      tot.kotor += Number(bd.total_kotor  || 0);
    });
    const tPlus5   = tot.spend * 1.05;
    const tEpc     = tot.clS   > 0 ? tot.komisi / tot.clS    : null;
    const tRoi     = tot.spend > 0 ? tot.laba   / tot.spend * 100 : null;
    const tPctKlik = tot.clM   > 0 ? tot.clS    / tot.clM    * 100 : null;
    const tCpcFp   = tot.clM   > 0 ? tot.spend  / tot.clM    : null;

    const thBase = 'padding:8px 10px;font-size:11px;font-weight:700;white-space:nowrap;text-transform:uppercase;letter-spacing:.4px;background:#f1f5f9;border-bottom:2px solid var(--border);';
    const thFP   = thBase + 'background:#f5f3ff;color:#7c3aed;';
    const thIklan= thBase + 'background:#fef2f2;color:#dc2626;';

    const rowsHtml = rows.map((r, i) => {
      const spend  = Number(r.spend_idr    || 0);
      const clM    = Number(r.clicks_meta  || 0);
      const clS    = Number(r.clicks_shopee|| 0);
      const ord    = Number(r.orders_selesai||0) + Number(r.orders_tertunda||0);
      const tertunda = Number(r.orders_tertunda || 0);
      const laba   = Number(r.laba         || 0);
      const roi    = spend > 0 ? laba / spend * 100 : null;
      const epc    = clS > 0 ? Number(r.komisi||0) / clS : null;
      const plus5  = spend * 1.05;
      const pctKlik = clM > 0 ? clS / clM * 100 : null;
      const bd = this._bdMap[r.tanggal] || {};
      const live  = Number(bd.komisi_live  || 0);
      const story = Number(bd.komisi_story || 0);
      const feed  = Number(bd.komisi_feed  || 0);
      const fp    = Number(bd.total_fp     || 0);
      const meta  = Number(bd.komisi_meta  || 0);
      const adu   = Number(bd.komisi_adu   || 0);
      const terra = Number(bd.komisi_terra || 0);
      const iklan = Number(bd.total_iklan  || 0);
      const kotor = Number(bd.total_kotor  || 0);
      const bgRow = i % 2 === 0 ? '' : 'background:var(--bg-muted);';

      return `<tr style="${bgRow}font-size:12.5px;">
        <td style="white-space:nowrap;padding:7px 10px;">
          <button class="tgl-btn" data-tgl="${r.tanggal}"
            style="background:none;border:none;cursor:pointer;font-weight:700;font-size:12.5px;color:#2563eb;padding:0;text-decoration:underline;text-underline-offset:2px;white-space:nowrap;">
            ${fmtDate(r.tanggal)}
          </button>
        </td>
        <td style="white-space:nowrap;">${rp(spend)}</td>
        <td style="white-space:nowrap;color:var(--text-muted);">${rp(Math.round(plus5))}</td>
        <td>${num(clM)}</td>
        <td>${num(clS)}</td>
        <td style="${pctKlik != null && pctKlik < 10 ? 'color:#dc2626;' : ''}">${pctKlik != null ? pctKlik.toFixed(1) + '%' : '—'}</td>
        <td style="white-space:nowrap;">${epc != null ? rp(Math.round(epc)) : '—'}</td>
        <td>
          ${num(ord)}${tertunda > 0 ? `<span style="font-size:10px;padding:1px 5px;background:#fef3c7;color:#d97706;border-radius:3px;margin-left:4px;">+${tertunda}</span>` : ''}
        </td>
        <td style="font-weight:500;color:${roi != null && roi >= 0 ? '#16a34a' : '#dc2626'};">${roi != null ? (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%' : '—'}</td>
        <td style="color:#7c3aed;">${rp(Math.round(live))}</td>
        <td style="color:#7c3aed;">${rp(Math.round(story))}</td>
        <td style="color:#7c3aed;">${rp(Math.round(feed))}</td>
        <td style="font-weight:700;color:#7c3aed;background:#f5f3ff;">${rp(Math.round(fp))}</td>
        <td style="color:#dc2626;">${rp(Math.round(meta))}</td>
        <td style="color:#dc2626;">${rp(Math.round(adu))}</td>
        <td style="color:#dc2626;">${rp(Math.round(terra))}</td>
        <td style="font-weight:700;color:#dc2626;background:#fef2f2;">${rp(Math.round(iklan))}</td>
        <td style="font-weight:700;color:#10b981;">${rp(Math.round(kotor))}</td>
      </tr>`;
    }).join('');

    wrap.innerHTML = `
      <table class="data-table" style="font-size:12.5px;min-width:1400px;border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th rowspan="2" style="${thBase}min-width:80px;">TGL</th>
            <th rowspan="2" style="${thBase}">SPEND</th>
            <th rowspan="2" style="${thBase}white-space:nowrap;">(+) 5%</th>
            <th rowspan="2" style="${thBase}white-space:nowrap;">KLIK FP</th>
            <th rowspan="2" style="${thBase}white-space:nowrap;">KLIK SHOPEE</th>
            <th rowspan="2" style="${thBase}white-space:nowrap;">(%) KLIK</th>
            <th rowspan="2" style="${thBase}white-space:nowrap;">CPC FP</th>
            <th rowspan="2" style="${thBase}"># ORDER</th>
            <th rowspan="2" style="${thBase}white-space:nowrap;">(%) PROFIT</th>
            <th colspan="4" style="${thFP}text-align:center;border-left:2px solid #ede9fe;">KOMISI FP</th>
            <th colspan="4" style="${thIklan}text-align:center;border-left:2px solid #fecaca;">KOMISI IKLAN</th>
            <th rowspan="2" style="${thBase}background:#f0fdf4;color:#15803d;white-space:nowrap;border-left:2px solid #bbf7d0;">TOTAL KOTOR</th>
          </tr>
          <tr>
            <th style="${thFP}border-left:2px solid #ede9fe;">LIVE</th>
            <th style="${thFP}">STORY</th>
            <th style="${thFP}">FEW FEED</th>
            <th style="${thFP}font-weight:800;">TOTAL FP</th>
            <th style="${thIklan}border-left:2px solid #fecaca;">META</th>
            <th style="${thIklan}">ADU</th>
            <th style="${thIklan}">TERRA</th>
            <th style="${thIklan}font-weight:800;">TOTAL IKLAN</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="font-weight:700;background:var(--bg-muted);border-top:2px solid var(--border);font-size:12px;">
            <td style="font-weight:800;white-space:nowrap;padding:8px 10px;">TOTAL (${rows.length} hari)</td>
            <td>${rp(Math.round(tot.spend))}</td>
            <td>${rp(Math.round(tPlus5))}</td>
            <td>${num(tot.clM)}</td>
            <td>${num(tot.clS)}</td>
            <td>${tPctKlik != null ? tPctKlik.toFixed(1) + '%' : '—'}</td>
            <td>${tCpcFp != null ? rp(Math.round(tCpcFp)) : '—'}</td>
            <td>${num(tot.ord)}</td>
            <td style="color:${tRoi != null && tRoi >= 0 ? '#16a34a' : '#dc2626'};">${tRoi != null ? (tRoi >= 0 ? '+' : '') + tRoi.toFixed(1) + '%' : '—'}</td>
            <td style="color:#7c3aed;">${rp(Math.round(tot.live))}</td>
            <td style="color:#7c3aed;">${rp(Math.round(tot.story))}</td>
            <td style="color:#7c3aed;">${rp(Math.round(tot.feed))}</td>
            <td style="color:#7c3aed;font-weight:800;">${rp(Math.round(tot.fp))}</td>
            <td style="color:#dc2626;">${rp(Math.round(tot.meta))}</td>
            <td style="color:#dc2626;">${rp(Math.round(tot.adu))}</td>
            <td style="color:#dc2626;">${rp(Math.round(tot.terra))}</td>
            <td style="color:#dc2626;font-weight:800;">${rp(Math.round(tot.iklan))}</td>
            <td style="color:#10b981;font-weight:800;">${rp(Math.round(tot.kotor))}</td>
          </tr>
        </tfoot>
      </table>`;

    wrap.querySelectorAll('.tgl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const r = this._rows.find(x => x.tanggal === btn.dataset.tgl);
        if (r) this._showModal(r);
      });
    });
  }

  async _showModal(r) {
    const dt        = new Date(r.tanggal + 'T00:00:00');
    const judulTgl  = `${dt.getDate()} ${FULL_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
    const judulHari = FULL_DAYS[dt.getDay()];
    const laba  = Number(r.laba || 0);
    const spend = Number(r.spend_idr || 0);
    const roi   = spend > 0 ? laba / spend * 100 : 0;
    const totalOrders = Number(r.orders_selesai||0) + Number(r.orders_tertunda||0) + Number(r.orders_batal||0);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:720px;width:95vw;max-height:90vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="flex-shrink:0;">
          <div><h2 style="font-size:17px;">${judulTgl} · ${judulHari}</h2></div>
          <button class="modal-close" id="modal-close">×</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto;padding-top:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
            <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;">
              <div style="font-size:10.5px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">SPEND</div>
              <div style="font-size:16px;font-weight:700;">${rp(spend)}</div>
            </div>
            <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;">
              <div style="font-size:10.5px;font-weight:700;color:#10b981;text-transform:uppercase;margin-bottom:4px;">KOMISI</div>
              <div style="font-size:16px;font-weight:700;color:#10b981;">${rp(r.komisi)}</div>
            </div>
            <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;">
              <div style="font-size:10.5px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">NET PROFIT</div>
              <div style="font-size:16px;font-weight:700;color:${laba>=0?'#16a34a':'#dc2626'};">${rpSigned(Math.round(laba))}</div>
            </div>
            <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;">
              <div style="font-size:10.5px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">ROI</div>
              <div style="font-size:16px;font-weight:700;color:${roi>=0?'#16a34a':'#dc2626'};">${roi>=0?'+':''}${roi.toFixed(2).replace('.',',')}%</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f9fafb;border-radius:8px;margin-bottom:14px;font-size:12.5px;flex-wrap:wrap;">
            <span style="font-weight:600;">${totalOrders} orders →</span>
            <span style="color:#16a34a;">Selesai <span id="m-selesai" style="font-weight:700;">${r.orders_selesai||0}</span></span>
            <span style="color:#f59e0b;">Diproses <span id="m-diproses" style="font-weight:700;">…</span></span>
            <span style="color:#9ca3af;">Belum Dibayar <span id="m-unpaid" style="font-weight:700;">…</span></span>
            <span style="color:#ef4444;">Dibatalkan <span id="m-batal" style="font-weight:700;">${r.orders_batal||0}</span></span>
          </div>
          <div style="display:flex;gap:0;border-bottom:2px solid #e5e7eb;margin-bottom:0;">
            ${['Top Komisi','Top Penjualan','Top Produk'].map((t,i)=>
              `<button class="modal-tab" data-tab="${i}"
                style="padding:8px 16px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;
                color:${i===0?'#dc2626':'#6b7280'};border-bottom:${i===0?'2px solid #dc2626':'2px solid transparent'};margin-bottom:-2px;">${t}</button>`
            ).join('')}
            <span style="margin-left:auto;padding:8px 14px;font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:.05em;">TOP 30</span>
          </div>
          <div id="modal-tab-content" style="min-height:200px;">
            <div class="loading" style="padding:32px;text-align:center;">Memuat data produk…</div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    let activeTab = 0;
    let topData   = null;

    const renderTabContent = (data, tab) => {
      const lists  = [data.top_komisi, data.top_penjualan, data.top_produk];
      const rows   = lists[tab] || [];
      const noData = rows.length === 0 || (rows.length === 1 && rows[0].nama_produk === '—');
      const content = overlay.querySelector('#modal-tab-content');
      if (noData) {
        content.innerHTML = `<div class="empty" style="padding:40px;text-align:center;color:#9ca3af;">Tidak ada data produk.<br><span style="font-size:12px;">Upload ulang Shopee CSV yang menyertakan kolom Product Name.</span></div>`;
        return;
      }
      content.innerHTML = `<div class="table-wrap"><table class="data-table" style="font-size:12px;">
        <thead><tr>
          <th style="width:28px;">#</th><th>PRODUK</th><th>TOKO</th>
          <th style="text-align:right;">QTY</th>
          <th style="text-align:right;">PENJUALAN</th>
          <th style="text-align:right;color:#10b981;">KOMISI</th>
        </tr></thead>
        <tbody>${rows.map((p,i)=>`<tr>
          <td style="color:#9ca3af;font-weight:700;">${i+1}</td>
          <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.nama_produk}">${p.nama_produk}</td>
          <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6b7280;">${p.nama_toko||'—'}</td>
          <td style="text-align:right;">${num(p.qty)}</td>
          <td style="text-align:right;">${rp(p.penjualan)}</td>
          <td style="text-align:right;color:#10b981;font-weight:600;">${rp(p.komisi)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    };

    try {
      const qs = filterQS ? filterQS() : '';
      topData = await apiFetch(`/dashboard/top-products?tanggal=${r.tanggal}${qs}`);
      if (topData) {
        const el = id => overlay.querySelector(id);
        if (el('#m-diproses')) el('#m-diproses').textContent = num(topData.orders_diproses);
        if (el('#m-unpaid'))   el('#m-unpaid').textContent   = num(topData.orders_tertunda);
        if (el('#m-batal'))    el('#m-batal').textContent    = num(topData.orders_batal);
        if (el('#m-selesai'))  el('#m-selesai').textContent  = num(topData.orders_selesai);
        renderTabContent(topData, activeTab);
      }
    } catch {
      overlay.querySelector('#modal-tab-content').innerHTML =
        `<div class="empty" style="padding:40px;text-align:center;color:#9ca3af;">Tidak ada data produk untuk hari ini.</div>`;
    }

    overlay.querySelectorAll('.modal-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = Number(btn.dataset.tab);
        overlay.querySelectorAll('.modal-tab').forEach((b, i) => {
          const on = i === activeTab;
          b.style.color        = on ? '#dc2626' : '#6b7280';
          b.style.borderBottom = on ? '2px solid #dc2626' : '2px solid transparent';
        });
        if (topData) renderTabContent(topData, activeTab);
      });
    });
  }

  destroy() {}
}
