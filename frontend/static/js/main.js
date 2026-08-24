import { getToken, clearToken, apiFetch } from './api.js';
import { getFilter, setFilter } from './filter-state.js';
import { startRouter, redirect } from './router.js';
import { AuthPage } from './pages/auth.js';
import { DashboardPage } from './pages/dashboard.js';
import { DailyPage } from './pages/daily.js';
import { OrdersPage } from './pages/orders.js';
import { CampaignsPage } from './pages/campaigns.js';
import { AnalysisPage } from './pages/analysis.js';
import { CommissionPage } from './pages/commission.js';
import { ClicksPage } from './pages/clicks.js';
import { UploadPage } from './pages/upload.js';
import { TaglinkPage } from './pages/taglink.js';
import { RefreshPage } from './pages/refresh.js';
import { BalancePage } from './pages/balance.js';
import { AccountPage } from './pages/account.js';
import { SubscriptionPage } from './pages/subscription.js';
import { MetaAccountPage } from './pages/meta_account.js';
import { CardGeneratorPage } from './pages/card_generator.js';
import { TaxPage } from './pages/tax.js';
import { AdsTrackerPage } from './pages/ads_tracker.js';
import { LaporanHarian2Page } from './pages/laporan_harian2.js';
import { IklanPage } from './pages/iklan.js';
import { KomisiBersihPage } from './pages/komisi_bersih.js';

const NAV_ITEMS = [
  { section: 'RINGKASAN' },
  // { path: '/dashboard', label: 'Dasbor', icon: 'dashboard' },
  // { path: '/daily', label: 'Laporan Harian', icon: 'calendar' },
  { path: '/laporan-harian2', label: 'Laporan Harian', icon: 'calendar' },
  { path: '/komisi-bersih', label: 'Pembayaran WD', icon: 'coin' },
  // { path: '/campaigns', label: 'Kampanye Meta', icon: 'megaphone' },
  // { path: '/analysis', label: 'Analisis Iklan', icon: 'chart' },
  { path: '/iklan', label: 'Iklan', icon: 'megaphone' },
  { groupLink: 'Laporan Komisi', icon: 'coin', path: '/commission', children: [
    { path: '/orders', label: 'Laporan Pesanan', icon: 'box' },
    { path: '/clicks', label: 'Laporan Klik', icon: 'cursor' },
  ]},
  { section: 'DATA' },
  { path: '/upload', label: 'Upload Data Harian', icon: 'upload' },
  { path: '/taglink', label: 'Hubungkan Taglink', icon: 'link' },
  { path: '/refresh', label: 'Perbarui Data Lama', icon: 'refresh' },
  { path: '/balance', label: 'Saldo Iklan', icon: 'wallet' },
  { group: 'Pengaturan', icon: 'gear', children: [
    { path: '/account', label: 'Akun', icon: 'user' },
    // { path: '/subscription', label: 'Langganan', icon: 'card' },
    { path: '/meta-account', label: 'Akun Meta', icon: 'shield' },
  ]},
  { section: 'LAINNYA' },
  { path: '/card-generator', label: 'Card Generator', icon: 'image' },
  { path: '/ads-tracker', label: 'AdsTracker', icon: 'target' },
  { path: '/tax', label: 'Pajak Affiliate', icon: 'receipt' },
];

const ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  megaphone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  coin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a3 3 0 0 0-5 2.2c0 1.4 1 2.5 2.5 3.3 1.5.8 2.5 1.9 2.5 3.3a3 3 0 0 1-5 2.2M12 6v2m0 8v2"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  cursor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l16 6-7 2-2 7z"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
  wallet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><circle cx="18" cy="12" r="2"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  card: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  receipt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  timer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`,
  chevronup: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  group: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
};

function icon(name) {
  return ICONS[name] || '';
}

function renderBanner() {
  const flags = Array(60).fill('<div class="banner-flag"></div>').join('');
  return `<div class="banner-flags">${flags}</div>`;
}

let expandedGroups = new Set();

function _confirmLogout() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:360px;width:92vw;">
      <div class="modal-body" style="padding:28px 24px 24px;text-align:center;">
        <div style="width:48px;height:48px;border-radius:50%;background:#fef2f2;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" width="22" height="22"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </div>
        <h2 style="font-size:16px;font-weight:700;margin:0 0 8px;">Keluar dari TrackPro?</h2>
        <p style="font-size:13px;color:var(--text-muted,#6b7280);margin:0 0 24px;">Sesi Anda akan diakhiri dan Anda perlu login kembali.</p>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button id="logout-batal" class="btn" style="min-width:100px;padding:9px 20px;">Batal</button>
          <button id="logout-ok" class="btn" style="min-width:100px;padding:9px 20px;background:#dc2626;color:#fff;border-color:#dc2626;">Ya, Keluar</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#logout-batal').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#logout-ok').addEventListener('click', () => {
    clearToken();
    redirect('/login');
  });
}

function renderSidebar(currentPath, user) {
  const userName = user?.nama || 'User';

  let html = `
    <a href="#/balance" class="sidebar-balance" style="text-decoration:none;display:block;cursor:pointer;">
      <div class="sidebar-balance-header">
        <div class="dot"></div>
        <span id="sb-saldo-label">SALDO</span>
      </div>
      <div class="sidebar-balance-amount" id="sb-saldo-amount">Rp —</div>
      <div class="sidebar-balance-update" id="sb-saldo-update">Memuat…</div>
    </a>

    <div class="sidebar-filter">
      <div class="sidebar-filter-label">FILTER AKUN</div>
      <button id="filter-akun-btn" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;font-size:13px;font-weight:500;color:var(--text);gap:6px;text-align:left;">
        <span id="filter-akun-label" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Semua Akun</span>
        <span class="fp-chevron" style="flex-shrink:0;width:14px;height:14px;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;">${icon('chevron')}</span>
      </button>
    </div>

    <div id="sidebar-nav">
  `;

  for (const item of NAV_ITEMS) {
    if (item.section) {
      html += `<div class="sidebar-section"><div class="sidebar-section-label">${item.section}</div></div><div class="sidebar-nav">`;
    } else if (item.path && !item.groupLink) {
      const isActive = currentPath === item.path ? ' active' : '';
      html += `
        <a href="#${item.path}" class="sidebar-item${isActive}">
          ${icon(item.icon)}
          ${item.label}
        </a>
      `;
    } else if (item.groupLink) {
      const isExpanded = expandedGroups.has(item.groupLink);
      const hasActiveChild = item.children?.some(c => c.path === currentPath);
      const isMain = currentPath === item.path;
      const isOpen = isExpanded || hasActiveChild || isMain;
      html += `
        <div style="display:flex;align-items:center;gap:0;">
          <a href="#${item.path}" class="sidebar-item${isMain ? ' active' : ''}" style="flex:1;min-width:0;">
            ${icon(item.icon)}
            ${item.groupLink}
          </a>
          <button class="sidebar-item" data-group="${item.groupLink}" style="padding:7px 6px;width:auto;flex-shrink:0;">
            <span style="width:14px;height:14px;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;${isOpen ? 'transform:rotate(180deg)' : ''}">${icon('chevron')}</span>
          </button>
        </div>
        <div class="sidebar-submenu" style="display:${isOpen ? 'block' : 'none'}" data-group-content="${item.groupLink}">
      `;
      for (const child of item.children || []) {
        const isActive = currentPath === child.path ? ' active' : '';
        html += `<a href="#${child.path}" class="sidebar-item${isActive}">${icon(child.icon)}${child.label}</a>`;
      }
      html += `</div>`;
    } else if (item.group) {
      const isExpanded = expandedGroups.has(item.group);
      const hasActiveChild = item.children?.some(c => c.path === currentPath);
      const isOpen = isExpanded || hasActiveChild;
      html += `
        <button class="sidebar-item sidebar-item-expand" data-group="${item.group}">
          <span style="display:flex;align-items:center;gap:9px;">
            ${icon(item.icon)}
            ${item.group}
          </span>
          <span style="width:14px;height:14px;transition:transform 0.2s;${isOpen ? 'transform:rotate(180deg)' : ''}">${icon('chevron')}</span>
        </button>
        <div class="sidebar-submenu" style="display:${isOpen ? 'block' : 'none'}" data-group-content="${item.group}">
      `;
      for (const child of item.children || []) {
        const isActive = currentPath === child.path ? ' active' : '';
        html += `
          <a href="#${child.path}" class="sidebar-item${isActive}">
            ${icon(child.icon)}
            ${child.label}
          </a>
        `;
      }
      html += `</div>`;
    }
  }

  html += `</div>`;

  html += `
    <div class="sidebar-bottom">
      <div class="sidebar-subscription" id="sidebar-sub-info" style="display:none;">
        ${icon('timer')}
        <div>
          <div style="font-weight:600;color:#dc2626;" id="sub-days-label">Langganan</div>
          <div style="font-size:11px;color:#6b7280;" id="sub-expire-label">–</div>
        </div>
      </div>
      <button class="sidebar-logout" id="btn-logout">
        ${icon('logout')}
        Keluar
      </button>
    </div>
  `;

  return html;
}

function renderShell(path, user) {
  document.getElementById('app').innerHTML = `
    <div id="layout">
      <aside id="sidebar">
        ${renderSidebar(path, user)}
      </aside>
      <div id="main-area">
        <header id="topbar">
          <button id="btn-sidebar-toggle" title="Sembunyikan/tampilkan sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="3" y1="6"  x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div class="topbar-logo">
            <div class="topbar-logo-icon">TP</div>
            <div class="topbar-logo-text">
              <div class="topbar-logo-name">TrackPro</div>
              <div class="topbar-logo-sub">Meta Ads × Shopee Affiliate</div>
            </div>
          </div>
          <div class="topbar-spacer"></div>
          <div class="topbar-meta-status" id="topbar-meta-status" style="opacity:0.4;">
            <div class="dot"></div>
            <span id="topbar-meta-label">Meta…</span>
          </div>
          <div class="topbar-meta-status" id="topbar-adu-status" style="opacity:0.4;">
            <div class="dot"></div>
            <span id="topbar-adu-label">Adu…</span>
          </div>
          <div class="topbar-meta-status" id="topbar-terra-status" style="opacity:0.4;">
            <div class="dot"></div>
            <span id="topbar-terra-label">Terra…</span>
          </div>
          <!-- <button class="topbar-group-btn">
            ${icon('group')}
            Gabung Grup
          </button> -->
          <div class="topbar-user">
            <div class="topbar-user-avatar">${(user?.nama || 'U').slice(0, 2).toUpperCase()}</div>
            <div class="topbar-user-info">
              <div class="topbar-user-name">${user?.nama || 'User'}</div>
              <div class="topbar-user-email">${user?.email || ''}</div>
            </div>
          </div>
        </header>
        <main id="page-content"></main>
      </div>
    </div>
  `;

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    _confirmLogout();
  });

  document.querySelectorAll('[data-group]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      const content = document.querySelector(`[data-group-content="${group}"]`);
      const arrow = btn.querySelector('span:last-child');
      if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
        expandedGroups.add(group);
      } else {
        content.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
        expandedGroups.delete(group);
      }
    });
  });

  updateSidebarLive();
}

function guard(Page) {
  return class {
    constructor(container) {
      this._inner = new Page(container);
    }
    async render() {
      if (!getToken()) { redirect('/login'); return; }
      return this._inner.render();
    }
    destroy() { this._inner.destroy?.(); }
  };
}

let currentUser = null;

async function loadUser() {
  try {
    const data = await apiFetch('/auth/me');
    if (data) currentUser = data;
  } catch (_) {}
}

function updateSidebarLive() {
  // Update subscription display
  const daysEl = document.getElementById('sub-days-label');
  const expEl = document.getElementById('sub-expire-label');
  if (daysEl && expEl) {
    apiFetch('/billing').then(d => {
      if (!d) return;
      daysEl.textContent = `Langganan - ${d.sisa_hari ?? '–'} hari lagi`;
      expEl.textContent = `s/d ${d.berakhir ? d.berakhir.slice(0, 10) : '–'}`;
    }).catch(() => {
      if (daysEl) daysEl.textContent = 'Langganan';
      if (expEl) expEl.textContent = '–';
    });
  }

  // Status koneksi Meta / Adu / Terra di topbar
  _loadMetaStatus();
  _loadSimpleApiStatus('adu', '/accounts/adu');
  _loadSimpleApiStatus('terra', '/accounts/terra');

  // Populate filter akun dropdown dari tree
  _initSidebarFilter();

  // Load live balance untuk sidebar widget
  _loadSidebarBalance();

  // Sidebar toggle
  _initSidebarToggle();
}

function _initSidebarToggle() {
  const btn      = document.getElementById('btn-sidebar-toggle');
  const sidebar  = document.getElementById('sidebar');
  const mainArea = document.getElementById('main-area');
  if (!btn || !sidebar || !mainArea) return;

  const collapsed = localStorage.getItem('sidebar-collapsed') === '1';
  if (collapsed) {
    sidebar.classList.add('collapsed');
    mainArea.classList.add('sidebar-hidden');
  }

  btn.addEventListener('click', () => {
    const isNowCollapsed = sidebar.classList.toggle('collapsed');
    mainArea.classList.toggle('sidebar-hidden', isNowCollapsed);
    localStorage.setItem('sidebar-collapsed', isNowCollapsed ? '1' : '0');
  });
}

async function _initSidebarFilter() {
  const btn = document.getElementById('filter-akun-btn');
  if (!btn || btn.dataset.loaded) return;
  btn.dataset.loaded = '1';

  if (!document.getElementById('fp-styles')) {
    const s = document.createElement('style');
    s.id = 'fp-styles';
    s.textContent = `.fp-opt{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;}.fp-opt:hover{background:#f9fafb;}.fp-opt.fp-sel{background:#fff1f2;}`;
    document.head.appendChild(s);
  }

  document.getElementById('filter-akun-panel')?.remove();
  const panel = document.createElement('div');
  panel.id = 'filter-akun-panel';
  panel.style.cssText = 'position:fixed;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.13);width:288px;max-height:440px;overflow-y:auto;z-index:9999;display:none;';
  document.body.appendChild(panel);

  const chevron = btn.querySelector('.fp-chevron');
  const closePanel = () => { panel.style.display = 'none'; if (chevron) chevron.style.transform = ''; };
  const openPanel = () => {
    const r = btn.getBoundingClientRect();
    panel.style.left = (r.right + 8) + 'px';
    panel.style.top = r.top + 'px';
    panel.style.display = 'block';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  };

  btn.addEventListener('click', (e) => { e.stopPropagation(); panel.style.display === 'none' ? openPanel() : closePanel(); });
  document.addEventListener('click', (e) => { if (!panel.contains(e.target) && e.target !== btn) closePanel(); });

  try {
    const tree = await apiFetch('/accounts/tree');
    if (!tree) return;

    const shopeeMetaCount = {};
    for (const m of (tree.meta_accounts || []))
      for (const s of (m.shopee_accounts || []))
        shopeeMetaCount[s.id] = (shopeeMetaCount[s.id] || 0) + 1;

    const linkedShopees = [];
    const seen = new Set();
    for (const m of (tree.meta_accounts || []))
      for (const s of (m.shopee_accounts || []))
        if (!seen.has(s.id)) { seen.add(s.id); linkedShopees.push({ ...s, metaCount: shopeeMetaCount[s.id] || 0 }); }

    const f = getFilter();
    const cur = f.type === 'meta' ? `meta:${f.id}` : f.type === 'shopee' ? `shopee:${f.id}` : '';
    const metaCount = tree.meta_accounts?.length || 0;

    const allShopees = [
      ...linkedShopees,
      ...(tree.shopee_unlinked || []).map(s => ({ ...s, metaCount: 0, unlinked: true })),
    ];

    const icoMeta = `<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" width="16" height="16"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    const icoShopee = `<svg viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" width="16" height="16"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>`;
    const icoGroup = `<svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
    const chk = `<svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" width="16" height="16" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>`;
    const bdg = (t, bg, c) => `<span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;background:${bg};color:${c};flex-shrink:0;">${t}</span>`;
    const opt = (val, icoBg, ico, name, sub, badge, sel) =>
      `<div class="fp-opt ${sel ? 'fp-sel' : ''}" data-val="${val}">
        <div style="width:32px;height:32px;background:${icoBg};border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ico}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:${sel?'600':'500'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
          <div style="font-size:11px;color:#9ca3af;">${sub}</div>
        </div>
        ${badge}${sel ? chk : ''}
      </div>`;

    let html = `<div style="padding:16px 16px 8px;font-size:14px;font-weight:700;color:var(--text);">Pilih Akun</div>`;
    html += opt('', '#fee2e2', icoGroup, 'Semua Akun', `${metaCount} akun Meta aktif`, '', !cur);

    if (metaCount > 0) {
      html += `<div style="padding:8px 16px 4px;font-size:10.5px;font-weight:700;letter-spacing:0.7px;color:#9ca3af;text-transform:uppercase;">Meta Ads</div>`;
      for (const m of tree.meta_accounts)
        html += opt(`meta:${m.id}`, '#eff6ff', icoMeta, m.nama, m.account_id, bdg('Meta', '#eff6ff', '#3b82f6'), cur === `meta:${m.id}`);
    }
    if (allShopees.length > 0) {
      html += `<div style="padding:8px 16px 4px;font-size:10.5px;font-weight:700;letter-spacing:0.7px;color:#9ca3af;text-transform:uppercase;">Shopee Affiliate</div>`;
      for (const s of allShopees)
        html += opt(`shopee:${s.id}`, '#fff7ed', icoShopee, s.nama, s.unlinked ? 'Belum terhubung' : `${s.metaCount} Meta terkait`, bdg('Shopee', '#fff7ed', '#f97316'), cur === `shopee:${s.id}`);
    }
    panel.innerHTML = html;

    const updateLabel = (val) => {
      const el = document.getElementById('filter-akun-label');
      if (!el) return;
      if (!val) { el.textContent = 'Semua Akun'; return; }
      const [type, id] = val.split(':');
      el.textContent = type === 'meta'
        ? (tree.meta_accounts.find(m => m.id === id)?.nama || 'Semua Akun')
        : (allShopees.find(s => s.id === id)?.nama || 'Semua Akun');
    };
    updateLabel(cur);

    panel.querySelectorAll('.fp-opt').forEach(o => {
      o.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = o.dataset.val;
        updateLabel(val);
        closePanel();
        if (!val) setFilter({ type: 'all' });
        else { const i = val.indexOf(':'); setFilter({ type: val.slice(0, i), id: val.slice(i + 1) }); }
      });
    });
  } catch (_) {}
}

async function _loadSidebarBalance() {
  const labelEl = document.getElementById('sb-saldo-label');
  const amountEl = document.getElementById('sb-saldo-amount');
  const updateEl = document.getElementById('sb-saldo-update');
  if (!amountEl) return;

  try {
    const data = await apiFetch('/balance/');
    if (!amountEl.isConnected) return;

    const accounts = data?.accounts || [];
    const f = getFilter();

    let saldo, nama, updated;
    if (f.type === 'meta' && f.id) {
      const acc = accounts.find(a => a.meta_account_id === f.id);
      saldo = acc ? Number(acc.sisa_saldo) : null;
      nama = acc ? acc.nama_akun : null;
      updated = acc?.updated_at;
    } else {
      saldo = accounts.reduce((s, a) => s + Number(a.sisa_saldo), 0);
      nama = null;
      updated = data?.terakhir_refresh;
    }

    const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const fmtUpd = iso => {
      if (!iso) return 'Belum ada data';
      const d = new Date(iso);
      return `Update ${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2,'0')}.${String(d.getMinutes()).padStart(2,'0')}`;
    };

    if (labelEl) {
      const shortName = nama ? nama.slice(0, 14) + (nama.length > 14 ? '…' : '') : null;
      labelEl.textContent = shortName ? `SALDO · ${shortName}` : 'SALDO';
    }
    if (amountEl) amountEl.textContent = saldo != null ? 'Rp ' + saldo.toLocaleString('id-ID') : 'Rp —';
    if (updateEl) updateEl.textContent = fmtUpd(updated);
  } catch (_) {
    if (amountEl?.isConnected) amountEl.textContent = 'Rp —';
    if (updateEl?.isConnected) updateEl.textContent = 'Belum ada data';
  }
}

async function _loadMetaStatus() {
  const el = document.getElementById('topbar-meta-status');
  const label = document.getElementById('topbar-meta-label');
  if (!el || !label) return;
  try {
    const list = await apiFetch('/accounts/meta');
    if (!list || list.length === 0) {
      el.style.opacity = '0.4';
      el.style.color = '';
      label.textContent = 'Meta Tidak Terhubung';
      const dot = el.querySelector('.dot');
      if (dot) dot.style.background = '#9ca3af';
      _removeTokenBanner();
      return;
    }

    const now = Date.now();
    const aktif   = list.filter(m => m.has_token && m.status_koneksi === 'terhubung');
    const expired  = list.filter(m => m.has_token && m.status_koneksi === 'token_expired');
    const dot = el.querySelector('.dot');

    // Hitung sisa hari token yang paling dekat expired
    let minSisa = Infinity;
    for (const m of list) {
      if (m.token_expires_at) {
        const sisa = Math.ceil((new Date(m.token_expires_at) - now) / 86400000);
        if (sisa < minSisa) minSisa = sisa;
      }
    }

    if (aktif.length > 0) {
      el.style.opacity = '1';
      el.style.color = '';
      if (dot) dot.style.background = '';
      label.textContent = aktif.length === 1 ? 'Meta Terhubung' : `Meta Terhubung (${aktif.length})`;
    } else if (expired.length > 0) {
      el.style.opacity = '1';
      el.style.color = '#f59e0b';
      if (dot) dot.style.background = '#f59e0b';
      label.textContent = 'Token Expired';
    } else {
      el.style.opacity = '0.4';
      el.style.color = '';
      if (dot) dot.style.background = '#9ca3af';
      label.textContent = 'Belum Ada Token';
    }

    // Banner warning
    if (expired.length > 0) {
      _showTokenBanner(
        'error',
        `⚠️ Token Meta <strong>sudah expired</strong> — data sync berhenti. ` +
        `<a href="#/meta-account" style="color:#991b1b;font-weight:700;text-decoration:underline;">Hubungkan ulang sekarang →</a>`
      );
    } else if (minSisa !== Infinity && minSisa <= 7) {
      _showTokenBanner(
        'warning',
        `⏰ Token Meta akan expired dalam <strong>${minSisa} hari</strong>. ` +
        `<a href="#/meta-account" style="color:#92400e;font-weight:700;text-decoration:underline;">Hubungkan ulang →</a>`
      );
    } else {
      _removeTokenBanner();
    }
  } catch (_) {}
}

async function _loadSimpleApiStatus(kind, endpoint) {
  const el = document.getElementById(`topbar-${kind}-status`);
  const label = document.getElementById(`topbar-${kind}-label`);
  if (!el || !label) return;
  const namaLabel = kind === 'adu' ? 'Adu' : 'Terra';
  try {
    const list = await apiFetch(endpoint);
    const dot = el.querySelector('.dot');
    if (!list || list.length === 0) {
      el.style.opacity = '0.4';
      el.style.color = '';
      label.textContent = `${namaLabel} Tidak Terhubung`;
      if (dot) dot.style.background = '#9ca3af';
      return;
    }
    const aktif = list.filter(a => a.has_api_key && a.status_koneksi === 'terhubung');
    const invalid = list.filter(a => a.has_api_key && a.status_koneksi === 'token_expired');
    if (aktif.length > 0) {
      el.style.opacity = '1';
      el.style.color = '';
      if (dot) dot.style.background = '';
      label.textContent = aktif.length === 1 ? `${namaLabel} Terhubung` : `${namaLabel} Terhubung (${aktif.length})`;
    } else if (invalid.length > 0) {
      el.style.opacity = '1';
      el.style.color = '#f59e0b';
      if (dot) dot.style.background = '#f59e0b';
      label.textContent = `${namaLabel} API Key Invalid`;
    } else {
      el.style.opacity = '0.4';
      el.style.color = '';
      if (dot) dot.style.background = '#9ca3af';
      label.textContent = `${namaLabel} Belum Ada API Key`;
    }
  } catch (_) {}
}

function _showTokenBanner(type, html) {
  let banner = document.getElementById('token-warning-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'token-warning-banner';
    const mainArea = document.getElementById('main-area');
    const topbar   = document.getElementById('topbar');
    if (mainArea && topbar) {
      mainArea.insertBefore(banner, topbar.nextSibling);
    }
  }
  const isError = type === 'error';
  banner.style.cssText = `
    padding:10px 20px;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;
    background:${isError ? '#fef2f2' : '#fffbeb'};
    color:${isError ? '#991b1b' : '#92400e'};
    border-bottom:1px solid ${isError ? '#fecaca' : '#fde68a'};
  `;
  banner.innerHTML = html;
}

function _removeTokenBanner() {
  document.getElementById('token-warning-banner')?.remove();
}

// Re-load sidebar balance ketika balance diupdate dari halaman Saldo Iklan
window.addEventListener('trackpro:balance-updated', () => _loadSidebarBalance());

const routes = {
  '/login': AuthPage,
  '/dashboard': guard(DashboardPage),
  '/daily': guard(DailyPage),
  '/orders': guard(OrdersPage),
  '/campaigns': guard(CampaignsPage),
  '/analysis': guard(AnalysisPage),
  '/commission': guard(CommissionPage),
  '/clicks': guard(ClicksPage),
  '/upload': guard(UploadPage),
  '/taglink': guard(TaglinkPage),
  '/refresh': guard(RefreshPage),
  '/balance': guard(BalancePage),
  '/account': guard(AccountPage),
  '/subscription': guard(SubscriptionPage),
  '/meta-account': guard(MetaAccountPage),
  '/card-generator': guard(CardGeneratorPage),
  '/ads-tracker': guard(AdsTrackerPage),
  '/tax': guard(TaxPage),
  '/laporan-harian2': guard(LaporanHarian2Page),
  '/iklan': guard(IklanPage),
  '/komisi-bersih': guard(KomisiBersihPage),
};

function getContainer(path) {
  if (path === '/login') return document.getElementById('app');

  if (!document.getElementById('page-content')) {
    renderShell(path, currentUser);
  } else {
    const sidebarNav = document.getElementById('sidebar');
    if (sidebarNav) {
      sidebarNav.innerHTML = renderSidebar(path, currentUser);
      document.getElementById('btn-logout')?.addEventListener('click', () => {
        _confirmLogout();
      });
      document.querySelectorAll('[data-group]').forEach(btn => {
        btn.addEventListener('click', () => {
          const group = btn.dataset.group;
          const content = document.querySelector(`[data-group-content="${group}"]`);
          const arrow = btn.querySelector('span:last-child');
          if (content.style.display === 'none') {
            content.style.display = 'block';
            arrow.style.transform = 'rotate(180deg)';
            expandedGroups.add(group);
          } else {
            content.style.display = 'none';
            arrow.style.transform = 'rotate(0deg)';
            expandedGroups.delete(group);
          }
        });
      });
      updateSidebarLive();
    }
  }
  return document.getElementById('page-content');
}

startRouter(routes, async (path) => {
  if (path !== '/login' && getToken() && !currentUser) {
    await loadUser();
  }
  const isAuth = path !== '/login';
  if (isAuth && !getToken()) {
    redirect('/login');
    return null;
  }
  if (!isAuth) {
    document.getElementById('app').innerHTML = '';
  }
  return getContainer(path);
});
