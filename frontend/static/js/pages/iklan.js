import { apiFetch, getToken } from '../api.js';
import { filterQS } from '../filter-state.js';

const rp  = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const num = n => n != null ? Number(n).toLocaleString('id-ID') : '—';
const pct = n => n != null
  ? (Number(n) >= 0 ? '+' : '') + Number(n).toFixed(1) + '%'
  : '—';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
}
function todayStr()    { return new Date().toISOString().split('T')[0]; }
function firstOfMonth(){ const n=new Date(); return new Date(n.getFullYear(),n.getMonth(),1).toISOString().split('T')[0]; }

const TAHAP_LABELS = { pra_filter:'Pra Filter', filter:'Filter', fix_scale_up:'Fix / Scale Up', off:'Off' };
const TAHAP_KEYS   = ['pra_filter','filter','fix_scale_up','off'];

async function _doExport(url, defaultName) {
  const token = getToken();
  const res   = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || res.statusText); }
  const blob = await res.blob();
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  const cd   = res.headers.get('Content-Disposition') || '';
  const m    = cd.match(/filename="?([^"]+)"?/);
  a.download = m ? m[1] : defaultName;
  a.click();
  URL.revokeObjectURL(a.href);
}

export class IklanPage {
  constructor(container) {
    this.container = container;
    this.dari    = firstOfMonth();
    this.sampai  = todayStr();
    this._rows   = [];
    this._search = '';
    this._tahap  = 'all';
    this._status = 'all';
    this._boundClose = this._closePanels.bind(this);
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Iklan</h1>
          <p>Pantau performa dan tahap setiap iklan. Klik baris untuk rincian harian & breakdown.</p>
        </div>
        <div class="page-header-right" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
          <div style="position:relative;">
            <button id="btn-export" class="btn btn-sm" style="display:flex;align-items:center;gap:5px;font-size:12px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div id="export-menu" style="display:none;position:absolute;top:calc(100% + 4px);right:0;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.14);z-index:400;min-width:200px;padding:4px 0;white-space:nowrap;">
              ${[
                ['pra',         'PRA FILTER ADV'],
                ['harian',      'LAP HARIAN'],
                ['---',         ''],
                ['off-fix',     'OFF FIX Meta'],
                ['filter',      'FILTER Meta'],
                ['filter-gambar','FILTER Meta GAMBAR'],
                ['fix',         'FIX Meta'],
                ['off',         'OFF Filter Meta'],
              ].map(([k,l]) => k === '---'
                ? `<div style="height:1px;background:var(--border);margin:3px 0;"></div>`
                : `<div class="export-item" data-key="${k}" style="padding:8px 14px;font-size:12.5px;cursor:pointer;">${l}</div>`
              ).join('')}
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="date" id="inp-dari"   class="form-input" style="width:135px;font-size:12px;" value="${this.dari}">
            <span style="color:var(--text-muted);">–</span>
            <input type="date" id="inp-sampai" class="form-input" style="width:135px;font-size:12px;" value="${this.sampai}">
            <button class="btn btn-primary" id="btn-terapkan" style="font-size:12px;padding:7px 14px;">Terapkan</button>
          </div>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;

    // date
    this.container.querySelector('#btn-terapkan').addEventListener('click', () => {
      this.dari   = this.container.querySelector('#inp-dari').value;
      this.sampai = this.container.querySelector('#inp-sampai').value;
      this._load();
    });

    // export
    const exportBtn  = this.container.querySelector('#btn-export');
    const exportMenu = this.container.querySelector('#export-menu');
    exportBtn.addEventListener('click', e => {
      e.stopPropagation();
      const open = exportMenu.style.display !== 'none';
      this._closePanels();
      exportMenu.style.display = open ? 'none' : 'block';
    });
    exportMenu.querySelectorAll('.export-item').forEach(item => {
      item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-muted)');
      item.addEventListener('mouseleave', () => item.style.background = '');
      item.addEventListener('click', e => {
        e.stopPropagation();
        exportMenu.style.display = 'none';
        this._export(item.dataset.key);
      });
    });
    exportMenu.addEventListener('click', e => e.stopPropagation());

    document.addEventListener('click', this._boundClose);
    await this._load();
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';
    try {
      const qs   = filterQS ? filterQS() : '';
      const data = await apiFetch(
        `/dashboard/campaigns?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}${qs}`
      );
      this._rows = data?.campaigns || [];
      this._renderContent(el);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _renderContent(el) {
    const counts = { all: this._rows.length };
    TAHAP_KEYS.forEach(k => { counts[k] = this._rows.filter(r => r.tahap === k).length; });
    const cAktif = this._rows.filter(r => r.status === 'ACTIVE').length;
    const cOff   = this._rows.filter(r => r.status !== 'ACTIVE').length;

    const visible = this._rows.filter(r => {
      const s      = this._search.toLowerCase();
      const matchS = !s || (r.nama_campaign||'').toLowerCase().includes(s) || (r.tag_link||'').toLowerCase().includes(s);
      const matchT = this._tahap === 'all' || r.tahap === this._tahap;
      const matchSt = this._status === 'all'
        || (this._status === 'active' && r.status === 'ACTIVE')
        || (this._status === 'off'    && r.status !== 'ACTIVE');
      return matchS && matchT && matchSt;
    });

    const tSpend  = visible.reduce((s,r) => s + Number(r.spend_idr||0), 0);
    const tKomisi = visible.reduce((s,r) => s + Number(r.komisi||0), 0);
    const tLaba   = visible.reduce((s,r) => s + Number(r.laba||0), 0);
    const tClM    = visible.reduce((s,r) => s + Number(r.clicks_meta||0), 0);
    const tClS    = visible.reduce((s,r) => s + Number(r.clicks_shopee||0), 0);
    const tOrd    = visible.reduce((s,r) => s + Number(r.orders||0), 0);
    const tRoi    = tSpend > 0 ? tLaba / tSpend * 100 : null;
    const tCpc    = tClM  > 0 ? tSpend / tClM : null;
    const tEpc    = tClS  > 0 ? tKomisi / tClS : null;

    const TAHAP_DEFS = [
      { key:'all',          label:`Semua (${counts.all})` },
      { key:'pra_filter',   label:`Pra Filter (${counts.pra_filter})` },
      { key:'filter',       label:`Filter (${counts.filter})` },
      { key:'fix_scale_up', label:`Fix/Scale Up (${counts.fix_scale_up})` },
      { key:'off',          label:`Off (${counts.off})` },
    ];

    const tPlus5   = tSpend * 1.05;
    const tPctKlik = tClM > 0 ? tClS / tClM * 100 : null;

    const rowHtml = (r, i) => {
      const spend   = Number(r.spend_idr || 0);
      const plus5   = spend * 1.05;
      const profit  = Number(r.laba || 0);
      const roi     = r.roi_persen != null ? Number(r.roi_persen) : null;
      const clM     = Number(r.clicks_meta || 0);
      const clS     = Number(r.clicks_shopee || 0);
      const pctKlik = clM > 0 ? clS / clM * 100 : null;
      const epc     = clS > 0 ? Number(r.komisi||0) / clS : null;
      const komisi0 = Number(r.komisi||0) === 0;
      return `<tr class="iklan-row" data-id="${r.id}" style="cursor:pointer;">
        <td style="color:var(--text-muted);font-size:12px;text-align:center;width:32px;">${i+1}</td>
        <td style="min-width:200px;">
          <div style="font-weight:600;font-size:13px;color:#2563eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;" title="${r.nama_campaign}">${r.nama_campaign}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Meta</div>
        </td>
        <td>
          <span class="badge ${r.status==='ACTIVE'?'badge-green':'badge-gray'}" style="font-size:11px;">
            ${r.status==='ACTIVE'?'Aktif':'Off'}
          </span>
        </td>
        <td style="min-width:130px;">
          <button class="tahap-btn" data-id="${r.id}" data-tahap="${r.tahap||'pra_filter'}"
            style="display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);cursor:pointer;font-size:12px;font-weight:600;color:var(--text);">
            <span>${TAHAP_LABELS[r.tahap]||'Pra Filter'}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </td>
        <td style="min-width:110px;">
          ${r.tag_link
            ? `<span style="font-size:11.5px;padding:2px 8px;background:#f0fdf4;color:#16a34a;border-radius:4px;border:1px solid #bbf7d0;white-space:nowrap;">${r.tag_link}</span>`
            : '<span style="color:var(--text-muted);font-size:12px;">—</span>'}
        </td>
        <td style="text-align:center;">${r.hari||0}</td>
        <td style="white-space:nowrap;">${rp(spend)}</td>
        <td style="white-space:nowrap;color:var(--text-muted);">${rp(Math.round(plus5))}</td>
        <td style="text-align:center;">${num(r.orders)}</td>
        <td style="color:#10b981;font-weight:500;white-space:nowrap;">${komisi0?'<span style="color:var(--text-muted);">Rp 0</span>':rp(Math.round(Number(r.komisi)))}</td>
        <td style="font-weight:600;color:${profit>=0?'#16a34a':'#dc2626'};white-space:nowrap;">${profit>=0?'+':'-'}${rp(Math.abs(Math.round(profit)))}</td>
        <td style="font-weight:600;color:${roi!=null&&roi>=0?'#16a34a':'#dc2626'};white-space:nowrap;">${roi!=null?pct(roi):'—'}</td>
        <td style="white-space:nowrap;">${num(clM)}</td>
        <td style="white-space:nowrap;">${num(clS)}</td>
        <td style="white-space:nowrap;${pctKlik!=null&&pctKlik<10?'color:#dc2626;':''}">${pctKlik!=null?pctKlik.toFixed(1)+'%':'—'}</td>
        <td style="white-space:nowrap;">${r.cpc!=null ? rp(Math.round(Number(r.cpc))) : '—'}</td>
        <td style="white-space:nowrap;">${epc!=null ? rp(Math.round(epc)) : '—'}</td>
        <td style="padding:4px;width:36px;text-align:center;">
          <button class="btn btn-sm catatan-btn" data-catatan-id="${r.id}"
            style="padding:2px 6px;position:relative;" title="${r.catatan ? r.catatan : 'Tambah catatan'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="${r.catatan?'#2563eb':'currentColor'}" stroke-width="2" width="13" height="13"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            ${r.catatan ? '<span style="position:absolute;top:1px;right:1px;width:6px;height:6px;border-radius:50%;background:#2563eb;"></span>' : ''}
          </button>
        </td>
      </tr>`;
    };

    const totalRow = `<tr style="font-weight:700;background:var(--bg-muted);border-top:2px solid var(--border);font-size:12px;">
      <td></td>
      <td style="font-weight:800;">TOTAL (${visible.length} iklan)</td>
      <td></td><td></td><td></td><td></td>
      <td>${rp(Math.round(tSpend))}</td>
      <td>${rp(Math.round(tPlus5))}</td>
      <td>${num(tOrd)}</td>
      <td style="color:#10b981;">${rp(Math.round(tKomisi))}</td>
      <td style="color:${tLaba>=0?'#16a34a':'#dc2626'};">${tLaba>=0?'+':'-'}${rp(Math.abs(Math.round(tLaba)))}</td>
      <td style="color:${tRoi!=null&&tRoi>=0?'#16a34a':'#dc2626'};">${tRoi!=null?pct(tRoi):'—'}</td>
      <td>${num(tClM)}</td>
      <td>${num(tClS)}</td>
      <td>${tPctKlik!=null?tPctKlik.toFixed(1)+'%':'—'}</td>
      <td>${tCpc!=null?rp(Math.round(tCpc)):'—'}</td>
      <td>${tEpc!=null?rp(Math.round(tEpc)):'—'}</td>
      <td></td>
    </tr>`;

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        <div style="position:relative;flex:1;min-width:200px;max-width:480px;">
          <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="inp-search" placeholder="Cari iklan atau tag link…" value="${this._search}"
            style="width:100%;padding:8px 12px 8px 34px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg-card);color:var(--text);box-sizing:border-box;">
        </div>
        <div class="filter-tabs" style="flex-shrink:0;">
          <button class="filter-tab ${this._status==='all'?'active':''}" data-st="all">Semua (${this._rows.length})</button>
          <button class="filter-tab ${this._status==='active'?'active':''}" data-st="active">Aktif (${cAktif})</button>
          <button class="filter-tab ${this._status==='off'?'active':''}" data-st="off">Off (${cOff})</button>
        </div>
      </div>

      <div class="filter-tabs" style="margin-bottom:12px;">
        ${TAHAP_DEFS.map(t=>`<button class="filter-tab${this._tahap===t.key?' active':''}" data-t="${t.key}">${t.label}</button>`).join('')}
      </div>

      <div class="card" style="padding:0;overflow:hidden;">
        <div style="overflow-x:auto;">
          <table class="data-table" style="font-size:12.5px;min-width:1200px;">
            <thead><tr>
              <th style="width:32px;text-align:center;">#</th>
              <th style="min-width:200px;">CAMPAIGN</th>
              <th>STATUS</th>
              <th style="min-width:130px;">TAHAP</th>
              <th style="min-width:110px;">TAG LINK 2</th>
              <th style="text-align:center;">HARI</th>
              <th>SPEND</th>
              <th style="white-space:nowrap;">(+) 5%</th>
              <th style="text-align:center;">#</th>
              <th>KOMISI</th>
              <th>PROFIT</th>
              <th style="white-space:nowrap;">(%) PROFIT</th>
              <th style="white-space:nowrap;">KLIK FP</th>
              <th style="white-space:nowrap;">KLIK SHOPEE</th>
              <th style="white-space:nowrap;">(%) KLIK</th>
              <th style="white-space:nowrap;">CPC FP</th>
              <th style="white-space:nowrap;">KOMISI/KLIK SHP</th>
              <th style="width:36px;"></th>
            </tr></thead>
            <tbody>
              ${visible.length===0
                ? `<tr><td colspan="18" class="empty">Tidak ada data iklan.</td></tr>`
                : visible.map(rowHtml).join('') + totalRow}
            </tbody>
          </table>
        </div>
      </div>`;

    // Search
    el.querySelector('#inp-search')?.addEventListener('input', e => {
      this._search = e.target.value; this._renderContent(el);
    });

    // Status tabs
    el.querySelectorAll('[data-st]').forEach(btn => {
      btn.addEventListener('click', () => { this._status = btn.dataset.st; this._renderContent(el); });
    });

    // Tahap tabs
    el.querySelectorAll('[data-t]').forEach(btn => {
      btn.addEventListener('click', () => { this._tahap = btn.dataset.t; this._renderContent(el); });
    });

    // Tahap dropdown per baris
    el.querySelectorAll('.tahap-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('.tahap-panel').forEach(p => p.remove());
        const id = btn.dataset.id, curTahap = btn.dataset.tahap;
        const rect = btn.getBoundingClientRect();
        const panel = document.createElement('div');
        panel.className = 'tahap-panel';
        panel.style.cssText = `position:fixed;top:${rect.bottom+4}px;left:${rect.left}px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.18);z-index:9999;min-width:160px;padding:4px 0;`;
        TAHAP_KEYS.forEach(key => {
          const isActive = key === curTahap;
          const item = document.createElement('div');
          item.style.cssText = `padding:8px 14px;cursor:pointer;font-size:12.5px;font-weight:500;display:flex;align-items:center;justify-content:space-between;gap:8px;${isActive?'background:#fef2f2;color:#dc2626;':'color:#111827;'}`;
          item.innerHTML = `<span>${TAHAP_LABELS[key]}</span>${isActive?'<span style="font-size:10px;font-weight:700;padding:1px 5px;background:#dc2626;color:#fff;border-radius:3px;">AKTIF</span>':''}`;
          item.addEventListener('mouseenter', () => { if(!isActive) item.style.background='#f9fafb'; });
          item.addEventListener('mouseleave', () => { if(!isActive) item.style.background=''; });
          item.addEventListener('click', ev => {
            ev.stopPropagation(); panel.remove();
            if (key !== curTahap) {
              const r = this._rows.find(x => x.id === id);
              if (r) this._confirmTahap(r, key, el);
            }
          });
          panel.appendChild(item);
        });
        document.body.appendChild(panel);
        panel.addEventListener('click', e => e.stopPropagation());
      });
    });

    // Catatan button
    el.querySelectorAll('.catatan-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const r = this._rows.find(x => x.id === btn.dataset.catatanId);
        if (r) this._showCatatanPopup(r, btn, el);
      });
    });

    // Klik baris → modal
    el.querySelectorAll('.iklan-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        const r = this._rows.find(x => x.id === row.dataset.id);
        if (r) this._showModal(r);
      });
    });
  }

  _confirmTahap(r, newTahap, tableEl) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px;">
        <div class="modal-body" style="padding:28px 24px 24px;">
          <h2 style="font-size:16px;font-weight:700;margin:0 0 8px;">Ubah tahap iklan?</h2>
          <p style="font-size:13px;color:var(--text-muted);margin:0 0 16px;">Iklan akan dipindahkan ke <strong>${TAHAP_LABELS[newTahap]}</strong>.</p>
          <div style="padding:10px 14px;background:var(--bg-muted);border:1px solid var(--border);border-radius:6px;font-size:13px;font-weight:500;margin-bottom:20px;">${r.nama_campaign}</div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button class="btn" id="cfm-batal">Batal</button>
            <button class="btn btn-primary" id="cfm-ok" style="background:#dc2626;border-color:#dc2626;">Ya, ubah</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#cfm-batal').addEventListener('click', close);
    overlay.addEventListener('click', e => { if(e.target===overlay) close(); });
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
        const el = this.container.querySelector('#content');
        this._renderContent(el);
      } catch(e) { alert(e.message || 'Gagal mengubah tahap.'); }
    });
  }

  _showCatatanPopup(r, btn, tableEl) {
    document.querySelectorAll('.catatan-popup').forEach(p => p.remove());
    const rect = btn.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'catatan-popup';
    popup.style.cssText = `position:fixed;top:${rect.bottom+6}px;right:${window.innerWidth-rect.right}px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,0.18);z-index:9999;width:300px;padding:14px;`;
    popup.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Catatan Iklan</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.nama_campaign}</div>
      <textarea id="popup-catatan" placeholder="Tulis catatan…" rows="4"
        style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;resize:vertical;background:var(--bg-muted);color:var(--text);font-family:inherit;outline:none;">${r.catatan||''}</textarea>
      <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:10px;">
        <button id="popup-hapus" class="btn btn-sm" style="font-size:12px;color:#dc2626;border-color:#fca5a5;">Hapus</button>
        <button id="popup-batal" class="btn btn-sm" style="font-size:12px;">Batal</button>
        <button id="popup-simpan" class="btn btn-primary btn-sm" style="font-size:12px;">Simpan</button>
      </div>`;
    document.body.appendChild(popup);
    popup.addEventListener('click', e => e.stopPropagation());

    const close = () => popup.remove();
    popup.querySelector('#popup-batal').addEventListener('click', close);
    popup.querySelector('#popup-hapus').addEventListener('click', async () => {
      close();
      try {
        await apiFetch(`/dashboard/campaigns/${r.id}/catatan`, {
          method: 'PATCH', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ catatan: null }),
        });
        const row = this._rows.find(x => x.id === r.id);
        if (row) row.catatan = null;
        this._renderContent(tableEl);
      } catch(e) { alert(e.message || 'Gagal menghapus catatan.'); }
    });
    popup.querySelector('#popup-simpan').addEventListener('click', async () => {
      const val = popup.querySelector('#popup-catatan').value.trim();
      close();
      try {
        await apiFetch(`/dashboard/campaigns/${r.id}/catatan`, {
          method: 'PATCH', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ catatan: val || null }),
        });
        const row = this._rows.find(x => x.id === r.id);
        if (row) row.catatan = val || null;
        this._renderContent(tableEl);
      } catch(e) { alert(e.message || 'Gagal menyimpan catatan.'); }
    });

    const outsideClick = e => {
      if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', outsideClick); }
    };
    setTimeout(() => document.addEventListener('click', outsideClick), 10);
    popup.querySelector('#popup-catatan').focus();
  }

  async _showModal(r) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:860px;width:96vw;max-height:90vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="flex-shrink:0;">
          <div>
            <h2 style="font-size:15px;">${r.nama_campaign}</h2>
            <p style="font-size:11px;color:var(--text-muted);">
              ${r.tag_link ? `Tag: <strong>${r.tag_link}</strong> · ` : ''}
              ${TAHAP_LABELS[r.tahap]||'Pra Filter'}
              ${r.catatan ? `· <span style="color:#2563eb;">📝 ${r.catatan.slice(0,40)}${r.catatan.length>40?'…':''}</span>` : ''}
            </p>
          </div>
          <button class="modal-close" id="modal-close">×</button>
        </div>
        <div style="display:flex;gap:0;border-bottom:2px solid var(--border);flex-shrink:0;padding:0 20px;">
          ${['Harian','Penempatan','Platform','Usia & Gender'].map((t,i)=>
            `<button class="camp-modal-tab${i===0?' active':''}" data-tab="${i}"
              style="padding:10px 16px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;
              color:${i===0?'#dc2626':'var(--text-muted)'};
              border-bottom:${i===0?'2px solid #dc2626':'2px solid transparent'};margin-bottom:-2px;white-space:nowrap;">${t}</button>`
          ).join('')}
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto;padding:16px 20px;">
          <div id="modal-content"><div class="loading">Memuat…</div></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });

    let harianData = null;
    const renderTab = async tab => {
      const content = overlay.querySelector('#modal-content');
      if (tab === 0) {
        if (!harianData) {
          content.innerHTML = '<div class="loading">Memuat…</div>';
          try { harianData = await apiFetch(`/dashboard/campaigns/${r.id}/harian`); }
          catch(e) { content.innerHTML=`<div class="alert alert-error">${e.message}</div>`; return; }
        }
        this._renderHarianTab(content, harianData);
      } else {
        this._renderBreakdownTab(content, tab, r);
      }
    };

    overlay.querySelectorAll('.camp-modal-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = Number(btn.dataset.tab);
        overlay.querySelectorAll('.camp-modal-tab').forEach((b,i) => {
          const on = i === tab;
          b.style.color = on ? '#dc2626' : 'var(--text-muted)';
          b.style.borderBottom = on ? '2px solid #dc2626' : '2px solid transparent';
        });
        renderTab(tab);
      });
    });
    renderTab(0);
  }

  _renderHarianTab(el, data) {
    const laba = Number(data.total_laba||0);
    const roi  = Number(data.roi_persen||0);
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">
        ${[
          ['TOTAL BIAYA',  rp(data.total_biaya),  ''],
          ['TOTAL KOMISI', rp(data.total_komisi), '#10b981'],
          ['LABA',         (laba>=0?'+':'')+rp(Math.abs(Math.round(laba))), laba>=0?'#16a34a':'#dc2626'],
          ['ROI',          (roi>=0?'+':'')+roi.toFixed(1)+'%', roi>=0?'#16a34a':'#dc2626'],
        ].map(([label,val,color])=>`
          <div style="padding:12px 16px;border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:10px;font-weight:700;color:${color||'var(--text-muted)'};text-transform:uppercase;margin-bottom:6px;">${label}</div>
            <div style="font-size:18px;font-weight:700;color:${color||'var(--text)'};">${val}</div>
          </div>`).join('')}
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table" style="font-size:12px;">
          <thead><tr>
            <th>TANGGAL</th><th>BIAYA</th><th>CPC</th><th>KLIK META</th><th>KLIK SHOPEE</th><th>ORDER</th><th>KOMISI</th><th>EPC</th><th>LABA</th><th>ROI</th>
          </tr></thead>
          <tbody>
            ${(data.harian||[]).length===0
              ? `<tr><td colspan="10" class="empty">Belum ada data.</td></tr>`
              : (data.harian||[]).map(h => {
                  const labah = h.laba!=null?Number(h.laba):null;
                  const roih  = h.roi_persen!=null?Number(h.roi_persen):null;
                  const epch  = h.clicks_shopee&&h.clicks_shopee>0&&h.komisi!=null ? Number(h.komisi)/Number(h.clicks_shopee) : null;
                  return `<tr>
                    <td style="font-weight:600;color:#2563eb;white-space:nowrap;">${fmtDate(h.tanggal)}</td>
                    <td>${rp(h.spend_idr)}</td>
                    <td>${h.cpc!=null?rp(Math.round(h.cpc)):'—'}</td>
                    <td>${num(h.clicks_meta)}</td>
                    <td>${h.clicks_shopee!=null?num(h.clicks_shopee):'—'}</td>
                    <td>${h.orders!=null?num(h.orders):'0'}</td>
                    <td style="color:${h.komisi!=null?'#10b981':'var(--text-muted)'};">${h.komisi!=null?rp(Math.round(h.komisi)):'menunggu'}</td>
                    <td>${epch!=null?rp(Math.round(epch)):'—'}</td>
                    <td style="font-weight:600;color:${labah!=null?(labah>=0?'#16a34a':'#dc2626'):'var(--text-muted)'};">${labah!=null?(labah>=0?'+':'-')+rp(Math.abs(Math.round(labah))):'—'}</td>
                    <td style="font-weight:600;color:${roih!=null?(roih>=0?'#16a34a':'#dc2626'):'var(--text-muted)'};">${roih!=null?pct(roih):'—'}</td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  async _renderBreakdownTab(el, tab, r) {
    const TIPES  = ['','placement','platform','age_gender'];
    const LABELS = ['','Penempatan','Platform','Usia & Gender'];
    el.innerHTML = '<div class="loading">Memuat…</div>';
    try {
      const data = await apiFetch(`/dashboard/campaigns/${r.id}/breakdown?tipe=${TIPES[tab]}`);
      if (!data||data.length===0) {
        el.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-muted);">
          <div style="font-size:14px;font-weight:600;margin-bottom:8px;">Data ${LABELS[tab]} belum tersedia</div>
          <div style="font-size:12px;">Upload CSV breakdown Meta Ads di halaman Upload Data Harian.</div>
        </div>`;
        return;
      }
      const totalSpend = data.reduce((s,x)=>s+x.spend_idr,0);
      el.innerHTML = `<div style="overflow-x:auto;"><table class="data-table" style="font-size:12px;">
        <thead><tr><th>${LABELS[tab].toUpperCase()}</th><th>BIAYA</th><th>% BIAYA</th><th>IMPRESI</th><th>KLIK</th><th>CPM</th><th>CPC</th><th>CTR</th></tr></thead>
        <tbody>${data.map(row => {
          const barW = totalSpend>0?Math.round(row.spend_idr/totalSpend*100):0;
          return `<tr>
            <td style="font-weight:600;">${row.nilai}</td>
            <td><div style="display:flex;align-items:center;gap:8px;">
              <div style="width:60px;height:4px;background:var(--bg-muted);border-radius:2px;flex-shrink:0;">
                <div style="width:${barW}%;height:100%;background:#dc2626;border-radius:2px;"></div>
              </div>${rp(Math.round(row.spend_idr))}</div></td>
            <td>${row.persen_spend.toFixed(1)}%</td>
            <td>${num(row.impressions)}</td>
            <td>${num(row.clicks)}</td>
            <td>${row.cpm_idr!=null?rp(Math.round(row.cpm_idr)):'—'}</td>
            <td>${row.cpc_idr!=null?rp(Math.round(row.cpc_idr)):'—'}</td>
            <td>${row.ctr_persen!=null?row.ctr_persen.toFixed(2)+'%':'—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
    } catch(e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  async _export(key) {
    const qs  = filterQS ? filterQS() : '';
    const base = `/api/export`;
    const map  = {
      pra:           [`${base}/laporan-pra-filter`,     'PRA FILTER ADV.xlsx'],
      harian:        [`${base}/laporan-harian`,          'LAP HARIAN.xlsx'],
      'off-fix':     [`${base}/laporan-off-fix`,         'OFF FIX META.xlsx'],
      filter:        [`${base}/laporan-filter`,          'FILTER META.xlsx'],
      'filter-gambar':[`${base}/laporan-filter-gambar`,  'FILTER META GAMBAR.xlsx'],
      fix:           [`${base}/laporan-fix`,             'FIX META.xlsx'],
      off:           [`${base}/laporan-off`,             'OFF FILTER META.xlsx'],
    };
    const [url, name] = map[key] || [];
    if (!url) return;
    try {
      await _doExport(`${url}?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}${qs}`, name);
    } catch(e) { alert('Export gagal: ' + e.message); }
  }

  _closePanels() {
    document.querySelectorAll('.tahap-panel').forEach(p => p.remove());
    document.querySelectorAll('.catatan-popup').forEach(p => p.remove());
    const m = this.container.querySelector('#export-menu');
    if (m) m.style.display = 'none';
  }

  destroy() {
    document.removeEventListener('click', this._boundClose);
  }
}
