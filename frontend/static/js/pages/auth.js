import { apiFetch, setToken, getToken } from '../api.js';
import { redirect } from '../router.js';

export class AuthPage {
  constructor(container) {
    this.container = container;
    this.mode = 'login';
  }

  async render() {
    if (getToken()) { redirect('/laporan-harian2'); return; }

    this.container.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <div class="auth-logo">
            <div class="auth-logo-icon">TP</div>
            <div class="auth-logo-name">TrackPro</div>
            <div class="auth-logo-sub">Meta Ads × Shopee Affiliate</div>
          </div>

          <div class="auth-tabs">
            <button class="auth-tab ${this.mode === 'login' ? 'active' : ''}" id="tab-login">Masuk</button>
            <button class="auth-tab ${this.mode === 'register' ? 'active' : ''}" id="tab-register">Daftar</button>
          </div>

          <div id="auth-error" style="display:none" class="alert alert-error"></div>

          <form id="auth-form">
            ${this.mode === 'register' ? `
              <div>
                <label class="auth-form-label">Nama Lengkap</label>
                <input class="auth-input" type="text" id="nama" placeholder="Masukkan nama Anda" autocomplete="name" required>
              </div>
              <div>
                <label class="auth-form-label">Username</label>
                <input class="auth-input" type="text" id="username" placeholder="Minimum 3 karakter" autocomplete="username" required>
              </div>
            ` : ''}
            <div>
              <label class="auth-form-label">Email</label>
              <input class="auth-input" type="email" id="email" placeholder="email@contoh.com" autocomplete="email" required>
            </div>
            <div>
              <label class="auth-form-label">Password</label>
              <input class="auth-input" type="password" id="password" placeholder="${this.mode === 'register' ? 'Minimal 8 karakter' : 'Masukkan password'}" autocomplete="${this.mode === 'login' ? 'current-password' : 'new-password'}" required>
            </div>
            <button class="auth-btn" type="submit" id="btn-submit">
              ${this.mode === 'login' ? 'Masuk' : 'Buat Akun'}
            </button>
          </form>
        </div>
      </div>
    `;

    this.container.querySelector('#tab-login').addEventListener('click', () => {
      this.mode = 'login';
      this.render();
    });

    this.container.querySelector('#tab-register').addEventListener('click', () => {
      this.mode = 'register';
      this.render();
    });

    this.container.querySelector('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this._submit();
    });
  }

  async _submit() {
    const errEl = this.container.querySelector('#auth-error');
    const btn = this.container.querySelector('#btn-submit');
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Memproses…';

    try {
      const email = this.container.querySelector('#email').value.trim();
      const password = this.container.querySelector('#password').value;
      let body;

      if (this.mode === 'register') {
        const nama = this.container.querySelector('#nama').value.trim();
        const username = this.container.querySelector('#username').value.trim();
        body = await apiFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ nama, email, username, password }),
        });
      } else {
        body = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
      }

      if (body?.access_token) {
        setToken(body.access_token);
        redirect('/laporan-harian2');
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = this.mode === 'login' ? 'Masuk' : 'Buat Akun';
    }
  }

  destroy() {}
}
