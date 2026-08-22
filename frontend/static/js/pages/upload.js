import { apiUpload, apiFetch } from '../api.js';

export class UploadPage {
  constructor(container) {
    this.container = container;
    this._accounts = [];
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Upload Data Harian</h1>
          <p>Upload CSV Meta Ads, Shopee Commission, dan Shopee Click untuk memetakan campaign ke tag link Shopee.</p>
        </div>
        <div class="page-header-right">
          <button class="btn btn-outline-red" id="btn-hapus-lama">Hapus Data Import Lama</button>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat…</div></div>
    `;

    try {
      const data = await apiFetch('/accounts');
      this._accounts = data || [];
    } catch (_) {}

    this._renderForm();

    this.container.querySelector('#btn-hapus-lama')?.addEventListener('click', () => {
      if (confirm('Hapus semua data import lama? Aksi ini tidak bisa dibatalkan.')) {
        alert('Fitur hapus data belum tersedia.');
      }
    });
  }

  _renderForm() {
    const el = this.container.querySelector('#content');
    const shopeeOptions = this._accounts
      .filter(a => a.tipe === 'shopee')
      .map(a => `<option value="${a.id}">${a.nama}</option>`)
      .join('');

    el.innerHTML = `
      <div class="card" style="margin-bottom:16px;padding:16px 20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px;">Template CSV</div>
            <div style="font-size:12px;color:var(--text-muted);">Download template, isi dengan data asli Anda, lalu upload di bawah.</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${[
              ['template-meta-ads.csv',                    'Meta Ads'],
              ['template-shopee-commission.csv',           'Shopee Komisi'],
              ['template-shopee-click.csv',                'Shopee Klik'],
              ['template-meta-breakdown-placement.csv',    'Breakdown Penempatan'],
              ['template-meta-breakdown-platform.csv',     'Breakdown Platform'],
              ['template-meta-breakdown-age-gender.csv',   'Breakdown Usia & Gender'],
            ].map(([file, label]) => `
              <a href="/static/templates/${file}" download="${file}" class="btn" style="font-size:12px;padding:6px 12px;display:flex;align-items:center;gap:6px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                ${label}
              </a>`).join('')}
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div>
            <div class="form-label">SLOT TAG LINK</div>
            <select class="form-select" id="sel-slot">
              <option value="1">Slot 1 (default)</option>
              <option value="2">Slot 2 / Tag_link2</option>
              <option value="3">Slot 3 / Tag_link3</option>
              <option value="4">Slot 4 / Tag_link4</option>
              <option value="5">Slot 5 / Tag_link5</option>
            </select>
            <div class="form-hint">Pilih kolom Sub_id / Tag_link di Shopee CSV yang berisi tag iklan.</div>
          </div>
          <div>
            <div class="form-label">PEMBEDA TAG</div>
            <select class="form-select" id="sel-pembeda">
              <option value="campaign">Nama Campaign</option>
              <option value="adset">Nama Ad Set</option>
              <option value="ad">Nama Ad</option>
            </select>
            <div class="form-hint">Berlaku per-akun & tersimpan ke setelan akun ini.</div>
          </div>
        </div>

        <div class="form-group">
          <div class="form-label">AKUN SHOPEE</div>
          <select class="form-select" id="sel-shopee">
            <option value="">Pilih Akun Shopee</option>
            ${shopeeOptions || '<option disabled>Belum ada akun Shopee terdaftar</option>'}
          </select>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <div class="form-label" style="margin-bottom:8px;">Shopee Commission CSV</div>
            <div class="upload-zone" id="zone-commission">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p><strong>Pilih file CSV</strong> atau drag & drop</p>
              <p style="font-size:12px;margin-top:4px;">Laporan komisi affiliate dari Shopee</p>
            </div>
            <input type="file" id="file-commission" accept=".csv" style="display:none">
            <div id="name-commission" style="font-size:12px;color:#6b7280;margin-top:4px;"></div>
          </div>
          <div>
            <div class="form-label" style="margin-bottom:8px;">
              Shopee Click CSV
              <span class="badge badge-yellow" style="margin-left:6px;">Opsional</span>
            </div>
            <div class="upload-zone" id="zone-click">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p><strong>Pilih file CSV</strong> atau drag & drop</p>
              <p style="font-size:12px;margin-top:4px;">Laporan klik affiliate dari Shopee</p>
            </div>
            <input type="file" id="file-click" accept=".csv" style="display:none">
            <div id="name-click" style="font-size:12px;color:#6b7280;margin-top:4px;"></div>
          </div>
        </div>

        <div style="margin-top:16px;">
          <div class="form-label" style="margin-bottom:8px;">Meta Ads CSV (Opsional)</div>
          <div class="upload-zone" id="zone-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p><strong>Pilih file CSV</strong> atau drag & drop</p>
            <p style="font-size:12px;margin-top:4px;">Data performa iklan dari Meta Ads Manager</p>
          </div>
          <input type="file" id="file-meta" accept=".csv" style="display:none">
          <div id="name-meta" style="font-size:12px;color:#6b7280;margin-top:4px;"></div>
        </div>

        <div style="margin-top:16px;">
          <div class="form-label" style="margin-bottom:8px;">
            Meta Breakdown CSV
            <span class="badge badge-yellow" style="margin-left:6px;">Opsional</span>
          </div>
          <div style="font-size:12px;color:#6b7280;margin-bottom:8px;">
            Upload 1–3 file breakdown Meta Ads (Penempatan, Platform, atau Usia &amp; Gender). Tipe otomatis terdeteksi dari kolom CSV.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div>
              <div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:6px;">PENEMPATAN</div>
              <div class="upload-zone" id="zone-breakdown-placement" style="padding:16px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:24px;height:24px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p style="font-size:12px;margin-top:6px;"><strong>Pilih file</strong></p>
                <p style="font-size:11px;color:#9ca3af;">kolom: Placement</p>
              </div>
              <input type="file" id="file-breakdown-placement" accept=".csv" style="display:none">
              <div id="name-breakdown-placement" style="font-size:11px;color:#6b7280;margin-top:4px;"></div>
            </div>
            <div>
              <div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:6px;">PLATFORM</div>
              <div class="upload-zone" id="zone-breakdown-platform" style="padding:16px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:24px;height:24px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p style="font-size:12px;margin-top:6px;"><strong>Pilih file</strong></p>
                <p style="font-size:11px;color:#9ca3af;">kolom: Platform</p>
              </div>
              <input type="file" id="file-breakdown-platform" accept=".csv" style="display:none">
              <div id="name-breakdown-platform" style="font-size:11px;color:#6b7280;margin-top:4px;"></div>
            </div>
            <div>
              <div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:6px;">USIA & GENDER</div>
              <div class="upload-zone" id="zone-breakdown-age" style="padding:16px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:24px;height:24px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p style="font-size:12px;margin-top:6px;"><strong>Pilih file</strong></p>
                <p style="font-size:11px;color:#9ca3af;">kolom: Age + Gender</p>
              </div>
              <input type="file" id="file-breakdown-age" accept=".csv" style="display:none">
              <div id="name-breakdown-age" style="font-size:11px;color:#6b7280;margin-top:4px;"></div>
            </div>
          </div>
        </div>

        <div id="upload-error" class="alert alert-error" style="display:none;margin-top:12px;"></div>
        <div id="upload-success" class="alert alert-success" style="display:none;margin-top:12px;"></div>

        <div style="margin-top:16px;display:flex;justify-content:flex-end;">
          <button class="btn btn-primary" id="btn-upload" style="padding:9px 32px;">
            Upload & Proses
          </button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;margin-bottom:4px;">Pembayaran WD Shopee</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">
          Upload <strong>BillConversionReport</strong> dari Shopee Affiliate (format .csv atau .xlsx).
          Data akan ditampilkan di Komisi Bersih dengan kalkulasi pajak progresif.
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <div class="form-label">AKUN SHOPEE</div>
          <select class="form-select" id="sel-shopee-wd">
            <option value="">Pilih Akun Shopee</option>
            ${shopeeOptions || '<option disabled>Belum ada akun Shopee terdaftar</option>'}
          </select>
        </div>

        <div class="upload-zone" id="zone-wd" style="max-width:480px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p><strong>Pilih file CSV / XLSX</strong> atau drag & drop</p>
          <p style="font-size:12px;margin-top:4px;">BillConversionReport dari Shopee Affiliate</p>
        </div>
        <input type="file" id="file-wd" accept=".csv,.xlsx" style="display:none">
        <div id="name-wd" style="font-size:12px;color:#6b7280;margin-top:4px;"></div>

        <div id="wd-error"   class="alert alert-error"   style="display:none;margin-top:10px;"></div>
        <div id="wd-success" class="alert alert-success" style="display:none;margin-top:10px;"></div>

        <div style="margin-top:12px;display:flex;justify-content:flex-end;">
          <button class="btn btn-primary" id="btn-upload-wd" style="padding:9px 32px;">Upload WD</button>
        </div>
      </div>
    `;

    this._bindUploadZone('zone-commission', 'file-commission', 'name-commission');
    this._bindUploadZone('zone-click', 'file-click', 'name-click');
    this._bindUploadZone('zone-meta', 'file-meta', 'name-meta');
    this._bindUploadZone('zone-breakdown-placement', 'file-breakdown-placement', 'name-breakdown-placement');
    this._bindUploadZone('zone-breakdown-platform', 'file-breakdown-platform', 'name-breakdown-platform');
    this._bindUploadZone('zone-breakdown-age', 'file-breakdown-age', 'name-breakdown-age');
    this._bindUploadZone('zone-wd', 'file-wd', 'name-wd');

    el.querySelector('#btn-upload').addEventListener('click', () => this._submit());
    el.querySelector('#btn-upload-wd').addEventListener('click', () => this._submitWd());
  }

  _bindUploadZone(zoneId, fileId, nameId) {
    const zone = this.container.querySelector(`#${zoneId}`);
    const input = this.container.querySelector(`#${fileId}`);
    const nameEl = this.container.querySelector(`#${nameId}`);

    zone.addEventListener('click', () => input.click());

    input.addEventListener('change', () => {
      if (input.files[0]) {
        nameEl.textContent = `✓ ${input.files[0].name}`;
        zone.style.borderColor = '#dc2626';
        zone.style.background = '#fef2f2';
      }
    });

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('active');
    });

    zone.addEventListener('dragleave', () => zone.classList.remove('active'));

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('active');
      const file = e.dataTransfer.files[0];
      if (file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        nameEl.textContent = `✓ ${file.name}`;
        zone.style.borderColor = '#dc2626';
        zone.style.background = '#fef2f2';
      }
    });
  }

  async _submit() {
    const errEl = this.container.querySelector('#upload-error');
    const successEl = this.container.querySelector('#upload-success');
    const btn = this.container.querySelector('#btn-upload');
    errEl.style.display = 'none';
    successEl.style.display = 'none';

    const shopeeId = this.container.querySelector('#sel-shopee').value;
    const tagSlot  = this.container.querySelector('#sel-slot').value || '1';
    const commFile = this.container.querySelector('#file-commission').files[0];
    const clickFile = this.container.querySelector('#file-click').files[0];
    const metaFile  = this.container.querySelector('#file-meta').files[0];
    const bdPlacement = this.container.querySelector('#file-breakdown-placement').files[0];
    const bdPlatform  = this.container.querySelector('#file-breakdown-platform').files[0];
    const bdAge       = this.container.querySelector('#file-breakdown-age').files[0];
    const anyBreakdown = bdPlacement || bdPlatform || bdAge;

    const needsShopee = commFile || clickFile;
    if (needsShopee && !shopeeId) {
      errEl.textContent = 'Pilih akun Shopee terlebih dahulu.';
      errEl.style.display = 'block';
      return;
    }
    if (!commFile && !metaFile && !anyBreakdown) {
      errEl.textContent = 'Upload minimal satu file CSV.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Memproses…';

    const results = [];

    try {
      if (commFile) {
        const fd = new FormData();
        fd.append('file', commFile);
        const res = await apiUpload(`/upload/shopee-commission?shopee_account_id=${shopeeId}&tag_slot=${tagSlot}`, fd);
        results.push(`Komisi: ${res?.baris_diproses ?? 0} baris berhasil`);
      }

      if (clickFile) {
        const fd = new FormData();
        fd.append('file', clickFile);
        const res = await apiUpload(`/upload/shopee-click?shopee_account_id=${shopeeId}&tag_slot=${tagSlot}`, fd);
        results.push(`Klik: ${res?.baris_diproses ?? 0} baris berhasil`);
      }

      if (metaFile) {
        const metaAccounts = this._accounts.filter(a => a.tipe === 'meta');
        if (metaAccounts.length === 0) {
          errEl.textContent = 'Tambah akun Meta Ads dulu di Pengaturan → Akun Meta.';
          errEl.style.display = 'block';
        } else {
          const metaId = metaAccounts[0].id;
          const fd = new FormData();
          fd.append('file', metaFile);
          const res = await apiUpload(`/upload/meta-ads?meta_account_id=${metaId}`, fd);
          results.push(`Meta Ads: ${res?.baris_diproses ?? 0} baris berhasil`);
        }
      }

      const metaAccounts = this._accounts.filter(a => a.tipe === 'meta');
      const metaId = metaAccounts[0]?.id;
      for (const [f, label] of [
        [bdPlacement, 'Breakdown Penempatan'],
        [bdPlatform,  'Breakdown Platform'],
        [bdAge,       'Breakdown Usia & Gender'],
      ]) {
        if (f && metaId) {
          const fdBd = new FormData();
          fdBd.append('file', f);
          const res = await apiUpload(`/upload/meta-breakdown?meta_account_id=${metaId}`, fdBd);
          results.push(`${label}: ${res?.baris_diproses ?? 0} baris berhasil`);
        }
      }

      if (results.length > 0) {
        successEl.textContent = 'Upload berhasil! ' + results.join(' · ');
        successEl.style.display = 'block';
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Upload & Proses';
    }
  }

  async _submitWd() {
    const errEl = this.container.querySelector('#wd-error');
    const successEl = this.container.querySelector('#wd-success');
    const btn = this.container.querySelector('#btn-upload-wd');
    errEl.style.display = 'none';
    successEl.style.display = 'none';

    const shopeeId = this.container.querySelector('#sel-shopee-wd').value;
    const file = this.container.querySelector('#file-wd').files[0];

    if (!shopeeId) {
      errEl.textContent = 'Pilih akun Shopee terlebih dahulu.';
      errEl.style.display = 'block';
      return;
    }
    if (!file) {
      errEl.textContent = 'Pilih file BillConversionReport terlebih dahulu.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Memproses…';

    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiUpload(`/upload/wd-payment?shopee_account_id=${shopeeId}`, fd);
      successEl.textContent = `Upload berhasil! ${res?.baris_diproses ?? 0} hari data WD tersimpan.`;
      successEl.style.display = 'block';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Upload WD';
    }
  }

  destroy() {}
}
