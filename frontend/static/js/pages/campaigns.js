import { apiFetch } from '../api.js';
import { filterQS } from '../filter-state.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const num = n => n != null ? Number(n).toLocaleString('id-ID') : '-';
const pctFmt = n => Number(n || 0).toFixed(1).replace('.', ',') + '%';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
function fmtDate(d) {
  const dt = new Date(d);
  return `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
}

export class CampaignsPage {
  constructor(container) {
    this.container = container;
    this._rows = [];
    this._filter = 'all';
    this._search = '';
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kampanye Meta</h1>
          <p>Iklan dikelompokkan per tag link. Klik nama iklan untuk lihat rincian harian.</p>
        </div>
        <div class="page-header-right">
          <div class="date-range-display" id="tz-label"></div>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;
    await this._load();
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';
    try {
      const qs = filterQS ? filterQS() : '';
      const data = await apiFetch(`/dashboard/campaigns${qs ? '?' + qs.slice(1) : ''}`);
      if (!data) { el.innerHTML = '<div class="empty">Tidak ada data kampanye.</div>'; return; }
      this._rows = data.campaigns || [];
      this._renderTable(el);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _renderTable(el) {
    const rows = this._rows.filter(r => {
      const s = this._search.toLowerCase();
      const matchS = !s || r.nama_campaign?.toLowerCase().includes(s) || r.tag_link?.toLowerCase().includes(s);
      const matchF = this._filter === 'all'
        || (this._filter === 'active' && r.status === 'ACTIVE')
        || (this._filter === 'off'    && r.status !== 'ACTIVE');
      return matchS && matchF;
    });

    const cAll    = this._rows.length;
    const cActive = this._rows.filter(r => r.status === 'ACTIVE').length;
    const cOff    = this._rows.filter(r => r.status !== 'ACTIVE').length;

    const tSpend  = rows.reduce((s, r) => s + Number(r.spend_idr || 0), 0);
    const tKomisi = rows.reduce((s, r) => s + Number(r.komisi || 0), 0);
    const tLaba   = rows.reduce((s, r) => s + Number(r.laba || 0), 0);
    const tClM    = rows.reduce((s, r) => s + Number(r.clicks_meta || 0), 0);
    const tClS    = rows.reduce((s, r) => s + Number(r.clicks_shopee || 0), 0);
    const tOrd    = rows.reduce((s, r) => s + Number(r.orders || 0), 0);
    const tPenj   = rows.reduce((s, r) => s + Number(r.penjualan || 0), 0);
    const tRoi    = tSpend > 0 ? tLaba / tSpend * 100 : 0;
    const tCpc    = tClM > 0 ? tSpend / tClM : 0;

    const arr = k => `<span style="font-size:10px;color:#d1d5db;">↕</span>`;

    const rowHtml = (r, i) => {
      const laba = Number(r.laba || 0);
      const roi  = Number(r.roi_persen || 0);
      const komisi0 = Number(r.komisi || 0) === 0;
      return `<tr class="camp-row" data-id="${r.id}" style="cursor:pointer;">
        <td style="color:#9ca3af;font-size:12px;">${i + 1}</td>
        <td style="min-width:200px;">
          <div style="font-weight:600;font-size:13px;color:#1e40af;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;" title="${r.nama_campaign}">${r.nama_campaign}</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:1px;">Meta</div>
        </td>
        <td>
          <span class="badge ${r.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}" style="font-size:11px;">
            ${r.status === 'ACTIVE' ? 'Aktif' : 'Off'}
          </span>
        </td>
        <td>${r.tag_link ? `<span class="tag-link" style="font-size:11px;">${r.tag_link}</span>` : '<span style="color:#d1d5db;">—</span>'}</td>
        <td style="text-align:center;">${r.hari || 0}</td>
        <td>${rp(r.spend_idr)}</td>
        <td>${r.cpc != null ? rp(r.cpc) : '<span style="color:#d1d5db;">—</span>'}</td>
        <td style="color:#9ca3af;">—</td>
        <td>${num(r.clicks_meta)}</td>
        <td>${r.clicks_shopee ? num(r.clicks_shopee) : '<span style="color:#d1d5db;">0</span>'}</td>
        <td>${r.orders ? num(r.orders) : '0'}</td>
        <td style="color:#10b981;font-weight:500;">${komisi0 ? '<span style="color:#d1d5db;">Rp 0</span>' : rp(r.komisi)}</td>
        <td style="font-weight:600;color:${laba >= 0 ? '#16a34a' : '#dc2626'};">${rp(Math.abs(laba))}${laba < 0 ? '' : ''}</td>
        <td style="font-weight:600;color:${roi >= 0 ? '#16a34a' : '#dc2626'};">${roi !== 0 ? (roi >= 0 ? '+' : '') + pctFmt(roi) : '—'}</td>
        <td style="padding:4px;">
          <button class="btn btn-sm" style="padding:2px 6px;" title="Catatan">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </button>
        </td>
      </tr>`;
    };

    const totalRow = `<tr style="font-weight:700;background:var(--bg,#f9fafb);border-top:2px solid var(--border,#e5e7eb);font-size:12.5px;">
      <td></td>
      <td style="font-weight:800;">TOTAL (${rows.length} campaign)</td>
      <td></td><td></td>
      <td></td>
      <td>${rp(tSpend)}</td>
      <td>${tCpc > 0 ? rp(Math.round(tCpc)) : '—'}</td>
      <td>—</td>
      <td>${num(tClM)}</td>
      <td>${num(tClS)}</td>
      <td>${num(tOrd)}</td>
      <td style="color:#10b981;">${rp(tKomisi)}</td>
      <td style="font-weight:700;color:${tLaba >= 0 ? '#16a34a' : '#dc2626'};">${rp(Math.abs(Math.round(tLaba)))}</td>
      <td style="font-weight:700;color:${tRoi >= 0 ? '#16a34a' : '#dc2626'};">${tRoi !== 0 ? (tRoi >= 0 ? '+' : '') + pctFmt(tRoi) : '—'}</td>
      <td></td>
    </tr>`;

    el.innerHTML = `<div class="card">
      <div class="toolbar">
        <div class="search-box" style="flex:1;max-width:560px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="inp-search" placeholder="Cari kampanye…" value="${this._search}"
            style="width:100%;padding:7px 12px 7px 32px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;">
          <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:#9ca3af;background:#f3f4f6;padding:1px 6px;border-radius:4px;">Ctrl+K</span>
        </div>
        <div class="filter-tabs">
          <button class="filter-tab ${this._filter==='all'?'active':''}" data-f="all">Semua (${cAll})</button>
          <button class="filter-tab ${this._filter==='active'?'active':''}" data-f="active">Aktif (${cActive})</button>
          <button class="filter-tab ${this._filter==='off'?'active':''}" data-f="off">Off (${cOff})</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table" style="font-size:12.5px;">
          <thead><tr>
            <th style="width:28px;">#</th>
            <th style="min-width:200px;">Campaign ${arr('nama')}</th>
            <th>Status ${arr('status')}</th>
            <th>Tag Link ${arr('tag')}</th>
            <th style="text-align:center;">Hari ${arr('hari')}</th>
            <th>Biaya ${arr('biaya')}</th>
            <th style="white-space:nowrap;">CPC Rata-rata ${arr('cpc')}</th>
            <th>Budget</th>
            <th style="white-space:nowrap;">Klik (Meta) ${arr('clm')}</th>
            <th style="white-space:nowrap;">Klik (Shopee) ${arr('cls')}</th>
            <th>Pesanan ${arr('ord')}</th>
            <th>Komisi ${arr('kom')}</th>
            <th>Laba ${arr('laba')}</th>
            <th>ROI ${arr('roi')}</th>
            <th style="width:36px;">Catatan</th>
          </tr></thead>
          <tbody>
            ${rows.length === 0
              ? `<tr><td colspan="15" class="empty">Tidak ada data kampanye.<br><span style="font-size:12px;">Upload data Meta Ads dan hubungkan taglink untuk melihat performa kampanye.</span></td></tr>`
              : rows.map(rowHtml).join('') + totalRow
            }
          </tbody>
        </table>
      </div>
    </div>`;

    el.querySelector('#inp-search')?.addEventListener('input', e => {
      this._search = e.target.value; this._renderTable(el);
    });
    el.querySelectorAll('[data-f]').forEach(btn => {
      btn.addEventListener('click', () => { this._filter = btn.dataset.f; this._renderTable(el); });
    });

    el.querySelectorAll('.camp-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const r = this._rows.find(x => x.id === row.dataset.id);
        if (r) this._showModal(r);
      });
    });
  }

  async _showModal(r) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:820px;width:96vw;max-height:90vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="flex-shrink:0;">
          <div>
            <h2 style="font-size:16px;">Data Harian - ${r.nama_campaign}</h2>
            <p style="font-size:12px;color:#9ca3af;">Performa harian grup ini - semua riwayat tanggal.</p>
          </div>
          <button class="modal-close" id="modal-close">×</button>
        </div>
        <div style="display:flex;align-items:center;gap:0;border-bottom:2px solid #e5e7eb;flex-shrink:0;padding:0 20px;">
          ${['Harian','Penempatan','Platform','Usia & Gender'].map((t,i) =>
            `<button class="camp-modal-tab${i===0?' active':''}" data-tab="${i}" style="padding:10px 16px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;color:${i===0?'#dc2626':'#6b7280'};border-bottom:${i===0?'2px solid #dc2626':'2px solid transparent'};margin-bottom:-2px;white-space:nowrap;">${t}</button>`
          ).join('')}
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto;padding:16px 20px;">
          <div id="camp-modal-content">
            <div class="loading">Memuat data harian…</div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    let activeTab = 0;
    let harianData = null;

    const renderTab = async (tab) => {
      const content = overlay.querySelector('#camp-modal-content');
      if (tab === 0) {
        if (!harianData) {
          content.innerHTML = '<div class="loading">Memuat data…</div>';
          try {
            harianData = await apiFetch(`/dashboard/campaigns/${r.id}/harian`);
          } catch (e) {
            content.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
            return;
          }
        }
        this._renderHarianTab(content, harianData);
      } else {
        this._renderBreakdownTab(content, tab, r);
      }
    };

    overlay.querySelectorAll('.camp-modal-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = Number(btn.dataset.tab);
        overlay.querySelectorAll('.camp-modal-tab').forEach((b, i) => {
          const on = i === activeTab;
          b.style.color = on ? '#dc2626' : '#6b7280';
          b.style.borderBottom = on ? '2px solid #dc2626' : '2px solid transparent';
          b.classList.toggle('active', on);
        });
        renderTab(activeTab);
      });
    });

    renderTab(0);
  }

  _renderHarianTab(el, data) {
    const laba = Number(data.total_laba || 0);
    const roi  = Number(data.roi_persen || 0);

    el.innerHTML = `
      <!-- Stat cards -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">
        <div style="padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;">
          <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">TOTAL BIAYA</div>
          <div style="font-size:18px;font-weight:700;">${rp(data.total_biaya)}</div>
        </div>
        <div style="padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;">
          <div style="font-size:10px;font-weight:700;color:#10b981;text-transform:uppercase;margin-bottom:6px;">TOTAL KOMISI</div>
          <div style="font-size:18px;font-weight:700;color:#10b981;">${rp(data.total_komisi)}</div>
        </div>
        <div style="padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;">
          <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">LABA</div>
          <div style="font-size:18px;font-weight:700;color:${laba >= 0 ? '#16a34a' : '#dc2626'};">${laba >= 0 ? '+' : ''}${rp(Math.abs(Math.round(laba)))}</div>
        </div>
        <div style="padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;">
          <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">ROI</div>
          <div style="font-size:18px;font-weight:700;color:${roi >= 0 ? '#16a34a' : '#dc2626'};">${roi >= 0 ? '+' : ''}${pctFmt(roi)}</div>
        </div>
      </div>

      <!-- Tag link info -->
      ${data.tag_link ? `<div style="font-size:12px;color:#6b7280;margin-bottom:12px;">
        <span style="font-weight:600;color:#374151;">${data.nama_campaign}</span>
        ${data.tag_link ? `· <span class="tag-link" style="font-size:11px;">${data.tag_link}</span>` : ''}
      </div>` : ''}

      <!-- Harian table -->
      <div class="table-wrap">
        <table class="data-table" style="font-size:12px;">
          <thead><tr>
            <th>TANGGAL</th>
            <th>BIAYA</th>
            <th style="white-space:nowrap;">CPC RATA-RATA</th>
            <th>BUDGET</th>
            <th style="white-space:nowrap;">KLIK (META)</th>
            <th style="white-space:nowrap;">KLIK (SHOPEE)</th>
            <th>PESANAN</th>
            <th>KOMISI</th>
            <th>LABA</th>
            <th>ROI</th>
          </tr></thead>
          <tbody>
            ${(data.harian || []).length === 0
              ? `<tr><td colspan="10" class="empty">Belum ada data.</td></tr>`
              : (data.harian || []).map(h => {
                  const labah = h.laba != null ? Number(h.laba) : null;
                  const roih  = h.roi_persen != null ? Number(h.roi_persen) : null;
                  const hasShopee = h.komisi != null;
                  return `<tr>
                    <td style="font-weight:600;color:#2563eb;white-space:nowrap;">${fmtDate(h.tanggal)}</td>
                    <td>${rp(h.spend_idr)}</td>
                    <td>${h.cpc != null ? rp(h.cpc) : '—'}</td>
                    <td style="color:#9ca3af;">—</td>
                    <td>${num(h.clicks_meta)}</td>
                    <td>${h.clicks_shopee != null ? num(h.clicks_shopee) : '<span style="color:#9ca3af;">—</span>'}</td>
                    <td>${h.orders != null ? num(h.orders) : '<span style="color:#9ca3af;">0</span>'}</td>
                    <td style="color:${hasShopee ? '#10b981' : '#9ca3af'};">
                      ${hasShopee ? rp(h.komisi) : '<span style="font-style:italic;">menunggu data</span>'}
                    </td>
                    <td style="font-weight:600;color:${labah != null ? (labah >= 0 ? '#16a34a' : '#dc2626') : '#9ca3af'};">
                      ${labah != null ? (labah >= 0 ? '+' : '') + rp(Math.abs(Math.round(labah))) : '—'}
                    </td>
                    <td style="font-weight:600;color:${roih != null ? (roih >= 0 ? '#16a34a' : '#dc2626') : '#9ca3af'};">
                      ${roih != null ? (roih >= 0 ? '+' : '') + pctFmt(roih) : '—'}
                    </td>
                  </tr>`;
                }).join('')
            }
          </tbody>
        </table>
      </div>`;
  }

  _renderBreakdownTab(el, tab, r) {
    const labels = ['', 'Penempatan', 'Platform', 'Usia & Gender'];
    el.innerHTML = `
      <div style="padding:32px;text-align:center;color:#9ca3af;">
        <div style="font-size:36px;margin-bottom:12px;">📊</div>
        <div style="font-size:14px;font-weight:600;color:#374151;margin-bottom:8px;">Data ${labels[tab]} belum tersedia</div>
        <div style="font-size:12.5px;max-width:380px;margin:0 auto;line-height:1.6;">
          Upload CSV breakdown Meta Ads (dengan kolom breakdown ${labels[tab].toLowerCase()}) untuk melihat segmentasi biaya, klik, CPC, CPM, dan CTR.
        </div>
      </div>`;
  }

  destroy() {}
}
