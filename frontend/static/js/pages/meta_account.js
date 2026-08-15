import { apiFetch } from '../api.js';

export class MetaAccountPage {
  constructor(container) {
    this.container = container;
    this._meta = [];
    this._shopee = [];
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Pengaturan Akun Meta</h1>
          <p>Kelola koneksi akun Meta Ads dan hubungkan dengan akun Shopee Affiliate.</p>
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
      <div class="card" style="margin-bottom:16px;">
        <div style="font-size:14px;font-weight:700;margin-bottom:12px;">Mode Akun Meta</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="font-size:13px;color:var(--text-muted);">Mode offline — masukkan data akun Meta Ads secara manual lalu upload CSV.</div>
          <div style="display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden;">
            <button class="btn btn-sm btn-primary" style="border:none;border-radius:0;">Offline</button>
            <button class="btn btn-sm" style="border:none;border-radius:0;color:var(--text-muted);">Online</button>
          </div>
        </div>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;">⚡</div>
              <div>
                <div style="font-size:13px;font-weight:700;">Akun Meta</div>
                <div style="font-size:12px;color:#16a34a;">● Aktif</div>
                <div style="font-size:12px;color:var(--text-muted);">${this._meta.length} akun terdaftar</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-sm btn-primary" id="btn-tambah-meta">+ Tambah Akun Meta</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Form tambah Meta (hidden) -->
      <div id="form-meta" class="card" style="margin-bottom:16px;display:none;border:2px solid var(--red);">
        <div style="font-size:14px;font-weight:700;margin-bottom:14px;">Tambah Akun Meta Ads</div>
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
          <button class="btn btn-primary" id="btn-simpan-meta">Simpan Akun Meta</button>
        </div>
      </div>

      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:14px;">🔗</span>
          <span style="font-size:14px;font-weight:700;">Akun Meta Terdaftar</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px;">
          Kelola setiap akun Meta, tax/fee, pembeda tag, dan akun Shopee Affiliate dalam satu kartu detail.
        </div>

        ${this._meta.length === 0
          ? `<div class="card" style="text-align:center;padding:48px;">
               <div style="font-size:32px;margin-bottom:12px;">📡</div>
               <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Belum ada akun Meta</div>
               <div style="font-size:13px;color:var(--text-muted);">Klik "+ Tambah Akun Meta" di atas untuk mendaftarkan akun Meta Ads</div>
             </div>`
          : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;" id="meta-cards">
               ${this._meta.map(a => this._renderAccountCard(a)).join('')}
             </div>`
        }
      </div>

      <!-- Form tambah Shopee (hidden) -->
      <div id="form-shopee" class="card" style="margin-top:16px;display:none;border:2px solid var(--red);">
        <input type="hidden" id="shopee-meta-id">
        <div style="font-size:14px;font-weight:700;margin-bottom:14px;">Tambah Akun Shopee Affiliate</div>
        <div style="margin-bottom:12px;">
          <div class="form-label">NAMA AKUN SHOPEE</div>
          <input id="shopee-nama" type="text" class="form-input" placeholder="Contoh: Shopee Utama">
          <div class="form-hint">Nama bebas untuk identifikasi akun ini di TrackPro</div>
        </div>
        <div id="shopee-error" class="alert alert-error" style="display:none;margin-bottom:10px;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn" id="btn-batal-shopee">Batal</button>
          <button class="btn btn-primary" id="btn-simpan-shopee">Simpan Akun Shopee</button>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _renderAccountCard(a) {
    return `
      <div class="card" data-meta-id="${a.id}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <div style="width:36px;height:36px;background:#fef3c7;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">📊</div>
          <div>
            <div style="font-weight:700;font-size:13px;">${a.nama}</div>
            <div style="font-size:11.5px;color:var(--text-muted);">${a.account_id || ''} · IDR</div>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <div class="form-label">PPN/TAX META (%)</div>
          <div style="display:flex;gap:8px;">
            <input type="number" class="form-input" value="0" style="width:80px;padding:6px 10px;" min="0" max="100">
            <span style="align-self:center;color:var(--text-muted);">%</span>
            <button class="btn btn-primary btn-sm">Simpan</button>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <div class="form-label">PEMBEDA TAG</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Field di Meta yang menjadi pembeda tag link.</div>
          <select class="form-select" style="font-size:12px;">
            <option>Nama Campaign</option>
            <option>Nama Ad Set</option>
            <option>Nama Ad</option>
          </select>
        </div>

        <div>
          <div class="form-label">SHOPEE AFFILIATE TERTAUT</div>
          <div style="font-size:13px;color:var(--text-muted);padding:12px;background:var(--bg);border-radius:6px;text-align:center;margin-bottom:8px;">
            Belum ada akun Shopee tertaut
          </div>
          <button class="btn btn-sm btn-tambah-shopee" data-meta-id="${a.id}" data-meta-nama="${a.nama}" style="width:100%;">
            + Tambah Shopee ke ${a.nama}
          </button>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    // Tampilkan form tambah Meta
    this.container.querySelector('#btn-tambah-meta')?.addEventListener('click', () => {
      const f = this.container.querySelector('#form-meta');
      f.style.display = f.style.display === 'none' ? 'block' : 'none';
      this.container.querySelector('#meta-nama')?.focus();
    });

    // Batal tambah Meta
    this.container.querySelector('#btn-batal-meta')?.addEventListener('click', () => {
      this.container.querySelector('#form-meta').style.display = 'none';
    });

    // Simpan akun Meta
    this.container.querySelector('#btn-simpan-meta')?.addEventListener('click', () => this._simpanMeta());

    // Tombol tambah Shopee per kartu Meta
    this.container.querySelectorAll('.btn-tambah-shopee').forEach(btn => {
      btn.addEventListener('click', () => {
        const metaId   = btn.dataset.metaId;
        const metaNama = btn.dataset.metaNama;
        const f = this.container.querySelector('#form-shopee');
        this.container.querySelector('#shopee-meta-id').value = metaId;
        this.container.querySelector('#shopee-nama').value = '';
        f.querySelector('div[style*="font-weight:700"]').textContent = `Tambah Akun Shopee → ${metaNama}`;
        f.style.display = 'block';
        f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        this.container.querySelector('#shopee-nama')?.focus();
      });
    });

    // Batal tambah Shopee
    this.container.querySelector('#btn-batal-shopee')?.addEventListener('click', () => {
      this.container.querySelector('#form-shopee').style.display = 'none';
    });

    // Simpan akun Shopee
    this.container.querySelector('#btn-simpan-shopee')?.addEventListener('click', () => this._simpanShopee());
  }

  async _simpanMeta() {
    const nama = this.container.querySelector('#meta-nama').value.trim();
    const adId  = this.container.querySelector('#meta-id').value.trim();
    const errEl = this.container.querySelector('#meta-error');
    errEl.style.display = 'none';

    if (!nama || !adId) {
      errEl.textContent = 'Nama tampilan dan Ad Account ID wajib diisi.';
      errEl.style.display = 'block';
      return;
    }

    const btn = this.container.querySelector('#btn-simpan-meta');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';

    try {
      await apiFetch('/accounts/meta', {
        method: 'POST',
        body: JSON.stringify({ nama_tampilan: nama, ad_account_id: adId }),
      });
      await this._load();
    } catch (e) {
      errEl.textContent = e.message || 'Gagal menyimpan akun Meta.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Simpan Akun Meta';
    }
  }

  async _simpanShopee() {
    const nama   = this.container.querySelector('#shopee-nama').value.trim();
    const metaId = this.container.querySelector('#shopee-meta-id').value;
    const errEl  = this.container.querySelector('#shopee-error');
    errEl.style.display = 'none';

    if (!nama) {
      errEl.textContent = 'Nama akun Shopee wajib diisi.';
      errEl.style.display = 'block';
      return;
    }

    const btn = this.container.querySelector('#btn-simpan-shopee');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';

    try {
      // 1. Buat akun Shopee
      const shopeeAcc = await apiFetch('/accounts/shopee', {
        method: 'POST',
        body: JSON.stringify({ nama_akun: nama }),
      });

      // 2. Hubungkan ke akun Meta yang dipilih
      if (metaId && shopeeAcc?.id) {
        await apiFetch(`/accounts/meta/${metaId}/links`, {
          method: 'POST',
          body: JSON.stringify({ shopee_account_id: shopeeAcc.id }),
        });
      }

      await this._load();
    } catch (e) {
      errEl.textContent = e.message || 'Gagal menyimpan akun Shopee.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Simpan Akun Shopee';
    }
  }

  destroy() {}
}
