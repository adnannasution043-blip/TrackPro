import { apiFetch, apiUpload } from '../api.js';

export class UploadPage {
  constructor(container) {
    this.container = container;
    this.metaAccounts = [];
    this.shopeeAccounts = [];
  }

  async render() {
    this.container.innerHTML = '<div class="loading">Memuat akun…</div>';
    try {
      [this.metaAccounts, this.shopeeAccounts] = await Promise.all([
        apiFetch('/accounts/meta'),
        apiFetch('/accounts/shopee'),
      ]);
    } catch (e) {
      this.container.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
      return;
    }
    this.container.innerHTML = `
      <div class="page-header"><h1>Upload Data</h1></div>
      ${this._section('meta', '1. Meta Ads CSV', this._metaForm())}
      ${this._section('commission', '2. Shopee Commission CSV', this._shopeeForm('commission'))}
      ${this._section('click', '3. Shopee Click CSV', this._shopeeForm('click'))}
    `;
    this._bind();
  }

  _section(id, title, body) {
    return `
      <div class="card upload-card">
        <div class="card-title">${title}</div>
        ${body}
        <div id="result-${id}" class="upload-result" style="display:none"></div>
      </div>
    `;
  }

  _metaForm() {
    if (!this.metaAccounts.length)
      return '<p class="muted">Belum ada akun Meta. <a href="#/settings">Tambahkan dulu.</a></p>';
    return `
      <form id="form-meta">
        <label>Akun Meta
          <select name="meta_account_id" required>
            <option value="">-- pilih akun --</option>
            ${this.metaAccounts.map(a => `<option value="${a.id}">${a.nama_tampilan} (${a.ad_account_id})</option>`).join('')}
          </select>
        </label>
        <label>File CSV
          <input type="file" name="file" accept=".csv" required>
        </label>
        <button type="submit" class="btn-primary">Upload</button>
      </form>
    `;
  }

  _shopeeForm(type) {
    const id = `form-${type}`;
    if (!this.shopeeAccounts.length)
      return '<p class="muted">Belum ada akun Shopee. <a href="#/settings">Tambahkan dulu.</a></p>';
    return `
      <form id="${id}">
        <label>Akun Shopee
          <select name="shopee_account_id" required>
            <option value="">-- pilih akun --</option>
            ${this.shopeeAccounts.map(a => `<option value="${a.id}">${a.nama_akun}</option>`).join('')}
          </select>
        </label>
        <label>File CSV
          <input type="file" name="file" accept=".csv" required>
        </label>
        <button type="submit" class="btn-primary">Upload</button>
      </form>
    `;
  }

  _bind() {
    const handle = (formId, resultId, buildPath) => {
      const form = this.container.querySelector(`#${formId}`);
      if (!form) return;
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = form.querySelector('button[type=submit]');
        const resultEl = this.container.querySelector(`#${resultId}`);
        btn.disabled = true;
        btn.textContent = 'Mengupload…';
        resultEl.style.display = 'none';

        const fd = new FormData(form);
        const path = buildPath(fd);
        // FormData untuk apiUpload cukup pakai file saja (account_id di query param)
        const fileFd = new FormData();
        fileFd.append('file', fd.get('file'));

        try {
          const res = await apiUpload(path, fileFd);
          if (!res) return;
          const ok = res.baris_diproses, fail = res.baris_gagal;
          resultEl.className = `upload-result alert ${fail === 0 ? 'alert-success' : 'alert-warning'}`;
          resultEl.innerHTML = `
            <strong>${res.status === 'selesai' ? 'Berhasil' : 'Selesai dengan peringatan'}</strong><br>
            ${ok} baris diproses${fail > 0 ? `, ${fail} baris gagal` : ''}.
          `;
        } catch (err) {
          resultEl.className = 'upload-result alert alert-error';
          resultEl.textContent = err.message;
        }

        resultEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Upload';
      });
    };

    handle('form-meta', 'result-meta', fd =>
      `/upload/meta-ads?meta_account_id=${fd.get('meta_account_id')}`
    );
    handle('form-commission', 'result-commission', fd =>
      `/upload/shopee-commission?shopee_account_id=${fd.get('shopee_account_id')}`
    );
    handle('form-click', 'result-click', fd =>
      `/upload/shopee-click?shopee_account_id=${fd.get('shopee_account_id')}`
    );
  }

  destroy() {}
}
