import { apiFetch } from '../api.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const num = n => Number(n || 0).toLocaleString('id-ID');

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function barColor(persen) {
  const p = Number(persen || 0);
  if (p >= 90) return '#dc2626';
  if (p >= 75) return '#f97316';
  return '#3b82f6';
}

function statusBadge(status) {
  if (status === 'Habis') return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11.5px;font-weight:700;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;">Habis</span>`;
  if (status === 'Segera') return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11.5px;font-weight:700;background:#fff7ed;color:#ea580c;border:1px solid #fed7aa;">Segera</span>`;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11.5px;font-weight:700;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;">Aman</span>`;
}

export class BalancePage {
  constructor(container) {
    this.container = container;
    this._data = null;
    this._page = 1;
    this._perPage = 10;
    this._showEditModal = this._showEditModal.bind(this);
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Saldo Iklan</h1>
          <p>Pantau saldo semua akun agensi dalam satu layar — tanpa buka satu-satu di Ads Manager.</p>
        </div>
        <div class="page-header-right" style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:12px;color:var(--text-muted,#9ca3af);" id="lbl-refresh">Terakhir dibaca: —</span>
          <button class="btn" id="btn-refresh" style="display:flex;align-items:center;gap:6px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh saldo
          </button>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;

    this.container.querySelector('#btn-refresh').addEventListener('click', () => this._load());
    await this._load();
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';
    try {
      this._data = await apiFetch('/balance/');
      this._render(el);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _render(el) {
    const d = this._data;
    const s = d.summary;
    const accounts = d.accounts || [];
    const refreshLabel = d.terakhir_refresh ? `Terakhir dibaca ${fmtDateTime(d.terakhir_refresh)}` : 'Belum ada data saldo';
    const lbl = this.container.querySelector('#lbl-refresh');
    if (lbl) lbl.textContent = refreshLabel;

    const persen = Number(s.persen_terpakai || 0);
    const color = barColor(persen);

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:12.5px;color:var(--text-muted,#6b7280);flex-wrap:wrap;">
        <span style="padding:4px 12px;background:var(--surface-alt,#f9fafb);border:1px solid var(--border,#e5e7eb);border-radius:6px;font-weight:500;">
          Semua akun agensi · ${s.jumlah_akun} akun
        </span>
        <span style="color:var(--text-muted,#9ca3af);">Filter Akun di sidebar tidak berlaku di halaman ini.</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 180px;gap:14px;margin-bottom:16px;align-items:start;">

        <!-- Ringkasan card -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
            <div style="font-size:10.5px;font-weight:700;color:var(--text-muted,#9ca3af);letter-spacing:.06em;">
              RINGKASAN · TOTAL LIMIT · TERPAKAI · SISA
            </div>
            <span style="font-size:11px;font-weight:700;color:#16a34a;display:flex;align-items:center;gap:4px;">
              <span style="width:7px;height:7px;border-radius:50%;background:#16a34a;display:inline-block;"></span> LIVE
            </span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px;">
            <div>
              <div style="font-size:10.5px;color:var(--text-muted,#9ca3af);margin-bottom:3px;">SISA SALDO</div>
              <div style="font-size:22px;font-weight:700;">${rp(s.sisa_saldo)}</div>
            </div>
            <div>
              <div style="font-size:10.5px;color:var(--text-muted,#9ca3af);margin-bottom:3px;">TOTAL LIMIT</div>
              <div style="font-size:22px;font-weight:700;">${rp(s.total_limit)}</div>
            </div>
            <div>
              <div style="font-size:10.5px;color:var(--text-muted,#9ca3af);margin-bottom:3px;">TERPAKAI</div>
              <div style="font-size:22px;font-weight:700;">${rp(s.terpakai)}</div>
            </div>
          </div>
          <div style="height:8px;background:var(--surface-alt,#f3f4f6);border-radius:4px;overflow:hidden;margin-bottom:6px;">
            <div style="width:${Math.min(persen, 100)}%;height:100%;background:${color};border-radius:4px;transition:width .4s;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted,#6b7280);">
            <span>${persen.toFixed(1).replace('.', ',')}% limit terpakai</span>
            <span>${s.jumlah_akun} akun</span>
          </div>
        </div>

        <!-- Right cards -->
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div class="card" style="padding:16px;background:${s.perlu_topup > 0 ? '#fff7ed' : 'var(--surface,#fff)'};border-color:${s.perlu_topup > 0 ? '#fed7aa' : 'var(--border,#e5e7eb)'};">
            <div style="font-size:10.5px;font-weight:700;color:var(--text-muted,#9ca3af);letter-spacing:.06em;margin-bottom:6px;">PERLU TOPUP ≤3 HARI</div>
            <div style="font-size:26px;font-weight:800;color:${s.perlu_topup > 0 ? '#ea580c' : 'var(--text,#374151)'};">${s.perlu_topup}</div>
            <div style="font-size:12px;color:var(--text-muted,#6b7280);">akun</div>
          </div>
          <div class="card" style="padding:16px;">
            <div style="font-size:10.5px;font-weight:700;color:var(--text-muted,#9ca3af);letter-spacing:.06em;margin-bottom:6px;">SISA SALDO 0</div>
            <div style="font-size:26px;font-weight:800;color:${s.saldo_nol > 0 ? '#dc2626' : 'var(--text,#374151)'};">${s.saldo_nol}</div>
            <div style="font-size:12px;color:var(--text-muted,#6b7280);">akun</div>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div style="font-size:11px;font-weight:700;color:var(--text-muted,#6b7280);letter-spacing:.06em;margin-bottom:8px;">
        AKUN AGENSI · ${accounts.length}
      </div>
      <div class="card" style="padding:0;">
        <div class="table-wrap" style="overflow-x:auto;">
          <table class="data-table" style="font-size:12.5px;">
            <thead>
              <tr>
                <th style="min-width:180px;">AKUN</th>
                <th style="min-width:200px;">SISA SALDO</th>
                <th style="text-align:right;min-width:110px;">KEMARIN</th>
                <th style="min-width:140px;">CUKUP</th>
                <th style="text-align:center;min-width:80px;">STATUS</th>
                <th style="width:44px;"></th>
              </tr>
            </thead>
            <tbody id="balance-tbody">
            </tbody>
          </table>
        </div>
      </div>
      <div id="pagination-wrap"></div>
    `;

    this._renderTable(el, accounts);
  }

  _renderTable(el, accounts) {
    const totalPages = Math.ceil(accounts.length / this._perPage);
    if (this._page > totalPages) this._page = Math.max(1, totalPages);
    const startIdx = (this._page - 1) * this._perPage;
    const pageRows = accounts.length === 0 ? [] : accounts.slice(startIdx, startIdx + this._perPage);

    const tbody = el.querySelector('#balance-tbody');
    tbody.innerHTML = accounts.length === 0
      ? `<tr><td colspan="6" class="empty" style="padding:32px;text-align:center;">Belum ada data saldo.<br><span style="font-size:12px;color:var(--text-muted,#9ca3af);">Klik tombol ✎ untuk input saldo manual.</span></td></tr>`
      : pageRows.map(a => this._rowHtml(a)).join('');

    tbody.querySelectorAll('[data-edit-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editId;
        const row = accounts.find(a => a.meta_account_id === id);
        if (row) this._showEditModal(row);
      });
    });

    const pgWrap = el.querySelector('#pagination-wrap');
    if (!pgWrap) return;
    const pp = this._perPage;
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
          <span style="font-size:12px;color:var(--text-muted,#9ca3af);">per halaman &nbsp;·&nbsp; ${accounts.length===0?'0':startIdx+1}–${Math.min(startIdx+pp, accounts.length)} dari ${accounts.length}</span>
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
    pgWrap.querySelector('#pg-size')?.addEventListener('change', e=>{ this._perPage=Number(e.target.value); this._page=1; this._renderTable(el, accounts); });
    pgWrap.querySelector('#pg-first')?.addEventListener('click', ()=>{ this._page=1; this._renderTable(el, accounts); });
    pgWrap.querySelector('#pg-prev') ?.addEventListener('click', ()=>{ this._page--; this._renderTable(el, accounts); });
    pgWrap.querySelector('#pg-next') ?.addEventListener('click', ()=>{ this._page++; this._renderTable(el, accounts); });
    pgWrap.querySelector('#pg-last') ?.addEventListener('click', ()=>{ this._page=totalPages; this._renderTable(el, accounts); });
    pgWrap.querySelectorAll('.pg-num').forEach(btn=>{ btn.addEventListener('click',()=>{ this._page=Number(btn.dataset.pg); this._renderTable(el, accounts); }); });
  }

  _rowHtml(a) {
    const persen = Number(a.persen_terpakai || 0);
    const color = barColor(persen);
    const rpSisa = rp(a.sisa_saldo);
    const rpLimit = rp(a.total_limit);
    const rpTerpakai = rp(a.terpakai);

    const cukupStr = a.cukup_hari != null
      ? `≈${a.cukup_hari.toFixed(1).replace('.', ',')} hari`
      : '—';
    const topupStr = a.topup_date
      ? `Topup ~${fmtDate(a.topup_date)}`
      : '';

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${a.sisa_saldo > 0 ? '#16a34a' : '#dc2626'};flex-shrink:0;"></div>
            <div>
              <div style="font-weight:600;font-size:13px;">${a.nama_akun}</div>
              <div style="font-size:11px;color:var(--text-muted,#6b7280);">${a.dikelola_oleh || a.ad_account_id || ''}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${rpSisa}</div>
          <div style="height:4px;background:var(--surface-alt,#f3f4f6);border-radius:2px;margin-bottom:4px;max-width:180px;">
            <div style="width:${Math.min(persen, 100)}%;height:100%;background:${color};border-radius:2px;"></div>
          </div>
          <div style="font-size:11px;color:var(--text-muted,#6b7280);">${rpTerpakai} / ${rpLimit} terpakai</div>
        </td>
        <td style="text-align:right;font-weight:500;">${rp(a.kemarin)}</td>
        <td>
          <div style="font-weight:600;font-size:13px;color:${a.status === 'Segera' || a.status === 'Habis' ? '#ea580c' : 'var(--text,#374151)'};">${cukupStr}</div>
          ${topupStr ? `<div style="font-size:11px;color:var(--text-muted,#6b7280);">${topupStr}</div>` : ''}
        </td>
        <td style="text-align:center;">${statusBadge(a.status)}</td>
        <td style="text-align:center;">
          <button data-edit-id="${a.meta_account_id}" title="Input saldo" style="background:none;border:none;cursor:pointer;color:#6b7280;padding:4px;line-height:0;" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#6b7280'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </td>
      </tr>`;
  }

  _showEditModal(row) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px;width:95vw;">
        <div class="modal-header">
          <div>
            <h2 style="font-size:16px;font-weight:700;margin:0;">Input Saldo Manual</h2>
            <p style="font-size:12px;color:var(--text-muted,#9ca3af);margin:3px 0 0;">${row.nama_akun}</p>
          </div>
          <button class="modal-close" id="bm-close">×</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <div style="margin-bottom:14px;">
            <label style="font-size:11px;font-weight:700;color:var(--text-muted,#6b7280);letter-spacing:.05em;display:block;margin-bottom:5px;">SISA SALDO (Rp)</label>
            <input type="number" id="bm-sisa" value="${Number(row.sisa_saldo)}" min="0" step="1000"
              style="width:100%;padding:8px 10px;border:1px solid var(--border,#e5e7eb);border-radius:7px;font-size:14px;box-sizing:border-box;">
          </div>
          <div style="margin-bottom:14px;">
            <label style="font-size:11px;font-weight:700;color:var(--text-muted,#6b7280);letter-spacing:.05em;display:block;margin-bottom:5px;">TOTAL LIMIT (Rp)</label>
            <input type="number" id="bm-limit" value="${Number(row.total_limit)}" min="0" step="1000"
              style="width:100%;padding:8px 10px;border:1px solid var(--border,#e5e7eb);border-radius:7px;font-size:14px;box-sizing:border-box;">
          </div>
          <div style="margin-bottom:18px;">
            <label style="font-size:11px;font-weight:700;color:var(--text-muted,#6b7280);letter-spacing:.05em;display:block;margin-bottom:5px;">DIKELOLA OLEH <span style="font-weight:400;">(opsional)</span></label>
            <input type="text" id="bm-dikelola" value="${row.dikelola_oleh || ''}" placeholder="contoh: Shopee Aset"
              style="width:100%;padding:8px 10px;border:1px solid var(--border,#e5e7eb);border-radius:7px;font-size:13px;box-sizing:border-box;">
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button class="btn" id="bm-batal">Batal</button>
            <button class="btn" id="bm-simpan" style="background:#dc2626;color:#fff;border-color:#dc2626;padding:8px 20px;">Simpan</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#bm-close').addEventListener('click', close);
    overlay.querySelector('#bm-batal').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('#bm-simpan').addEventListener('click', async () => {
      const sisa = parseFloat(overlay.querySelector('#bm-sisa').value) || 0;
      const limit = parseFloat(overlay.querySelector('#bm-limit').value) || 0;
      const dikelola = overlay.querySelector('#bm-dikelola').value.trim() || null;

      const btn = overlay.querySelector('#bm-simpan');
      btn.disabled = true; btn.textContent = 'Menyimpan…';
      try {
        await apiFetch(`/balance/${row.meta_account_id}`, {
          method: 'POST',
          body: JSON.stringify({ sisa_saldo: sisa, total_limit: limit, dikelola_oleh: dikelola }),
        });
        close();
        await this._load();
        // Update sidebar balance
        window.dispatchEvent(new CustomEvent('trackpro:balance-updated'));
      } catch (e) {
        alert(e.message);
        btn.disabled = false; btn.textContent = 'Simpan';
      }
    });
  }

  destroy() {}
}
