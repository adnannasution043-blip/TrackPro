import { apiFetch } from '../api.js';

export class RefreshPage {
  constructor(container) {
    this.container = container;
    this._accounts = [];
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Perbarui Data Lama</h1>
          <p>Upload file komisi Shopee terbaru untuk membandingkan dengan data lama.</p>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat…</div></div>
    `;

    try {
      const data = await apiFetch('/accounts');
      this._accounts = (data || []).filter(a => a.tipe === 'shopee');
    } catch (_) {}

    this._renderForm();
  }

  _renderForm() {
    const el = this.container.querySelector('#content');
    const shopeeOptions = this._accounts
      .map(a => `<option value="${a.id}">${a.nama}</option>`)
      .join('');

    el.innerHTML = `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <div>
            <div style="font-size:16px;font-weight:700;">Upload Komisi Shopee Terbaru</div>
            <div style="font-size:13px;color:#6b7280;margin-top:4px;">
              Data komisi Shopee yang sudah pernah di-upload akan digunakan sebagai baseline.
              Upload file terbaru untuk mendeteksi perubahan status order.
            </div>
          </div>
          <button class="btn btn-icon" title="Riwayat upload">🕐</button>
        </div>

        <div class="form-row" style="margin-bottom:16px;">
          <div class="form-group">
            <div class="form-label">PILIH AKUN SHOPEE</div>
            <select class="form-select" id="sel-shopee">
              <option value="">Pilih Akun Shopee</option>
              ${shopeeOptions || '<option disabled>Belum ada akun</option>'}
            </select>
          </div>
          <div class="form-group">
            <div class="form-label">SHOPEE COMMISSION CSV TERBARU</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <button class="btn" id="btn-pilih-file">Pilih file CSV</button>
              <span id="file-name" style="font-size:13px;color:#6b7280;">Belum ada file dipilih</span>
            </div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Bisa pilih lebih dari satu file CSV Shopee Komisi sekaligus.</div>
            <input type="file" id="file-csv" accept=".csv" multiple style="display:none">
          </div>
        </div>

        <div class="form-group">
          <div class="form-label">CATATAN OPSIONAL</div>
          <input type="text" class="form-input" id="inp-catatan" placeholder="Contoh: Upload terbaru 13 Juli pagi">
        </div>

        <div id="refresh-error" class="alert alert-error" style="display:none;"></div>
        <div id="refresh-success" class="alert alert-success" style="display:none;"></div>

        <div style="display:flex;justify-content:flex-end;margin-top:8px;">
          <button class="btn btn-primary" id="btn-proses" style="padding:9px 28px;">
            🔄 Proses Perbarui
          </button>
        </div>
      </div>
    `;

    el.querySelector('#btn-pilih-file').addEventListener('click', () => el.querySelector('#file-csv').click());

    el.querySelector('#file-csv').addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      el.querySelector('#file-name').textContent = files.length > 0
        ? files.map(f => f.name).join(', ')
        : 'Belum ada file dipilih';
    });

    el.querySelector('#btn-proses').addEventListener('click', async () => {
      const errEl = el.querySelector('#refresh-error');
      const successEl = el.querySelector('#refresh-success');
      errEl.style.display = 'none';
      successEl.style.display = 'none';

      const shopeeId = el.querySelector('#sel-shopee').value;
      if (!shopeeId) {
        errEl.textContent = 'Pilih akun Shopee terlebih dahulu.';
        errEl.style.display = 'block';
        return;
      }

      const files = el.querySelector('#file-csv').files;
      if (!files.length) {
        errEl.textContent = 'Upload minimal satu file CSV.';
        errEl.style.display = 'block';
        return;
      }

      successEl.textContent = 'Fitur perbarui data sedang dikembangkan. Gunakan Upload Data Harian untuk sementara.';
      successEl.style.display = 'block';
    });
  }

  destroy() {}
}
