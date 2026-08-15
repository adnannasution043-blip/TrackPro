export class SubscriptionPage {
  constructor(container) {
    this.container = container;
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Langganan</h1>
          <p>Lihat paket aktif, pilih paket baru, dan kelola pembayaran TrackPro Anda.</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 280px;gap:16px;align-items:start;">
        <div>
          <div class="profile-card" style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
              <h3>Status Langganan Saat Ini</h3>
              <span class="badge badge-green">Aktif</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
              <div>
                <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">PAKET SAAT INI</div>
                <div style="font-size:16px;font-weight:700;">Trial</div>
              </div>
              <div>
                <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">SISA HARI</div>
                <div style="font-size:16px;font-weight:700;">-</div>
              </div>
              <div>
                <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">BERAKHIR</div>
                <div style="font-size:16px;font-weight:700;">-</div>
              </div>
            </div>
          </div>

          <div class="profile-card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
              <h3>Pilih Paket</h3>
            </div>

            ${this._renderPlan('Lifetime', 'Akses Lifetime TrackPro dengan limit unlimited.', 'Rp 0', 'Lifetime', ['Unlimited','Unlimited','Unlimited'], false, true)}
            ${this._renderPlan('Trial', 'Trial TrackPro untuk aktivasi manual admin.', 'Rp 0', '14 hari', ['1','1','1.000.000'], false, true)}
            ${this._renderPlan('Bulanan', 'Akses TrackPro selama 30 hari.', 'Rp 45.000', '30 hari', ['5','10','10.000.000'], true, false)}
            ${this._renderPlan('3 Bulan', 'Hemat untuk pemakaian rutin 3 bulan.', 'Rp 100.000', '90 hari', ['10','20','25.000.000'], true, false)}
            ${this._renderPlan('Tahunan', 'Paket tahunan untuk tracking jangka panjang.', 'Rp 345.000', '365 hari', ['10','20','50.000.000'], true, false)}
          </div>

          <div class="profile-card" style="margin-top:16px;">
            <h3 style="margin-bottom:16px;">Invoice Aktif / Menunggu Pembayaran</h3>
            <div style="padding:32px;text-align:center;border:1px solid #e5e7eb;border-radius:6px;color:#6b7280;font-size:13px;">
              Tidak ada invoice yang menunggu pembayaran.
            </div>
          </div>

          <div class="profile-card" style="margin-top:16px;">
            <h3 style="margin-bottom:4px;">Upload Bukti Pembayaran</h3>
            <p style="font-size:12.5px;color:#6b7280;margin-bottom:12px;">JPG, PNG, WEBP, atau PDF. Maksimal 5 MB.</p>
            <div style="display:flex;gap:8px;">
              <select class="form-select" style="flex:1;" disabled>
                <option>Tidak ada invoice yang menunggu pembayaran.</option>
              </select>
              <button class="btn" disabled>Pilih bukti pembayaran</button>
              <button class="btn btn-primary" disabled>↑ Upload</button>
            </div>
          </div>

          <div class="profile-card" style="margin-top:16px;">
            <h3 style="margin-bottom:14px;">Riwayat Invoice</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>INVOICE</th><th>PAKET</th><th>NOMINAL</th>
                  <th>STATUS</th><th>METODE</th><th>DIBUAT</th>
                  <th>DIBAYAR / UPLOAD</th><th>AKSI</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="8" class="empty">Belum ada riwayat invoice.</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div class="profile-card">
            <h3 style="margin-bottom:14px;">Limit Paket</h3>
            <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;">
              <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Akun Meta</span><span style="font-weight:700;">1</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Akun Shopee</span><span style="font-weight:700;">1</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Import harian</span><span style="font-weight:700;">1.000.000</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">AI</span><span class="badge badge-green">ON</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Automation</span><span class="badge badge-green">ON</span></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderPlan(name, desc, price, duration, limits, canBuy, isAdmin) {
    const [meta, shopee, importLimit] = limits;
    return `
      <div class="plan-card" style="margin-bottom:10px;">
        <div>
          <div class="plan-name">${name}</div>
          <div class="plan-desc">${desc}</div>
          <div class="plan-features" style="margin-top:6px;">
            Akun Meta: ${meta} · Akun Shopee: ${shopee} · Import harian: ${importLimit}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
          <div>
            <div class="plan-price">${price}</div>
            <div class="plan-duration">${duration}</div>
          </div>
          ${isAdmin
            ? `<button class="btn" style="background:#f3f4f6;color:#6b7280;cursor:not-allowed;" disabled>Aktivasi admin</button>`
            : `<button class="btn btn-primary">Buat Invoice</button>`
          }
        </div>
      </div>
    `;
  }

  destroy() {}
}
