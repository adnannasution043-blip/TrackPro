import { apiFetch } from '../api.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

export class BalancePage {
  constructor(container) {
    this.container = container;
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Saldo Iklan</h1>
          <p>Pantau saldo semua akun agensi dalam satu layar — tanpa buka satu-satu di Ads Manager.</p>
        </div>
        <div class="page-header-right">
          <span style="font-size:12.5px;color:#6b7280;">Terakhir dibaca: hari ini</span>
          <button class="btn" id="btn-refresh">🔄 Refresh saldo</button>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;

    this.container.querySelector('#btn-refresh').addEventListener('click', () => this._load());
    await this._load();
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';
    try {
      const data = await apiFetch('/accounts');
      const accounts = (data || []).filter(a => a.tipe === 'meta');
      this._render(el, accounts);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _render(el, accounts) {
    if (accounts.length === 0) {
      el.innerHTML = `
        <div class="card" style="text-align:center;padding:48px;">
          <div style="font-size:32px;margin-bottom:12px;">🏦</div>
          <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Belum ada akun Meta</div>
          <div style="font-size:13px;color:#6b7280;">Hubungkan akun Meta Ads di Pengaturan → Akun Meta</div>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:13px;color:#6b7280;">
        Semua akun agensi · ${accounts.length} akun
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:10px;">
          RINGKASAN - TOTAL LIMIT · TERPAKAI · SISA
          <span style="float:right;" class="badge badge-green">● LIVE</span>
        </div>
        <div style="display:flex;gap:24px;margin-bottom:10px;flex-wrap:wrap;">
          <div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">SISA SALDO</div>
            <div style="font-size:22px;font-weight:700;">Rp 0</div>
          </div>
          <div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">TOTAL LIMIT</div>
            <div style="font-size:22px;font-weight:700;">Rp 0</div>
          </div>
          <div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">TERPAKAI</div>
            <div style="font-size:22px;font-weight:700;">Rp 0</div>
          </div>
        </div>
        <div style="height:8px;background:#f3f4f6;border-radius:4px;overflow:hidden;">
          <div style="width:0%;height:100%;background:#dc2626;border-radius:4px;"></div>
        </div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">- limit terpakai · ${accounts.length} akun</div>
      </div>

      <div style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px;">
        AKUN AGENSI · ${accounts.length}
      </div>

      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>AKUN</th><th>SISA SALDO</th><th>KEMARIN</th><th>CUKUP</th><th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              ${accounts.map(a => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div style="width:8px;height:8px;border-radius:50%;background:#16a34a;flex-shrink:0;"></div>
                      <div>
                        <div style="font-weight:600;">${a.nama}</div>
                        <div style="font-size:11.5px;color:#6b7280;">${a.account_id || ''} · IDR</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style="font-weight:600;">${rp(0)}</div>
                    <div style="height:4px;background:#f3f4f6;border-radius:2px;margin-top:4px;width:80px;">
                      <div style="width:0%;height:100%;background:#dc2626;border-radius:2px;"></div>
                    </div>
                    <div style="font-size:11px;color:#6b7280;">Rp 0 / Rp 0 terpakai</div>
                  </td>
                  <td>${rp(0)}</td>
                  <td>-</td>
                  <td><span class="badge badge-green">Aman</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  destroy() {}
}
