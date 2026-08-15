import { apiFetch, setToken } from '../api.js';
import { redirect } from '../router.js';

export class AuthPage {
  constructor(container) {
    this.container = container;
    this.mode = 'login';
  }

  render() {
    this.container.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <div class="auth-logo">AdCommTrack</div>
          <div class="auth-tabs">
            <button class="tab-btn ${this.mode === 'login' ? 'active' : ''}" data-mode="login">Masuk</button>
            <button class="tab-btn ${this.mode === 'register' ? 'active' : ''}" data-mode="register">Daftar</button>
          </div>

          <div id="alert" class="alert" style="display:none"></div>

          ${this.mode === 'login' ? this._loginForm() : this._registerForm()}
        </div>
      </div>
    `;
    this._bind();
  }

  _loginForm() {
    return `
      <form id="auth-form">
        <label>Email
          <input type="email" name="email" required autocomplete="email">
        </label>
        <label>Password
          <input type="password" name="password" required autocomplete="current-password">
        </label>
        <button type="submit" class="btn-primary btn-full">Masuk</button>
      </form>
    `;
  }

  _registerForm() {
    return `
      <form id="auth-form">
        <label>Nama Lengkap
          <input type="text" name="nama" required>
        </label>
        <label>Email
          <input type="email" name="email" required autocomplete="email">
        </label>
        <label>Username
          <input type="text" name="username" required autocomplete="username">
        </label>
        <label>Password
          <input type="password" name="password" required autocomplete="new-password" minlength="8">
        </label>
        <button type="submit" class="btn-primary btn-full">Daftar & Masuk</button>
      </form>
    `;
  }

  _bind() {
    this.container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.mode = btn.dataset.mode;
        this.render();
      });
    });

    this.container.querySelector('#auth-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      const alertEl = this.container.querySelector('#alert');
      alertEl.style.display = 'none';
      btn.disabled = true;
      btn.textContent = 'Memproses…';

      const data = Object.fromEntries(new FormData(e.target));
      const path = this.mode === 'login' ? '/auth/login' : '/auth/register';

      try {
        const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(data) });
        if (!res) return;
        setToken(res.access_token);
        redirect('/dashboard');
      } catch (err) {
        alertEl.textContent = err.message;
        alertEl.className = 'alert alert-error';
        alertEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = this.mode === 'login' ? 'Masuk' : 'Daftar & Masuk';
      }
    });
  }

  destroy() {}
}
