import { apiFetch, clearToken } from '../api.js';

export class AccountPage {
  constructor(container) {
    this.container = container;
    this._user = null;
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Akun</h1>
          <p>Kelola profil, keamanan password, dan data akun TrackPro Anda.</p>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;
    await this._load();
  }

  async _load() {
    const el = this.container.querySelector('#content');
    try {
      const user = await apiFetch('/auth/me');
      if (!user) return;
      this._user = user;
      this._render(el, user);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _render(el, user) {
    const initials = (user.nama || 'U').slice(0, 2).toUpperCase();
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start;">
        <div>
          <div class="profile-card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
              <div>
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="width:40px;height:40px;background:#dc2626;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;">${initials}</div>
                  <h3>Profil User</h3>
                </div>
                <p style="margin-left:50px;">Informasi dasar user yang sedang login.</p>
              </div>
              <span style="font-size:12px;color:#6b7280;">ID ${user.id?.slice(0,8).toUpperCase() || '-'}</span>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;">
              <div class="profile-field">
                <div class="profile-field-label">NAMA</div>
                <div class="profile-field-value">${user.nama || '-'}</div>
              </div>
              <div class="profile-field">
                <div class="profile-field-label">EMAIL</div>
                <div class="profile-field-value">${user.email || '-'}</div>
              </div>
              <div class="profile-field">
                <div class="profile-field-label">USERNAME</div>
                <div class="profile-field-value">${user.username || '-'}</div>
              </div>
              <div class="profile-field">
                <div class="profile-field-label">ROLE</div>
                <div class="profile-field-value">${user.role || 'User'}</div>
              </div>
              <div class="profile-field">
                <div class="profile-field-label">TANGGAL DAFTAR</div>
                <div class="profile-field-value">${user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID') : '-'}</div>
              </div>
              <div class="profile-field">
                <div class="profile-field-label">ID USER</div>
                <div class="profile-field-value">${user.id?.slice(0,8).toUpperCase() || '-'}</div>
              </div>
            </div>
          </div>

          <div class="profile-card">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <span style="font-size:20px;">🔒</span>
              <h3>Keamanan Password</h3>
            </div>
            <p>Gunakan password minimal 8 karakter dengan kombinasi huruf besar, huruf kecil, angka, dan simbol.</p>

            <div id="pw-error" class="alert alert-error" style="display:none;margin-bottom:12px;"></div>
            <div id="pw-success" class="alert alert-success" style="display:none;margin-bottom:12px;"></div>

            <div style="display:grid;grid-template-columns:1fr 280px;gap:16px;">
              <div>
                <div class="form-group">
                  <div class="form-label">Password saat ini</div>
                  <div style="position:relative;">
                    <input type="password" class="form-input" id="pw-current" placeholder="Masukkan password saat ini">
                  </div>
                </div>
                <div class="form-group">
                  <div class="form-label">Password baru</div>
                  <input type="password" class="form-input" id="pw-new" placeholder="Minimal 8 karakter">
                </div>
                <div class="form-group">
                  <div class="form-label">Konfirmasi password baru</div>
                  <input type="password" class="form-input" id="pw-confirm" placeholder="Ulangi password baru">
                </div>
                <button class="btn btn-primary" id="btn-update-pw">Update Password</button>
              </div>
              <div style="background:#f9fafb;border-radius:8px;padding:16px;">
                <div style="font-size:13px;font-weight:600;margin-bottom:10px;">Kekuatan password: Lemah</div>
                <div style="height:4px;background:#e5e7eb;border-radius:2px;margin-bottom:14px;">
                  <div style="width:20%;height:100%;background:#dc2626;border-radius:2px;"></div>
                </div>
                <div style="font-size:12px;color:#6b7280;display:flex;flex-direction:column;gap:5px;">
                  <div>○ Minimal 8 karakter</div>
                  <div>○ Huruf kecil</div>
                  <div>○ Huruf besar</div>
                  <div>○ Angka</div>
                  <div>○ Simbol</div>
                </div>
              </div>
            </div>
          </div>

          <div class="profile-card">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <span style="font-size:20px;">🔔</span>
              <div>
                <h3>Notifikasi User</h3>
                <span class="badge badge-yellow" style="margin-left:6px;">Telegram belum terhubung</span>
              </div>
            </div>
            <p>Notifikasi saldo rendah dan Aksi Otomatis Meta dikirim ke Telegram atau WhatsApp milik akun ini.</p>

            <div style="display:grid;grid-template-columns:1fr 1fr 220px;gap:16px;margin-top:16px;">
              <div class="form-group">
                <div class="form-label">TELEGRAM CHAT ID</div>
                <input type="text" class="form-input" placeholder="Contoh: 123456789">
                <div class="form-hint">Wajib diisi agar pesan Telegram bisa dikirim langsung.</div>
              </div>
              <div class="form-group">
                <div class="form-label">USERNAME TELEGRAM</div>
                <input type="text" class="form-input" placeholder="username tanpa @">
                <div class="form-hint">Opsional untuk memudahkan identifikasi user.</div>
              </div>
              <div style="background:#f9fafb;border-radius:8px;padding:14px;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:13px;">📱 WhatsApp</div>
                <div style="font-size:13px;font-weight:600;margin-bottom:10px;">+62 xxx</div>
                <button class="btn btn-sm" style="width:100%;">Hubungkan Telegram ↗</button>
              </div>
            </div>
            <button class="btn btn-primary btn-sm">Simpan Notifikasi</button>
          </div>

          <div class="profile-card" style="border-color:#dc2626;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="color:#dc2626;font-size:16px;">⚠</span>
              <h3 style="color:#dc2626;">Danger Zone</h3>
            </div>
            <p style="color:#dc2626;">Aksi di bawah ini bersifat permanen dan tidak bisa dibatalkan.</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
              <div style="border:1px solid #e5e7eb;border-radius:6px;padding:14px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-weight:600;">Reset Data Tracking</div>
                  <div style="font-size:12px;color:#6b7280;margin-top:2px;">Menghapus data Shopee, Meta, import, dan cache laporan dari akun Anda.</div>
                </div>
                <button class="btn btn-sm" id="btn-reset-data" style="color:#dc2626;border-color:#dc2626;white-space:nowrap;">🔄</button>
              </div>
              <div style="border:1px solid #e5e7eb;border-radius:6px;padding:14px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-weight:600;">Hapus Akun</div>
                  <div style="font-size:12px;color:#6b7280;margin-top:2px;">Menghapus akun user dan seluruh data terkait secara permanen.</div>
                </div>
                <button class="btn btn-sm" id="btn-hapus-akun" style="color:#dc2626;border-color:#dc2626;white-space:nowrap;">🗑</button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="profile-card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <h3>Status User</h3>
              <span style="font-size:18px;">🛡</span>
            </div>
            <p style="margin-bottom:12px;">Status akun dan langganan TrackPro.</p>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:8px;">
              <span style="font-size:13px;">Status akun</span>
              <span class="badge badge-green">Aktif</span>
            </div>
            <div style="padding:10px;border:1px solid #e5e7eb;border-radius:6px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-size:13px;">Status langganan</span>
                <span class="badge badge-green">Aktif</span>
              </div>
              <div style="font-size:13px;display:flex;flex-direction:column;gap:4px;">
                <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Paket</span><span style="font-weight:600;">Trial</span></div>
                <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Mulai</span><span>-</span></div>
                <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Berakhir</span><span>-</span></div>
                <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Sisa hari</span><span>-</span></div>
                <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Pembayaran terakhir</span><span>-</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    el.querySelector('#btn-reset-data')?.addEventListener('click', () => this._confirmReset());
    el.querySelector('#btn-hapus-akun')?.addEventListener('click', () => this._confirmDeleteAccount());

    el.querySelector('#btn-update-pw')?.addEventListener('click', async () => {
      const errEl = el.querySelector('#pw-error');
      const successEl = el.querySelector('#pw-success');
      const cur = el.querySelector('#pw-current').value;
      const nw = el.querySelector('#pw-new').value;
      const conf = el.querySelector('#pw-confirm').value;

      errEl.style.display = 'none';
      successEl.style.display = 'none';

      if (nw !== conf) {
        errEl.textContent = 'Password baru tidak cocok.';
        errEl.style.display = 'block';
        return;
      }
      if (nw.length < 8) {
        errEl.textContent = 'Password minimal 8 karakter.';
        errEl.style.display = 'block';
        return;
      }

      try {
        await apiFetch('/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ current_password: cur, new_password: nw }),
        });
        successEl.textContent = 'Password berhasil diperbarui.';
        successEl.style.display = 'block';
      } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
      }
    });
  }

  _confirmReset() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    overlay.innerHTML = `
      <div style="background:white;border-radius:10px;padding:28px;width:420px;max-width:90vw;">
        <h3 style="margin:0 0 8px;color:#dc2626;">Reset Data Tracking</h3>
        <p style="font-size:14px;color:#6b7280;margin-bottom:16px;">Semua data kampanye, metrik, komisi, klik, dan saldo iklan akan dihapus permanen. Akun dan pengaturan tetap.</p>
        <p style="font-size:13px;margin-bottom:8px;">Ketik <strong>RESET</strong> untuk konfirmasi:</p>
        <input id="reset-confirm-input" type="text" class="form-input" placeholder="Ketik RESET" style="margin-bottom:16px;">
        <div id="reset-error" style="color:#dc2626;font-size:13px;margin-bottom:8px;display:none;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="reset-cancel" class="btn">Batal</button>
          <button id="reset-confirm" class="btn" style="background:#dc2626;color:white;border-color:#dc2626;">Reset Data</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#reset-cancel').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.querySelector('#reset-confirm').onclick = async () => {
      const val = overlay.querySelector('#reset-confirm-input').value.trim();
      if (val !== 'RESET') {
        overlay.querySelector('#reset-error').textContent = 'Ketik RESET (huruf kapital) untuk konfirmasi.';
        overlay.querySelector('#reset-error').style.display = 'block';
        return;
      }
      try {
        overlay.querySelector('#reset-confirm').textContent = 'Menghapus…';
        overlay.querySelector('#reset-confirm').disabled = true;
        await apiFetch('/auth/reset-data', { method: 'POST' });
        overlay.remove();
        window.location.reload();
      } catch (e) {
        overlay.querySelector('#reset-error').textContent = e.message;
        overlay.querySelector('#reset-error').style.display = 'block';
        overlay.querySelector('#reset-confirm').textContent = 'Reset Data';
        overlay.querySelector('#reset-confirm').disabled = false;
      }
    };
  }

  _confirmDeleteAccount() {
    const email = this._user?.email || '';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    overlay.innerHTML = `
      <div style="background:white;border-radius:10px;padding:28px;width:420px;max-width:90vw;">
        <h3 style="margin:0 0 8px;color:#dc2626;">Hapus Akun</h3>
        <p style="font-size:14px;color:#6b7280;margin-bottom:16px;">Akun dan seluruh data terkait akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.</p>
        <p style="font-size:13px;margin-bottom:8px;">Ketik email Anda (<strong>${email}</strong>) untuk konfirmasi:</p>
        <input id="delete-confirm-input" type="text" class="form-input" placeholder="${email}" style="margin-bottom:16px;">
        <div id="delete-error" style="color:#dc2626;font-size:13px;margin-bottom:8px;display:none;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="delete-cancel" class="btn">Batal</button>
          <button id="delete-confirm" class="btn" style="background:#dc2626;color:white;border-color:#dc2626;">Hapus Akun Saya</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#delete-cancel').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.querySelector('#delete-confirm').onclick = async () => {
      const val = overlay.querySelector('#delete-confirm-input').value.trim();
      if (val !== email) {
        overlay.querySelector('#delete-error').textContent = 'Email tidak cocok.';
        overlay.querySelector('#delete-error').style.display = 'block';
        return;
      }
      try {
        overlay.querySelector('#delete-confirm').textContent = 'Menghapus…';
        overlay.querySelector('#delete-confirm').disabled = true;
        await apiFetch('/auth/account', { method: 'DELETE' });
        overlay.remove();
        clearToken();
        window.location.hash = '#/login';
      } catch (e) {
        overlay.querySelector('#delete-error').textContent = e.message;
        overlay.querySelector('#delete-error').style.display = 'block';
        overlay.querySelector('#delete-confirm').textContent = 'Hapus Akun Saya';
        overlay.querySelector('#delete-confirm').disabled = false;
      }
    };
  }

  destroy() {}
}
