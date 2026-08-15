import { apiFetch } from '../api.js';
import { filterQS } from '../filter-state.js';

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const rpShort = n => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1_000_000_000) return (v < 0 ? '-' : '') + 'Rp ' + (Math.abs(v) / 1_000_000_000).toFixed(1).replace('.', ',') + ' M';
  if (Math.abs(v) >= 1_000_000) return (v < 0 ? '-' : '') + 'Rp ' + (Math.abs(v) / 1_000_000).toFixed(2).replace('.', ',') + ' jt';
  return rp(v);
};
const pct = n => n != null ? Number(n).toFixed(1) + '%' : '-';
const num = n => n != null ? Number(n).toLocaleString('id-ID') : '-';
const numShort = n => {
  const v = Number(n || 0);
  if (v >= 1000) return (v / 1000).toFixed(1).replace('.', ',') + 'K';
  return String(v);
};

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
    this._chartData = null;
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Dasbor</h1>
          <p>Biaya, penjualan, komisi, dan ROI di seluruh kampanye Meta Anda.</p>
        </div>
        <div class="page-header-right" style="position:relative;">
          <button class="date-range-btn" id="btn-date-range">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span id="date-label">${fmtDate(this.dari)} — ${fmtDate(this.sampai)}</span>
          </button>
          <div id="date-picker" style="display:none;position:absolute;top:40px;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;box-shadow:0 8px 32px rgba(0,0,0,0.12);z-index:50;min-width:320px;">
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
          <div class="date-range-display" id="date-tz-label">Menampilkan ${this.dari} → ${this.sampai} (WIB)</div>
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
      this.container.querySelector('#date-tz-label').textContent = `Menampilkan ${this.dari} → ${this.sampai} (WIB)`;
      picker.style.display = 'none';
      this._load();
    });
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';
    try {
      const data = await apiFetch(`/dashboard?tanggal_dari=${this.dari}&tanggal_sampai=${this.sampai}${filterQS()}`);
      if (!data) return;
      this._chartData = data.harian;
      el.innerHTML = this._render(data);
      requestAnimationFrame(() => this._drawChart(data.harian));
      this._initChartHover(data.harian);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _render({ summary: s, harian }) {
    const lc = n => Number(n) >= 0 ? 'positive' : 'negative';

    // Komisi berdasarkan status computation
    const totalOrders = (s.total_orders_selesai || 0) + (s.total_orders_tertunda || 0);
    const terpetakan = Number(s.total_komisi) - Number(s.total_komisi_nonmeta);
    let komisiSelesai = 0, komisiTertunda = 0;
    if (totalOrders > 0) {
      komisiSelesai = terpetakan * s.total_orders_selesai / totalOrders;
      komisiTertunda = terpetakan * s.total_orders_tertunda / totalOrders;
    } else {
      komisiSelesai = terpetakan;
    }
    const total = Number(s.total_komisi) || 1;
    const pctSelesai = (komisiSelesai / total * 100).toFixed(1);
    const pctTertunda = (komisiTertunda / total * 100).toFixed(1);
    const pctNonmeta = (Number(s.total_komisi_nonmeta) / total * 100).toFixed(1);

    return `
      <!-- 7 stat cards -->
      <div class="stat-scroll">
        <div class="stat-card-h selected">
          <div class="stat-label">BIAYA (TERMASUK PPN/TAX META)</div>
          <div class="stat-value">${rpShort(s.total_biaya)}</div>
        </div>
        <div class="stat-card-h">
          <div class="stat-label">PENJUALAN</div>
          <div class="stat-value">${rpShort(s.total_penjualan)}</div>
        </div>
        <div class="stat-card-h">
          <div class="stat-label">KOMISI (DARI IKLAN META)</div>
          <div class="stat-value">${rpShort(s.total_komisi)}</div>
        </div>
        <div class="stat-card-h">
          <div class="stat-label">LABA</div>
          <div class="stat-value ${lc(s.total_laba)}">${rpShort(s.total_laba)}</div>
        </div>
        <div class="stat-card-h">
          <div class="stat-label">ROI</div>
          <div class="stat-value ${lc(s.total_laba)}">${pct(s.roi_persen)}</div>
        </div>
        <div class="stat-card-h">
          <div class="stat-label">PESANAN</div>
          <div class="stat-value">${num(s.total_orders)}</div>
        </div>
        <div class="stat-card-h">
          <div class="stat-label">KLIK SHOPEE</div>
          <div class="stat-value">${numShort(s.total_clicks_shopee)}</div>
        </div>
      </div>

      <!-- Komisi berdasarkan status -->
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
          <div style="font-size:14px;font-weight:700;">Komisi berdasarkan status</div>
          <div style="display:flex;gap:12px;font-size:12.5px;flex-wrap:wrap;">
            <a href="#/orders" style="color:var(--red);font-weight:500;">Buka di Status Pesanan →</a>
            <a href="#/refresh" style="color:var(--red);font-weight:500;">Muat ulang melalui Perbarui Komisi →</a>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:14px;">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">● SELESAI</div>
            <div style="font-size:18px;font-weight:700;">${rp(komisiSelesai)}</div>
            <div style="font-size:12px;color:var(--text-muted);">${num(s.total_orders_selesai)} pesanan · ${pctSelesai}%</div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--yellow);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">● TERTUNDA</div>
            <div style="font-size:18px;font-weight:700;">${rp(komisiTertunda)}</div>
            <div style="font-size:12px;color:var(--text-muted);">${num(s.total_orders_tertunda)} pesanan · ${pctTertunda}%</div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">● BELUM DIPETAKAN / NON-META</div>
            <div style="font-size:18px;font-weight:700;color:var(--text-muted);">${rp(s.total_komisi_nonmeta)}</div>
            <div style="font-size:12px;color:var(--text-muted);">${pctNonmeta}% dari total</div>
          </div>
        </div>
        <div style="height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;display:flex;">
          <div style="background:var(--green);width:${pctSelesai}%;transition:width 0.3s;"></div>
          <div style="background:var(--yellow);width:${pctTertunda}%;transition:width 0.3s;"></div>
          <div style="background:#9ca3af;width:${pctNonmeta}%;transition:width 0.3s;"></div>
        </div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-top:10px;">
          Total komisi Shopee semua tag: <strong>${rp(s.total_komisi)}</strong>
        </div>
      </div>

      <!-- Grafik Performa -->
      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-title">Grafik Performa</div>
          <div class="chart-hover-info" id="chart-hover-info">&nbsp;</div>
        </div>
        <div class="chart-legend">
          <div class="chart-legend-item"><div class="chart-dot" style="background:#10b981;"></div> Komisi</div>
          <div class="chart-legend-item"><div class="chart-dot" style="background:#1f2937;"></div> Laba</div>
          <div class="chart-legend-item"><div class="chart-dot" style="background:#ef4444;"></div> Biaya</div>
        </div>
        ${harian.length === 0
          ? `<div style="text-align:center;color:var(--text-muted);padding:48px;">Tidak ada data untuk periode ini.</div>`
          : `<div style="position:relative;"><canvas id="perf-chart" style="width:100%;height:280px;display:block;"></canvas></div>`
        }
      </div>

      <!-- Tabel harian -->
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
                    <td style="color:var(--green);">${rp(r.komisi)}</td>
                    <td>${rp(r.penjualan)}</td>
                    <td style="color:var(--green);">${r.orders_selesai}</td>
                    <td style="color:var(--yellow);">${r.orders_tertunda}</td>
                    <td class="${Number(r.laba) >= 0 ? 'positive' : 'negative'}">${rp(r.laba)}</td>
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

  _drawChart(harian) {
    if (!harian || !harian.length) return;
    const canvas = document.getElementById('perf-chart');
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = 280;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const pad = { top: 24, right: 20, bottom: 36, left: 68 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;
    const n = harian.length;

    const biaya = harian.map(r => Number(r.spend_idr));
    const komisi = harian.map(r => Number(r.komisi));
    const laba = harian.map(r => Number(r.laba));
    const labels = harian.map(r => r.tanggal.slice(5));

    const allVals = [...biaya, ...komisi, ...laba, 0];
    const maxV = Math.max(...allVals);
    const minV = Math.min(...allVals);
    const range = maxV - minV || 1;

    const toX = i => pad.left + (n === 1 ? cW / 2 : i / (n - 1) * cW);
    const toY = v => pad.top + cH - ((v - minV) / range * cH);

    // Grid lines + y-axis labels
    ctx.font = `10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.textAlign = 'right';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = minV + range * (steps - i) / steps;
      const y = pad.top + i * cH / steps;
      ctx.strokeStyle = '#f3f4f6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + cW, y);
      ctx.stroke();
      ctx.fillStyle = '#9ca3af';
      const lab = Math.abs(v) >= 1_000_000
        ? (v < 0 ? '-' : '') + 'Rp ' + (Math.abs(v) / 1_000_000).toFixed(1) + ' jt'
        : 'Rp ' + Math.round(v).toLocaleString('id-ID');
      ctx.fillText(lab, pad.left - 4, y + 4);
    }

    // Zero line
    const zeroY = toY(0);
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(pad.left + cW, zeroY);
    ctx.stroke();

    // Laba bars
    const barW = Math.max(4, cW / n * 0.45);
    laba.forEach((v, i) => {
      const x = toX(i) - barW / 2;
      if (v >= 0) {
        ctx.fillStyle = 'rgba(16,185,129,0.25)';
        ctx.fillRect(x, toY(v), barW, zeroY - toY(v) || 1);
      } else {
        ctx.fillStyle = 'rgba(239,68,68,0.2)';
        ctx.fillRect(x, zeroY, barW, toY(v) - zeroY || 1);
      }
    });

    // Smooth line helper
    const drawLine = (data, color) => {
      if (data.length === 0) return;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (data.length === 1) {
        ctx.arc(toX(0), toY(data[0]), 4, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.moveTo(toX(0), toY(data[0]));
      for (let i = 1; i < data.length; i++) {
        const cpx = (toX(i - 1) + toX(i)) / 2;
        ctx.bezierCurveTo(cpx, toY(data[i - 1]), cpx, toY(data[i]), toX(i), toY(data[i]));
      }
      ctx.stroke();
      data.forEach((v, i) => {
        ctx.beginPath();
        ctx.arc(toX(i), toY(v), 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    drawLine(biaya, '#ef4444');
    drawLine(komisi, '#10b981');

    // X-axis labels
    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'center';
    labels.forEach((lab, i) => ctx.fillText(lab, toX(i), H - 8));

    // Store coords for hover
    this._chartCoords = { toX, toY, biaya, komisi, laba, harian, pad, cW };
  }

  _initChartHover(harian) {
    if (!harian || !harian.length) return;
    const canvas = document.getElementById('perf-chart');
    const info = document.getElementById('chart-hover-info');
    if (!canvas || !info) return;

    canvas.addEventListener('mousemove', (e) => {
      if (!this._chartCoords) return;
      const { toX, biaya, komisi, laba, pad, cW } = this._chartCoords;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const n = harian.length;
      if (n === 0) return;
      const step = n === 1 ? cW : cW / (n - 1);
      let idx = Math.round((mouseX - pad.left) / step);
      idx = Math.max(0, Math.min(n - 1, idx));
      const r = harian[idx];
      info.innerHTML = `<span style="color:var(--text-muted)">${r.tanggal}</span>&nbsp;&nbsp;
        <span style="color:#ef4444">Biaya: ${rp(biaya[idx])}</span>&nbsp;&nbsp;
        <span style="color:#10b981">Komisi: ${rp(komisi[idx])}</span>&nbsp;&nbsp;
        <span style="color:#1f2937">Laba: ${rp(laba[idx])}</span>`;
    });

    canvas.addEventListener('mouseleave', () => {
      if (info) info.innerHTML = '&nbsp;';
    });
  }

  destroy() {}
}
