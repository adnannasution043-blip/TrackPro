import { apiFetch } from '../api.js';

export class MetaAccountPage {
  constructor(container) {
    this.container = container;
    this._tree = { meta_accounts: [], shopee_unlinked: [] };
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Pengaturan Akun</h1>
          <p>Kelola akun Meta Ads dan Shopee Affiliate, serta hubungkan keduanya.</p>
        </div>
        <div class="page-header-right" style="display:flex;gap:8px;">
          <button class="btn btn-primary" id="btn-show-form-meta">+ Tambah Akun Meta</button>
          <button class="btn btn-primary" id="btn-show-form-shopee">+ Tambah Akun Shopee</button>
        </div>
      </div>

      <!-- Form tambah Meta -->
      <div id="form-meta" style="display:none;" class="card" style="margin-bottom:16px;">
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

      <!-- Form tambah Shopee -->
      <div id="form-shopee" style="display:none;" class="card" style="margin-bottom:16px;">
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

      <div id="content"><div class="loading">Memuat data…</div></div>
    `;

    this._bindFormEvents();
    await this._load();
  }

  _bindFormEvents() {
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
    this.container.querySelector('#meta-id')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._simpanMeta(); });

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
    this.container.querySelector('#shopee-nama')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._simpanShopee(); });
  }

  async _load() {
    const el = this.container.querySelector('#content');
    try {
      const tree = await apiFetch('/accounts/tree');
      this._tree = tree || { meta_accounts: [], shopee_unlinked: [] };
      this._render(el);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _render(el) {
    const { meta_accounts, shopee_unlinked } = this._tree;

    const unlinkedOptions = shopee_unlinked.map(s =>
      `<option value="${s.id}">${s.nama}</option>`
    ).join('');

    const metaCards = meta_accounts.length === 0
      ? `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">Belum ada akun Meta. Klik "+ Tambah Akun Meta" di atas.</div>`
      : meta_accounts.map(m => {
          const shopeeRows = m.shopee_accounts.length === 0
            ? `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Belum ada akun Shopee terhubung.</div>`
            : m.shopee_accounts.map(s => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;margin-bottom:6px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <div style="width:26px;height:26px;background:#f0fdf4;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:13px;">🛒</div>
                    <span style="font-size:13px;font-weight:500;">${s.nama}</span>
                  </div>
                  <button class="btn btn-sm" style="font-size:11px;color:#dc2626;border-color:#dc2626;"
                    data-unlink-meta="${m.id}" data-unlink-shopee="${s.id}">Lepas</button>
                </div>
              `).join('');

          const linkRow = unlinkedOptions
            ? `<div style="display:flex;gap:8px;align-items:center;margin-top:10px;">
                <select class="form-select" id="sel-link-${m.id}" style="flex:1;font-size:12px;">
                  <option value="">Pilih akun Shopee…</option>
                  ${unlinkedOptions}
                </select>
                <button class="btn btn-primary btn-sm" data-link-meta="${m.id}" style="white-space:nowrap;">Hubungkan</button>
               </div>`
            : `<div style="font-size:11.5px;color:var(--text-muted);margin-top:8px;">Semua akun Shopee sudah terhubung.</div>`;

          return `
            <div class="card" style="margin-bottom:12px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="width:36px;height:36px;background:#fef3c7;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">📊</div>
                  <div>
                    <div style="font-size:14px;font-weight:700;">${m.nama}</div>
                    <div style="font-size:11.5px;color:var(--text-muted);">ID: ${m.account_id}</div>
                  </div>
                </div>
                <span class="badge badge-green">Aktif</span>
              </div>

              <div style="border-top:1px solid var(--border);padding-top:12px;">
                <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
                  Shopee terhubung (${m.shopee_accounts.length})
                </div>
                ${shopeeRows}
                ${linkRow}
              </div>
            </div>
          `;
        }).join('');

    const unlinkedSection = shopee_unlinked.length > 0
      ? `<div style="font-size:13px;font-weight:700;color:var(--text-muted);margin:20px 0 10px;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;">
           Akun Shopee Belum Terhubung (${shopee_unlinked.length})
         </div>
         <div style="display:flex;flex-direction:column;gap:8px;">
           ${shopee_unlinked.map(s => `
             <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:var(--surface);">
               <div style="width:32px;height:32px;background:#f0fdf4;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px;">🛒</div>
               <div>
                 <div style="font-size:13px;font-weight:600;">${s.nama}</div>
                 <div style="font-size:11.5px;color:var(--text-muted);">Belum dihubungkan ke akun Meta</div>
               </div>
             </div>
           `).join('')}
         </div>`
      : '';

    el.innerHTML = `
      <div id="tree-content">
        ${metaCards}
        ${unlinkedSection}
      </div>
    `;

    this._bindTreeEvents(el);
  }

  _bindTreeEvents(el) {
    // Lepas hubungan
    el.querySelectorAll('[data-unlink-meta]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const metaId = btn.dataset.unlinkMeta;
        const shopeeId = btn.dataset.unlinkShopee;
        btn.disabled = true;
        try {
          await apiFetch(`/accounts/meta/${metaId}/links/${shopeeId}`, { method: 'DELETE' });
          await this._load();
        } catch (e) {
          alert(e.message);
          btn.disabled = false;
        }
      });
    });

    // Hubungkan Shopee ke Meta
    el.querySelectorAll('[data-link-meta]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const metaId = btn.dataset.linkMeta;
        const sel = el.querySelector(`#sel-link-${metaId}`);
        const shopeeId = sel?.value;
        if (!shopeeId) return;
        btn.disabled = true;
        try {
          await apiFetch(`/accounts/meta/${metaId}/links`, {
            method: 'POST',
            body: JSON.stringify({ shopee_account_id: shopeeId }),
          });
          await this._load();
        } catch (e) {
          alert(e.message);
          btn.disabled = false;
        }
      });
    });
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
      this.container.querySelector('#form-meta').style.display = 'none';
      this.container.querySelector('#meta-nama').value = '';
      this.container.querySelector('#meta-id').value = '';
      await this._load();
    } catch (e) {
      errEl.textContent = e.message || 'Gagal menyimpan akun Meta.';
      errEl.style.display = 'block';
    } finally {
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
      this.container.querySelector('#form-shopee').style.display = 'none';
      this.container.querySelector('#shopee-nama').value = '';
      await this._load();
    } catch (e) {
      errEl.textContent = e.message || 'Gagal menyimpan akun Shopee.';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan';
    }
  }

  destroy() {}
}
