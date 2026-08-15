import { apiFetch } from '../api.js';

export class MetaAccountPage {
  constructor(container) {
    this.container = container;
    this._meta   = [];
    this._shopee = [];
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Pengaturan Akun</h1>
          <p>Kelola akun Meta Ads dan akun Shopee Affiliate secara terpisah.</p>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;
    await this._load();
  }

  async _load() {
    const el = this.container.querySelector('#content');
    try {
      const all = await apiFetch('/accounts');
      this._meta   = (all || []).filter(a => a.tipe === 'meta');
      this._shopee = (all || []).filter(a => a.tipe === 'shopee');
      this._render(el);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _render(el) {
    el.innerHTML = `
      <!-- ===== SECTION META ===== -->
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <div style="font-size:14px;font-weight:700;">Akun Meta Ads</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${this._meta.length} akun terdaftar</div>
          </div>
          <button class="btn btn-primary" id="btn-show-form-meta">+ Tambah Akun Meta</button>
        </div>

        <!-- Form tambah Meta (hidden) -->
        <div id="form-meta" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;">Tambah Akun Meta Ads</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div>
              <div class="form-label">NAMA TAMPILAN</div>
              <input id="meta-nama" type="text" class="form-input" placeholder="Contoh: Akun Utama">
            </div>
            <div>
              <div class="form-label">AD ACCOUNT ID</div>
              <input id="meta-id" type="text" class="form-input" placeholder="Contoh: 120210001234567">
              <div class="form-hint">ID numerik dari Meta Ads Manager (tanpa "act_")</div>
            </div>
          </div>
          <div id="meta-error" class="alert alert-error" style="display:none;margin-bottom:10px;"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button class="btn" id="btn-batal-meta">Batal</button>
            <button class="btn btn-primary" id="btn-simpan-meta">Simpan</button>
          </div>
        </div>

        <!-- Daftar akun Meta -->
        ${this._meta.length === 0
          ? `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">Belum ada akun Meta. Klik "+ Tambah Akun Meta" di atas.</div>`
          : `<div style="display:flex;flex-direction:column;gap:8px;">
              ${this._meta.map(a => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:var(--surface);">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:32px;height:32px;background:#fef3c7;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px;">📊</div>
                    <div>
                      <div style="font-size:13px;font-weight:600;">${a.nama}</div>
                      <div style="font-size:11.5px;color:var(--text-muted);">ID: ${a.account_id || '-'}</div>
                    </div>
                  </div>
                  <span class="badge badge-green">Aktif</span>
                </div>
              `).join('')}
            </div>`
        }
      </div>

      <!-- ===== SECTION SHOPEE ===== -->
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <div style="font-size:14px;font-weight:700;">Akun Shopee Affiliate</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${this._shopee.length} akun terdaftar</div>
          </div>
          <button class="btn btn-primary" id="btn-show-form-shopee">+ Tambah Akun Shopee</button>
        </div>

        <!-- Form tambah Shopee (hidden) -->
        <div id="form-shopee" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;">Tambah Akun Shopee Affiliate</div>
          <div style="margin-bottom:12px;">
            <div class="form-label">NAMA AKUN</div>
            <input id="shopee-nama" type="text" class="form-input" placeholder="Contoh: Shopee Utama">
            <div class="form-hint">Nama bebas untuk identifikasi akun ini di TrackPro</div>
          </div>
          <div id="shopee-error" class="alert alert-error" style="display:none;margin-bottom:10px;"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button class="btn" id="btn-batal-shopee">Batal</button>
            <button class="btn btn-primary" id="btn-simpan-shopee">Simpan</button>
          </div>
        </div>

        <!-- Daftar akun Shopee -->
        ${this._shopee.length === 0
          ? `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">Belum ada akun Shopee. Klik "+ Tambah Akun Shopee" di atas.</div>`
          : `<div style="display:flex;flex-direction:column;gap:8px;">
              ${this._shopee.map(a => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:var(--surface);">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:32px;height:32px;background:#f0fdf4;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px;">🛒</div>
                    <div>
                      <div style="font-size:13px;font-weight:600;">${a.nama}</div>
                      <div style="font-size:11.5px;color:var(--text-muted);">Shopee Affiliate</div>
                    </div>
                  </div>
                  <span class="badge badge-green">Aktif</span>
                </div>
              `).join('')}
            </div>`
        }
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    // Toggle form Meta
    this.container.querySelector('#btn-show-form-meta')?.addEventListener('click', () => {
      const f = this.container.querySelector('#form-meta');
      f.style.display = f.style.display === 'none' ? 'block' : 'none';
      if (f.style.display === 'block') this.container.querySelector('#meta-nama')?.focus();
    });
    this.container.querySelector('#btn-batal-meta')?.addEventListener('click', () => {
      this.container.querySelector('#form-meta').style.display = 'none';
    });
    this.container.querySelector('#btn-simpan-meta')?.addEventListener('click', () => this._simpanMeta());

    // Toggle form Shopee
    this.container.querySelector('#btn-show-form-shopee')?.addEventListener('click', () => {
      const f = this.container.querySelector('#form-shopee');
      f.style.display = f.style.display === 'none' ? 'block' : 'none';
      if (f.style.display === 'block') this.container.querySelector('#shopee-nama')?.focus();
    });
    this.container.querySelector('#btn-batal-shopee')?.addEventListener('click', () => {
      this.container.querySelector('#form-shopee').style.display = 'none';
    });
    this.container.querySelector('#btn-simpan-shopee')?.addEventListener('click', () => this._simpanShopee());

    // Enter key support
    this.container.querySelector('#meta-id')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._simpanMeta(); });
    this.container.querySelector('#shopee-nama')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._simpanShopee(); });
  }

  async _simpanMeta() {
    const nama = this.container.querySelector('#meta-nama').value.trim();
    const adId = this.container.querySelector('#meta-id').value.trim();
    const errEl = this.container.querySelector('#meta-error');
    errEl.style.display = 'none';

    if (!nama || !adId) {
      errEl.textContent = 'Nama tampilan dan Ad Account ID wajib diisi.';
      errEl.style.display = 'block';
      return;
    }

    const btn = this.container.querySelector('#btn-simpan-meta');
    btn.disabled = true; btn.textContent = 'Menyimpan…';

    try {
      await apiFetch('/accounts/meta', {
        method: 'POST',
        body: JSON.stringify({ nama_tampilan: nama, ad_account_id: adId }),
      });
      await this._load();
    } catch (e) {
      errEl.textContent = e.message || 'Gagal menyimpan akun Meta.';
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Simpan';
    }
  }

  async _simpanShopee() {
    const nama = this.container.querySelector('#shopee-nama').value.trim();
    const errEl = this.container.querySelector('#shopee-error');
    errEl.style.display = 'none';

    if (!nama) {
      errEl.textContent = 'Nama akun Shopee wajib diisi.';
      errEl.style.display = 'block';
      return;
    }

    const btn = this.container.querySelector('#btn-simpan-shopee');
    btn.disabled = true; btn.textContent = 'Menyimpan…';

    try {
      await apiFetch('/accounts/shopee', {
        method: 'POST',
        body: JSON.stringify({ nama_akun: nama }),
      });
      await this._load();
    } catch (e) {
      errEl.textContent = e.message || 'Gagal menyimpan akun Shopee.';
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Simpan';
    }
  }

  destroy() {}
}
