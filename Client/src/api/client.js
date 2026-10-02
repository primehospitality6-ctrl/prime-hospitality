/**
 * Public site + staff (admin) API client — talks to Prime Server (/api).
 */

/** API origin from VITE_API_URL; tolerates a missing scheme and a trailing slash or /api. Empty = same origin. */
export function apiBase(raw) {
  let base = String(raw || '').trim().replace(/\/+$/, '').replace(/\/api$/i, '');
  if (base && !/^https?:\/\//i.test(base)) base = `${/^(localhost|127\.0\.0\.1)(:|$)/.test(base) ? 'http' : 'https'}://${base}`;
  return base;
}

const BASE = apiBase(import.meta.env.VITE_API_URL);
const ADMIN_TOKEN_KEY = 'prime_admin_token';

function buildUrl(path, params) {
  const url = new URL(path, BASE || window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return BASE ? url.toString() : `${url.pathname}${url.search}`;
}

async function request(path, { method = 'GET', params, body, token, formData } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined && !formData) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(buildUrl(path, params), {
    method,
    headers,
    body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function adminRequest(path, options = {}) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  return request(path, { ...options, token });
}

const publicCache = new Map();
const PUBLIC_TTL_MS = 60_000;

/** Site content several components ask for on the same page — fetch once per minute. */
function cachedRequest(path, params) {
  const key = `${path}?${JSON.stringify(params || {})}`;
  const hit = publicCache.get(key);
  if (hit && Date.now() - hit.at < PUBLIC_TTL_MS) return hit.promise;
  const promise = request(path, { params }).catch((err) => {
    publicCache.delete(key);
    throw err;
  });
  publicCache.set(key, { at: Date.now(), promise });
  return promise;
}

export const api = {
  getHealth() {
    return request('/api/health');
  },

  getListings(params = {}) {
    return request('/api/units', { params });
  },

  getListingBySlug(slug) {
    return request(`/api/units/${encodeURIComponent(slug)}`);
  },

  getListingAvailability(slug, params = {}) {
    return request(`/api/units/${encodeURIComponent(slug)}/availability`, { params });
  },

  getListingPricing(slug, params = {}) {
    return request(`/api/units/${encodeURIComponent(slug)}/pricing`, { params });
  },

  getCompounds(params = {}) {
    return request('/api/compounds', { params });
  },

  getDestinations(params = {}) {
    return cachedRequest('/api/destinations', params);
  },

  getDestinationById(id) {
    return request(`/api/destinations/${encodeURIComponent(id)}`);
  },

  getMeta() {
    return cachedRequest('/api/content/meta');
  },

  getPartners() {
    return cachedRequest('/api/content/partners');
  },

  getTrust() {
    return cachedRequest('/api/content/trust');
  },

  getFaqs() {
    return cachedRequest('/api/content/faqs');
  },

  getSlideshow() {
    return cachedRequest('/api/content/slideshow');
  },

  getPixels() {
    return request('/api/content/pixels');
  },

  getSite() {
    return request('/api/content/site');
  },

  async getFeatured(limit = 8) {
    const featured = await this.getListings({ featured: true, limit });
    if (featured.items?.length) return featured;
    return this.getListings({ limit });
  },

  createBooking(payload) {
    return request('/api/bookings', { method: 'POST', body: payload });
  },

  sendContact(payload) {
    return request('/api/inquiries/contact', { method: 'POST', body: payload });
  },

  sendPartnerInquiry(payload) {
    return request('/api/inquiries/partner', { method: 'POST', body: payload });
  },

  /* ——— Admin ——— */
  adminLogin(payload) {
    return request('/api/admin/auth/login', { method: 'POST', body: payload });
  },

  adminMe() {
    return adminRequest('/api/admin/auth/me');
  },

  adminDriveFolderImages(url) {
    return adminRequest('/api/admin/drive/folder-images', {
      method: 'POST',
      body: { url },
    });
  },

  adminDashboard() {
    return adminRequest('/api/admin/dashboard');
  },

  adminUpload(file, folder = 'site') {
    const fd = new FormData();
    fd.append('file', file);
    return adminRequest(`/api/admin/upload?folder=${encodeURIComponent(folder)}`, {
      method: 'POST',
      formData: fd,
    });
  },

  adminGetSlideshow() {
    return adminRequest('/api/admin/slideshow');
  },
  adminCreateSlide(body) {
    return adminRequest('/api/admin/slideshow', { method: 'POST', body });
  },
  adminUpdateSlide(id, body) {
    return adminRequest(`/api/admin/slideshow/${id}`, { method: 'PATCH', body });
  },
  adminDeleteSlide(id) {
    return adminRequest(`/api/admin/slideshow/${id}`, { method: 'DELETE' });
  },
  adminReorderSlideshow(ids) {
    return adminRequest('/api/admin/slideshow/reorder', { method: 'PATCH', body: { ids } });
  },

  adminGetDestinations() {
    return adminRequest('/api/admin/destinations');
  },
  adminCreateDestination(body) {
    return adminRequest('/api/admin/destinations', { method: 'POST', body });
  },
  adminUpdateDestination(id, body) {
    return adminRequest(`/api/admin/destinations/${id}`, { method: 'PATCH', body });
  },
  adminDeleteDestination(id) {
    return adminRequest(`/api/admin/destinations/${id}`, { method: 'DELETE' });
  },
  adminReorderDestinations(ids) {
    return adminRequest('/api/admin/destinations/reorder', { method: 'PATCH', body: { ids } });
  },

  adminGetBookings() {
    return adminRequest('/api/admin/bookings');
  },

  adminGetCompounds() {
    return adminRequest('/api/admin/compounds');
  },
  adminCreateCompound(body) {
    return adminRequest('/api/admin/compounds', { method: 'POST', body });
  },
  adminUpdateCompound(id, body) {
    return adminRequest(`/api/admin/compounds/${id}`, { method: 'PATCH', body });
  },
  adminDeleteCompound(id) {
    return adminRequest(`/api/admin/compounds/${id}`, { method: 'DELETE' });
  },
  adminReorderCompounds(ids) {
    return adminRequest('/api/admin/compounds/reorder', { method: 'PATCH', body: { ids } });
  },

  adminGetUnits() {
    return adminRequest('/api/admin/units');
  },
  adminCreateUnit(body) {
    return adminRequest('/api/admin/units', { method: 'POST', body });
  },
  adminUpdateUnit(id, body) {
    return adminRequest(`/api/admin/units/${id}`, { method: 'PATCH', body });
  },
  adminDeleteUnit(id) {
    return adminRequest(`/api/admin/units/${id}`, { method: 'DELETE' });
  },
  adminReorderHomeUnits(ids) {
    return adminRequest('/api/admin/units/reorder-home', { method: 'PATCH', body: { ids } });
  },
  adminReorderSearchUnits(ids) {
    return adminRequest('/api/admin/units/reorder-search', { method: 'PATCH', body: { ids } });
  },
  adminBulkUpdateUnits(ids, patch) {
    return adminRequest('/api/admin/units/bulk', { method: 'PATCH', body: { ids, patch } });
  },

  adminGetSite() {
    return adminRequest('/api/admin/site');
  },
  /** Send one or more whole sections: business, announcement, home, pages, copy, seo, tracking */
  adminSaveSite(sections) {
    return adminRequest('/api/admin/site', { method: 'PUT', body: sections });
  },
  adminGetContent() {
    return adminRequest('/api/admin/content');
  },
  adminSaveContent(body) {
    return adminRequest('/api/admin/content', { method: 'PUT', body });
  },

  adminKwentraStatus() {
    return adminRequest('/api/admin/kwentra/status');
  },
  adminKwentraSync() {
    return adminRequest('/api/admin/kwentra/sync', { method: 'POST' });
  },
  adminGetSettings() {
    return adminRequest('/api/admin/settings');
  },
  adminSaveSettings(body) {
    return adminRequest('/api/admin/settings', { method: 'PUT', body });
  },

  getAdminToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  },
  setAdminToken(token) {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  },
};

export default api;
