import { apiFetch } from '../api.js';

export class MetaAccountPage {
  constructor(container) {
    this.container = container;
    this._accounts = [];
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
      const data = await apiFetch('/accounts');
      this._accounts = (data || []).filter(a => a.tipe === 'meta');
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
          <div style="font-size:13px;color:#6b7280;">Mode online aktif. Data Meta diambil dari akun Facebook yang terhubung.</div>
          <div style="display:flex;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
            <button class="btn btn-sm" style="border:none;border-radius:0;color:#6b7280;">Offline</button>
            <button class="btn btn-sm btn-primary" style="border:none;border-radius:0;">Online</button>
          </div>
        </div>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;">⚡</div>
              <div>
                <div style="font-size:13px;font-weight:700;">Akun Meta Online</div>
                <div style="font-size:12px;color:#16a34a;">● Aktif</div>
                <div style="font-size:12px;color:#6b7280;">${this._accounts.length} akun aktif</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-sm">🔄 Full Sinkron Historis</button>
              <button class="btn btn-sm btn-primary">+ Tambah Facebook</button>
              <button class="btn btn-sm">Kelola ↗</button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:14px;">🔗</span>
          <span style="font-size:14px;font-weight:700;">Akun Meta</span>
        </div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:14px;">
          Kelola setiap akun Meta, tax/fee, pembeda tag, dan akun Shopee Affiliate dalam satu kartu detail.
        </div>

        ${this._accounts.length === 0
          ? `<div class="card" style="text-align:center;padding:48px;"><div style="font-size:32px;margin-bottom:12px;">📡</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;">Belum ada akun Meta</div><div style="font-size:13px;color:#6b7280;">Klik "Tambah Facebook" untuk menghubungkan akun Meta Ads</div></div>`
          : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
              ${this._accounts.map(a => this._renderAccountCard(a)).join('')}
            </div>`
        }
      </div>
    `;
  }

  _renderAccountCard(a) {
    return `
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <div style="width:36px;height:36px;background:#fef3c7;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">📊</div>
          <div>
            <div style="font-weight:700;font-size:13px;">${a.nama}</div>
            <div style="font-size:11.5px;color:#6b7280;">${a.account_id || ''} · IDR</div>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">PPN/TAX META (%)</div>
          <div style="display:flex;gap:8px;">
            <input type="number" class="form-input" value="${a.ppn_persen || 0}" style="width:80px;padding:6px 10px;">
            <span style="align-self:center;color:#6b7280;">%</span>
            <button class="btn btn-primary btn-sm">Simpan</button>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">PEMBEDA TAG</div>
          <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">Field di Meta yang menjadi pembeda tag link. Default Nama Iklan.</div>
          <select class="form-select" style="font-size:12px;">
            <option>Nama Campaign</option>
            <option>Nama Ad Set</option>
            <option>Nama Ad</option>
          </select>
        </div>

        <div>
          <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">
            SHOPEE AFFILIATE (${a.shopee_accounts?.length || 0})
          </div>
          <div style="font-size:13px;color:#6b7280;padding:16px;background:#f9fafb;border-radius:6px;text-align:center;">
            Belum ada akun Shopee tertaut
          </div>
          <button class="btn btn-sm" style="margin-top:8px;width:100%;">+ Tambah Shopee ke ${a.nama}</button>
        </div>
      </div>
    `;
  }

  destroy() {}
}
