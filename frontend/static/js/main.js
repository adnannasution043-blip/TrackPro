import { getToken, clearToken } from './api.js';
import { startRouter, redirect } from './router.js';
import { AuthPage } from './pages/auth.js';
import { DashboardPage } from './pages/dashboard.js';
import { UploadPage } from './pages/upload.js';
import { TaglinkPage } from './pages/taglink.js';

const routes = {
  '/login': AuthPage,
  '/dashboard': guard(DashboardPage),
  '/upload': guard(UploadPage),
  '/taglink': guard(TaglinkPage),
};

function guard(Page) {
  return class extends Page {
    async render() {
      if (!getToken()) { redirect('/login'); return; }
      return super.render();
    }
  };
}

// Navbar
async function initNavbar() {
  const nav = document.getElementById('navbar');

  function updateNav() {
    const token = getToken();
    nav.style.display = token ? 'flex' : 'none';
  }

  nav.querySelector('#btn-logout').addEventListener('click', () => {
    clearToken();
    nav.style.display = 'none';
    redirect('/login');
  });

  // Update navbar aktif setiap navigasi
  window.addEventListener('hashchange', updateNav);
  updateNav();
}

initNavbar();
startRouter(routes);
