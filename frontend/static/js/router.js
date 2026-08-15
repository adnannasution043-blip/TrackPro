let currentPage = null;

export function startRouter(routes, getContainer) {
  async function navigate() {
    const hash = window.location.hash || '#/login';
    const path = hash.replace('#', '') || '/login';

    if (currentPage?.destroy) currentPage.destroy();

    const container = await getContainer(path);
    if (!container) return;

    const Page = routes[path] || routes['/login'];
    container.innerHTML = '';
    currentPage = new Page(container);
    await currentPage.render();
  }

  window.addEventListener('hashchange', navigate);
  navigate();
}

export function redirect(path) {
  window.location.hash = '#' + path;
}
