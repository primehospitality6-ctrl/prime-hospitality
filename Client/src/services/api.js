/**
 * Guest SPA → our Node.js gateway only.
 * Never call Kwentra or payment provider hosts from the browser for booking/auth.
 */
import api, { apiBase } from '../api/client';

const BASE = apiBase(import.meta.env.VITE_API_URL);
const GEO_KEY = 'prime.geo';
let bookingConfigPromise = null;

async function request(path, { method = 'GET', params, body, keepalive = false } = {}) {
  const url = new URL(path, BASE || window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(BASE ? url.toString() : `${url.pathname}${url.search}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    keepalive,
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

export const kwentraApi = {
  getUnits(params = {}) {
    return request('/api/kwentra/units', { params });
  },

  getAvailability({ slug, unitId, from, to } = {}) {
    return request('/api/availability', {
      params: { slug, unitId, from, to },
    });
  },

  quote(payload) {
    return request('/api/kwentra/quote', { method: 'POST', body: payload });
  },

  /** PMS field contract, rate plans and allowed check-in / check-out times */
  getBookingConfig() {
    bookingConfigPromise ||= request('/api/booking/config').catch((err) => {
      bookingConfigPromise = null;
      throw err;
    });
    return bookingConfigPromise;
  },

  /** Booker country from IP — pre-fills nationality + reservation country */
  async getGeo() {
    const cached = sessionStorage.getItem(GEO_KEY);
    if (cached) return JSON.parse(cached);
    const geo = await request('/api/booking/geo');
    if (geo?.country) sessionStorage.setItem(GEO_KEY, JSON.stringify(geo));
    return geo;
  },

  /** Create on-site booking hold + embedded payment session (zero redirect) */
  bookDirect(payload) {
    return request('/api/book-direct', { method: 'POST', body: payload });
  },

  paymentStatus(merchantOrderId) {
    return request(`/api/kwentra/payments/order/${encodeURIComponent(merchantOrderId)}`);
  },

  /** The guest left without paying: end that unpaid booking. keepalive lets it finish while the page closes. */
  cancelPayment(merchantOrderId) {
    if (!merchantOrderId) return Promise.resolve();
    return request('/api/kwentra/payments/cancel', { method: 'POST', body: { merchantOrderId }, keepalive: true }).catch(() => {});
  },

  confirmMockPayment(payload) {
    return request('/api/kwentra/payments/mock-confirm', { method: 'POST', body: payload });
  },

  getPaymentProviderStatus() {
    return request('/api/kwentra/payments/status');
  },

  /** Re-use CMS listing helpers from main client */
  getListingBySlug(slug) {
    return api.getListingBySlug(slug);
  },
};

export default kwentraApi;
