let currentPage = null;

export function startRouter(routes) {
  async function navigate() {
    const hash = window.location.hash || '#/login';
    const path = hash.replace('#', '');

    if (currentPage?.destroy) currentPage.destroy();

    const Page = routes[path] || routes['/login'];
    const container = document.getElementById('app');
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
