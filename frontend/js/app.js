// app.js — shared auth & API helpers

const API = '';  // empty = same origin via nginx proxy

function getToken() {
  return localStorage.getItem('token');
}

function setToken(t) {
  localStorage.setItem('token', t);
}

function clearToken() {
  localStorage.removeItem('token');
}

function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload) return null;
  // Check expiry
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    clearToken();
    return null;
  }
  return { username: payload.username, role: payload.role };
}

function authHeaders() {
  const t = getToken();
  return t ? { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) }
  });
  return res;
}

// HTMX — add Bearer token to every htmx request
document.addEventListener('htmx:configRequest', (e) => {
  const t = getToken();
  if (t) e.detail.headers['Authorization'] = `Bearer ${t}`;
});

// Redirect to login if 401
document.addEventListener('htmx:responseError', (e) => {
  if (e.detail.xhr.status === 401) {
    clearToken();
    window.location.href = '/login.html';
  }
});