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

const FILTERS = [
  { key: 'semua',        label: 'Semua' },
  { key: 'organic',      label: 'Organic' },
  { key: 'meta',         label: 'Meta' },
  { key: 'adu',          label: 'Adu' },
  { key: 'terra',        label: 'Terra' },
  { key: 'meta_pribadi', label: 'Meta Pribadi' },
  { key: 'live',         label: 'Live' },
];

export class KomisiBersih2Page {
  constructor(container) {
    this.container = container;
    this.dari      = firstOfMonth();
    this.sampai    = todayStr();
    this._spendMap = {};
    this._dates    = [];
    this._wdRows   = [];
    this._tab      = 'komisi';
    this._filters  = new Set(); // kosong = semua — sama pola kayak Laporan Harian
    this._page     = 1;
    this._perPage  = 10;
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Pembayaran WD (Baru)</h1>
          <p>Komisi after tax PPh 21 — format & filter disamakan dengan Laporan Harian. Halaman uji coba, belum menggantikan Pembayaran WD lama.</p>
        </div>
        <div class="page-header-right" style="display:flex;gap:8px;align-items:center;">
          <input type="date" id="inp-dari"   class="form-input" style="width:140px;" value="${this.dari}">
          <span style="color:var(--text-muted)">–</span>
          <input type="date" id="inp-sampai" class="form-input" style="width:140px;" value="${this.sampai}">
          <button class="btn btn-primary" id="btn-terapkan">Terapkan</button>
        </div>
      </div>

      <div style="display:flex;gap:0;align-items:center;border-bottom:2px solid var(--border);margin-bottom:14px;" id="tab-bar">
        ${TABS.map((t,i) => `
          <button class="kb-tab" data-tab="${t.key}"
            style="padding:10px 20px;border:none;background:none;cursor:pointer;font-size:13.5px;font-weight:600;
            color:${i===0?'#dc2626':'var(--text-muted)'};
            border-bottom:${i===0?'2px solid #dc2626':'2px solid transparent'};margin-bottom:-2px;">
            ${t.label}
          </button>`).join('')}
        <button id="btn-biaya-layanan" class="btn btn-sm" style="margin-left:auto;margin-bottom:8px;">
          + Biaya Layanan
        </button>
        <button id="btn-reset-wd" class="btn btn-sm" style="margin-bottom:8px;color:#dc2626;border-color:#dc2626;">
          Reset Data WD
        </button>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center;" id="filter-pills">
        ${FILTERS.map(f => {
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
      </div>

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

    this.container.querySelector('#tab-bar').addEventListener('click', e => {
      const btn = e.target.closest('.kb-tab');
      if (!btn) return;
      this._tab  = btn.dataset.tab;
      this._page = 1;
      this.container.querySelectorAll('.kb-tab').forEach(b => {
        const on = b.dataset.tab === this._tab;
        b.style.color        = on ? '#dc2626' : 'var(--text-muted)';
        b.style.borderBottom = on ? '2px solid #dc2626' : '2px solid transparent';
      });
      const pillsEl = this.container.querySelector('#filter-pills');
      if (pillsEl) pillsEl.style.display = this._tab === 'komisi' ? 'flex' : 'none';
      this._render();
    });

    this.container.querySelector('#filter-pills').addEventListener('click', e => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      const key = btn.dataset.filter;
      if (key === 'semua') {
        this._filters.clear();
      } else {
        if (this._filters.has(key)) this._filters.delete(key);
        else this._filters.add(key);
      }
      this.container.querySelectorAll('[data-filter]').forEach(b => {
        const k  = b.dataset.filter;
        const on = k === 'semua' ? this._filters.size === 0 : this._filters.has(k);
        b.style.background  = on ? '#dc2626' : 'var(--bg-card)';
        b.style.color       = on ? '#fff' : 'var(--text)';
        b.style.borderColor = on ? '#dc2626' : 'var(--border)';
      });
      this._page = 1;
      this._render();
    });

    this.container.querySelector('#btn-reset-wd').addEventListener('click', () => this._resetWd());
    this.container.querySelector('#btn-biaya-layanan').addEventListener('click', () => this._inputBiayaLayanan());

    this._load();
  }

  // Modal input manual Biaya Layanan (tanggal + nominal) — dikurangi dari
  // komisi SEBELUM dihitung PPh 21 di tab "Komisi & Profit" (lihat _renderKomisi).
  _inputBiayaLayanan() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:10px;padding:24px;width:360px;max-width:90vw;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
        <h3 style="margin:0 0 4px;font-size:16px;">Biaya Layanan</h3>
        <p style="font-size:12.5px;color:#6b7280;margin:0 0 16px;">
          Dikurangi dari komisi tanggal itu sebelum dihitung PPh 21. Kalau tanggalnya
          sudah pernah diisi, nilainya akan diganti (bukan ditambah).
        </p>
        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">Tanggal</label>
          <input type="date" id="bl-tanggal" class="form-input" style="width:100%;" value="${todayStr()}">
        </div>
        <div style="margin-bottom:18px;">
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">Nominal (Rp)</label>
          <input type="number" id="bl-jumlah" class="form-input" style="width:100%;" min="0" step="1" placeholder="0">
        </div>
        <div id="bl-error" style="display:none;color:#dc2626;font-size:12.5px;margin-bottom:12px;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="bl-cancel" class="btn">Batal</button>
          <button id="bl-save" class="btn btn-primary">Simpan</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#bl-cancel').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    overlay.querySelector('#bl-save').onclick = async () => {
      const errEl   = overlay.querySelector('#bl-error');
      const saveBtn = overlay.querySelector('#bl-save');
      const tanggal = overlay.querySelector('#bl-tanggal').value;
      const jumlah  = Number(overlay.querySelector('#bl-jumlah').value);
      errEl.style.display = 'none';

      if (!tanggal) { errEl.textContent = 'Pilih tanggal dulu.'; errEl.style.display = 'block'; return; }
      if (!(jumlah >= 0)) { errEl.textContent = 'Nominal tidak valid.'; errEl.style.display = 'block'; return; }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Menyimpan…';
      try {
        await apiFetch('/biaya-layanan', {
          method: 'POST',
          body: JSON.stringify({ tanggal, jumlah }),
        });
        close();
        await this._load();
      } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Simpan';
      }
    };
  }

  async _resetWd() {
    const ok = await this._confirmModal(
      'Hapus SEMUA data Pembayaran WD (semua akun Shopee) yang sudah pernah diupload? Tindakan ini tidak bisa dibatalkan — Anda perlu upload ulang file BillConversionReport dari awal. Ini data yang SAMA dipakai halaman Pembayaran WD lama.'
    );
    if (!ok) return;

    const btn = this.container.querySelector('#btn-reset-wd');
    btn.disabled = true;
    btn.textContent = 'Menghapus…';
    try {
      await apiFetch('/upload/wd-payment', { method: 'DELETE' });
      await this._load();
    } catch (e) {
      alert(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Reset Data WD';
    }
  }

  // Modal konfirmasi generik — resolve(true) kalau user klik tombol aksi,
  // resolve(false) kalau Batal / klik di luar modal.
  _confirmModal(message, confirmLabel = 'Hapus') {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
      overlay.innerHTML = `
        <div style="background:#fff;border-radius:10px;padding:24px;width:420px;max-width:90vw;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
          <h3 style="margin:0 0 10px;color:#dc2626;font-size:16px;">Konfirmasi Hapus</h3>
          <p style="font-size:13.5px;color:#6b7280;margin:0 0 20px;">${message}</p>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button id="confirm-cancel" class="btn">Batal</button>
            <button id="confirm-ok" class="btn" style="background:#dc2626;color:white;border-color:#dc2626;">${confirmLabel}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const close = (result) => { overlay.remove(); resolve(result); };
      overlay.querySelector('#confirm-cancel').onclick = () => close(false);
      overlay.querySelector('#confirm-ok').onclick = () => close(true);
      overlay.onclick = (e) => { if (e.target === overlay) close(false); };
    });
  }

  async _load() {
    const wrap = this.container.querySelector('#tbl-wrap');
    wrap.innerHTML = '<div class="loading" style="padding:32px;text-align:center;">Memuat…</div>';
    try {
      const qs = filterQS ? filterQS() : '';
      const [dash, wd, biaya] = await Promise.all([
        apiFetch(`/dashboard?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}${qs}`),
        apiFetch(`/upload/wd-payment?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}`),
        apiFetch(`/biaya-layanan?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}`),
      ]);

      this._spendMap        = {};
      this._wdLiveMap       = {};
      this._wdOrganikMap    = {};
      this._wdIklanMap      = {};
      this._wdStoryMap      = {};
      this._wdFeedMap       = {};
      this._wdMetaMap       = {};
      this._wdAduMap        = {};
      this._wdTerraMap      = {};
      this._wdMetaPribadiMap = {};
      this._biayaLayananMap = {};
      const dateSet         = new Set();

      for (const row of (dash?.harian || [])) {
        this._spendMap[row.tanggal] = Number(row.spend_idr || 0);
        dateSet.add(row.tanggal);
      }
      // Semua komisi (breakdown + organik/iklan/live) dari file WD Payment —
      // BUKAN dari CSV Komisi Shopee. Cuma Budget Iklan (spend) yang tetap
      // dari CSV Meta Ads, karena WD Payment tidak punya data belanja iklan.
      for (const row of (wd || [])) {
        this._wdLiveMap[row.tanggal]        = Number(row.komisi_live || 0);
        this._wdOrganikMap[row.tanggal]     = Number(row.komisi_organik || 0);
        this._wdIklanMap[row.tanggal]       = Number(row.komisi_iklan || 0);
        this._wdStoryMap[row.tanggal]       = Number(row.komisi_story || 0);
        this._wdFeedMap[row.tanggal]        = Number(row.komisi_feed || 0);
        this._wdMetaMap[row.tanggal]        = Number(row.komisi_meta || 0);
        this._wdAduMap[row.tanggal]         = Number(row.komisi_adu || 0);
        this._wdTerraMap[row.tanggal]       = Number(row.komisi_terra || 0);
        this._wdMetaPribadiMap[row.tanggal] = Number(row.komisi_meta_pribadi || 0);
        dateSet.add(row.tanggal);
      }
      // Biaya Layanan — input manual, dikurangi dari komisi SEBELUM PPh 21
      // dihitung (lihat _renderKomisi).
      for (const row of (biaya || [])) {
        this._biayaLayananMap[row.tanggal] = Number(row.jumlah || 0);
        dateSet.add(row.tanggal);
      }
      // Tanggal terbaru di paling atas — sama pola kayak Laporan Harian
      this._dates  = [...dateSet].sort((a, b) => b.localeCompare(a));
      this._wdRows = calcWdTax((wd || []).sort((a,b) => a.tanggal.localeCompare(b.tanggal)));
      this._page   = 1;
      this._render();
    } catch (e) {
      wrap.innerHTML = `<div class="alert alert-error" style="margin:16px;">${e.message}</div>`;
    }
  }

  _render() {
    if (this._tab === 'pajak') { this._renderPajak(); return; }
    this._renderKomisi();
  }

  _pgHtml(total, pgWrap) {
    const totalPages = Math.ceil(total / this._perPage);
    if (!pgWrap) return totalPages;
    if (totalPages <= 1 && total <= Math.min(...[10,20,30,50])) { pgWrap.innerHTML = ''; return totalPages; }
    const startIdx = (this._page - 1) * this._perPage;
    const pp = this._perPage;
    const pageNums = Array.from({length:totalPages},(_,i)=>i+1)
      .filter(p=>p===1||p===totalPages||Math.abs(p-this._page)<=2)
      .reduce((acc,p,i,arr)=>{if(i>0&&p-arr[i-1]>1)acc.push('…');acc.push(p);return acc;},[]);
    pgWrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 4px;margin-top:8px;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <select id="pg-size" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg-card);color:var(--text);cursor:pointer;">
            ${[10,20,30,50].map(n=>`<option value="${n}"${pp===n?' selected':''}>${n}</option>`).join('')}
          </select>
          <span style="font-size:12px;color:var(--text-muted);">per halaman &nbsp;·&nbsp; ${startIdx+1}–${Math.min(startIdx+pp, total)} dari ${total}</span>
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
    pgWrap.querySelector('#pg-size')?.addEventListener('change', e=>{ this._perPage=Number(e.target.value); this._page=1; this._render(); });
    pgWrap.querySelector('#pg-first')?.addEventListener('click', ()=>{ this._page=1; this._render(); });
    pgWrap.querySelector('#pg-prev') ?.addEventListener('click', ()=>{ this._page--; this._render(); });
    pgWrap.querySelector('#pg-next') ?.addEventListener('click', ()=>{ this._page++; this._render(); });
    pgWrap.querySelector('#pg-last') ?.addEventListener('click', ()=>{ this._page=totalPages; this._render(); });
    pgWrap.querySelectorAll('.pg-num').forEach(btn=>{ btn.addEventListener('click',()=>{ this._page=Number(btn.dataset.pg); this._render(); }); });
    return totalPages;
  }

  // Filter pills cuma nentuin kolom BREAKDOWN mana yang ditampilkan (Story/
  // Feed/Meta/Adu/Terra/Meta Pribadi/Live) — TIDAK mengubah perhitungan
  // pajak/profit/komisi bersih, yang selalu dari total penuh periode itu.
  // Sengaja beda dari Laporan Harian yang "Total Kotor"-nya ikut menyusut
  // sesuai filter — di sini pajak PPh 21 riil, tidak masuk akal kalau
  // kewajiban pajak "berkurang" cuma karena tampilan difilter.
  _getVisibleCols() {
    if (this._filters.size === 0) {
      return { story:true, feed:true, meta:true, adu:true, terra:true, metaPribadi:true, live:true };
    }
    const c = { story:false, feed:false, meta:false, adu:false, terra:false, metaPribadi:false, live:false };
    if (this._filters.has('organic'))    { c.story = true; c.feed = true; }
    if (this._filters.has('meta'))         c.meta = true;
    if (this._filters.has('adu'))          c.adu = true;
    if (this._filters.has('terra'))        c.terra = true;
    if (this._filters.has('meta_pribadi')) c.metaPribadi = true;
    if (this._filters.has('live'))         c.live = true;
    return c;
  }

  // Tanggal yang ditampilkan — dipersempit kalau ada filter aktif dan
  // tanggal itu tidak punya komisi sama sekali di kategori yang dipilih.
  _visibleDates() {
    if (this._filters.size === 0) return this._dates;
    return this._dates.filter(tgl => {
      return [...this._filters].some(f => {
        if (f === 'organic')      return (this._wdStoryMap[tgl]||0) > 0 || (this._wdFeedMap[tgl]||0) > 0;
        if (f === 'meta')         return (this._wdMetaMap[tgl]||0) > 0;
        if (f === 'adu')          return (this._wdAduMap[tgl]||0) > 0;
        if (f === 'terra')        return (this._wdTerraMap[tgl]||0) > 0;
        if (f === 'meta_pribadi') return (this._wdMetaPribadiMap[tgl]||0) > 0;
        if (f === 'live')         return (this._wdLiveMap[tgl]||0) > 0;
        return false;
      });
    });
  }

  _renderKomisi() {
    const wrap   = this.container.querySelector('#tbl-wrap');
    const pgWrap = this.container.querySelector('#pagination-wrap');
    const dates  = this._visibleDates();
    const c      = this._getVisibleCols();
    if (!dates.length) {
      wrap.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);">Tidak ada data untuk rentang tanggal / filter ini.</div>';
      if (pgWrap) pgWrap.innerHTML = '';
      return;
    }

    // Hitung pajak progresif kumulatif per bulan dari SEMUA tanggal di
    // rentang (bukan cuma yang lolos filter tampilan), biar akumulasi DPP
    // bulanan tetap benar walau lagi lihat filter tertentu.
    const cumByMonth = {};
    const calcForDate = (tgl) => {
      const spend = this._spendMap[tgl] || 0;
      const live  = this._wdLiveMap[tgl] || 0;
      const grossOrganik = live + (this._wdOrganikMap[tgl] || 0);
      const grossIklan   = this._wdIklanMap[tgl] || 0;
      const grossTotal   = grossOrganik + grossIklan;
      const biaya        = this._biayaLayananMap[tgl] || 0;

      const netKomisi = grossTotal - biaya;
      const bulan  = tgl.slice(0, 7);
      const dpp    = netKomisi * 0.5;
      const prevCum = cumByMonth[bulan] || 0;
      const currCum = prevCum + dpp;
      cumByMonth[bulan] = currCum;
      const pajak  = progressiveTax(currCum) - progressiveTax(prevCum);

      const potongan = pajak + biaya;
      const ratio   = grossTotal > 0 ? grossOrganik / grossTotal : 0.5;
      const organik = grossOrganik - potongan * ratio;
      const iklan   = grossIklan   - potongan * (1 - ratio);

      const totalMasuk  = organik + iklan;
      const profitIklan = iklan - spend;
      const totalBersih = organik + profitIklan;

      return {
        tgl, live, biaya, organik, iklan, totalMasuk, spend, profitIklan, totalBersih, pajak,
        story: this._wdStoryMap[tgl] || 0,
        feed: this._wdFeedMap[tgl] || 0,
        meta: this._wdMetaMap[tgl] || 0,
        adu: this._wdAduMap[tgl] || 0,
        terra: this._wdTerraMap[tgl] || 0,
        metaPribadi: this._wdMetaPribadiMap[tgl] || 0,
        tarif: tarifLabel(currCum),
      };
    };
    // Jalankan buat SEMUA tanggal urut kronologis dulu (biar DPP kumulatif
    // benar), simpan hasil per tanggal, baru pilih yang lolos filter.
    const chronological = this._dates.slice().sort((a,b) => a.localeCompare(b));
    const byDate = {};
    for (const tgl of chronological) byDate[tgl] = calcForDate(tgl);
    const rows = dates.map(tgl => byDate[tgl]); // dates sudah urut terbaru-di-atas

    const tot = rows.reduce((a, r) => ({
      live:         a.live        + r.live,
      biaya:        a.biaya       + r.biaya,
      organik:      a.organik     + r.organik,
      iklan:        a.iklan       + r.iklan,
      totalMasuk:   a.totalMasuk  + r.totalMasuk,
      spend:        a.spend       + r.spend,
      profitIklan:  a.profitIklan + r.profitIklan,
      totalBersih:  a.totalBersih + r.totalBersih,
      pajak:        a.pajak       + r.pajak,
      story:        a.story       + r.story,
      feed:         a.feed        + r.feed,
      meta:         a.meta        + r.meta,
      adu:          a.adu         + r.adu,
      terra:        a.terra       + r.terra,
      metaPribadi:  a.metaPribadi + r.metaPribadi,
    }), { live:0, biaya:0, organik:0, iklan:0, totalMasuk:0, spend:0, profitIklan:0, totalBersih:0, pajak:0, story:0, feed:0, meta:0, adu:0, terra:0, metaPribadi:0 });

    const totalPages = Math.ceil(rows.length / this._perPage);
    if (this._page > totalPages) this._page = Math.max(1, totalPages);
    const startIdx = (this._page - 1) * this._perPage;
    const pageRows = rows.slice(startIdx, startIdx + this._perPage);

    // ── styles ────────────────────────────────────────────────────────────────
    const thBase = 'padding:8px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;text-align:right;';
    const tdBase = 'padding:7px 10px;text-align:right;white-space:nowrap;';
    const GRP0   = { bg:'#fdf2f8', border:'#db2777', color:'#db2777' }; // breakdown – pink
    const GRP1   = { bg:'#f5f3ff', border:'#7c3aed', color:'#7c3aed' }; // organik – ungu
    const GRP2   = { bg:'#fef2f2', border:'#dc2626', color:'#dc2626' }; // profit iklan – merah
    const GRP3   = { bg:'#f0fdf4', border:'#16a34a', color:'#16a34a' }; // bersih – hijau
    const grpHdr = (g, label, cols) =>
      `<th colspan="${cols}" style="${thBase}background:${g.bg};color:${g.color};border-bottom:2px solid ${g.border};text-align:center;">${label}</th>`;

    const breakdownCols  = (c.live?1:0)+(c.story?1:0)+(c.feed?1:0)+(c.meta?1:0)+(c.adu?1:0)+(c.terra?1:0)+(c.metaPribadi?1:0);
    const hasBreakdown   = breakdownCols > 0;

    const h1Breakdown = hasBreakdown ? grpHdr(GRP0, 'Breakdown Komisi (mentah, sebelum pajak)', breakdownCols) : '';
    const h2Breakdown = [
      c.live        ? `<th style="${thBase}background:${GRP0.bg};color:${GRP0.color};">LIVE</th>` : '',
      c.story       ? `<th style="${thBase}background:${GRP0.bg};color:${GRP0.color};">STORY</th>` : '',
      c.feed        ? `<th style="${thBase}background:${GRP0.bg};color:${GRP0.color};">FEED</th>` : '',
      c.meta        ? `<th style="${thBase}background:${GRP0.bg};color:${GRP0.color};">META</th>` : '',
      c.adu         ? `<th style="${thBase}background:${GRP0.bg};color:${GRP0.color};">ADU</th>` : '',
      c.terra       ? `<th style="${thBase}background:${GRP0.bg};color:${GRP0.color};">TERRA</th>` : '',
      c.metaPribadi ? `<th style="${thBase}background:${GRP0.bg};color:${GRP0.color};">META PRIBADI</th>` : '',
    ].join('');

    const bodyRows = pageRows.map((r, i) => {
      const stripe = i%2===1 ? 'background:var(--bg-muted);' : '';
      const pColor = r.profitIklan >= 0 ? '#16a34a' : '#dc2626';
      const tColor = r.totalBersih >= 0 ? '#16a34a' : '#dc2626';
      const tdBreakdown = [
        c.live        ? `<td style="${tdBase}color:${GRP0.color};">${rp(r.live)}</td>` : '',
        c.story       ? `<td style="${tdBase}color:${GRP0.color};">${rp(r.story)}</td>` : '',
        c.feed        ? `<td style="${tdBase}color:${GRP0.color};">${rp(r.feed)}</td>` : '',
        c.meta        ? `<td style="${tdBase}color:${GRP0.color};">${rp(r.meta)}</td>` : '',
        c.adu         ? `<td style="${tdBase}color:${GRP0.color};">${rp(r.adu)}</td>` : '',
        c.terra       ? `<td style="${tdBase}color:${GRP0.color};">${rp(r.terra)}</td>` : '',
        c.metaPribadi ? `<td style="${tdBase}color:${GRP0.color};">${rp(r.metaPribadi)}</td>` : '',
      ].join('');
      return `<tr style="${stripe}">
        <td style="padding:7px 10px;font-weight:600;white-space:nowrap;">${fmtDate(r.tgl)}</td>
        <td style="text-align:center;padding:7px 8px;">
          <span style="display:inline-block;padding:2px 7px;border-radius:9999px;font-size:11px;font-weight:700;background:#fef3c7;color:#92400e;">${r.tarif}</span>
        </td>
        ${tdBreakdown}
        <td style="${tdBase}color:#7c3aed;">${rp(r.organik)}</td>
        <td style="${tdBase}color:#7c3aed;">${rp(r.iklan)}</td>
        <td style="${tdBase}color:#dc2626;">${r.biaya ? '(' + rp(r.biaya) + ')' : rp(0)}</td>
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
    const tfBreakdown = [
      c.live        ? `<td style="${tdBase}color:${GRP0.color};">${rp(tot.live)}</td>` : '',
      c.story       ? `<td style="${tdBase}color:${GRP0.color};">${rp(tot.story)}</td>` : '',
      c.feed        ? `<td style="${tdBase}color:${GRP0.color};">${rp(tot.feed)}</td>` : '',
      c.meta        ? `<td style="${tdBase}color:${GRP0.color};">${rp(tot.meta)}</td>` : '',
      c.adu         ? `<td style="${tdBase}color:${GRP0.color};">${rp(tot.adu)}</td>` : '',
      c.terra       ? `<td style="${tdBase}color:${GRP0.color};">${rp(tot.terra)}</td>` : '',
      c.metaPribadi ? `<td style="${tdBase}color:${GRP0.color};">${rp(tot.metaPribadi)}</td>` : '',
    ].join('');

    wrap.innerHTML = `
      <table class="data-table" style="min-width:${980 + breakdownCols*110}px;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:none;">
            <th rowspan="2" style="${thBase}text-align:left;vertical-align:bottom;min-width:80px;">TGL</th>
            <th rowspan="2" style="${thBase}vertical-align:bottom;text-align:center;background:#fffbeb;color:#92400e;">TARIF</th>
            ${h1Breakdown}
            ${grpHdr(GRP1, 'Komisi Bersih after Tax (PPh 21)', 4)}
            ${grpHdr(GRP2, 'Profit Iklan', 3)}
            ${grpHdr(GRP3, 'Komisi Bersih', 3)}
          </tr>
          <tr>
            ${h2Breakdown}
            <th style="${thBase}background:${GRP1.bg};color:${GRP1.color};">Komisi Organik</th>
            <th style="${thBase}background:${GRP1.bg};color:${GRP1.color};">Komisi Iklan</th>
            <th style="${thBase}background:${GRP1.bg};color:${GRP1.color};">Biaya Layanan</th>
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
            ${tfBreakdown}
            <td style="${tdBase}color:#7c3aed;">${rp(tot.organik)}</td>
            <td style="${tdBase}color:#7c3aed;">${rp(tot.iklan)}</td>
            <td style="${tdBase}color:#dc2626;">${tot.biaya ? '(' + rp(tot.biaya) + ')' : rp(0)}</td>
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
        <strong>PPh 21 Progresif</strong> — DPP = (Komisi − Biaya Layanan) × 50%, kumulatif per bulan:
        ≤60 jt → 5% · 60–250 jt → 15% · 250–500 jt → 25% · 500 jt–5 M → 30% · >5 M → 35%
        &nbsp;·&nbsp; Total pajak periode ini: <strong>Rp ${rp(tot.pajak)}</strong>
        &nbsp;·&nbsp; Total Biaya Layanan: <strong>Rp ${rp(tot.biaya)}</strong>
        &nbsp;·&nbsp; <em>Filter di atas cuma nampilin/nyembunyiin kolom breakdown — pajak &amp; profit selalu dari total penuh periode ini.</em>
      </div>`;
    this._pgHtml(rows.length, pgWrap);
  }

  _renderPajak() {
    const wrap   = this.container.querySelector('#tbl-wrap');
    const pgWrap = this.container.querySelector('#pagination-wrap');
    if (!this._wdRows.length) {
      wrap.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--text-muted);">
          <p>Belum ada data Pembayaran WD.</p>
          <p style="font-size:12px;margin-top:6px;">Upload <strong>BillConversionReport</strong> di halaman <a href="#/upload" style="color:#dc2626;">Upload Data</a>.</p>
        </div>`;
      if (pgWrap) pgWrap.innerHTML = '';
      return;
    }

    const thS = 'padding:9px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;';
    const totKomisi = this._wdRows.reduce((s,r) => s+Number(r.total_komisi),0);
    const totDpp    = this._wdRows.reduce((s,r) => s+r.dpp,0);
    const totPajak  = this._wdRows.reduce((s,r) => s+r.pajak,0);
    const totBersih = this._wdRows.reduce((s,r) => s+r.bersih,0);

    const totalPages = Math.ceil(this._wdRows.length / this._perPage);
    if (this._page > totalPages) this._page = Math.max(1, totalPages);
    const startIdx = (this._page - 1) * this._perPage;
    const pageWdRows = this._wdRows.slice(startIdx, startIdx + this._perPage);

    let prevBulan = '';
    const bodyRows = pageWdRows.map((r,i) => {
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
    this._pgHtml(this._wdRows.length, pgWrap);
  }

  destroy() {}
}
