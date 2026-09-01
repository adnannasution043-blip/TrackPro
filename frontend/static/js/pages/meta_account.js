import { apiFetch } from '../api.js';

export class MetaAccountPage {
  constructor(container) {
    this.container = container;
    this._tree = { meta_accounts: [], shopee_unlinked: [], shopee_all: [] };
    this._metaInfo = {}; // id → { has_token, token_expires_at, status_koneksi }
    this._aduAccounts = [];
    this._terraAccounts = [];
  }

  async render() {
    // Cek pesan sukses/error dari OAuth callback (hash: #/pengaturan/meta?success=1)
    const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const urlParams = new URLSearchParams(hashQuery);
    const oauthSuccess = urlParams.get('success');
    const oauthError   = urlParams.get('error');
    const oauthAdded   = urlParams.get('added');

    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Pengaturan Akun</h1>
          <p>Kelola akun Meta Ads dan Shopee Affiliate, serta hubungkan keduanya.</p>
        </div>
        <div class="page-header-right" style="display:flex;gap:8px;">
          <button class="btn btn-primary" id="btn-show-form-meta">+ Tambah Akun Meta</button>
          <button class="btn btn-primary" id="btn-show-form-shopee">+ Tambah Akun Shopee</button>
          <button class="btn btn-primary" id="btn-show-form-adu">+ Tambah Akun Adu</button>
          <button class="btn btn-primary" id="btn-show-form-terra">+ Tambah Akun Terra</button>
        </div>
      </div>

      ${oauthSuccess ? `<div class="alert alert-success" style="margin-bottom:16px;">
        Akun Meta berhasil dihubungkan! ${oauthAdded > 0 ? `${oauthAdded} Ad Account baru ditambahkan.` : 'Token diperbarui.'}
      </div>` : ''}
      ${oauthError ? `<div class="alert alert-error" style="margin-bottom:16px;">
        Koneksi Meta gagal: ${decodeURIComponent(oauthError).replace(/_/g, ' ')}.
        Pastikan App ID, App Secret, dan Redirect URI sudah benar.
      </div>` : ''}

      <!-- Kartu Koneksi Meta OAuth -->
      <div class="card" style="margin-bottom:16px;border-left:4px solid #1877f2;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <div style="width:36px;height:36px;background:#e7f0fd;border-radius:8px;display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#1877f2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </div>
          <div>
            <div style="font-size:13.5px;font-weight:700;">Koneksi Meta via OAuth</div>
            <div style="font-size:11.5px;color:var(--text-muted);">Input App ID dan App Secret dari Meta Developer App kamu, lalu klik Hubungkan.</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <div class="form-label">APP ID</div>
            <input id="oauth-app-id" type="text" class="form-input" placeholder="Contoh: 1234567890123456">
            <div class="form-hint">Dari Meta Developer App → Settings → Basic</div>
          </div>
          <div>
            <div class="form-label">APP SECRET</div>
            <input id="oauth-app-secret" type="password" class="form-input" placeholder="Paste App Secret di sini">
            <div class="form-hint">Jangan share App Secret ke siapapun</div>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <div class="form-label">REDIRECT URI (copy ke Meta App)</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input id="oauth-redirect-uri" type="text" class="form-input"
              value="${window.location.origin}/api/meta-oauth/callback"
              readonly style="flex:1;font-family:monospace;font-size:11.5px;background:var(--bg-muted);color:var(--text-muted);">
            <button class="btn btn-sm" id="btn-copy-uri" style="white-space:nowrap;">Salin</button>
          </div>
          <div class="form-hint">
            Tambahkan URL ini di Meta Developer → App → Facebook Login → Pengaturan → Valid OAuth Redirect URIs
          </div>
        </div>

        <div id="oauth-msg" style="display:none;margin-bottom:10px;padding:8px 10px;border-radius:6px;font-size:12px;"></div>

        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-primary" id="btn-simpan-oauth">Simpan Konfigurasi</button>
          <button class="btn" style="background:#1877f2;color:#fff;border-color:#1877f2;" id="btn-oauth-connect">
            Hubungkan Meta
          </button>
          <span style="font-size:11px;color:var(--text-muted);">Simpan dulu sebelum klik Hubungkan</span>
        </div>
      </div>

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

      <div id="form-adu" style="display:none;" class="card" style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px;">Tambah Akun Adu Ads (Clickadu)</div>
        <div style="margin-bottom:12px;">
          <div class="form-label">NAMA TAMPILAN</div>
          <input id="adu-nama" type="text" class="form-input" placeholder="Contoh: Adu Utama">
          <div class="form-hint">Nama bebas untuk identifikasi akun ini di TrackPro. API Key dipasang setelah akun dibuat.</div>
        </div>
        <div id="adu-error" class="alert alert-error" style="display:none;margin-bottom:10px;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn" id="btn-batal-adu">Batal</button>
          <button class="btn btn-primary" id="btn-simpan-adu">Simpan</button>
        </div>
      </div>

      <div id="form-terra" style="display:none;" class="card" style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px;">Tambah Akun Terra Ads (Adsterra)</div>
        <div style="margin-bottom:12px;">
          <div class="form-label">NAMA TAMPILAN</div>
          <input id="terra-nama" type="text" class="form-input" placeholder="Contoh: Terra Utama">
          <div class="form-hint">Nama bebas untuk identifikasi akun ini di TrackPro. API Key dipasang setelah akun dibuat.</div>
        </div>
        <div id="terra-error" class="alert alert-error" style="display:none;margin-bottom:10px;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn" id="btn-batal-terra">Batal</button>
          <button class="btn btn-primary" id="btn-simpan-terra">Simpan</button>
        </div>
      </div>

      <div id="content"><div class="loading">Memuat data…</div></div>
      <div id="content-adu"></div>
      <div id="content-terra"></div>
    `;

    this._bindFormEvents();
    await this._load();
    await this._loadOAuthConfig();
  }

  async _loadOAuthConfig() {
    try {
      const cfg = await apiFetch('/meta-oauth/config');
      if (cfg.app_id) {
        const inpId = this.container.querySelector('#oauth-app-id');
        if (inpId) inpId.value = cfg.app_id;
      }
      if (cfg.app_secret_hint) {
        const inpSec = this.container.querySelector('#oauth-app-secret');
        if (inpSec) {
          inpSec.placeholder = `Tersimpan (${cfg.app_secret_hint}) — kosongkan untuk tidak mengubah`;
        }
      }
    } catch (_) {}
  }

  _bindFormEvents() {
    // Salin Redirect URI
    this.container.querySelector('#btn-copy-uri')?.addEventListener('click', () => {
      const val = this.container.querySelector('#oauth-redirect-uri')?.value || '';
      navigator.clipboard.writeText(val).then(() => {
        const btn = this.container.querySelector('#btn-copy-uri');
        if (btn) { btn.textContent = 'Tersalin!'; setTimeout(() => { btn.textContent = 'Salin'; }, 2000); }
      });
    });

    // Simpan konfigurasi OAuth
    this.container.querySelector('#btn-simpan-oauth')?.addEventListener('click', async () => {
      const appId  = this.container.querySelector('#oauth-app-id')?.value.trim();
      const appSec = this.container.querySelector('#oauth-app-secret')?.value.trim();
      const msgEl  = this.container.querySelector('#oauth-msg');
      if (!appId) {
        _showMsg(msgEl, 'App ID wajib diisi.', 'error');
        return;
      }
      const btn = this.container.querySelector('#btn-simpan-oauth');
      btn.disabled = true; btn.textContent = 'Menyimpan…';
      try {
        const body = { app_id: appId };
        if (appSec) body.app_secret = appSec;
        if (!appSec && !appId) { _showMsg(msgEl, 'Isi App ID minimal.', 'error'); return; }
        // kalau app_secret kosong, kita tetap perlu kirim sesuatu — baca existing atau tidak perlu
        if (!appSec) {
          // ambil existing secret dari backend tidak mungkin (terenkripsi), jadi wajib isi ulang saat edit
          _showMsg(msgEl, 'App Secret wajib diisi (atau isi ulang untuk mengupdate).', 'error');
          btn.disabled = false; btn.textContent = 'Simpan Konfigurasi';
          return;
        }
        await apiFetch('/meta-oauth/config', { method: 'PUT', body: JSON.stringify(body) });
        _showMsg(msgEl, 'Konfigurasi tersimpan. Sekarang klik "Hubungkan Meta".', 'success');
        await this._loadOAuthConfig();
      } catch (e) {
        _showMsg(msgEl, e.message || 'Gagal menyimpan konfigurasi.', 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'Simpan Konfigurasi';
      }
    });

    // Hubungkan Meta — fetch URL dulu dengan token, lalu redirect
    this.container.querySelector('#btn-oauth-connect')?.addEventListener('click', async () => {
      const msgEl = this.container.querySelector('#oauth-msg');
      const btn   = this.container.querySelector('#btn-oauth-connect');
      btn.disabled = true; btn.textContent = 'Menghubungkan…';
      try {
        const res = await apiFetch('/meta-oauth/connect');
        if (res?.url) {
          window.location.href = res.url;
        } else {
          _showMsg(msgEl, 'Gagal mendapatkan URL koneksi.', 'error');
          btn.disabled = false; btn.textContent = 'Hubungkan Meta';
        }
      } catch (e) {
        _showMsg(msgEl, e.message || 'Gagal. Pastikan App ID dan App Secret sudah disimpan.', 'error');
        btn.disabled = false; btn.textContent = 'Hubungkan Meta';
      }
    });

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

    this.container.querySelector('#btn-show-form-adu')?.addEventListener('click', () => {
      const f = this.container.querySelector('#form-adu');
      f.style.display = f.style.display === 'none' ? 'block' : 'none';
      if (f.style.display === 'block') this.container.querySelector('#adu-nama')?.focus();
    });
    this.container.querySelector('#btn-batal-adu')?.addEventListener('click', () => {
      this.container.querySelector('#form-adu').style.display = 'none';
    });
    this.container.querySelector('#btn-simpan-adu')?.addEventListener('click', () => this._simpanAdu());
    this.container.querySelector('#adu-nama')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._simpanAdu(); });

    this.container.querySelector('#btn-show-form-terra')?.addEventListener('click', () => {
      const f = this.container.querySelector('#form-terra');
      f.style.display = f.style.display === 'none' ? 'block' : 'none';
      if (f.style.display === 'block') this.container.querySelector('#terra-nama')?.focus();
    });
    this.container.querySelector('#btn-batal-terra')?.addEventListener('click', () => {
      this.container.querySelector('#form-terra').style.display = 'none';
    });
    this.container.querySelector('#btn-simpan-terra')?.addEventListener('click', () => this._simpanTerra());
    this.container.querySelector('#terra-nama')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._simpanTerra(); });
  }

  async _load() {
    const el = this.container.querySelector('#content');
    const elAdu = this.container.querySelector('#content-adu');
    const elTerra = this.container.querySelector('#content-terra');
    try {
      const [tree, metaList, aduList, terraList] = await Promise.all([
        apiFetch('/accounts/tree'),
        apiFetch('/accounts/meta'),
        apiFetch('/accounts/adu'),
        apiFetch('/accounts/terra'),
      ]);
      this._tree = tree || { meta_accounts: [], shopee_unlinked: [], shopee_all: [] };
      this._metaInfo = {};
      for (const m of (metaList || [])) {
        this._metaInfo[m.id] = m;
      }
      this._aduAccounts = aduList || [];
      this._terraAccounts = terraList || [];
      this._render(el);
      this._renderAdu(elAdu);
      this._renderTerra(elTerra);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _render(el) {
    const { meta_accounts, shopee_all } = this._tree;
    const allShopee = shopee_all || [];

    const metaCards = meta_accounts.length === 0
      ? `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">Belum ada akun Meta. Klik "+ Tambah Akun Meta" di atas.</div>`
      : meta_accounts.map(m => this._renderMetaCard(m)).join('');

    // Kartu per akun Shopee — dari sini satu akun Shopee bisa dihubungkan
    // ke banyak akun Meta sekaligus (kebalikan dari kartu Meta di atas
    // yang cuma nampilin ringkasan read-only).
    const shopeeHeader = `<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin:24px 0 10px;text-transform:uppercase;letter-spacing:0.5px;">
      Akun Shopee Affiliate (${allShopee.length}) — hubungkan tiap akun ke satu atau banyak akun Meta
    </div>`;

    const shopeeCards = allShopee.length === 0
      ? `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;border:1px solid var(--border);border-radius:8px;">Belum ada akun Shopee. Klik "+ Tambah Akun Shopee" di atas.</div>`
      : allShopee.map(s => {
          const connected = meta_accounts.filter(m => m.shopee_accounts.some(x => x.id === s.id));
          const connectedIds = new Set(connected.map(m => m.id));
          const availableOptions = meta_accounts
            .filter(m => !connectedIds.has(m.id))
            .map(m => `<option value="${m.id}">${m.nama}</option>`)
            .join('');
          return this._renderShopeeCard(s, connected, availableOptions);
        }).join('');

    el.innerHTML = `<div id="tree-content">${metaCards}</div>${shopeeHeader}<div id="shopee-tree-content">${shopeeCards}</div>`;
    this._bindShopeeTreeEvents(el);
    this._bindTokenEvents(el);
    this._bindSyncEvents(el);
  }

  _renderShopeeCard(s, connected, availableOptions) {
    const metaRows = connected.length === 0
      ? `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Belum ada akun Meta terhubung.</div>`
      : connected.map(m => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:26px;height:26px;background:#fef3c7;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:13px;">📊</div>
              <span style="font-size:13px;font-weight:500;">${m.nama}</span>
              <span style="font-size:11px;color:var(--text-muted);">ID: ${m.account_id}</span>
            </div>
            <button class="btn btn-sm" style="font-size:11px;color:#dc2626;border-color:#dc2626;"
              data-shopee-unlink-meta="${m.id}" data-shopee-unlink-shopee="${s.id}">Lepas</button>
          </div>
        `).join('');

    const linkRow = availableOptions
      ? `<div style="display:flex;gap:8px;align-items:center;margin-top:10px;">
           <select class="form-select" id="sel-shopee-link-${s.id}" style="flex:1;font-size:12px;">
             <option value="">Pilih akun Meta…</option>
             ${availableOptions}
           </select>
           <button class="btn btn-primary btn-sm" data-shopee-link="${s.id}" style="white-space:nowrap;">Hubungkan</button>
         </div>`
      : `<div style="font-size:11.5px;color:var(--text-muted);margin-top:8px;">Semua akun Meta sudah terhubung.</div>`;

    return `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;background:#f0fdf4;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">🛒</div>
            <div>
              <div style="font-size:14px;font-weight:700;">${s.nama}</div>
              <div style="font-size:11.5px;color:var(--text-muted);">Akun Shopee Affiliate</div>
            </div>
          </div>
        </div>

        <div style="border-top:1px solid var(--border);padding-top:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
            Meta terhubung (${connected.length})
          </div>
          ${metaRows}
          ${linkRow}
        </div>
      </div>
    `;
  }

  _bindShopeeTreeEvents(el) {
    el.querySelectorAll('[data-shopee-unlink-meta]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const metaId = btn.dataset.shopeeUnlinkMeta;
        const shopeeId = btn.dataset.shopeeUnlinkShopee;
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

    el.querySelectorAll('[data-shopee-link]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const shopeeId = btn.dataset.shopeeLink;
        const sel = el.querySelector(`#sel-shopee-link-${shopeeId}`);
        const metaId = sel?.value;
        if (!metaId) return;
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

  _renderMetaCard(m) {
    const info = this._metaInfo[m.id] || {};
    const hasToken = info.has_token || false;
    const expiresAt = info.token_expires_at;
    const statusKoneksi = info.status_koneksi || 'tidak_diketahui';

    // Token badge
    let tokenBadge = '';
    let tokenExpiry = '';
    if (hasToken) {
      if (statusKoneksi === 'token_expired') {
        tokenBadge = `<span class="badge badge-red">Token Expired</span>`;
      } else {
        tokenBadge = `<span class="badge badge-green">Token Aktif</span>`;
      }
      if (expiresAt) {
        const d = new Date(expiresAt);
        const now = new Date();
        const sisa = Math.ceil((d - now) / 86400000);
        tokenExpiry = `<span style="font-size:11px;color:${sisa < 7 ? '#dc2626' : 'var(--text-muted)'};">Exp: ${d.toLocaleDateString('id-ID')} (${sisa} hari)</span>`;
      }
    } else {
      tokenBadge = `<span class="badge badge-yellow">Belum Ada Token</span>`;
    }

    // Ringkasan read-only — pengelolaan koneksi (hubung/lepas) dipindah ke
    // kartu "Akun Shopee Affiliate" di bawah, supaya satu akun Shopee bisa
    // dihubungkan ke banyak akun Meta dari satu tempat yang sama.
    const shopeeSummary = m.shopee_accounts.length === 0
      ? `Belum ada akun Shopee terhubung.`
      : m.shopee_accounts.map(s => s.nama).join(', ');

    const today = new Date().toISOString().slice(0, 10);
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    return `
      <div class="card" style="margin-bottom:12px;">
        <!-- Header -->
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

        <!-- Token status row -->
        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;margin-bottom:12px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0;color:var(--text-muted);"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          <span style="font-size:12px;color:var(--text-muted);flex:1;">Token API Meta</span>
          ${tokenBadge}
          ${tokenExpiry}
          <button class="btn btn-sm" data-toggle-token="${m.id}" style="font-size:11px;">
            ${hasToken ? 'Ganti' : 'Pasang Token'}
          </button>
        </div>

        <!-- Token form (collapsed by default) -->
        <div id="token-panel-${m.id}" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px;">
          <div class="form-label">LONG-LIVED TOKEN META</div>
          <textarea id="token-input-${m.id}" class="form-input" rows="3"
            placeholder="Paste token di sini (EAA...)"
            style="font-family:monospace;font-size:11px;resize:vertical;"></textarea>
          <div class="form-hint" style="margin-bottom:10px;">
            Token berlaku 60 hari. Generate di
            <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener" style="color:#3b82f6;">Meta Graph API Explorer</a>
            → pilih app TrackPro → Exchange untuk long-lived token.
          </div>
          <div id="token-msg-${m.id}" style="display:none;font-size:12px;margin-bottom:8px;padding:8px 10px;border-radius:6px;"></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" data-save-token="${m.id}">Simpan Token</button>
            ${hasToken ? `<button class="btn btn-sm" style="color:#dc2626;border-color:#dc2626;" data-delete-token="${m.id}">Hapus Token</button>` : ''}
            <button class="btn btn-sm" data-close-token="${m.id}">Batal</button>
          </div>
        </div>

        <!-- Sync section -->
        <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:12px;">
          <button data-toggle-sync="${m.id}"
            style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg);border:none;cursor:pointer;font-size:13px;font-weight:600;color:var(--text);">
            <span style="display:flex;align-items:center;gap:7px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Sync Data dari Meta API
            </span>
            <svg id="sync-chevron-${m.id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div id="sync-panel-${m.id}" style="display:none;padding:14px;border-top:1px solid var(--border);">
            ${!hasToken ? `<div class="alert alert-error" style="margin-bottom:0;font-size:12px;">Pasang token API dulu sebelum bisa sync.</div>` : `
            <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;">
              <div>
                <div class="form-label">DARI</div>
                <input type="date" class="form-input" id="sync-dari-${m.id}" value="${firstDay}">
              </div>
              <div>
                <div class="form-label">SAMPAI</div>
                <input type="date" class="form-input" id="sync-sampai-${m.id}" value="${today}">
              </div>
              <button class="btn btn-primary btn-sm" data-do-sync="${m.id}" style="white-space:nowrap;">
                Sync Sekarang
              </button>
            </div>
            <div id="sync-result-${m.id}" style="display:none;margin-top:10px;"></div>
            <div id="sync-logs-${m.id}" style="margin-top:12px;"></div>
            `}
          </div>
        </div>

        <!-- Shopee links (read-only, kelola di kartu Akun Shopee Affiliate) -->
        <div style="border-top:1px solid var(--border);padding-top:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
            Shopee terhubung (${m.shopee_accounts.length})
          </div>
          <div style="font-size:12.5px;color:var(--text);">${shopeeSummary}</div>
        </div>
      </div>
    `;
  }

  _bindTokenEvents(el) {
    // Toggle token panel
    el.querySelectorAll('[data-toggle-token]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggleToken;
        const panel = el.querySelector(`#token-panel-${id}`);
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        if (panel.style.display === 'block') {
          el.querySelector(`#token-input-${id}`)?.focus();
        }
      });
    });

    // Close token panel
    el.querySelectorAll('[data-close-token]').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelector(`#token-panel-${btn.dataset.closeToken}`).style.display = 'none';
      });
    });

    // Save token
    el.querySelectorAll('[data-save-token]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.saveToken;
        const token = el.querySelector(`#token-input-${id}`)?.value.trim();
        const msgEl = el.querySelector(`#token-msg-${id}`);

        if (!token || !token.startsWith('EAA')) {
          _showMsg(msgEl, 'Token tidak valid. Harus diawali dengan "EAA".', 'error');
          return;
        }

        const orig = btn.textContent;
        btn.disabled = true; btn.textContent = 'Menyimpan…';
        try {
          await apiFetch(`/accounts/meta/${id}/token`, {
            method: 'PATCH',
            body: JSON.stringify({ access_token: token }),
          });
          _showMsg(msgEl, 'Token berhasil disimpan. Berlaku 60 hari.', 'success');
          el.querySelector(`#token-input-${id}`).value = '';
          await this._load();
        } catch (e) {
          _showMsg(msgEl, e.message || 'Gagal menyimpan token.', 'error');
        } finally {
          btn.disabled = false; btn.textContent = orig;
        }
      });
    });

    // Delete token
    el.querySelectorAll('[data-delete-token]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Hapus token Meta dari akun ini?')) return;
        const id = btn.dataset.deleteToken;
        btn.disabled = true;
        try {
          await apiFetch(`/accounts/meta/${id}/token`, { method: 'DELETE' });
          await this._load();
        } catch (e) {
          alert(e.message);
          btn.disabled = false;
        }
      });
    });
  }

  _bindSyncEvents(el) {
    // Toggle sync panel
    el.querySelectorAll('[data-toggle-sync]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggleSync;
        const panel = el.querySelector(`#sync-panel-${id}`);
        const chevron = el.querySelector(`#sync-chevron-${id}`);
        const open = panel.style.display === 'none';
        panel.style.display = open ? 'block' : 'none';
        if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
        if (open) this._loadSyncLogs(id, el);
      });
    });

    // Do sync
    el.querySelectorAll('[data-do-sync]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.doSync;
        const dari = el.querySelector(`#sync-dari-${id}`)?.value;
        const sampai = el.querySelector(`#sync-sampai-${id}`)?.value;
        const resultEl = el.querySelector(`#sync-result-${id}`);

        if (!dari || !sampai) {
          _showResult(resultEl, 'Isi rentang tanggal dulu.', 'error');
          return;
        }
        if (dari > sampai) {
          _showResult(resultEl, 'Tanggal dari tidak boleh lebih dari sampai.', 'error');
          return;
        }

        const orig = btn.textContent;
        btn.disabled = true; btn.textContent = 'Menyinkronkan…';
        resultEl.style.display = 'none';

        try {
          const res = await apiFetch(`/meta-sync/${id}`, {
            method: 'POST',
            body: JSON.stringify({ tanggal_dari: dari, tanggal_sampai: sampai }),
          });
          _showResult(resultEl,
            `Selesai — ${res.rows_fetched} baris dari Meta, ${res.rows_upserted} berhasil diupsert${res.rows_gagal > 0 ? `, ${res.rows_gagal} gagal` : ''}.`,
            'success'
          );
          this._loadSyncLogs(id, el);
        } catch (e) {
          _showResult(resultEl, e.message || 'Sync gagal.', 'error');
        } finally {
          btn.disabled = false; btn.textContent = orig;
        }
      });
    });
  }

  async _loadSyncLogs(accountId, el) {
    const logsEl = el.querySelector(`#sync-logs-${accountId}`);
    if (!logsEl) return;
    try {
      const logs = await apiFetch(`/meta-sync/${accountId}/logs?limit=5`);
      if (!logs || logs.length === 0) {
        logsEl.innerHTML = `<div style="font-size:11.5px;color:var(--text-muted);">Belum ada riwayat sync.</div>`;
        return;
      }
      logsEl.innerHTML = `
        <div style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;">Riwayat Sync</div>
        ${logs.map(l => `
          <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px;">
            <span class="badge ${l.status === 'selesai' ? 'badge-green' : 'badge-red'}" style="font-size:10px;padding:2px 6px;">${l.status}</span>
            <span style="color:var(--text-muted);">${l.tanggal_dari} – ${l.tanggal_sampai}</span>
            <span style="flex:1;text-align:right;color:var(--text-muted);">${l.rows_upserted} upsert${l.rows_gagal > 0 ? ` · ${l.rows_gagal} gagal` : ''}</span>
            <span style="color:var(--text-muted);font-size:10.5px;">${_fmtDt(l.synced_at)}</span>
          </div>
        `).join('')}
      `;
    } catch (_) {}
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

  // ---------------------------------------------------------------------------
  // Adu Ads (Clickadu API)
  // ---------------------------------------------------------------------------

  _renderAdu(el) {
    if (!el) return;
    const header = `<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin:20px 0 10px;text-transform:uppercase;letter-spacing:0.5px;">
      Akun Adu Ads / Clickadu (${this._aduAccounts.length})
    </div>`;
    const cards = this._aduAccounts.length === 0
      ? `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;border:1px solid var(--border);border-radius:8px;">Belum ada akun Adu. Klik "+ Tambah Akun Adu" di atas.</div>`
      : this._aduAccounts.map(a => this._renderAduCard(a)).join('');
    el.innerHTML = header + cards;
    this._bindAduEvents(el);
  }

  _renderAduCard(a) {
    const hasKey = a.has_api_key;
    let keyBadge = hasKey
      ? (a.status_koneksi === 'token_expired'
          ? `<span class="badge badge-red">API Key Invalid</span>`
          : `<span class="badge badge-green">API Key Aktif</span>`)
      : `<span class="badge badge-yellow">Belum Ada API Key</span>`;

    const today = new Date().toISOString().slice(0, 10);
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    return `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;background:#fef3c7;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">🎯</div>
            <div>
              <div style="font-size:14px;font-weight:700;">${a.nama_tampilan}</div>
              <div style="font-size:11.5px;color:var(--text-muted);">Clickadu SSP Advertiser</div>
            </div>
          </div>
          <button class="btn btn-sm" style="color:#dc2626;border-color:#dc2626;" data-delete-adu="${a.id}">Hapus</button>
        </div>

        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;margin-bottom:12px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0;color:var(--text-muted);"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          <span style="font-size:12px;color:var(--text-muted);flex:1;">API Key Clickadu</span>
          ${keyBadge}
          <button class="btn btn-sm" data-toggle-adu-key="${a.id}" style="font-size:11px;">
            ${hasKey ? 'Ganti' : 'Pasang API Key'}
          </button>
        </div>

        <div id="adu-key-panel-${a.id}" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px;">
          <div class="form-label">API KEY CLICKADU</div>
          <input id="adu-key-input-${a.id}" type="text" class="form-input"
            placeholder="Paste API Key di sini"
            style="font-family:monospace;font-size:11.5px;">
          <div class="form-hint" style="margin-bottom:10px;">
            Ambil dari Clickadu SSP Advertiser Platform → bagian API Key.
          </div>
          <div id="adu-key-msg-${a.id}" style="display:none;font-size:12px;margin-bottom:8px;padding:8px 10px;border-radius:6px;"></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" data-save-adu-key="${a.id}">Simpan API Key</button>
            ${hasKey ? `<button class="btn btn-sm" style="color:#dc2626;border-color:#dc2626;" data-delete-adu-key="${a.id}">Hapus API Key</button>` : ''}
            <button class="btn btn-sm" data-close-adu-key="${a.id}">Batal</button>
          </div>
        </div>

        <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;">
          <button data-toggle-adu-sync="${a.id}"
            style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg);border:none;cursor:pointer;font-size:13px;font-weight:600;color:var(--text);">
            <span style="display:flex;align-items:center;gap:7px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Sync Data dari Clickadu API
            </span>
            <svg id="adu-sync-chevron-${a.id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div id="adu-sync-panel-${a.id}" style="display:none;padding:14px;border-top:1px solid var(--border);">
            ${!hasKey ? `<div class="alert alert-error" style="margin-bottom:0;font-size:12px;">Pasang API Key dulu sebelum bisa sync.</div>` : `
            <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;">
              <div>
                <div class="form-label">DARI</div>
                <input type="date" class="form-input" id="adu-sync-dari-${a.id}" value="${firstDay}">
              </div>
              <div>
                <div class="form-label">SAMPAI</div>
                <input type="date" class="form-input" id="adu-sync-sampai-${a.id}" value="${today}">
              </div>
              <button class="btn btn-primary btn-sm" data-do-adu-sync="${a.id}" style="white-space:nowrap;">
                Sync Sekarang
              </button>
            </div>
            <div class="form-hint" style="margin-top:6px;">Sync ditarik per-hari (satu API call per tanggal) agar budget per zone akurat per hari.</div>
            <div id="adu-sync-result-${a.id}" style="display:none;margin-top:10px;"></div>
            <button data-toggle-adu-hist="${a.id}" style="margin-top:12px;background:none;border:none;padding:0;cursor:pointer;font-size:11.5px;color:var(--text-muted);display:flex;align-items:center;gap:4px;">
              <svg id="adu-hist-chevron-${a.id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="transition:transform 0.2s;"><polyline points="9 18 15 12 9 6"/></svg>
              Riwayat Sync
            </button>
            <div id="adu-sync-logs-${a.id}" style="display:none;margin-top:8px;"></div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  _bindAduEvents(el) {
    el.querySelectorAll('[data-toggle-adu-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggleAduKey;
        const panel = el.querySelector(`#adu-key-panel-${id}`);
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        if (panel.style.display === 'block') el.querySelector(`#adu-key-input-${id}`)?.focus();
      });
    });
    el.querySelectorAll('[data-close-adu-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelector(`#adu-key-panel-${btn.dataset.closeAduKey}`).style.display = 'none';
      });
    });
    el.querySelectorAll('[data-save-adu-key]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.saveAduKey;
        const key = el.querySelector(`#adu-key-input-${id}`)?.value.trim();
        const msgEl = el.querySelector(`#adu-key-msg-${id}`);
        if (!key) {
          _showMsg(msgEl, 'API Key tidak boleh kosong.', 'error');
          return;
        }
        const orig = btn.textContent;
        btn.disabled = true; btn.textContent = 'Menyimpan…';
        try {
          await apiFetch(`/accounts/adu/${id}/api-key`, {
            method: 'PATCH',
            body: JSON.stringify({ api_key: key }),
          });
          _showMsg(msgEl, 'API Key berhasil disimpan.', 'success');
          await this._load();
        } catch (e) {
          _showMsg(msgEl, e.message || 'Gagal menyimpan API Key.', 'error');
        } finally {
          btn.disabled = false; btn.textContent = orig;
        }
      });
    });
    el.querySelectorAll('[data-delete-adu-key]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Hapus API Key Adu dari akun ini?')) return;
        const id = btn.dataset.deleteAduKey;
        btn.disabled = true;
        try {
          await apiFetch(`/accounts/adu/${id}/api-key`, { method: 'DELETE' });
          await this._load();
        } catch (e) {
          alert(e.message);
          btn.disabled = false;
        }
      });
    });
    el.querySelectorAll('[data-delete-adu]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Hapus akun Adu ini beserta riwayat sync-nya?')) return;
        const id = btn.dataset.deleteAdu;
        btn.disabled = true;
        try {
          await apiFetch(`/accounts/adu/${id}`, { method: 'DELETE' });
          await this._load();
        } catch (e) {
          alert(e.message);
          btn.disabled = false;
        }
      });
    });
    el.querySelectorAll('[data-toggle-adu-sync]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggleAduSync;
        const panel = el.querySelector(`#adu-sync-panel-${id}`);
        const chevron = el.querySelector(`#adu-sync-chevron-${id}`);
        const open = panel.style.display === 'none';
        panel.style.display = open ? 'block' : 'none';
        if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
      });
    });
    el.querySelectorAll('[data-toggle-adu-hist]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggleAduHist;
        const panel = el.querySelector(`#adu-sync-logs-${id}`);
        const chevron = el.querySelector(`#adu-hist-chevron-${id}`);
        const open = panel.style.display === 'none';
        panel.style.display = open ? 'block' : 'none';
        if (chevron) chevron.style.transform = open ? 'rotate(90deg)' : '';
        if (open) this._loadAduSyncLogs(id, el);
      });
    });
    el.querySelectorAll('[data-do-adu-sync]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.doAduSync;
        const dari = el.querySelector(`#adu-sync-dari-${id}`)?.value;
        const sampai = el.querySelector(`#adu-sync-sampai-${id}`)?.value;
        const resultEl = el.querySelector(`#adu-sync-result-${id}`);
        if (!dari || !sampai) { _showResult(resultEl, 'Isi rentang tanggal dulu.', 'error'); return; }
        if (dari > sampai) { _showResult(resultEl, 'Tanggal dari tidak boleh lebih dari sampai.', 'error'); return; }

        const orig = btn.textContent;
        btn.disabled = true; btn.textContent = 'Menyinkronkan…';
        resultEl.style.display = 'none';
        try {
          const res = await apiFetch(`/adu-sync/${id}`, {
            method: 'POST',
            body: JSON.stringify({ tanggal_dari: dari, tanggal_sampai: sampai }),
          });
          _showResult(resultEl,
            `Selesai — ${res.rows_fetched} baris dari Clickadu, ${res.rows_upserted} berhasil diupsert${res.rows_gagal > 0 ? `, ${res.rows_gagal} gagal` : ''}.`,
            'success'
          );
          if (el.querySelector(`#adu-sync-logs-${id}`)?.style.display !== 'none') this._loadAduSyncLogs(id, el);
        } catch (e) {
          _showResult(resultEl, e.message || 'Sync gagal.', 'error');
          if (el.querySelector(`#adu-sync-logs-${id}`)?.style.display !== 'none') this._loadAduSyncLogs(id, el);
        } finally {
          btn.disabled = false; btn.textContent = orig;
        }
      });
    });
  }

  async _loadAduSyncLogs(accountId, el) {
    const logsEl = el.querySelector(`#adu-sync-logs-${accountId}`);
    if (!logsEl) return;
    try {
      const logs = await apiFetch(`/adu-sync/${accountId}/logs?limit=5`);
      if (!logs || logs.length === 0) {
        logsEl.innerHTML = `<div style="font-size:11.5px;color:var(--text-muted);">Belum ada riwayat sync.</div>`;
        return;
      }
      logsEl.innerHTML = `
        <div style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;">Riwayat Sync</div>
        ${logs.map(l => `
          <div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="badge ${l.status === 'selesai' ? 'badge-green' : 'badge-red'}" style="font-size:10px;padding:2px 6px;">${l.status}</span>
              <span style="color:var(--text-muted);">${l.tanggal_dari} – ${l.tanggal_sampai}</span>
              <span style="flex:1;text-align:right;color:var(--text-muted);">${l.rows_upserted} upsert${l.rows_gagal > 0 ? ` · ${l.rows_gagal} gagal` : ''}</span>
              <span style="color:var(--text-muted);font-size:10.5px;">${_fmtDt(l.synced_at)}</span>
            </div>
            ${l.catatan ? `<div style="margin-top:4px;color:#dc2626;font-size:11px;">${l.catatan}</div>` : ''}
          </div>
        `).join('')}
      `;
    } catch (_) {}
  }

  async _simpanAdu() {
    const nama = this.container.querySelector('#adu-nama').value.trim();
    const errEl = this.container.querySelector('#adu-error');
    errEl.style.display = 'none';

    if (!nama) {
      errEl.textContent = 'Nama tampilan wajib diisi.';
      errEl.style.display = 'block';
      return;
    }

    const btn = this.container.querySelector('#btn-simpan-adu');
    btn.disabled = true; btn.textContent = 'Menyimpan…';
    try {
      await apiFetch('/accounts/adu', {
        method: 'POST',
        body: JSON.stringify({ nama_tampilan: nama }),
      });
      this.container.querySelector('#form-adu').style.display = 'none';
      this.container.querySelector('#adu-nama').value = '';
      await this._load();
    } catch (e) {
      errEl.textContent = e.message || 'Gagal menyimpan akun Adu.';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan';
    }
  }

  // ---------------------------------------------------------------------------
  // Terra Ads (Adsterra API)
  // ---------------------------------------------------------------------------

  _renderTerra(el) {
    if (!el) return;
    const header = `<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin:20px 0 10px;text-transform:uppercase;letter-spacing:0.5px;">
      Akun Terra Ads / Adsterra (${this._terraAccounts.length})
    </div>`;
    const cards = this._terraAccounts.length === 0
      ? `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;border:1px solid var(--border);border-radius:8px;">Belum ada akun Terra. Klik "+ Tambah Akun Terra" di atas.</div>`
      : this._terraAccounts.map(a => this._renderTerraCard(a)).join('');
    el.innerHTML = header + cards;
    this._bindTerraEvents(el);
  }

  _renderTerraCard(a) {
    const hasKey = a.has_api_key;
    let keyBadge = hasKey
      ? (a.status_koneksi === 'token_expired'
          ? `<span class="badge badge-red">API Key Invalid</span>`
          : `<span class="badge badge-green">API Key Aktif</span>`)
      : `<span class="badge badge-yellow">Belum Ada API Key</span>`;

    const today = new Date().toISOString().slice(0, 10);
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    return `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;background:#fef3c7;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">🌍</div>
            <div>
              <div style="font-size:14px;font-weight:700;">${a.nama_tampilan}</div>
              <div style="font-size:11.5px;color:var(--text-muted);">Adsterra Advertiser</div>
            </div>
          </div>
          <button class="btn btn-sm" style="color:#dc2626;border-color:#dc2626;" data-delete-terra="${a.id}">Hapus</button>
        </div>

        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;margin-bottom:12px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0;color:var(--text-muted);"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          <span style="font-size:12px;color:var(--text-muted);flex:1;">API Key Adsterra</span>
          ${keyBadge}
          <button class="btn btn-sm" data-toggle-terra-key="${a.id}" style="font-size:11px;">
            ${hasKey ? 'Ganti' : 'Pasang API Key'}
          </button>
        </div>

        <div id="terra-key-panel-${a.id}" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px;">
          <div class="form-label">API KEY ADSTERRA</div>
          <input id="terra-key-input-${a.id}" type="text" class="form-input"
            placeholder="Paste API Key di sini"
            style="font-family:monospace;font-size:11.5px;">
          <div class="form-hint" style="margin-bottom:10px;">
            Ambil dari Adsterra Advertiser Dashboard → Advertisers API documentation → X-API-Key.
          </div>
          <div id="terra-key-msg-${a.id}" style="display:none;font-size:12px;margin-bottom:8px;padding:8px 10px;border-radius:6px;"></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" data-save-terra-key="${a.id}">Simpan API Key</button>
            ${hasKey ? `<button class="btn btn-sm" style="color:#dc2626;border-color:#dc2626;" data-delete-terra-key="${a.id}">Hapus API Key</button>` : ''}
            <button class="btn btn-sm" data-close-terra-key="${a.id}">Batal</button>
          </div>
        </div>

        <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;">
          <button data-toggle-terra-sync="${a.id}"
            style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg);border:none;cursor:pointer;font-size:13px;font-weight:600;color:var(--text);">
            <span style="display:flex;align-items:center;gap:7px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Sync Data dari Adsterra API
            </span>
            <svg id="terra-sync-chevron-${a.id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div id="terra-sync-panel-${a.id}" style="display:none;padding:14px;border-top:1px solid var(--border);">
            ${!hasKey ? `<div class="alert alert-error" style="margin-bottom:0;font-size:12px;">Pasang API Key dulu sebelum bisa sync.</div>` : `
            <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;">
              <div>
                <div class="form-label">DARI</div>
                <input type="date" class="form-input" id="terra-sync-dari-${a.id}" value="${firstDay}">
              </div>
              <div>
                <div class="form-label">SAMPAI</div>
                <input type="date" class="form-input" id="terra-sync-sampai-${a.id}" value="${today}">
              </div>
              <button class="btn btn-primary btn-sm" data-do-terra-sync="${a.id}" style="white-space:nowrap;">
                Sync Sekarang
              </button>
            </div>
            <div class="form-hint" style="margin-top:6px;">Satu kali sync mencakup seluruh rentang tanggal (breakdown per hari per placement langsung dari API).</div>
            <div id="terra-sync-result-${a.id}" style="display:none;margin-top:10px;"></div>
            <button data-toggle-terra-hist="${a.id}" style="margin-top:12px;background:none;border:none;padding:0;cursor:pointer;font-size:11.5px;color:var(--text-muted);display:flex;align-items:center;gap:4px;">
              <svg id="terra-hist-chevron-${a.id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="transition:transform 0.2s;"><polyline points="9 18 15 12 9 6"/></svg>
              Riwayat Sync
            </button>
            <div id="terra-sync-logs-${a.id}" style="display:none;margin-top:8px;"></div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  _bindTerraEvents(el) {
    el.querySelectorAll('[data-toggle-terra-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggleTerraKey;
        const panel = el.querySelector(`#terra-key-panel-${id}`);
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        if (panel.style.display === 'block') el.querySelector(`#terra-key-input-${id}`)?.focus();
      });
    });
    el.querySelectorAll('[data-close-terra-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelector(`#terra-key-panel-${btn.dataset.closeTerraKey}`).style.display = 'none';
      });
    });
    el.querySelectorAll('[data-save-terra-key]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.saveTerraKey;
        const key = el.querySelector(`#terra-key-input-${id}`)?.value.trim();
        const msgEl = el.querySelector(`#terra-key-msg-${id}`);
        if (!key) {
          _showMsg(msgEl, 'API Key tidak boleh kosong.', 'error');
          return;
        }
        const orig = btn.textContent;
        btn.disabled = true; btn.textContent = 'Menyimpan…';
        try {
          await apiFetch(`/accounts/terra/${id}/api-key`, {
            method: 'PATCH',
            body: JSON.stringify({ api_key: key }),
          });
          _showMsg(msgEl, 'API Key berhasil disimpan.', 'success');
          await this._load();
        } catch (e) {
          _showMsg(msgEl, e.message || 'Gagal menyimpan API Key.', 'error');
        } finally {
          btn.disabled = false; btn.textContent = orig;
        }
      });
    });
    el.querySelectorAll('[data-delete-terra-key]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Hapus API Key Terra dari akun ini?')) return;
        const id = btn.dataset.deleteTerraKey;
        btn.disabled = true;
        try {
          await apiFetch(`/accounts/terra/${id}/api-key`, { method: 'DELETE' });
          await this._load();
        } catch (e) {
          alert(e.message);
          btn.disabled = false;
        }
      });
    });
    el.querySelectorAll('[data-delete-terra]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Hapus akun Terra ini beserta riwayat sync-nya?')) return;
        const id = btn.dataset.deleteTerra;
        btn.disabled = true;
        try {
          await apiFetch(`/accounts/terra/${id}`, { method: 'DELETE' });
          await this._load();
        } catch (e) {
          alert(e.message);
          btn.disabled = false;
        }
      });
    });
    el.querySelectorAll('[data-toggle-terra-sync]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggleTerraSync;
        const panel = el.querySelector(`#terra-sync-panel-${id}`);
        const chevron = el.querySelector(`#terra-sync-chevron-${id}`);
        const open = panel.style.display === 'none';
        panel.style.display = open ? 'block' : 'none';
        if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
      });
    });
    el.querySelectorAll('[data-toggle-terra-hist]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggleTerraHist;
        const panel = el.querySelector(`#terra-sync-logs-${id}`);
        const chevron = el.querySelector(`#terra-hist-chevron-${id}`);
        const open = panel.style.display === 'none';
        panel.style.display = open ? 'block' : 'none';
        if (chevron) chevron.style.transform = open ? 'rotate(90deg)' : '';
        if (open) this._loadTerraSyncLogs(id, el);
      });
    });
    el.querySelectorAll('[data-do-terra-sync]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.doTerraSync;
        const dari = el.querySelector(`#terra-sync-dari-${id}`)?.value;
        const sampai = el.querySelector(`#terra-sync-sampai-${id}`)?.value;
        const resultEl = el.querySelector(`#terra-sync-result-${id}`);
        if (!dari || !sampai) { _showResult(resultEl, 'Isi rentang tanggal dulu.', 'error'); return; }
        if (dari > sampai) { _showResult(resultEl, 'Tanggal dari tidak boleh lebih dari sampai.', 'error'); return; }

        const orig = btn.textContent;
        btn.disabled = true; btn.textContent = 'Menyinkronkan…';
        resultEl.style.display = 'none';
        try {
          const res = await apiFetch(`/terra-sync/${id}`, {
            method: 'POST',
            body: JSON.stringify({ tanggal_dari: dari, tanggal_sampai: sampai }),
          });
          _showResult(resultEl,
            `Selesai — ${res.rows_fetched} baris dari Adsterra, ${res.rows_upserted} berhasil diupsert${res.rows_gagal > 0 ? `, ${res.rows_gagal} gagal` : ''}.`,
            'success'
          );
          if (el.querySelector(`#terra-sync-logs-${id}`)?.style.display !== 'none') this._loadTerraSyncLogs(id, el);
        } catch (e) {
          _showResult(resultEl, e.message || 'Sync gagal.', 'error');
          if (el.querySelector(`#terra-sync-logs-${id}`)?.style.display !== 'none') this._loadTerraSyncLogs(id, el);
        } finally {
          btn.disabled = false; btn.textContent = orig;
        }
      });
    });
  }

  async _loadTerraSyncLogs(accountId, el) {
    const logsEl = el.querySelector(`#terra-sync-logs-${accountId}`);
    if (!logsEl) return;
    try {
      const logs = await apiFetch(`/terra-sync/${accountId}/logs?limit=5`);
      if (!logs || logs.length === 0) {
        logsEl.innerHTML = `<div style="font-size:11.5px;color:var(--text-muted);">Belum ada riwayat sync.</div>`;
        return;
      }
      logsEl.innerHTML = `
        <div style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;">Riwayat Sync</div>
        ${logs.map(l => `
          <div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="badge ${l.status === 'selesai' ? 'badge-green' : 'badge-red'}" style="font-size:10px;padding:2px 6px;">${l.status}</span>
              <span style="color:var(--text-muted);">${l.tanggal_dari} – ${l.tanggal_sampai}</span>
              <span style="flex:1;text-align:right;color:var(--text-muted);">${l.rows_upserted} upsert${l.rows_gagal > 0 ? ` · ${l.rows_gagal} gagal` : ''}</span>
              <span style="color:var(--text-muted);font-size:10.5px;">${_fmtDt(l.synced_at)}</span>
            </div>
            ${l.catatan ? `<div style="margin-top:4px;color:#dc2626;font-size:11px;">${l.catatan}</div>` : ''}
          </div>
        `).join('')}
      `;
    } catch (_) {}
  }

  async _simpanTerra() {
    const nama = this.container.querySelector('#terra-nama').value.trim();
    const errEl = this.container.querySelector('#terra-error');
    errEl.style.display = 'none';

    if (!nama) {
      errEl.textContent = 'Nama tampilan wajib diisi.';
      errEl.style.display = 'block';
      return;
    }

    const btn = this.container.querySelector('#btn-simpan-terra');
    btn.disabled = true; btn.textContent = 'Menyimpan…';
    try {
      await apiFetch('/accounts/terra', {
        method: 'POST',
        body: JSON.stringify({ nama_tampilan: nama }),
      });
      this.container.querySelector('#form-terra').style.display = 'none';
      this.container.querySelector('#terra-nama').value = '';
      await this._load();
    } catch (e) {
      errEl.textContent = e.message || 'Gagal menyimpan akun Terra.';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan';
    }
  }

  destroy() {}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _showMsg(el, text, type) {
  el.textContent = text;
  el.style.background = type === 'success' ? '#f0fdf4' : '#fef2f2';
  el.style.color = type === 'success' ? '#166534' : '#991b1b';
  el.style.border = `1px solid ${type === 'success' ? '#bbf7d0' : '#fecaca'}`;
  el.style.display = 'block';
}

function _showResult(el, text, type) {
  el.textContent = text;
  el.style.padding = '8px 12px';
  el.style.borderRadius = '6px';
  el.style.fontSize = '12px';
  el.style.background = type === 'success' ? '#f0fdf4' : '#fef2f2';
  el.style.color = type === 'success' ? '#166534' : '#991b1b';
  el.style.border = `1px solid ${type === 'success' ? '#bbf7d0' : '#fecaca'}`;
  el.style.display = 'block';
}

function _fmtDt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}
