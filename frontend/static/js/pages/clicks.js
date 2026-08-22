import { apiFetch } from '../api.js';
import { filterQS } from '../filter-state.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const num = n => Number(n || 0).toLocaleString('id-ID');
const pct = n => Number(n || 0).toFixed(2).replace('.', ',') + '%';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

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

const CHANNEL_COLORS = {
  Instagram: '#e1306c',
  Facebook:  '#1877f2',
  TikTok:    '#010101',
  Websites:  '#059669',
  Others:    '#6b7280',
};

function channelColor(name) {
  return CHANNEL_COLORS[name] || '#6b7280';
}

export class ClicksPage {
  constructor(container) {
    this.container = container;
    const now = new Date();
    const d60 = new Date(now); d60.setDate(d60.getDate() - 60);
    this.dari = d60.toISOString().split('T')[0];
    this.sampai = now.toISOString().split('T')[0];
    this._tab = 'taglink';
    this._search = '';
    this._allTaglinks = [];
    this._allSources = [];
    this._summary = null;
    this._page = 1;
    this._perPage = 50;
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Laporan Klik</h1>
          <p>Volume click dan konversi per tag link. Klik baris untuk lihat rincian per-channel.</p>
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
    document.addEventListener('click', this._onDocClick.bind(this));
    await this._load();
  }

  _onDocClick(e) {
    const picker = this.container.querySelector('#range-picker');
    const btn = this.container.querySelector('#btn-range');
    if (picker && !picker.contains(e.target) && e.target !== btn) picker.style.display = 'none';
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
    this._load();
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';
    try {
      const qs = `tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}`;
      const [tlData, srcData] = await Promise.all([
        apiFetch(appendFilter(`/clicks/taglinks?${qs}`)),
        apiFetch(appendFilter(`/clicks/sources?${qs}`)).catch(() => null),
      ]);

      this._summary = tlData?.summary || null;
      this._allTaglinks = tlData?.taglinks || [];
      this._allSources = srcData?.sources || [];
      this._srcCount = srcData?.source_count || 0;
      this._page = 1;

      this._renderContent(el);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _renderContent(el) {
    const s = this._summary || {};
    const cr = s.cr_persen != null ? pct(s.cr_persen) : '—';

    el.innerHTML = `
      <div class="stat-grid" style="margin-bottom:14px;grid-template-columns:repeat(4,1fr);">
        <div class="stat-card">
          <div class="stat-label">TOTAL CLICK</div>
          <div class="stat-value">${num(s.total_click)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">TAG LINK</div>
          <div class="stat-value" style="color:#16a34a;">${num(s.tag_link_count)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">PESANAN</div>
          <div class="stat-value">${num(s.total_pesanan)}</div>
        </div>
        <div class="stat-card" style="background:#fff1f2;">
          <div class="stat-label">KOMISI</div>
          <div class="stat-value" style="font-size:17px;color:#dc2626;">${rp(s.total_komisi)}</div>
          <div class="stat-sub">CR ${cr}</div>
        </div>
      </div>
      <div class="filter-tabs" style="margin-bottom:10px;">
        <button class="filter-tab${this._tab === 'taglink' ? ' active' : ''}" data-t="taglink">Per Tag Link ${num(s.tag_link_count)}</button>
        <button class="filter-tab${this._tab === 'source' ? ' active' : ''}" data-t="source">Per Sumber ${this._srcCount || ''}</button>
      </div>
      <div class="card" style="padding:0;">
        <div style="padding:10px 16px;border-bottom:1px solid var(--border,#e5e7eb);display:flex;align-items:center;gap:8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="color:var(--text-muted,#9ca3af);flex-shrink:0;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="inp-search" placeholder="Cari" value="${this._search}"
            style="flex:1;border:none;outline:none;background:transparent;font-size:13px;color:var(--text,#374151);">
          <span style="font-size:11px;color:var(--text-muted,#9ca3af);background:var(--surface-alt,#f9fafb);padding:2px 7px;border-radius:4px;border:1px solid var(--border,#e5e7eb);">Ctrl + K</span>
        </div>
        <div class="table-wrap" style="overflow-x:auto;" id="click-table"></div>
      </div>
      <div id="pagination-wrap"></div>`;

    this._renderTable(el.querySelector('#click-table'));

    el.querySelectorAll('[data-t]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._tab = btn.dataset.t;
        this._page = 1;
        el.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('active', b.dataset.t === this._tab));
        this._renderTable(el.querySelector('#click-table'));
      });
    });

    const inp = el.querySelector('#inp-search');
    inp?.addEventListener('input', () => { this._search = inp.value; this._page = 1; this._renderTable(el.querySelector('#click-table')); });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); inp?.focus(); }
    }, { once: true });
  }

  _renderPagination(total) {
    const pgWrap = this.container.querySelector('#pagination-wrap');
    if (!pgWrap) return;
    const totalPages = Math.ceil(total / this._perPage);
    const tblEl = this.container.querySelector('#click-table');
    const pp = this._perPage;
    if (total === 0) { pgWrap.innerHTML = ''; return; }
    const startIdx = (this._page - 1) * this._perPage;
    const pageNums = totalPages > 1
      ? Array.from({length:totalPages},(_,i)=>i+1)
          .filter(p=>p===1||p===totalPages||Math.abs(p-this._page)<=2)
          .reduce((acc,p,i,arr)=>{if(i>0&&p-arr[i-1]>1)acc.push('…');acc.push(p);return acc;},[])
      : [];
    pgWrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 4px;margin-top:8px;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <select id="pg-size" style="padding:4px 8px;border:1px solid var(--border,#e5e7eb);border-radius:6px;font-size:12px;background:var(--bg-card,#fff);color:var(--text,#374151);cursor:pointer;">
            ${[10,20,30,50].map(n=>`<option value="${n}"${pp===n?' selected':''}>${n}</option>`).join('')}
          </select>
          <span style="font-size:12px;color:var(--text-muted,#9ca3af);">per halaman &nbsp;·&nbsp; ${startIdx+1}–${Math.min(startIdx+pp, total)} dari ${total}</span>
        </div>
        ${totalPages > 1 ? `<div style="display:flex;align-items:center;gap:4px;">
          <button id="pg-first" class="btn btn-sm" style="font-size:12px;padding:5px 10px;" ${this._page===1?'disabled':''}>«</button>
          <button id="pg-prev"  class="btn btn-sm" style="font-size:12px;padding:5px 10px;" ${this._page===1?'disabled':''}>‹</button>
          ${pageNums.map(p=>p==='…'
            ?`<span style="padding:5px 8px;font-size:12px;color:var(--text-muted,#9ca3af);">…</span>`
            :`<button class="btn btn-sm pg-num" data-pg="${p}" style="font-size:12px;padding:5px 10px;${p===this._page?'background:#dc2626;color:#fff;border-color:#dc2626;':''}">${p}</button>`
          ).join('')}
          <button id="pg-next" class="btn btn-sm" style="font-size:12px;padding:5px 10px;" ${this._page===totalPages?'disabled':''}>›</button>
          <button id="pg-last" class="btn btn-sm" style="font-size:12px;padding:5px 10px;" ${this._page===totalPages?'disabled':''}>»</button>
        </div>` : ''}
      </div>`;
    pgWrap.querySelector('#pg-size')?.addEventListener('change', e=>{ this._perPage=Number(e.target.value); this._page=1; this._renderTable(tblEl); });
    pgWrap.querySelector('#pg-first')?.addEventListener('click', ()=>{ this._page=1; this._renderTable(tblEl); });
    pgWrap.querySelector('#pg-prev') ?.addEventListener('click', ()=>{ this._page--; this._renderTable(tblEl); });
    pgWrap.querySelector('#pg-next') ?.addEventListener('click', ()=>{ this._page++; this._renderTable(tblEl); });
    pgWrap.querySelector('#pg-last') ?.addEventListener('click', ()=>{ this._page=totalPages; this._renderTable(tblEl); });
    pgWrap.querySelectorAll('.pg-num').forEach(btn=>{ btn.addEventListener('click',()=>{ this._page=Number(btn.dataset.pg); this._renderTable(tblEl); }); });
  }

  _renderTable(el) {
    if (this._tab === 'source') {
      const rows = this._allSources;
      if (rows.length === 0) {
        el.innerHTML = `<div class="empty" style="padding:32px;text-align:center;">Belum ada data sumber.<br><span style="font-size:12px;">Upload ulang Shopee Click CSV untuk mengisi data per channel.</span></div>`;
        this._renderPagination(0);
        return;
      }
      const totalPages = Math.ceil(rows.length / this._perPage);
      if (this._page > totalPages) this._page = Math.max(1, totalPages);
      const pageRows = rows.slice((this._page-1)*this._perPage, this._page*this._perPage);
      el.innerHTML = `
        <table class="data-table" style="font-size:12.5px;">
          <thead><tr>
            <th style="min-width:160px;">SUMBER</th>
            <th style="text-align:right;">CLICK</th>
            <th style="text-align:right;">SHARE</th>
            <th style="text-align:right;">KOMISI</th>
          </tr></thead>
          <tbody>
            ${pageRows.map(r => `
              <tr>
                <td><span style="font-weight:600;color:${channelColor(r.sumber)};">${r.sumber}</span></td>
                <td style="text-align:right;">${num(r.click)}</td>
                <td style="text-align:right;color:var(--text-muted,#6b7280);">${pct(r.share_persen)}</td>
                <td style="text-align:right;">${rp(Math.round(Number(r.komisi)))}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      this._renderPagination(rows.length);
    } else {
      const s = this._search.toLowerCase();
      const filtered = s
        ? this._allTaglinks.filter(r => r.tag.toLowerCase().includes(s))
        : this._allTaglinks;

      if (filtered.length === 0) {
        el.innerHTML = `<div class="empty" style="padding:32px;text-align:center;">Belum ada data klik.<br><span style="font-size:12px;">Upload data Shopee Click untuk melihat laporan per tag link.</span></div>`;
        this._renderPagination(0);
        return;
      }

      const totalPages = Math.ceil(filtered.length / this._perPage);
      if (this._page > totalPages) this._page = Math.max(1, totalPages);
      const pageRows = filtered.slice((this._page-1)*this._perPage, this._page*this._perPage);

      el.innerHTML = `
        <table class="data-table" style="font-size:12.5px;">
          <thead><tr>
            <th style="min-width:160px;">TAG LINK</th>
            <th style="text-align:right;">CLICK</th>
            <th style="text-align:right;">PESANAN</th>
            <th style="text-align:right;">CR</th>
            <th style="text-align:right;">KOMISI</th>
            <th style="width:32px;"></th>
          </tr></thead>
          <tbody>
            ${pageRows.map(r => `
              <tr class="taglink-row" data-id="${r.tag_link_id}" style="cursor:pointer;">
                <td><a style="color:#2563eb;font-weight:500;text-decoration:none;">${r.tag}</a></td>
                <td style="text-align:right;">${num(r.click)}</td>
                <td style="text-align:right;">${num(r.pesanan)}</td>
                <td style="text-align:right;color:var(--text-muted,#6b7280);">${r.cr_persen != null ? pct(r.cr_persen) : '—'}</td>
                <td style="text-align:right;">${rp(Math.round(Number(r.komisi)))}</td>
                <td style="text-align:center;color:var(--text-muted,#9ca3af);">›</td>
              </tr>`).join('')}
          </tbody>
        </table>`;

      el.querySelectorAll('.taglink-row').forEach(tr => {
        tr.addEventListener('mouseenter', () => tr.style.background = 'var(--surface-alt,#f9fafb)');
        tr.addEventListener('mouseleave', () => tr.style.background = '');
        tr.addEventListener('click', () => {
          const id = tr.dataset.id;
          const r = this._allTaglinks.find(x => x.tag_link_id === id);
          if (r) this._showChannelModal(r);
        });
      });
      this._renderPagination(filtered.length);
    }
  }

  async _showChannelModal(r) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:560px;width:95vw;">
        <div class="modal-header">
          <div>
            <h2 style="font-size:16px;font-weight:700;">${r.tag} - rincian channel</h2>
            <p style="font-size:11.5px;color:var(--text-muted,#9ca3af);margin:2px 0 0;">${this.dari} → ${this.sampai}</p>
          </div>
          <button class="modal-close" id="ch-close">×</button>
        </div>
        <div class="modal-body" id="ch-body">
          <div class="loading" style="padding:20px;">Memuat…</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#ch-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    const bodyEl = overlay.querySelector('#ch-body');
    try {
      const qs = `tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}`;
      const data = await apiFetch(appendFilter(`/clicks/taglink/${r.tag_link_id}/channels?${qs}`));
      const channels = data.channels || [];
      const total = data.total_click || 0;
      const totalKomisi = Math.round(Number(data.total_komisi || 0));

      if (channels.length === 0) {
        bodyEl.innerHTML = `<div class="empty" style="padding:24px;text-align:center;">Belum ada data channel.<br><span style="font-size:12px;">Upload ulang Shopee Click CSV untuk mengisi data per channel.</span></div>`;
        return;
      }

      bodyEl.innerHTML = `
        <div class="table-wrap" style="overflow-x:auto;">
          <table class="data-table" style="font-size:12.5px;">
            <thead><tr>
              <th style="min-width:130px;">CHANNEL</th>
              <th style="text-align:right;">CLICK</th>
              <th style="text-align:right;">SHARE</th>
              <th style="text-align:right;">KOMISI</th>
            </tr></thead>
            <tbody>
              ${channels.map(ch => `
                <tr>
                  <td><span style="font-weight:600;color:${channelColor(ch.sumber)};">${ch.sumber}</span></td>
                  <td style="text-align:right;">${num(ch.click)}</td>
                  <td style="text-align:right;color:var(--text-muted,#6b7280);">${pct(ch.share_persen)}</td>
                  <td style="text-align:right;">${rp(Math.round(Number(ch.komisi)))}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight:700;background:var(--surface-alt,#f9fafb);">
                <td>TOTAL</td>
                <td style="text-align:right;">${num(total)}</td>
                <td style="text-align:right;">100.0%</td>
                <td style="text-align:right;">${rp(totalKomisi)}</td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    } catch (e) {
      bodyEl.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  destroy() {
    document.removeEventListener('click', this._onDocClick.bind(this));
  }
}
