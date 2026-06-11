// app.js — shared auth & API helpers

const API = '';  // empty = same origin via nginx proxy

function getToken() {
  return localStorage.getItem('lk_token');
}

function setToken(t) {
  localStorage.setItem('lk_token', t);
}

function clearToken() {
  localStorage.removeItem('lk_token');
}

function decodeToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload || !payload.username || !payload.role) {
    clearToken();
    return null;
  }
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    clearToken();
    return null;
  }
  return { username: payload.username, role: payload.role };
}

function authHeaders() {
  const t = getToken();
  return t
    ? { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401) {
    clearToken();
    if (!window.location.pathname.endsWith('/login.html')) {
      window.location.replace('/login.html');
    }
  }
  return res;
}

// Escape HTML helper used across modules
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
