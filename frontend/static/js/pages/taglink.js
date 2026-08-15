import { apiFetch } from '../api.js';

export class TaglinkPage {
  constructor(container) {
    this.container = container;
    this._rows = [];
    this._tags = [];
    this._filter = 'all';
    this._search = '';
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Hubungkan Taglink</h1>
          <p>Petakan campaign Meta ke tag link Shopee agar biaya, klik, pesanan, komisi, dan ROI terbaca benar.</p>
        </div>
      </div>
      <div id="content"><div class="loading">Memuat data…</div></div>
    `;
    await this._load();
  }

  async _load() {
    const el = this.container.querySelector('#content');
    el.innerHTML = '<div class="loading">Memuat data…</div>';
    try {
      const [campaigns, maps, tags] = await Promise.all([
        apiFetch('/taglinks/campaigns'),
        apiFetch('/taglinks/map'),
        apiFetch('/taglinks/tags'),
      ]);

      const mapsByCampaign = {};
      for (const m of (maps || [])) {
        if (!mapsByCampaign[m.campaign_id]) mapsByCampaign[m.campaign_id] = [];
        mapsByCampaign[m.campaign_id].push(m);
      }

      this._rows = (campaigns || []).map(c => ({
        id: c.id,
        nama_campaign: c.nama_campaign,
        created_at: c.created_at,
        dipetakan: c.dipetakan,
        maps: mapsByCampaign[c.id] || [],
      }));

      this._tags = tags || [];
      this._renderContent(el);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  _renderContent(el) {
    const total = this._rows.length;
    const mapped = this._rows.filter(r => r.dipetakan).length;
    const unmapped = total - mapped;

    el.innerHTML = `
      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px;">
        <div class="stat-card">
          <div class="stat-label">Total Campaign</div>
          <div class="stat-value">${total}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Sudah Dipetakan</div>
          <div class="stat-value" style="color:#16a34a;">${mapped}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Belum Dipetakan</div>
          <div class="stat-value" style="color:#dc2626;">${unmapped}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tag Link Shopee</div>
          <div class="stat-value">${this._tags.length}</div>
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <div class="search-box" style="flex:1;max-width:340px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="inp-search" placeholder="Cari campaign atau tag link…" value="${this._search}" style="width:100%;padding:7px 12px 7px 32px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;">
          </div>
          <div class="filter-tabs">
            <button class="filter-tab ${this._filter==='all'?'active':''}" data-f="all">Semua (${total})</button>
            <button class="filter-tab ${this._filter==='mapped'?'active':''}" data-f="mapped">Sudah dipetakan (${mapped})</button>
            <button class="filter-tab ${this._filter==='unmapped'?'active':''}" data-f="unmapped">Belum dipetakan (${unmapped})</button>
          </div>
        </div>

        <div class="table-wrap" id="tl-table"></div>
      </div>
    `;

    this._renderTable(el.querySelector('#tl-table'));

    el.querySelector('#inp-search')?.addEventListener('input', (e) => {
      this._search = e.target.value;
      this._renderTable(el.querySelector('#tl-table'));
    });
    el.querySelectorAll('[data-f]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._filter = btn.dataset.f;
        el.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('active', b.dataset.f === this._filter));
        this._renderTable(el.querySelector('#tl-table'));
      });
    });
  }

  _renderTable(el) {
    const filtered = this._rows.filter(r => {
      const search = this._search.toLowerCase();
      const matchSearch = !search ||
        r.nama_campaign.toLowerCase().includes(search) ||
        r.maps.some(m => m.tag.toLowerCase().includes(search));
      const matchFilter = this._filter === 'all' ||
        (this._filter === 'mapped' && r.dipetakan) ||
        (this._filter === 'unmapped' && !r.dipetakan);
      return matchSearch && matchFilter;
    });

    const tagOptions = this._tags.map(t =>
      `<option value="${t.id}">${t.tag}</option>`
    ).join('');

    el.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Nama Campaign</th>
            <th>Tag Link (Shopee)</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0
            ? `<tr><td colspan="4" class="empty">Tidak ada data kampanye.<br><span style="font-size:12px;">Upload data Meta Ads terlebih dahulu untuk melihat kampanye yang bisa dipetakan.</span></td></tr>`
            : filtered.map(r => `
              <tr>
                <td style="font-weight:500;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.nama_campaign}">${r.nama_campaign}</td>
                <td>
                  ${r.maps.length > 0
                    ? r.maps.map(m => `<span class="badge badge-green" style="margin-right:4px;">${m.tag}</span>`).join('')
                    : (tagOptions
                        ? `<select class="form-select sel-tag" data-campaign="${r.id}" style="font-size:12px;padding:4px 8px;min-width:160px;">
                             <option value="">Pilih tag link…</option>
                             ${tagOptions}
                           </select>`
                        : `<span style="font-size:12px;color:#6b7280;">Upload Shopee terlebih dahulu</span>`)
                  }
                </td>
                <td>
                  ${r.dipetakan
                    ? `<span class="badge badge-green">Dipetakan</span>`
                    : `<span class="badge badge-red">Belum</span>`}
                </td>
                <td>
                  <div style="display:flex;gap:4px;flex-wrap:wrap;">
                    ${r.maps.length > 0
                      ? r.maps.map(m => `<button class="btn btn-sm" style="font-size:11px;color:#dc2626;border-color:#dc2626;" data-lepas="${m.id}">Lepas</button>`).join('')
                      : (tagOptions
                          ? `<button class="btn btn-sm btn-primary" data-hubungkan="${r.id}">Hubungkan</button>`
                          : '')
                    }
                  </div>
                </td>
              </tr>`).join('')
          }
        </tbody>
      </table>
      <div style="margin-top:10px;font-size:12.5px;color:#6b7280;">
        Menampilkan ${filtered.length} dari ${this._rows.length} campaign
      </div>
    `;

    el.querySelectorAll('[data-hubungkan]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const campaignId = btn.dataset.hubungkan;
        const row = btn.closest('tr');
        const sel = row?.querySelector('.sel-tag');
        const tagLinkId = sel?.value;
        if (!tagLinkId) { alert('Pilih tag link terlebih dahulu.'); return; }
        btn.disabled = true; btn.textContent = '…';
        try {
          await apiFetch('/taglinks/map', {
            method: 'POST',
            body: JSON.stringify({ campaign_id: campaignId, tag_link_id: tagLinkId }),
          });
          await this._load();
        } catch (e) {
          alert(e.message);
          btn.disabled = false; btn.textContent = 'Hubungkan';
        }
      });
    });

    el.querySelectorAll('[data-lepas]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const mapId = btn.dataset.lepas;
        btn.disabled = true; btn.textContent = '…';
        try {
          await apiFetch(`/taglinks/map/${mapId}`, { method: 'DELETE' });
          await this._load();
        } catch (e) {
          alert(e.message);
          btn.disabled = false; btn.textContent = 'Lepas';
        }
      });
    });
  }

  destroy() {}
}
