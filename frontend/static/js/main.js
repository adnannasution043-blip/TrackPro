import { getToken, clearToken, apiFetch } from './api.js';
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

const NAV_ITEMS = [
  { section: 'RINGKASAN' },
  { path: '/dashboard', label: 'Dasbor', icon: 'dashboard' },
  { path: '/daily', label: 'Laporan Harian', icon: 'calendar' },
  { path: '/campaigns', label: 'Kampanye Meta', icon: 'megaphone' },
  { path: '/analysis', label: 'Analisis Iklan', icon: 'chart' },
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
    { path: '/subscription', label: 'Langganan', icon: 'card' },
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

function renderSidebar(currentPath, user) {
  const userName = user?.nama || 'User';

  let html = `
    <div class="sidebar-balance">
      <div class="sidebar-balance-header">
        <div class="dot"></div>
        SALDO
      </div>
      <div class="sidebar-balance-amount">Rp 0</div>
      <div class="sidebar-balance-update">Update hari ini</div>
    </div>

    <div class="sidebar-filter">
      <div class="sidebar-filter-label">Filter Akun</div>
      <select>
        <option>Semua Akun</option>
      </select>
    </div>

    <div id="sidebar-nav">
  `;

  for (const item of NAV_ITEMS) {
    if (item.section) {
      html += `<div class="sidebar-section"><div class="sidebar-section-label">${item.section}</div></div><div class="sidebar-nav">`;
    } else if (item.path) {
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
      <div class="sidebar-subscription" id="sidebar-sub-info">
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
          <div class="topbar-logo">
            <div class="topbar-logo-icon">TP</div>
            <div class="topbar-logo-text">
              <div class="topbar-logo-name">TrackPro</div>
              <div class="topbar-logo-sub">Meta Ads × Shopee Affiliate</div>
            </div>
          </div>
          <div class="topbar-spacer"></div>
          <div class="topbar-meta-status">
            <div class="dot"></div>
            Meta Terhubung
          </div>
          <button class="topbar-group-btn">
            ${icon('group')}
            Gabung Grup
          </button>
          <div class="topbar-locale">🇮🇩 Indonesia ▾</div>
          <button class="topbar-icon-btn">${icon('moon')}</button>
          <div class="topbar-user">
            <div class="topbar-user-name">${user?.nama || 'User'}</div>
            <div class="topbar-user-email">${user?.email || ''}</div>
          </div>
        </header>
        <div id="banner">${renderBanner()}</div>
        <main id="page-content"></main>
      </div>
    </div>
  `;

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    clearToken();
    redirect('/login');
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
  // Update subscription display once user data is available
  const daysEl = document.getElementById('sub-days-label');
  const expEl = document.getElementById('sub-expire-label');
  if (!daysEl || !expEl) return;
  // Fetch subscription data
  apiFetch('/billing').then(d => {
    if (!d) return;
    const days = d.sisa_hari != null ? d.sisa_hari : '–';
    const exp = d.berakhir ? d.berakhir.slice(0, 10) : '–';
    daysEl.textContent = `Langganan - ${days} hari lagi`;
    expEl.textContent = `s/d ${exp}`;
  }).catch(() => {
    if (daysEl) daysEl.textContent = 'Langganan';
    if (expEl) expEl.textContent = '–';
  });
}

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
        clearToken();
        redirect('/login');
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
