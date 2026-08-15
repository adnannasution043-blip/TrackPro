import { apiFetch } from '../api.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const pct = n => n != null ? Number(n).toFixed(2) + '%' : '-';
const num = n => n != null ? Number(n).toLocaleString('id-ID') : '-';

function fmtDate(d) {
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const dt = new Date(d);
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

export class DashboardPage {
  constructor(container) {
    this.container = container;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    this.dari = new Date(y, m, 1).toISOString().split('T')[0];
    this.sampai = now.toISOString().split('T')[0];
    this._showPicker = false;
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Dasbor</h1>
          <p>Ringkasan performa iklan dan komisi affiliate Anda.</p>
        </div>
        <div class="page-header-right">
          <button class="date-range-btn" id="btn-date-range">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span id="date-label">${fmtDate(this.dari)} — ${fmtDate(this.sampai)}</span>
          </button>
          <div id="date-picker" style="display:none;position:absolute;top:80px;right:28px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;box-shadow:0 8px 32px rgba(0,0,0,0.12);z-index:50;display:none;">
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;">
              <div>
                <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:4px;">DARI</div>
                <input type="date" id="inp-dari" value="${this.dari}" style="padding:6px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;">
              </div>
              <div style="margin-top:18px;color:#6b7280;">—</div>
              <div>
                <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:4px;">SAMPAI</div>
                <input type="date" id="inp-sampai" value="${this.sampai}" style="padding:6px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;">
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;" id="presets"></div>
            <button id="btn-apply" class="btn btn-primary btn-sm">Terapkan</button>
          </div>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;

    this._initDatePicker();
    await this._load();
  }

  _initDatePicker() {
    const btn = this.container.querySelector('#btn-date-range');
    const picker = this.container.querySelector('#date-picker');
    const presetsEl = this.container.querySelector('#presets');

    const presets = [
      { label: 'Hari ini', days: 0 },
      { label: '7 hari', days: 7 },
      { label: '14 hari', days: 14 },
      { label: '30 hari', days: 30 },
      { label: 'Bulan ini', month: true },
    ];

    presets.forEach(p => {
      const b = document.createElement('button');
      b.className = 'btn btn-sm';
      b.textContent = p.label;
      b.style.fontSize = '11px';
      b.addEventListener('click', () => {
        const now = new Date();
        let dari;
        if (p.month) {
          dari = new Date(now.getFullYear(), now.getMonth(), 1);
        } else {
          dari = new Date(now - p.days * 86400000);
        }
        this.container.querySelector('#inp-dari').value = dari.toISOString().split('T')[0];
        this.container.querySelector('#inp-sampai').value = now.toISOString().split('T')[0];
      });
      presetsEl.appendChild(b);
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target) && e.target !== btn) {
        picker.style.display = 'none';
      }
    });

    this.container.querySelector('#btn-apply').addEventListener('click', () => {
      this.dari = this.container.querySelector('#inp-dari').value;
      this.sampai = this.container.querySelector('#inp-sampai').value;
      this.container.querySelector('#date-label').textContent = `${fmtDate(this.dari)} — ${fmtDate(this.sampai)}`;
      picker.style.display = 'none';
      this._load();
    });
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';
    try {
      const data = await apiFetch(`/dashboard?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}`);
      if (!data) return;
      el.innerHTML = this._render(data);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _render({ summary: s, harian }) {
    const lc = n => Number(n) >= 0 ? 'positive' : 'negative';
    return `
      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);">
        <div class="stat-card">
          <div class="stat-label">Total Biaya</div>
          <div class="stat-value">${rp(s.total_biaya)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Komisi</div>
          <div class="stat-value">${rp(s.total_komisi)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Laba</div>
          <div class="stat-value ${lc(s.total_laba)}">${rp(s.total_laba)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">ROI</div>
          <div class="stat-value ${lc(s.total_laba)}">${pct(s.roi_persen)}</div>
        </div>
      </div>

      <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
        <div class="stat-card">
          <div class="stat-label">Total Penjualan</div>
          <div class="stat-value">${rp(s.total_penjualan)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pesanan (Selesai / Pending / Batal)</div>
          <div class="stat-value">${s.total_orders_selesai} <span style="color:#6b7280;font-weight:400">/</span> ${s.total_orders_tertunda} <span style="color:#6b7280;font-weight:400">/</span> ${s.total_orders_batal}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Klik (Meta / Shopee)</div>
          <div class="stat-value">${num(s.total_clicks_meta)} <span style="color:#6b7280;font-weight:400">/</span> ${num(s.total_clicks_shopee)}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="font-size:14px;font-weight:700;">Status Komisi</div>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div style="flex:1;min-width:160px;padding:12px;background:#f3f4f6;border-radius:6px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Terpetakan</div>
            <div style="font-size:18px;font-weight:700;color:#111;">${rp(s.total_komisi_terpetakan)}</div>
          </div>
          <div style="flex:1;min-width:160px;padding:12px;background:#f3f4f6;border-radius:6px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Non-Meta / Belum Dipetakan</div>
            <div style="font-size:18px;font-weight:700;color:#6b7280;">${rp(s.total_komisi_nonmeta)}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="font-size:14px;font-weight:700;">Laporan Harian</div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tanggal</th><th>Biaya</th><th>Klik Meta</th><th>Klik Shopee</th>
                <th>Komisi</th><th>Penjualan</th><th>Selesai</th><th>Pending</th>
                <th>Laba</th><th>EPC</th><th>CR</th>
              </tr>
            </thead>
            <tbody>
              ${harian.length === 0
                ? `<tr><td colspan="11" class="empty">Tidak ada data untuk periode ini.<br><span style="font-size:12px;">Upload data harian terlebih dahulu.</span></td></tr>`
                : harian.map(r => `
                  <tr>
                    <td style="font-weight:500;">${r.tanggal}</td>
                    <td>${rp(r.spend_idr)}</td>
                    <td>${num(r.clicks_meta)}</td>
                    <td>${num(r.clicks_shopee)}</td>
                    <td>${rp(r.komisi)}</td>
                    <td>${rp(r.penjualan)}</td>
                    <td style="color:#16a34a;">${r.orders_selesai}</td>
                    <td style="color:#d97706;">${r.orders_tertunda}</td>
                    <td class="${lc(r.laba)}">${rp(r.laba)}</td>
                    <td>${r.epc != null ? rp(r.epc) : '-'}</td>
                    <td>${r.cr_persen != null ? r.cr_persen + '%' : '-'}</td>
                  </tr>`).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  destroy() {}
}
