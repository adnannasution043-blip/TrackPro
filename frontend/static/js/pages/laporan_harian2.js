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
  { key: 'semua',        label: 'Semua' },
  { key: 'organic',      label: 'Organic' },
  { key: 'meta',         label: 'Meta' },
  { key: 'adu',          label: 'Adu' },
  { key: 'terra',        label: 'Terra' },
  { key: 'meta_pribadi', label: 'Meta Pribadi' },
  { key: 'live',         label: 'Live' },
];

export class LaporanHarian2Page {
  constructor(container) {
    this.container = container;
    this.dari      = firstOfMonth();
    this.sampai    = todayStr();
    this._rows     = [];   // dari /dashboard (metrics harian)
    this._bdMap    = {};   // dari /laporan-harian2 (breakdown kategori)
    this._customCats = []; // dari /custom-kategori — kategori tambahan manual
    this._filters  = new Set(); // kosong = semua
    this._page     = 1;
    this._perPage  = 10;
  }

  // Filter pill = kategori bawaan (hardcode) + kategori custom (dari DB).
  // Key kategori custom diprefix "custom:" biar gak ketuker sama key bawaan.
  _allFilters() {
    return [...FILTERS, ...this._customCats.map(c => ({ key: `custom:${c.id}`, label: c.nama }))];
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Laporan Harian</h1>
          <p>Rekapan komisi harian per kategori. Klik tanggal untuk detail produk.</p>
        </div>
        <div class="page-header-right" style="display:flex;gap:8px;align-items:center;">
          <input type="date" id="inp-dari"   class="form-input" style="width:140px;" value="${this.dari}">
          <span style="color:var(--text-muted)">–</span>
          <input type="date" id="inp-sampai" class="form-input" style="width:140px;" value="${this.sampai}">
          <button class="btn btn-primary" id="btn-terapkan">Terapkan</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center;" id="filter-pills"></div>

      <div class="card" style="padding:0;overflow:hidden;">
        <div id="tbl-wrap" style="overflow-x:auto;">
          <div class="loading" style="padding:32px;text-align:center;">Memuat…</div>
        </div>
      </div>
      <div id="pagination-wrap"></div>
    `;

    this.container.querySelector('#btn-terapkan').addEventListener('click', () => {
      this.dari   = this.container.querySelector('#inp-dari').value;
      this.sampai = this.container.querySelector('#inp-sampai').value;
      this._load();
    });

    this._renderFilterPills();
    this._load();
  }

  // Filter pills + tombol "+ Kategori" — dirender ulang tiap kali daftar
  // kategori custom berubah (setelah load awal, atau setelah tambah/hapus
  // kategori dari modal kelola).
  _renderFilterPills() {
    const el = this.container.querySelector('#filter-pills');
    if (!el) return;
    const filters = this._allFilters();
    el.innerHTML = `
      ${filters.map(f => {
        const isAll = f.key === 'semua';
        const on    = isAll ? this._filters.size === 0 : this._filters.has(f.key);
        return `<button data-filter="${f.key}"
          style="padding:6px 16px;border-radius:20px;border:1.5px solid ${on ? '#dc2626' : 'var(--border)'};
                 background:${on ? '#dc2626' : 'var(--bg-card)'};
                 color:${on ? '#fff' : 'var(--text)'};
                 font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;">
          ${f.label}
        </button>`;
      }).join('')}
      <button id="btn-kelola-kategori" title="Tambah / kelola kategori custom"
        style="padding:6px 14px;border-radius:20px;border:1.5px dashed var(--border);background:none;
               color:var(--text-muted);font-size:13px;font-weight:500;cursor:pointer;">
        + Kategori
      </button>
    `;

    el.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.filter;
        if (key === 'semua') {
          this._filters.clear();
        } else {
          if (this._filters.has(key)) this._filters.delete(key);
          else this._filters.add(key);
        }
        el.querySelectorAll('[data-filter]').forEach(b => {
          const k  = b.dataset.filter;
          const on = k === 'semua' ? this._filters.size === 0 : this._filters.has(k);
          b.style.background  = on ? '#dc2626' : 'var(--bg-card)';
          b.style.color       = on ? '#fff' : 'var(--text)';
          b.style.borderColor = on ? '#dc2626' : 'var(--border)';
        });
        this._page = 1;
        this._render();
      });
    });

    el.querySelector('#btn-kelola-kategori')?.addEventListener('click', () => this._showKategoriModal());
  }

  async _load() {
    const wrap = this.container.querySelector('#tbl-wrap');
    wrap.innerHTML = '<div class="loading" style="padding:32px;text-align:center;">Memuat…</div>';
    try {
      const qs = filterQS ? filterQS() : '';
      const [dash, bd, cats] = await Promise.all([
        apiFetch(`/dashboard?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}${qs}`),
        apiFetch(`/dashboard/laporan-harian2?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}${qs}`),
        apiFetch('/custom-kategori'),
      ]);
      // Tanggal terbaru di paling atas
      this._rows  = (dash?.harian || []).slice().sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      this._bdMap = {};
      for (const row of (bd || [])) this._bdMap[row.tanggal] = row;
      this._customCats = cats || [];
      this._renderFilterPills();
      this._page = 1;
      this._render();
    } catch (e) {
      wrap.innerHTML = `<div class="alert alert-error" style="margin:16px;">${e.message}</div>`;
    }
  }

  _visible() {
    if (this._filters.size === 0) return this._rows;
    return this._rows.filter(r => {
      const bd = this._bdMap[r.tanggal] || {};
      return [...this._filters].some(f => {
        if (f === 'organic')      return Number(bd.total_fp || 0) > 0 || Number(bd.total_ig || 0) > 0;
        if (f === 'meta')         return Number(bd.komisi_meta || 0) > 0 || Number(bd.budget_meta || 0) > 0;
        if (f === 'adu')          return Number(bd.komisi_adu || 0) > 0 || Number(bd.budget_adu || 0) > 0;
        if (f === 'terra')        return Number(bd.komisi_terra || 0) > 0 || Number(bd.budget_terra || 0) > 0;
        if (f === 'meta_pribadi') return Number(bd.komisi_meta_pribadi || 0) > 0;
        if (f === 'live')         return Number(bd.komisi_live || 0) > 0;
        if (f.startsWith('custom:')) {
          const id = f.slice(7);
          return Number((bd.komisi_custom || {})[id] || 0) > 0;
        }
        return false;
      });
    });
  }

  // "Live" dihitung dari kolom Platform (bukan tag link seperti kategori
  // lain). Kolom KOMISI LIVE TIDAK ditampilkan di tab "Semua" dan TIDAK ikut
  // dijumlah ke Total Kotor di sana — cuma nongol & dihitung kalau tab Live
  // dipilih eksplisit, persis kayak kategori lain. Kategori custom defaultnya
  // TAMPIL di tab Semua (beda dari Live), sesuai perlakuan yang sama seperti
  // kategori bawaan lain (Meta/Adu/Terra/Meta Pribadi).
  _getVisibleCols() {
    if (this._filters.size === 0) {
      return {
        fp: true, ig: true, meta: true, adu: true, terra: true, metaPribadi: true, live: false,
        customIds: new Set(this._customCats.map(c => c.id)),
      };
    }
    const c = { fp: false, ig: false, meta: false, adu: false, terra: false, metaPribadi: false, live: false, customIds: new Set() };
    if (this._filters.has('organic'))      { c.fp = true; c.ig = true; }
    if (this._filters.has('meta'))           c.meta = true;
    if (this._filters.has('adu'))            c.adu = true;
    if (this._filters.has('terra'))          c.terra = true;
    if (this._filters.has('meta_pribadi'))   c.metaPribadi = true;
    if (this._filters.has('live'))           c.live = true;
    for (const f of this._filters) {
      if (f.startsWith('custom:')) c.customIds.add(f.slice(7));
    }
    return c;
  }

  // Total Kotor mengikuti tab yang aktif — cuma jumlahin kategori yang
  // lagi ditampilkan (kolom komisi, bukan budget). Kalau "Semua" dipilih
  // (semua kolom visible) hasilnya sama dengan total_kotor dari backend
  // (asalkan semua kategori custom ikut_total_kotor=true — kalau ada yang
  // di-uncheck, backend & sini konsisten sama-sama mengecualikannya).
  _kotorVisible(bd, c) {
    let k = 0;
    if (c.fp)          k += Number(bd.total_fp            || 0);
    if (c.ig)          k += Number(bd.total_ig            || 0);
    if (c.meta)        k += Number(bd.komisi_meta         || 0);
    if (c.adu)         k += Number(bd.komisi_adu          || 0);
    if (c.terra)       k += Number(bd.komisi_terra        || 0);
    if (c.metaPribadi) k += Number(bd.komisi_meta_pribadi || 0);
    if (c.live)        k += Number(bd.komisi_live         || 0);
    for (const cat of this._customCats) {
      if (c.customIds.has(cat.id) && cat.ikut_total_kotor) {
        k += Number((bd.komisi_custom || {})[cat.id] || 0);
      }
    }
    return k;
  }

  _render() {
    const wrap   = this.container.querySelector('#tbl-wrap');
    const pgWrap = this.container.querySelector('#pagination-wrap');
    const rows   = this._visible();
    const c      = this._getVisibleCols();

    if (!rows.length) {
      wrap.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);">Tidak ada data untuk rentang tanggal ini.</div>';
      if (pgWrap) pgWrap.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(rows.length / this._perPage);
    if (this._page > totalPages) this._page = Math.max(1, totalPages);
    const startIdx = (this._page - 1) * this._perPage;
    const endIdx   = startIdx + this._perPage;
    const pageRows = rows.slice(startIdx, endIdx);

    const visibleCustomCats = this._customCats.filter(cat => c.customIds.has(cat.id));

    // Aggregat totals (semua rows, bukan hanya halaman ini)
    const tot = { story:0, feed:0, fp:0, storyIg:0, feedIg:0, ig:0, meta:0, budgetMeta:0, adu:0, budgetAdu:0, terra:0, budgetTerra:0, metaPribadi:0, iklan:0, live:0, kotor:0, custom:{} };
    for (const cat of visibleCustomCats) tot.custom[cat.id] = 0;
    rows.forEach(r => {
      const bd = this._bdMap[r.tanggal] || {};
      tot.story       += Number(bd.komisi_story        || 0);
      tot.feed        += Number(bd.komisi_feed         || 0);
      tot.fp          += Number(bd.total_fp            || 0);
      tot.storyIg     += Number(bd.komisi_story_ig     || 0);
      tot.feedIg      += Number(bd.komisi_feed_ig      || 0);
      tot.ig          += Number(bd.total_ig            || 0);
      tot.meta        += Number(bd.komisi_meta         || 0);
      tot.budgetMeta  += Number(bd.budget_meta         || 0);
      tot.adu         += Number(bd.komisi_adu          || 0);
      tot.budgetAdu   += Number(bd.budget_adu          || 0);
      tot.terra       += Number(bd.komisi_terra        || 0);
      tot.budgetTerra += Number(bd.budget_terra        || 0);
      tot.metaPribadi += Number(bd.komisi_meta_pribadi || 0);
      tot.iklan       += Number(bd.total_iklan         || 0);
      tot.live        += Number(bd.komisi_live         || 0);
      tot.kotor       += this._kotorVisible(bd, c);
      for (const cat of visibleCustomCats) {
        tot.custom[cat.id] += Number((bd.komisi_custom || {})[cat.id] || 0);
      }
    });

    const thBase   = 'padding:8px 10px;font-size:11px;font-weight:700;white-space:nowrap;text-transform:uppercase;letter-spacing:.4px;background:#f1f5f9;border-bottom:2px solid var(--border);';
    const thFP     = thBase + 'background:#f5f3ff;color:#7c3aed;';
    const thIG     = thBase + 'background:#eff6ff;color:#2563eb;';
    const thIklan  = thBase + 'background:#fef2f2;color:#dc2626;';
    const thMeta   = thBase + 'background:#fff7ed;color:#c2410c;';
    const thBudget = thBase + 'background:#f8fafc;color:#64748b;font-style:italic;';
    const thLive   = thBase + 'background:#fdf2f8;color:#db2777;';
    const thCustom = thBase + 'background:#f0fdfa;color:#0d9488;';

    // colspan IKLAN: meta/adu/terra masing-masing 2 kolom (komisi + budget), meta_pribadi 1 kolom
    const iklanIndiv    = (c.meta ? 2 : 0) + (c.adu ? 2 : 0) + (c.terra ? 2 : 0) + (c.metaPribadi ? 1 : 0);
    const hasIklan      = iklanIndiv > 0;
    const budgetGroups  = (c.meta ? 1 : 0) + (c.adu ? 1 : 0) + (c.terra ? 1 : 0);
    const hasTotalBudget = budgetGroups >= 2;
    const iklanColspan  = iklanIndiv + (hasIklan ? 1 : 0) + (hasTotalBudget ? 1 : 0);

    // Header baris 1
    const h1Fp    = c.fp      ? `<th colspan="3" style="${thFP}text-align:center;">KOMISI FP</th>` : '';
    const h1Ig    = c.ig      ? `<th colspan="3" style="${thIG}text-align:center;border-left:2px solid #bfdbfe;">KOMISI IG</th>` : '';
    const h1Iklan = hasIklan  ? `<th colspan="${iklanColspan}" style="${thIklan}text-align:center;border-left:2px solid #fecaca;">KOMISI IKLAN</th>` : '';
    const h1Custom = visibleCustomCats.map((cat, i) =>
      `<th rowspan="2" style="${thCustom}${i === 0 ? 'border-left:2px solid #99f6e4;' : ''}">${cat.nama.toUpperCase()}</th>`
    ).join('');
    const h1Live  = c.live    ? `<th rowspan="2" style="${thLive}border-left:2px solid #fbcfe8;">KOMISI LIVE</th>` : '';

    // Header baris 2
    const h2Fp = c.fp ? `
      <th style="${thFP}">STORY</th>
      <th style="${thFP}">FEW FEED</th>
      <th style="${thFP}font-weight:800;">TOTAL FP</th>` : '';
    const h2Ig = c.ig ? `
      <th style="${thIG}border-left:2px solid #bfdbfe;">STORY IG</th>
      <th style="${thIG}">FEED IG</th>
      <th style="${thIG}font-weight:800;">TOTAL IG</th>` : '';
    const h2IklanMeta  = c.meta        ? `<th style="${thIklan}border-left:2px solid #fecaca;">META</th><th style="${thBudget}">BUDGET META</th>` : '';
    const h2IklanAdu   = c.adu         ? `<th style="${thIklan}${!c.meta ? 'border-left:2px solid #fecaca;' : ''}">ADU</th><th style="${thBudget}">BUDGET ADU</th>` : '';
    const h2IklanTerra = c.terra       ? `<th style="${thIklan}${!c.meta && !c.adu ? 'border-left:2px solid #fecaca;' : ''}">TERRA</th><th style="${thBudget}">BUDGET TERRA</th>` : '';
    const h2IklanPrib  = c.metaPribadi ? `<th style="${thMeta}${!c.meta && !c.adu && !c.terra ? 'border-left:2px solid #fed7aa;' : ''}">META PRIBADI</th>` : '';
    const h2IklanTot   = hasIklan      ? `<th style="${thIklan}font-weight:800;">TOTAL IKLAN</th>` : '';
    const h2TotBudget  = hasTotalBudget ? `<th style="${thBudget}font-weight:800;">TOTAL BUDGET</th>` : '';

    const rowsHtml = pageRows.map((r, i) => {
      const bd          = this._bdMap[r.tanggal] || {};
      const story       = Number(bd.komisi_story        || 0);
      const feed        = Number(bd.komisi_feed         || 0);
      const fp          = Number(bd.total_fp            || 0);
      const storyIg     = Number(bd.komisi_story_ig     || 0);
      const feedIg      = Number(bd.komisi_feed_ig      || 0);
      const ig          = Number(bd.total_ig            || 0);
      const meta        = Number(bd.komisi_meta         || 0);
      const budgetMeta  = Number(bd.budget_meta         || 0);
      const adu         = Number(bd.komisi_adu          || 0);
      const budgetAdu   = Number(bd.budget_adu          || 0);
      const terra       = Number(bd.komisi_terra        || 0);
      const budgetTerra = Number(bd.budget_terra        || 0);
      const metaPribadi = Number(bd.komisi_meta_pribadi || 0);
      const iklan       = Number(bd.total_iklan         || 0);
      const live        = Number(bd.komisi_live         || 0);
      const kotor       = this._kotorVisible(bd, c);
      const bgRow       = i % 2 === 0 ? '' : 'background:var(--bg-muted);';
      const tdBg        = i % 2 === 0 ? '#f8fafc' : 'var(--bg-muted)';

      const tdFp = c.fp ? `
        <td style="white-space:nowrap;color:#7c3aed;">${rp(Math.round(story))}</td>
        <td style="white-space:nowrap;color:#7c3aed;">${rp(Math.round(feed))}</td>
        <td style="font-weight:700;color:#7c3aed;background:#f5f3ff;">${rp(Math.round(fp))}</td>` : '';
      const tdIg = c.ig ? `
        <td style="white-space:nowrap;color:#2563eb;border-left:2px solid #bfdbfe;">${rp(Math.round(storyIg))}</td>
        <td style="white-space:nowrap;color:#2563eb;">${rp(Math.round(feedIg))}</td>
        <td style="font-weight:700;color:#2563eb;background:#eff6ff;">${rp(Math.round(ig))}</td>` : '';
      const tdMeta  = c.meta        ? `<td style="white-space:nowrap;color:#dc2626;border-left:2px solid #fecaca;">${rp(Math.round(meta))}</td><td style="white-space:nowrap;color:#64748b;font-style:italic;">${rp(Math.round(budgetMeta))}</td>` : '';
      const tdAdu   = c.adu         ? `<td style="white-space:nowrap;color:#dc2626;${!c.meta ? 'border-left:2px solid #fecaca;' : ''}">${rp(Math.round(adu))}</td><td style="white-space:nowrap;color:#64748b;font-style:italic;">${rp(Math.round(budgetAdu))}</td>` : '';
      const tdTerra = c.terra       ? `<td style="white-space:nowrap;color:#dc2626;${!c.meta && !c.adu ? 'border-left:2px solid #fecaca;' : ''}">${rp(Math.round(terra))}</td><td style="white-space:nowrap;color:#64748b;font-style:italic;">${rp(Math.round(budgetTerra))}</td>` : '';
      const tdPrib  = c.metaPribadi ? `<td style="white-space:nowrap;color:#c2410c;${!c.meta && !c.adu && !c.terra ? 'border-left:2px solid #fed7aa;' : ''}">${rp(Math.round(metaPribadi))}</td>` : '';
      const tdIklan = hasIklan      ? `<td style="font-weight:700;color:#dc2626;background:#fef2f2;">${rp(Math.round(iklan))}</td>` : '';
      const rowTotalBudget = (c.meta ? budgetMeta : 0) + (c.adu ? budgetAdu : 0) + (c.terra ? budgetTerra : 0);
      const tdTotBudget = hasTotalBudget ? `<td style="font-weight:700;color:#64748b;font-style:italic;background:#f8fafc;">${rp(Math.round(rowTotalBudget))}</td>` : '';
      const tdLive = c.live ? `<td style="font-weight:700;color:#db2777;background:#fdf2f8;border-left:2px solid #fbcfe8;">${rp(Math.round(live))}</td>` : '';
      const tdCustom = visibleCustomCats.map((cat, ci) => {
        const val = Number((bd.komisi_custom || {})[cat.id] || 0);
        return `<td style="color:#0d9488;${ci === 0 ? 'border-left:2px solid #99f6e4;' : ''}">${rp(Math.round(val))}</td>`;
      }).join('');

      return `<tr style="${bgRow}font-size:12.5px;">
        <td style="white-space:nowrap;padding:7px 10px;">
          <button class="tgl-btn" data-tgl="${r.tanggal}"
            style="background:none;border:none;cursor:pointer;font-weight:700;font-size:12.5px;color:#2563eb;padding:0;text-decoration:underline;text-underline-offset:2px;white-space:nowrap;">
            ${fmtDate(r.tanggal)}
          </button>
        </td>
        ${tdFp}${tdIg}${tdMeta}${tdAdu}${tdTerra}${tdPrib}${tdIklan}${tdTotBudget}${tdCustom}${tdLive}
        <td style="font-weight:700;color:#10b981;border-left:2px solid #bbf7d0;">${rp(Math.round(kotor))}</td>
      </tr>`;
    }).join('');

    // Baris total
    const tfFp    = c.fp          ? `<td style="color:#7c3aed;">${rp(Math.round(tot.story))}</td><td style="color:#7c3aed;">${rp(Math.round(tot.feed))}</td><td style="color:#7c3aed;font-weight:800;">${rp(Math.round(tot.fp))}</td>` : '';
    const tfIg    = c.ig          ? `<td style="color:#2563eb;">${rp(Math.round(tot.storyIg))}</td><td style="color:#2563eb;">${rp(Math.round(tot.feedIg))}</td><td style="color:#2563eb;font-weight:800;">${rp(Math.round(tot.ig))}</td>` : '';
    const tfMeta  = c.meta        ? `<td style="color:#dc2626;">${rp(Math.round(tot.meta))}</td><td style="color:#64748b;font-style:italic;">${rp(Math.round(tot.budgetMeta))}</td>` : '';
    const tfAdu   = c.adu         ? `<td style="color:#dc2626;">${rp(Math.round(tot.adu))}</td><td style="color:#64748b;font-style:italic;">${rp(Math.round(tot.budgetAdu))}</td>` : '';
    const tfTerra = c.terra       ? `<td style="color:#dc2626;">${rp(Math.round(tot.terra))}</td><td style="color:#64748b;font-style:italic;">${rp(Math.round(tot.budgetTerra))}</td>` : '';
    const tfPrib  = c.metaPribadi ? `<td style="color:#c2410c;">${rp(Math.round(tot.metaPribadi))}</td>` : '';
    const tfIklan = hasIklan      ? `<td style="color:#dc2626;font-weight:800;">${rp(Math.round(tot.iklan))}</td>` : '';
    const totTotalBudget = (c.meta ? tot.budgetMeta : 0) + (c.adu ? tot.budgetAdu : 0) + (c.terra ? tot.budgetTerra : 0);
    const tfTotBudget = hasTotalBudget ? `<td style="color:#64748b;font-style:italic;font-weight:800;">${rp(Math.round(totTotalBudget))}</td>` : '';
    const tfLive = c.live ? `<td style="color:#db2777;font-weight:800;">${rp(Math.round(tot.live))}</td>` : '';
    const tfCustom = visibleCustomCats.map((cat, ci) =>
      `<td style="color:#0d9488;font-weight:800;${ci === 0 ? 'border-left:2px solid #99f6e4;' : ''}">${rp(Math.round(tot.custom[cat.id] || 0))}</td>`
    ).join('');

    wrap.innerHTML = `
      <table class="data-table" style="font-size:12.5px;min-width:700px;border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th rowspan="2" style="${thBase}min-width:80px;">TGL</th>
            ${h1Fp}${h1Ig}${h1Iklan}${h1Custom}${h1Live}
            <th rowspan="2" style="${thBase}background:#f0fdf4;color:#15803d;white-space:nowrap;border-left:2px solid #bbf7d0;">TOTAL KOTOR</th>
          </tr>
          <tr>${h2Fp}${h2Ig}${h2IklanMeta}${h2IklanAdu}${h2IklanTerra}${h2IklanPrib}${h2IklanTot}${h2TotBudget}</tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="font-weight:700;background:var(--bg-muted);border-top:2px solid var(--border);font-size:12px;">
            <td style="font-weight:800;white-space:nowrap;padding:8px 10px;">TOTAL (${rows.length} hari)</td>
            ${tfFp}${tfIg}${tfMeta}${tfAdu}${tfTerra}${tfPrib}${tfIklan}${tfTotBudget}${tfCustom}${tfLive}
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

    if (pgWrap) {
      pgWrap.innerHTML = this._pgBarHtml(startIdx, Math.min(endIdx, rows.length), rows.length, totalPages);
      this._bindPgBar(pgWrap, totalPages, () => this._render());
    }
  }

  // Modal kelola kategori custom — tambah/hapus/toggle "ikut Total Kotor".
  // Perubahan di sini langsung nge-trigger _load() ulang buat refresh
  // filter pill, kolom tabel, dan Total Kotor di seluruh halaman.
  _showKategoriModal() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';

    const renderList = () => {
      if (this._customCats.length === 0) {
        return `<div style="font-size:12.5px;color:#6b7280;padding:12px 0;">Belum ada kategori custom.</div>`;
      }
      return this._customCats.map(cat => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:6px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;">${cat.nama}</div>
            <div style="font-size:11px;color:#6b7280;">keyword: "${cat.keyword}"</div>
          </div>
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#6b7280;cursor:pointer;white-space:nowrap;">
            <input type="checkbox" data-toggle-kotor="${cat.id}" ${cat.ikut_total_kotor ? 'checked' : ''}>
            Ikut Total Kotor
          </label>
          <button class="btn btn-sm" style="color:#dc2626;border-color:#dc2626;font-size:11px;" data-hapus-kategori="${cat.id}">Hapus</button>
        </div>
      `).join('');
    };

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:10px;padding:24px;width:440px;max-width:92vw;max-height:85vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
        <h3 style="margin:0 0 4px;font-size:16px;">Kategori Custom</h3>
        <p style="font-size:12.5px;color:#6b7280;margin:0 0 16px;">
          Tambah kategori baru buat tag_link yang belum masuk Organic/Meta/Adu/Terra/Meta Pribadi/Live —
          dicocokkan dari kata kunci yang mengandung teks di tag_link.
        </p>
        <div id="kategori-list">${renderList()}</div>
        <div style="border-top:1px solid #e5e7eb;margin-top:14px;padding-top:14px;">
          <div style="font-size:12px;font-weight:600;margin-bottom:8px;">Tambah Kategori Baru</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <input type="text" id="kat-nama" class="form-input" placeholder="Nama (mis. Tiktok)" style="font-size:12.5px;">
            <input type="text" id="kat-keyword" class="form-input" placeholder="Keyword (mis. tiktok)" style="font-size:12.5px;">
          </div>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#6b7280;margin-bottom:10px;cursor:pointer;">
            <input type="checkbox" id="kat-ikut-kotor" checked>
            Ikut hitungan Total Kotor
          </label>
          <div id="kat-error" style="display:none;color:#dc2626;font-size:12px;margin-bottom:10px;"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button class="btn" id="kat-tutup">Tutup</button>
            <button class="btn btn-primary" id="kat-tambah">+ Tambah</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#kat-tutup').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    const refreshList = () => {
      overlay.querySelector('#kategori-list').innerHTML = renderList();
      bindListEvents();
    };

    const bindListEvents = () => {
      overlay.querySelectorAll('[data-toggle-kotor]').forEach(chk => {
        chk.addEventListener('change', async () => {
          const id = chk.dataset.toggleKotor;
          chk.disabled = true;
          try {
            await apiFetch(`/custom-kategori/${id}`, {
              method: 'PATCH',
              body: JSON.stringify({ ikut_total_kotor: chk.checked }),
            });
            const cat = this._customCats.find(c => c.id === id);
            if (cat) cat.ikut_total_kotor = chk.checked;
            this._render();
          } catch (e) {
            alert(e.message);
            chk.checked = !chk.checked;
          } finally {
            chk.disabled = false;
          }
        });
      });
      overlay.querySelectorAll('[data-hapus-kategori]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Hapus kategori ini? Filter dan kolomnya akan hilang dari tabel.')) return;
          const id = btn.dataset.hapusKategori;
          btn.disabled = true;
          try {
            await apiFetch(`/custom-kategori/${id}`, { method: 'DELETE' });
            this._customCats = this._customCats.filter(c => c.id !== id);
            this._filters.delete(`custom:${id}`);
            refreshList();
            this._renderFilterPills();
            await this._load();
          } catch (e) {
            alert(e.message);
            btn.disabled = false;
          }
        });
      });
    };
    bindListEvents();

    overlay.querySelector('#kat-tambah').addEventListener('click', async () => {
      const errEl = overlay.querySelector('#kat-error');
      const nama = overlay.querySelector('#kat-nama').value.trim();
      const keyword = overlay.querySelector('#kat-keyword').value.trim();
      const ikutKotor = overlay.querySelector('#kat-ikut-kotor').checked;
      errEl.style.display = 'none';
      if (!nama || !keyword) {
        errEl.textContent = 'Nama dan keyword wajib diisi.';
        errEl.style.display = 'block';
        return;
      }
      const btn = overlay.querySelector('#kat-tambah');
      btn.disabled = true;
      btn.textContent = 'Menyimpan…';
      try {
        const created = await apiFetch('/custom-kategori', {
          method: 'POST',
          body: JSON.stringify({ nama, keyword, ikut_total_kotor: ikutKotor }),
        });
        this._customCats.push(created);
        overlay.querySelector('#kat-nama').value = '';
        overlay.querySelector('#kat-keyword').value = '';
        refreshList();
        this._renderFilterPills();
        await this._load();
      } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = '+ Tambah';
      }
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

  _pgBarHtml(start, end, total, totalPages) {
    const pp = this._perPage;
    const pageNums = Array.from({length:totalPages},(_,i)=>i+1)
      .filter(p=>p===1||p===totalPages||Math.abs(p-this._page)<=2)
      .reduce((acc,p,i,arr)=>{if(i>0&&p-arr[i-1]>1)acc.push('…');acc.push(p);return acc;},[]);
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 4px;margin-top:8px;flex-wrap:wrap;gap:8px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <select id="pg-size" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg-card);color:var(--text);cursor:pointer;">
          ${[10,20,30,50].map(n=>`<option value="${n}"${pp===n?' selected':''}>${n}</option>`).join('')}
        </select>
        <span style="font-size:12px;color:var(--text-muted);">per halaman &nbsp;·&nbsp; ${start+1}–${end} dari ${total}</span>
      </div>
      <div style="display:flex;align-items:center;gap:4px;">
        <button id="pg-first" class="btn btn-sm" style="font-size:12px;padding:5px 10px;" ${this._page===1?'disabled':''}>«</button>
        <button id="pg-prev"  class="btn btn-sm" style="font-size:12px;padding:5px 10px;" ${this._page===1?'disabled':''}>‹</button>
        ${pageNums.map(p=>p==='…'
          ?`<span style="padding:5px 8px;font-size:12px;color:var(--text-muted);">…</span>`
          :`<button class="btn btn-sm pg-num" data-pg="${p}" style="font-size:12px;padding:5px 10px;${p===this._page?'background:#dc2626;color:#fff;border-color:#dc2626;':''}">${p}</button>`
        ).join('')}
        <button id="pg-next" class="btn btn-sm" style="font-size:12px;padding:5px 10px;" ${this._page===totalPages?'disabled':''}>›</button>
        <button id="pg-last" class="btn btn-sm" style="font-size:12px;padding:5px 10px;" ${this._page===totalPages?'disabled':''}>»</button>
      </div>
    </div>`;
  }

  _bindPgBar(wrap, totalPages, rerender) {
    wrap.querySelector('#pg-size')?.addEventListener('change', e => { this._perPage=Number(e.target.value); this._page=1; rerender(); });
    wrap.querySelector('#pg-first')?.addEventListener('click', ()=>{ this._page=1; rerender(); });
    wrap.querySelector('#pg-prev') ?.addEventListener('click', ()=>{ this._page--; rerender(); });
    wrap.querySelector('#pg-next') ?.addEventListener('click', ()=>{ this._page++; rerender(); });
    wrap.querySelector('#pg-last') ?.addEventListener('click', ()=>{ this._page=totalPages; rerender(); });
    wrap.querySelectorAll('.pg-num').forEach(btn=>{ btn.addEventListener('click',()=>{ this._page=Number(btn.dataset.pg); rerender(); }); });
  }

  destroy() {}
}
