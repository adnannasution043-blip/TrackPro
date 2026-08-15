import { apiFetch } from '../api.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

export class TaxPage {
  constructor(container) {
    this.container = container;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    this.dari = new Date(y, m, 1).toISOString().split('T')[0];
    this.sampai = now.toISOString().split('T')[0];
    this._mode = 'affiliate';
    this._pajakSudahDipotong = 0;
    this._catatan = '';
    this._ppDpp = 50;
    this._tarif = 5;
    this._progresif = true;
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Pajak Affiliate</h1>
          <p>Hitung estimasi pajak dari komisi Shopee Affiliate.</p>
        </div>
        <div class="page-header-right">
          <input type="date" id="inp-dari" value="${this.dari}" style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;">
          <span style="color:#6b7280;">—</span>
          <input type="date" id="inp-sampai" value="${this.sampai}" style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;">
          <button class="btn btn-primary" id="btn-apply">Tampilkan</button>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;

    this.container.querySelector('#btn-apply').addEventListener('click', () => {
      this.dari = this.container.querySelector('#inp-dari').value;
      this.sampai = this.container.querySelector('#inp-sampai').value;
      this._load();
    });

    await this._load();
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';
    try {
      const data = await apiFetch(`/dashboard?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}`);
      if (!data) return;
      this._render(el, data);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _render(el, data) {
    const s = data.summary || {};
    const totalKomisi = Number(s.total_komisi || 0);
    const dpp = totalKomisi * (this._ppDpp / 100);
    const estimasiPph = dpp * (this._tarif / 100);
    const kurangBayar = estimasiPph - this._pajakSudahDipotong;

    el.innerHTML = `
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <div class="form-group" style="flex:1;min-width:160px;margin-bottom:0;">
          <div class="form-label">AKUN SHOPEE</div>
          <select class="form-select">
            <option>Semua Akun Shopee</option>
          </select>
        </div>
        <div class="form-group" style="flex:1;min-width:160px;margin-bottom:0;">
          <div class="form-label">STATUS ORDER</div>
          <select class="form-select">
            <option>Completed saja</option>
            <option>Semua status</option>
          </select>
        </div>
        <div class="form-group" style="flex:1;min-width:180px;margin-bottom:0;">
          <div class="form-label">MODE PERHITUNGAN</div>
          <select class="form-select">
            <option>Shopee Affiliate / PPh 21</option>
            <option>Custom</option>
          </select>
        </div>
        <div style="display:flex;align-items:flex-end;">
          <button class="btn">⬇ Export Pajak</button>
        </div>
      </div>

      <div class="stat-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:16px;">
        <div class="stat-card">
          <div class="stat-label">Total Komisi</div>
          <div class="stat-value" style="font-size:17px;">${rp(totalKomisi)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Dasar Pengenaan Pajak</div>
          <div class="stat-value" style="font-size:17px;">${rp(dpp)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Estimasi PPh</div>
          <div class="stat-value" style="font-size:17px;">${rp(estimasiPph)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pajak Sudah Dipotong</div>
          <div class="stat-value" style="font-size:17px;">${rp(this._pajakSudahDipotong)}</div>
        </div>
        <div class="stat-card" style="border-color:${kurangBayar > 0 ? '#dc2626' : '#16a34a'};">
          <div class="stat-label">Kurang/Lebih Bayar</div>
          <div class="stat-value" style="font-size:17px;color:${kurangBayar > 0 ? '#dc2626' : '#16a34a'};">${rp(Math.abs(kurangBayar))}</div>
          <div style="font-size:11.5px;color:${kurangBayar > 0 ? '#dc2626' : '#16a34a'};">${kurangBayar > 0 ? 'Kurang Bayar' : 'Lebih Bayar'}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div class="card">
          <div style="font-size:14px;font-weight:700;margin-bottom:14px;">Konfigurasi Pajak</div>
          <div style="font-size:12.5px;color:#6b7280;margin-bottom:12px;">Tarif dapat berubah sesuai aturan pajak. Silakan sesuaikan jika diperlukan.</div>
          <div class="form-row" style="margin-bottom:12px;">
            <div class="form-group">
              <div class="form-label">Persentase DPP</div>
              <input type="number" class="form-input" value="${this._ppDpp}" min="0" max="100">
            </div>
            <div class="form-group">
              <div class="form-label">Tarif flat</div>
              <input type="number" class="form-input" value="${this._tarif}" min="0" max="100">
            </div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-bottom:14px;">
            <input type="checkbox" ${this._progresif ? 'checked' : ''} style="width:16px;height:16px;accent-color:#dc2626;">
            Gunakan tarif progresif
          </label>
          <div style="font-size:12.5px;">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;"><span>Rp 0 - Rp 60.000.000</span><span style="font-weight:700;">5%</span></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;"><span>Rp 60.000.000 - Rp 250.000.000</span><span style="font-weight:700;">15%</span></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;"><span>Rp 250.000.000 - Rp 500.000.000</span><span style="font-weight:700;">25%</span></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;"><span>Rp 500.000.000 - Rp 5.000.000.000</span><span style="font-weight:700;">30%</span></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;"><span>Rp 5.000.000.000 - > max</span><span style="font-weight:700;">35%</span></div>
          </div>
        </div>

        <div class="card">
          <div style="font-size:14px;font-weight:700;margin-bottom:4px;">Pajak Sudah Dipotong</div>
          <div style="font-size:12.5px;color:#6b7280;margin-bottom:14px;">Kolom pajak dipotong Shopee belum tersedia di CSV, jadi isi manual untuk periode ini.</div>
          <div class="form-group">
            <div class="form-label">Pajak dipotong periode ini</div>
            <input type="number" class="form-input" id="inp-dipotong" value="${this._pajakSudahDipotong}" min="0">
          </div>
          <div class="form-group">
            <div class="form-label">Catatan</div>
            <textarea class="form-textarea" id="inp-catatan" rows="4" placeholder=""></textarea>
          </div>
          <button class="btn btn-primary" id="btn-simpan">💾 Simpan</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="font-size:14px;font-weight:700;">Ringkasan Bulanan</div>
          <span style="font-size:12px;color:#6b7280;">1 bulan</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>BULAN</th><th>TOTAL KOMISI</th><th>DASAR PENGENAAN PAJAK</th>
                <th>ESTIMASI PPH</th><th>PAJAK DIPOTONG</th><th>KURANG/LEBIH BAYAR</th>
                <th>ORDER COMPLETED</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${new Date(this.dari).toLocaleDateString('id-ID', {month:'long',year:'numeric'})}</td>
                <td>${rp(totalKomisi)}</td>
                <td>${rp(dpp)}</td>
                <td>${rp(estimasiPph)}</td>
                <td>${rp(this._pajakSudahDipotong)}</td>
                <td style="color:${kurangBayar > 0 ? '#dc2626' : '#16a34a'};">${rp(Math.abs(kurangBayar))}</td>
                <td>${s.total_orders_selesai || 0}</td>
              </tr>
              <tr style="font-weight:700;">
                <td>Total</td>
                <td>${rp(totalKomisi)}</td>
                <td>${rp(dpp)}</td>
                <td>${rp(estimasiPph)}</td>
                <td>${rp(this._pajakSudahDipotong)}</td>
                <td style="color:${kurangBayar > 0 ? '#dc2626' : '#16a34a'};">${rp(Math.abs(kurangBayar))}</td>
                <td>${s.total_orders_selesai || 0}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div style="font-size:14px;font-weight:700;margin-bottom:14px;">Detail Order Pajak</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>TANGGAL</th><th>ID PESANAN</th><th>PRODUK</th>
                <th>TOKO</th><th>STATUS</th><th>KOMISI</th><th>DASAR PENGENAAN PAJAK</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="7" class="empty">Upload data Shopee untuk melihat detail pajak per order.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    el.querySelector('#btn-simpan')?.addEventListener('click', () => {
      this._pajakSudahDipotong = Number(el.querySelector('#inp-dipotong').value) || 0;
      this._catatan = el.querySelector('#inp-catatan').value;
      this._render(el, data);
    });
  }

  destroy() {}
}
