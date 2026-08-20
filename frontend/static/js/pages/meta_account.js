import { apiFetch } from '../api.js';

export class MetaAccountPage {
  constructor(container) {
    this.container = container;
    this._tree = { meta_accounts: [], shopee_unlinked: [] };
    this._metaInfo = {}; // id → { has_token, token_expires_at, status_koneksi }
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
          <a id="btn-hubungkan-meta" href="/api/meta-oauth/connect" style="display:inline-block;">
            <button class="btn" style="background:#1877f2;color:#fff;border-color:#1877f2;" id="btn-oauth-connect">
              Hubungkan Meta
            </button>
          </a>
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

      <div id="content"><div class="loading">Memuat data…</div></div>
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
  }

  async _load() {
    const el = this.container.querySelector('#content');
    try {
      const [tree, metaList] = await Promise.all([
        apiFetch('/accounts/tree'),
        apiFetch('/accounts/meta'),
      ]);
      this._tree = tree || { meta_accounts: [], shopee_unlinked: [] };
      this._metaInfo = {};
      for (const m of (metaList || [])) {
        this._metaInfo[m.id] = m;
      }
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
      : meta_accounts.map(m => this._renderMetaCard(m, unlinkedOptions)).join('');

    const unlinkedSection = shopee_unlinked.length > 0
      ? `<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin:20px 0 10px;text-transform:uppercase;letter-spacing:0.5px;">
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

    el.innerHTML = `<div id="tree-content">${metaCards}${unlinkedSection}</div>`;
    this._bindTreeEvents(el);
    this._bindTokenEvents(el);
    this._bindSyncEvents(el);
  }

  _renderMetaCard(m, unlinkedOptions) {
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

        <!-- Shopee links -->
        <div style="border-top:1px solid var(--border);padding-top:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
            Shopee terhubung (${m.shopee_accounts.length})
          </div>
          ${shopeeRows}
          ${linkRow}
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

  _bindTreeEvents(el) {
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
