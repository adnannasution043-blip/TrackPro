export class AdsTrackerPage {
  constructor(container) {
    this.container = container;
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>AdsTracker</h1>
          <p>Pemantauan iklan kompetitor akan tersedia pada tahap berikutnya.</p>
        </div>
      </div>

      <div class="card" style="text-align:center;padding:64px 48px;">
        <div style="width:56px;height:56px;background:#fef2f2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px;">🎯</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:6px;">Fitur ini akan dikembangkan</div>
        <div style="font-size:13.5px;color:#6b7280;max-width:400px;margin:0 auto;">
          Area ini disiapkan untuk modul radar iklan TrackPro. Fitur pemantauan iklan kompetitor segera hadir.
        </div>
      </div>
    `;
  }

  destroy() {}
}
