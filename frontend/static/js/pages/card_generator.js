export class CardGeneratorPage {
  constructor(container) {
    this.container = container;
    this._images = [];
    this._nPlus = 0;
    this._canvas = null;
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Card Generator</h1>
          <p>Gabung gambar produk jadi 1 image grid persis gaya FB (2 atas + 3 bawah + "+N"). Upload, atur urutan, download PNG. Semua diproses di browser.</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 340px;gap:20px;align-items:start;">
        <div>
          <div class="card" style="margin-bottom:16px;">
            <div class="form-label" style="margin-bottom:10px;">Gambar produk</div>

            <div class="upload-zone" id="upload-zone">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p><strong>Upload gambar</strong> (bisa banyak sekaligus - Ctrl+V juga bisa)</p>
            </div>
            <input type="file" id="file-input" accept="image/*" multiple style="display:none">

            <div id="image-list" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;"></div>
          </div>

          <div class="card">
            <div class="form-label" style="margin-bottom:8px;">Angka "+N" (kosongin = otomatis dari jumlah gambar)</div>
            <input type="number" class="form-input" id="inp-n" value="0" min="0" style="width:120px;margin-bottom:16px;">
            <div>
              <button class="btn btn-primary" id="btn-download" style="gap:8px;">
                ⬇ Download PNG
              </button>
            </div>
          </div>
        </div>

        <div>
          <div class="card">
            <div class="form-label" style="margin-bottom:10px;">Preview</div>
            <div id="preview-area" style="background:#d1d5db;border-radius:6px;aspect-ratio:6/5;display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:13px;overflow:hidden;">
              <div id="preview-canvas-wrap" style="width:100%;height:100%;"></div>
            </div>
            <div style="font-size:11.5px;color:#6b7280;margin-top:8px;text-align:center;">
              Output 1080×900 (6:5, persis rasio album FB). Tile kosong = abu.
            </div>
          </div>
        </div>
      </div>
    `;

    const zone = this.container.querySelector('#upload-zone');
    const fileInput = this.container.querySelector('#file-input');

    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('active'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('active'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('active');
      this._addFiles(Array.from(e.dataTransfer.files));
    });

    fileInput.addEventListener('change', () => this._addFiles(Array.from(fileInput.files)));

    document.addEventListener('paste', (e) => {
      const items = Array.from(e.clipboardData.items);
      const files = items.filter(i => i.type.startsWith('image/')).map(i => i.getAsFile());
      if (files.length) this._addFiles(files);
    });

    this.container.querySelector('#btn-download').addEventListener('click', () => this._download());
    this.container.querySelector('#inp-n').addEventListener('input', () => this._updatePreview());
  }

  _addFiles(files) {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      const url = URL.createObjectURL(f);
      this._images.push({ url, name: f.name });
    }
    this._renderList();
    this._updatePreview();
  }

  _renderList() {
    const el = this.container.querySelector('#image-list');
    el.innerHTML = this._images.map((img, i) => `
      <div style="position:relative;width:80px;height:80px;border-radius:6px;overflow:hidden;border:2px solid #e5e7eb;" draggable="true" data-idx="${i}">
        <img src="${img.url}" style="width:100%;height:100%;object-fit:cover;">
        <button onclick="this.closest('[data-idx]').remove()" style="position:absolute;top:2px;right:2px;width:18px;height:18px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;" data-remove="${i}">×</button>
      </div>
    `).join('');

    el.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.remove);
        this._images.splice(idx, 1);
        this._renderList();
        this._updatePreview();
      });
    });
  }

  _updatePreview() {
    const wrap = this.container.querySelector('#preview-canvas-wrap');
    const nVal = parseInt(this.container.querySelector('#inp-n').value) || 0;
    const imgs = this._images;

    if (imgs.length === 0) {
      wrap.innerHTML = `<div style="width:100%;height:100%;background:#d1d5db;display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:13px;">Belum ada gambar produk.</div>`;
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(0, 0, 1080, 900);
    this._canvas = canvas;

    const w2 = 540, h2 = 450, w3 = 360;
    const slots = [
      [0, 0, w2, h2], [w2, 0, w2, h2],
      [0, h2, w3, h2], [w3, h2, w3, h2], [2*w3, h2, w3, h2],
    ];

    let loadCount = 0;
    const total = Math.min(imgs.length, 5);

    for (let i = 0; i < total; i++) {
      const img = new Image();
      img.onload = () => {
        const [x, y, w, h] = slots[i];
        const scale = Math.min(w/img.width, h/img.height);
        const sw = img.width * scale, sh = img.height * scale;
        const sx = x + (w - sw) / 2, sy = y + (h - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh);

        if (i === total - 1 && (imgs.length > 5 || nVal > 0)) {
          const [x, y, w, h] = slots[4];
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = 'white';
          ctx.font = 'bold 80px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const n = nVal > 0 ? nVal : (imgs.length - 5);
          ctx.fillText(`+${n}`, x + w/2, y + h/2);
        }

        loadCount++;
        if (loadCount === total) {
          wrap.innerHTML = '';
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          canvas.style.objectFit = 'contain';
          wrap.appendChild(canvas);
        }
      };
      img.src = imgs[i].url;
    }
  }

  _download() {
    if (!this._canvas) { alert('Tambahkan gambar terlebih dahulu.'); return; }
    const a = document.createElement('a');
    a.download = 'card-generator.png';
    a.href = this._canvas.toDataURL('image/png');
    a.click();
  }

  destroy() {}
}
