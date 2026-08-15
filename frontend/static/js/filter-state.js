const KEY = 'trackpro_filter';

export function getFilter() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { type: 'all' };
  } catch { return { type: 'all' }; }
}

export function setFilter(f) {
  localStorage.setItem(KEY, JSON.stringify(f));
  window.dispatchEvent(new CustomEvent('trackpro:filter-changed', { detail: f }));
}

// Returns query string fragment (starts with '&') for API calls that support account filtering
export function filterQS() {
  const f = getFilter();
  if (f.type === 'meta' && f.id)    return `&meta_account_id=${f.id}`;
  if (f.type === 'shopee' && f.id)  return `&shopee_account_id=${f.id}`;
  return '';
}
