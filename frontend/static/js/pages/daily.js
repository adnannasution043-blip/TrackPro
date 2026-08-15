import { apiFetch } from '../api.js';
import { filterQS } from '../filter-state.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const num = n => n != null ? Number(n).toLocaleString('id-ID') : '-';
const rpSigned = n => {
  const v = Number(n || 0);
  return (v >= 0 ? '+Rp ' : '-Rp ') + Math.abs(v).toLocaleString('id-ID');
};
const pctFmt = n => Number(n || 0).toFixed(1).replace('.', ',') + '%';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const DAYS_SHORT = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function fmtDateLabel(d) {
  const dt = new Date(d);
  return `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
}

function fmtDateRow(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y.slice(2)}`;
}

function getDayName(dateStr) {
  return DAYS_SHORT[new Date(dateStr).getDay()];
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }

export class DailyPage {
  constructor(container) {
    this.container = container;
    const now = new Date();
    this.dari = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    this.sampai = todayStr();
    this._rows = [];
    this._sort = { col: 'tanggal', dir: 'desc' };
    this._page = 1;
    this._pageSize = 10;
    // Date picker state
    const dt = new Date(this.dari);
    this._dpYear = dt.getFullYear();
    this._dpMonth = Math.max(0, dt.getMonth() - 1);
    this._dpStart = this.dari;
    this._dpEnd = this.sampai;
    this._dpSelecting = false;
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Laporan Harian</h1>
          <p>Rincian P&L per-hari — klik baris untuk lihat top produk hari itu.</p>
        </div>
        <div class="page-header-right" style="position:relative;">
          <button id="btn-date-range" class="date-range-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span id="date-label">${fmtDateLabel(this.dari)} — ${fmtDateLabel(this.sampai)}</span>
          </button>
          <div id="date-picker" style="display:none;position:absolute;top:44px;right:0;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.13);z-index:200;flex-direction:row;"></div>
          <div class="date-range-display" id="tz-label">Menampilkan ${this.dari} → ${this.sampai} (WIB)</div>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;
    this._injectStyles();
    this._initDatePicker();
    await this._load();
  }

  _injectStyles() {
    if (document.getElementById('daily-styles')) return;
    const s = document.createElement('style');
    s.id = 'daily-styles';
    s.textContent = `
      .dp-cell { width:30px; height:30px; display:flex; align-items:center; justify-content:center;
        font-size:12px; border-radius:50%; cursor:pointer; user-select:none; }
      .dp-cell:hover { background:#f3f4f6; }
      .dp-cell.dp-sel { background:#dc2626 !important; color:#fff !important; font-weight:700; border-radius:50% !important; }
      .dp-cell.dp-in-range { background:#fee2e2; color:#dc2626; border-radius:0; }
      .dp-preset { padding:8px 14px; border-radius:8px; cursor:pointer; font-size:12.5px; font-weight:500; white-space:nowrap; }
      .dp-preset:hover, .dp-preset.active { background:#fee2e2; color:#dc2626; font-weight:700; }
    `;
    document.head.appendChild(s);
  }

  _initDatePicker() {
    const btn = this.container.querySelector('#btn-date-range');
    const picker = this.container.querySelector('#date-picker');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = picker.style.display === 'flex';
      if (!isOpen) {
        this._dpStart = this.dari; this._dpEnd = this.sampai; this._dpSelecting = false;
        const dt = new Date(this.dari);
        this._dpYear = dt.getFullYear();
        this._dpMonth = Math.max(0, dt.getMonth() - 1);
        this._renderPicker(picker);
        picker.style.display = 'flex';
      } else {
        picker.style.display = 'none';
      }
    });

    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target) && e.target !== btn) picker.style.display = 'none';
    });
  }

  _renderPicker(picker) {
    const presets = [
      { label: 'Maksimum',       s: '2020-01-01',  e: todayStr() },
      { label: 'Kemarin',        s: daysAgo(1),     e: daysAgo(1) },
      { label: '7 hari terakhir',  s: daysAgo(7),  e: todayStr() },
      { label: '14 hari terakhir', s: daysAgo(14), e: todayStr() },
      { label: '30 hari terakhir', s: daysAgo(30), e: todayStr() },
      {
        label: 'Minggu ini',
        get s() { const d=new Date(); d.setDate(d.getDate()-d.getDay()); return d.toISOString().split('T')[0]; },
        e: todayStr(),
      },
      {
        label: 'Minggu lalu',
        get s() { const d=new Date(); d.setDate(d.getDate()-d.getDay()-7); return d.toISOString().split('T')[0]; },
        get e() { const d=new Date(); d.setDate(d.getDate()-d.getDay()-1); return d.toISOString().split('T')[0]; },
      },
      {
        label: 'Bulan ini',
        get s() { const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1).toISOString().split('T')[0]; },
        e: todayStr(),
      },
      {
        label: 'Bulan lalu',
        get s() { const d=new Date(); return new Date(d.getFullYear(),d.getMonth()-1,1).toISOString().split('T')[0]; },
        get e() { const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),0).toISOString().split('T')[0]; },
      },
    ];

    const y1 = this._dpYear, m1 = this._dpMonth;
    const y2 = m1 === 11 ? y1 + 1 : y1;
    const m2 = m1 === 11 ? 0 : m1 + 1;

    const renderMonth = (year, month) => {
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const s = this._dpStart, e = this._dpEnd;
      let cells = '';
      for (let i = 0; i < firstDay; i++) cells += '<div></div>';
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        let cls = 'dp-cell';
        if (dt === s || dt === e) cls += ' dp-sel';
        else if (s && e && dt > s && dt < e) cls += ' dp-in-range';
        cells += `<div class="${cls}" data-date="${dt}">${d}</div>`;
      }
      return `
        <div>
          <div style="font-size:13px;font-weight:700;text-align:center;margin-bottom:10px;">${MONTHS[month]} ${year}</div>
          <div style="display:grid;grid-template-columns:repeat(7,30px);gap:1px;margin-bottom:4px;">
            ${DAYS_SHORT.map(d=>`<div style="text-align:center;font-size:10.5px;font-weight:600;color:#9ca3af;width:30px;">${d}</div>`).join('')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,30px);gap:1px;">${cells}</div>
        </div>`;
    };

    picker.innerHTML = `
      <div style="padding:12px 8px 12px 12px;border-right:1px solid #f3f4f6;display:flex;flex-direction:column;gap:2px;min-width:152px;">
        ${presets.map((p,i) => {
          const active = p.s === this._dpStart && p.e === this._dpEnd;
          return `<div class="dp-preset${active?' active':''}" data-pi="${i}">${p.label}</div>`;
        }).join('')}
      </div>
      <div style="padding:16px 16px 12px;">
        <div style="display:flex;align-items:flex-start;gap:6px;">
          <button id="dp-prev" style="background:none;border:1px solid #e5e7eb;border-radius:6px;cursor:pointer;padding:5px 10px;font-size:15px;color:#374151;flex-shrink:0;margin-top:28px;">‹</button>
          <div style="display:flex;gap:28px;">${renderMonth(y1,m1)}${renderMonth(y2,m2)}</div>
          <button id="dp-next" style="background:none;border:1px solid #e5e7eb;border-radius:6px;cursor:pointer;padding:5px 10px;font-size:15px;color:#374151;flex-shrink:0;margin-top:28px;">›</button>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #f3f4f6;padding-top:12px;margin-top:12px;">
          <button id="dp-batal" class="btn">Batal</button>
          <button id="dp-terapkan" class="btn btn-primary">Terapkan</button>
        </div>
      </div>`;

    picker.querySelectorAll('.dp-cell[data-date]').forEach(el => {
      el.addEventListener('click', () => {
        const d = el.dataset.date;
        if (!this._dpSelecting) {
          this._dpStart = d; this._dpEnd = d; this._dpSelecting = true;
        } else {
          if (d >= this._dpStart) this._dpEnd = d;
          else { this._dpEnd = this._dpStart; this._dpStart = d; }
          this._dpSelecting = false;
        }
        this._renderPicker(picker);
      });
    });

    picker.querySelector('#dp-prev').addEventListener('click', () => {
      this._dpMonth--; if (this._dpMonth < 0) { this._dpMonth = 11; this._dpYear--; }
      this._renderPicker(picker);
    });
    picker.querySelector('#dp-next').addEventListener('click', () => {
      this._dpMonth++; if (this._dpMonth > 11) { this._dpMonth = 0; this._dpYear++; }
      this._renderPicker(picker);
    });

    picker.querySelectorAll('.dp-preset').forEach(el => {
      el.addEventListener('click', () => {
        const p = presets[Number(el.dataset.pi)];
        this._dpStart = p.s; this._dpEnd = p.e; this._dpSelecting = false;
        this._renderPicker(picker);
      });
    });

    picker.querySelector('#dp-batal').addEventListener('click', () => {
      picker.style.display = 'none';
    });
    picker.querySelector('#dp-terapkan').addEventListener('click', () => {
      this.dari = this._dpStart; this.sampai = this._dpEnd;
      this.container.querySelector('#date-label').textContent = `${fmtDateLabel(this.dari)} — ${fmtDateLabel(this.sampai)}`;
      const tzEl = this.container.querySelector('#tz-label');
      if (tzEl) tzEl.textContent = `Menampilkan ${this.dari} → ${this.sampai} (WIB)`;
      picker.style.display = 'none';
      this._page = 1; this._load();
    });
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';
    try {
      const data = await apiFetch(`/dashboard?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}${filterQS()}`);
      if (!data) return;
      this._rows = (data.harian || []).map(r => ({
        ...r,
        _roi: Number(r.spend_idr) > 0 ? Number(r.laba) / Number(r.spend_idr) * 100 : 0,
      }));
      this._renderTable(el);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _renderTable(el) {
    const sorted = [...this._rows].sort((a, b) => {
      const { col, dir } = this._sort;
      let va, vb;
      if (col === 'tanggal') { va = String(a.tanggal).localeCompare(String(b.tanggal)); }
      else { va = Number(a[col] || 0) - Number(b[col] || 0); }
      return dir === 'asc' ? va : -va;
    });

    const total = sorted.length;
    const start = (this._page - 1) * this._pageSize;
    const pageRows = sorted.slice(start, start + this._pageSize);
    const totalPages = Math.max(1, Math.ceil(total / this._pageSize));

    const arr = k => this._sort.col !== k
      ? `<span style="color:#d1d5db;font-size:10px;">↕</span>`
      : `<span style="font-size:10px;">${this._sort.dir === 'asc' ? '↑' : '↓'}</span>`;

    const sum = f => sorted.reduce((s, r) => s + Number(r[f] || 0), 0);
    const tSpend = sum('spend_idr'), tKom = sum('komisi'), tPenj = sum('penjualan');
    const tSel = sum('orders_selesai'), tTert = sum('orders_tertunda');
    const tLaba = sum('laba'), tClM = sum('clicks_meta'), tClS = sum('clicks_shopee');
    const tRoi = tSpend > 0 ? tLaba / tSpend * 100 : 0;
    const tEpc  = tClS  > 0 ? tKom  / tClS  : 0;

    const pendBadge = n => n > 0
      ? ` <span style="padding:1px 5px;border-radius:4px;background:#fef3c7;color:#d97706;font-size:10px;font-weight:700;">+${n}</span>`
      : '';

    const rowHtml = r => {
      const laba = Number(r.laba || 0);
      const epc  = Number(r.epc  || 0);
      const roi  = Number(r._roi || 0);
      const orders = Number(r.orders_selesai || 0) + Number(r.orders_tertunda || 0);
      const pend   = Number(r.orders_tertunda || 0);
      return `<tr class="daily-row" data-date="${r.tanggal}" style="cursor:pointer;">
        <td style="font-weight:600;white-space:nowrap;">${fmtDateRow(r.tanggal)}</td>
        <td style="color:#9ca3af;font-size:12px;">${getDayName(r.tanggal)}</td>
        <td>${rp(r.spend_idr)}</td>
        <td>${num(r.clicks_meta)}</td>
        <td>${num(r.clicks_shopee)}</td>
        <td style="color:#10b981;font-weight:500;">${rp(r.komisi)}</td>
        <td>${rp(r.penjualan)}</td>
        <td>${num(orders)}${pendBadge(pend)}</td>
        <td style="color:${epc >= 0 ? '#16a34a' : '#dc2626'};">${rpSigned(Math.round(epc))}</td>
        <td>${r.cr_persen != null ? pctFmt(r.cr_persen) : '-'}</td>
        <td style="color:${laba >= 0 ? '#16a34a' : '#dc2626'};font-weight:600;">${rpSigned(Math.round(laba))}</td>
        <td style="color:${roi >= 0 ? '#16a34a' : '#dc2626'};font-weight:600;">${roi >= 0 ? '+' : ''}${pctFmt(roi)}</td>
        <td style="padding:4px 4px;">
          <button class="btn btn-sm" style="color:#ef4444;border-color:transparent;padding:3px 6px;" data-del="${r.tanggal}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </td>
        <td style="padding:4px 4px;">
          <button class="btn btn-sm" style="padding:3px 8px;font-size:13px;color:#6b7280;" data-exp="${r.tanggal}">›</button>
        </td>
      </tr>`;
    };

    const totalRow = total > 0 ? `<tr style="font-weight:700;background:var(--bg,#f9fafb);border-top:2px solid var(--border,#e5e7eb);">
      <td colspan="2" style="font-weight:800;font-size:12.5px;">TOTAL - ${total} hari</td>
      <td>${rp(tSpend)}</td>
      <td>${num(tClM)}</td>
      <td>${num(tClS)}</td>
      <td style="color:#10b981;">${rp(tKom)}</td>
      <td>${rp(tPenj)}</td>
      <td>${num(tSel + tTert)}${pendBadge(tTert)}</td>
      <td style="color:${tEpc >= 0 ? '#16a34a' : '#dc2626'};">${rpSigned(Math.round(tEpc))}</td>
      <td>-</td>
      <td style="color:${tLaba >= 0 ? '#16a34a' : '#dc2626'};font-weight:700;">${rpSigned(Math.round(tLaba))}</td>
      <td style="color:${tRoi >= 0 ? '#16a34a' : '#dc2626'};">${tRoi >= 0 ? '+' : ''}${pctFmt(tRoi)}</td>
      <td></td><td></td>
    </tr>` : '';

    const p = this._page, ps = this._pageSize;
    const pagCtrl = `<div style="display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:10px;font-size:12.5px;color:#6b7280;">
      <div style="display:flex;align-items:center;gap:6px;">Tampilkan baris:
        <select id="pag-size" style="padding:3px 8px;border:1px solid #e5e7eb;border-radius:4px;font-size:12px;">
          ${[10,25,50,100].map(n=>`<option value="${n}"${n===ps?' selected':''}>${n}</option>`).join('')}
        </select>
      </div>
      <span>${total === 0 ? '0' : start+1}-${Math.min(start+ps,total)} dari ${total}</span>
      <div style="display:flex;gap:2px;">
        ${[['«',1],['‹',p-1],['›',p+1],['»',totalPages]].map(([s,pg]) => {
          const dis = (pg<1)||(pg>totalPages);
          return `<button class="btn btn-sm pag-btn" data-pg="${pg}" style="padding:3px 8px;" ${dis?'disabled':''}>${s}</button>`;
        }).join('')}
      </div>
    </div>`;

    el.innerHTML = `<div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th class="sortable" data-col="tanggal" style="white-space:nowrap;">Tanggal ${arr('tanggal')}</th>
            <th>Hari</th>
            <th class="sortable" data-col="spend_idr" style="white-space:nowrap;">Spend ${arr('spend_idr')}</th>
            <th class="sortable" data-col="clicks_meta" style="white-space:nowrap;">Click Meta ${arr('clicks_meta')}</th>
            <th class="sortable" data-col="clicks_shopee" style="white-space:nowrap;">Click Shopee ${arr('clicks_shopee')}</th>
            <th class="sortable" data-col="komisi" style="white-space:nowrap;">Komisi ${arr('komisi')}</th>
            <th>Penjualan</th>
            <th>Orders</th>
            <th class="sortable" data-col="epc" style="white-space:nowrap;">EPC ${arr('epc')}</th>
            <th>CR</th>
            <th class="sortable" data-col="laba" style="white-space:nowrap;">Laba ${arr('laba')}</th>
            <th class="sortable" data-col="_roi" style="white-space:nowrap;">ROI ${arr('_roi')}</th>
            <th style="width:36px;"></th>
            <th style="width:36px;"></th>
          </tr></thead>
          <tbody>
            ${total === 0
              ? `<tr><td colspan="14" class="empty">Tidak ada data.<br><span style="font-size:12px;">Upload data harian terlebih dahulu.</span></td></tr>`
              : pageRows.map(rowHtml).join('') + totalRow}
          </tbody>
        </table>
      </div>
      <div style="font-size:11.5px;color:#9ca3af;margin-top:8px;">Tanggal tanpa data Shopee tidak ditampilkan di Laporan Harian.</div>
      ${pagCtrl}
    </div>`;

    el.querySelectorAll('[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (this._sort.col === col) this._sort.dir = this._sort.dir === 'asc' ? 'desc' : 'asc';
        else this._sort = { col, dir: 'desc' };
        this._page = 1; this._renderTable(el);
      });
    });

    el.querySelectorAll('.pag-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const pg = Number(btn.dataset.pg);
        if (pg >= 1 && pg <= totalPages) { this._page = pg; this._renderTable(el); }
      });
    });

    el.querySelector('#pag-size')?.addEventListener('change', (e) => {
      this._pageSize = Number(e.target.value); this._page = 1; this._renderTable(el);
    });

    el.querySelectorAll('.daily-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-del]') || e.target.closest('[data-exp]')) return;
        const r = this._rows.find(x => x.tanggal === row.dataset.date);
        if (r) this._showModal(r);
      });
    });

    el.querySelectorAll('[data-exp]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const r = this._rows.find(x => x.tanggal === btn.dataset.exp);
        if (r) this._showModal(r);
      });
    });
  }

  async _showModal(r) {
    const FULL_MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const FULL_DAYS   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const dt = new Date(r.tanggal);
    const judulTgl = `${dt.getDate()} ${FULL_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
    const judulHari = FULL_DAYS[dt.getDay()];

    const laba = Number(r.laba || 0);
    const roi  = Number(r.spend_idr) > 0 ? laba / Number(r.spend_idr) * 100 : 0;
    const totalOrders = Number(r.orders_selesai||0) + Number(r.orders_tertunda||0) + Number(r.orders_batal||0);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:720px;width:95vw;max-height:90vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="flex-shrink:0;">
          <div>
            <h2 style="font-size:17px;">${judulTgl} · ${judulHari}</h2>
          </div>
          <button class="modal-close" id="modal-close">×</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto;padding-top:12px;">

          <!-- Stat cards -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
            <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;">
              <div style="font-size:10.5px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">SPEND</div>
              <div style="font-size:16px;font-weight:700;">${rp(r.spend_idr)}</div>
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

          <!-- Orders summary bar -->
          <div id="modal-order-bar" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f9fafb;border-radius:8px;margin-bottom:14px;font-size:12.5px;flex-wrap:wrap;">
            <span style="font-weight:600;">${totalOrders} orders →</span>
            <span style="color:#16a34a;">Selesai <span id="m-selesai" style="font-weight:700;">${r.orders_selesai}</span></span>
            <span style="color:#f59e0b;">Diproses <span id="m-diproses" style="font-weight:700;">…</span></span>
            <span style="color:#9ca3af;">Belum Dibayar <span id="m-unpaid" style="font-weight:700;">…</span></span>
            <span style="color:#ef4444;">Dibatalkan <span id="m-batal" style="font-weight:700;">${r.orders_batal||0}</span></span>
          </div>

          <!-- Tabs -->
          <div style="display:flex;gap:0;border-bottom:2px solid #e5e7eb;margin-bottom:0;">
            ${['Top Komisi','Top Penjualan','Top Produk'].map((t,i)=>
              `<button class="modal-tab${i===0?' modal-tab-active':''}" data-tab="${i}" style="padding:8px 16px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;color:${i===0?'#dc2626':'#6b7280'};border-bottom:${i===0?'2px solid #dc2626':'2px solid transparent'};margin-bottom:-2px;">${t}</button>`
            ).join('')}
            <span style="margin-left:auto;padding:8px 14px;font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:0.05em;">TOP 30</span>
          </div>

          <!-- Tab panels -->
          <div id="modal-tab-content" style="min-height:200px;">
            <div class="loading" style="padding:32px;text-align:center;">Memuat data produk…</div>
          </div>

        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // Tab switching
    let activeTab = 0;
    let topData = null;

    const renderTabContent = (data, tab) => {
      const lists = [data.top_komisi, data.top_penjualan, data.top_produk];
      const rows = lists[tab] || [];
      const noData = rows.length === 0 || (rows.length === 1 && rows[0].nama_produk === '—');
      const content = overlay.querySelector('#modal-tab-content');

      if (noData) {
        content.innerHTML = `<div class="empty" style="padding:40px;text-align:center;color:#9ca3af;">
          Tidak ada data produk.<br>
          <span style="font-size:12px;">Upload ulang Shopee CSV yang menyertakan kolom Product Name.</span>
        </div>`;
        return;
      }

      content.innerHTML = `<div class="table-wrap">
        <table class="data-table" style="font-size:12px;">
          <thead><tr>
            <th style="width:28px;">#</th>
            <th>PRODUK</th>
            <th>TOKO</th>
            <th style="text-align:right;">QTY</th>
            <th style="text-align:right;">PENJUALAN</th>
            <th style="text-align:right;color:#10b981;">KOMISI</th>
          </tr></thead>
          <tbody>
            ${rows.map((p, i) => `<tr>
              <td style="color:#9ca3af;font-weight:700;">${i+1}</td>
              <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.nama_produk}">${p.nama_produk}</td>
              <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6b7280;" title="${p.nama_toko||''}">${p.nama_toko||'—'}</td>
              <td style="text-align:right;">${num(p.qty)}</td>
              <td style="text-align:right;">${rp(p.penjualan)}</td>
              <td style="text-align:right;color:#10b981;font-weight:600;">${rp(p.komisi)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    };

    // Load top products
    try {
      const qs = typeof filterQS === 'function' ? filterQS() : '';
      topData = await apiFetch(`/dashboard/top-products?tanggal=${r.tanggal}${qs}`);

      // Update order bar with actual per-status counts
      if (topData) {
        const mDip = overlay.querySelector('#m-diproses');
        const mUnp = overlay.querySelector('#m-unpaid');
        const mBat = overlay.querySelector('#m-batal');
        const mSel = overlay.querySelector('#m-selesai');
        if (mDip) mDip.textContent = num(topData.orders_diproses);
        if (mUnp) mUnp.textContent = num(topData.orders_tertunda);
        if (mBat) mBat.textContent = num(topData.orders_batal);
        if (mSel) mSel.textContent = num(topData.orders_selesai);
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
          const active = i === activeTab;
          b.style.color = active ? '#dc2626' : '#6b7280';
          b.style.borderBottom = active ? '2px solid #dc2626' : '2px solid transparent';
        });
        if (topData) renderTabContent(topData, activeTab);
      });
    });
  }

  destroy() {}
}
