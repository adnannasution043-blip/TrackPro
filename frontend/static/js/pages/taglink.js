import { apiFetch } from '../api.js';

export class TaglinkPage {
  constructor(container) {
    this.container = container;
    this.campaigns = [];
    this.tags = [];
    this.maps = [];
  }

  async render() {
    this.container.innerHTML = `<div class="page-header"><h1>Hubungkan Taglink</h1></div><div class="loading">Memuat…</div>`;
    await this._loadAll();
    this._renderAll();
  }

  async _loadAll() {
    try {
      [this.campaigns, this.tags, this.maps] = await Promise.all([
        apiFetch('/taglink/campaigns'),
        apiFetch('/taglink/tags'),
        apiFetch('/taglink/map'),
      ]);
    } catch (e) {
      this.container.querySelector('.loading').outerHTML =
        `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _renderAll() {
    const header = `<div class="page-header"><h1>Hubungkan Taglink</h1></div>`;
    this.container.innerHTML = header + `
      <div class="card">
        <div class="card-title">Tambah Pemetaan Baru</div>
        <div id="add-alert" class="alert" style="display:none"></div>
        <form id="form-map" class="map-form">
          <label>Campaign Meta
            <select id="sel-campaign" required>
              <option value="">-- pilih campaign --</option>
              ${this.campaigns.map(c => `
                <option value="${c.id}">
                  ${c.nama_campaign}${!c.dipetakan ? ' ★' : ''}
                </option>`).join('')}
            </select>
            <small class="muted">★ = belum dipetakan</small>
          </label>
          <label>Tag Link Shopee
            <select id="sel-tag" required>
              <option value="">-- pilih tag --</option>
              ${this.tags.map(t => `<option value="${t.id}">${t.tag}</option>`).join('')}
            </select>
          </label>
          <button type="submit" class="btn-primary">Hubungkan</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title" id="map-card-title">Pemetaan Aktif (${this.maps.length})</div>
        <div class="table-wrap">
          <table id="map-table">
            <thead>
              <tr>
                <th>Campaign Meta</th>
                <th>Tag Link Shopee</th>
                <th>Sumber</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${this._renderRows()}
            </tbody>
          </table>
        </div>
      </div>
    `;
    this._bind();
  }

  _renderRows() {
    if (!this.maps.length)
      return `<tr><td colspan="4" class="empty">Belum ada pemetaan.</td></tr>`;
    return this.maps.map(m => `
      <tr data-id="${m.id}">
        <td><strong>${m.nama_campaign}</strong><br><small class="muted">${m.meta_campaign_id}</small></td>
        <td>${m.tag}</td>
        <td><span class="badge">${m.sumber}</span></td>
        <td><button class="btn-danger btn-sm btn-hapus" data-id="${m.id}">Hapus</button></td>
      </tr>`).join('');
  }

  _bind() {
    this.container.querySelector('#form-map').addEventListener('submit', async e => {
      e.preventDefault();
      const alertEl = this.container.querySelector('#add-alert');
      const btn = e.target.querySelector('button[type=submit]');
      alertEl.style.display = 'none';
      btn.disabled = true;

      const campaign_id = this.container.querySelector('#sel-campaign').value;
      const tag_link_id = this.container.querySelector('#sel-tag').value;

      try {
        await apiFetch('/taglink/map', {
          method: 'POST',
          body: JSON.stringify({ campaign_id, tag_link_id }),
        });
        await this._loadAll();
        this._renderAll();
      } catch (err) {
        alertEl.textContent = err.message;
        alertEl.className = 'alert alert-error';
        alertEl.style.display = 'block';
        btn.disabled = false;
      }
    });

    this.container.querySelectorAll('.btn-hapus').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (!confirm('Hapus pemetaan ini?')) return;
        btn.disabled = true;
        try {
          await apiFetch(`/taglink/map/${id}`, { method: 'DELETE' });
          this.maps = this.maps.filter(m => m.id !== id);
          this.container.querySelector(`tr[data-id="${id}"]`).remove();
          // Update judul
          this.container.querySelector('#map-card-title').textContent =
            `Pemetaan Aktif (${this.maps.length})`;
          // Jika tabel kosong, tampilkan pesan
          if (!this.maps.length) {
            this.container.querySelector('#map-table tbody').innerHTML =
              `<tr><td colspan="4" class="empty">Belum ada pemetaan.</td></tr>`;
          }
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
  }

  destroy() {}
}
