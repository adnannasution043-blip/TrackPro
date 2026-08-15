const API_BASE = '/api';

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(t) {
  localStorage.setItem('token', t);
}

export function clearToken() {
  localStorage.removeItem('token');
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    window.location.hash = '#/login';
    return null;
  }

  if (res.status === 204) return null;

  const body = await res.json().catch(() => ({ detail: 'Respons tidak valid dari server.' }));

  if (!res.ok) {
    throw new Error(body.detail || `Error ${res.status}`);
  }

  return body;
}

// Untuk multipart/form-data — JANGAN set Content-Type, biar browser set boundary otomatis
export async function apiUpload(path, formData) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (res.status === 401) {
    clearToken();
    window.location.hash = '#/login';
    return null;
  }

  const body = await res.json().catch(() => ({ detail: 'Respons tidak valid dari server.' }));

  if (!res.ok) {
    throw new Error(body.detail || `Error ${res.status}`);
  }

  return body;
}
