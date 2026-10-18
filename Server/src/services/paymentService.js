/**
 * On-site payment gateways — embedded iframe / hosted fields only.
 * NEVER return a top-level redirect URL for the guest to leave our domain.
 * Paymob iframe is rendered inside PaymentModal on our React app.
 *
 * Site amounts are usually USD. Paymob can charge USD (if the integration is USD)
 * or the live EGP equivalent (PAYMOB_CURRENCY=EGP).
 */

const https = require('https');
const crypto = require('crypto');

const PAYMOB_BASE = process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com/api';
const SITE_CURRENCY = String(process.env.SITE_CURRENCY || process.env.KWENTRA_CURRENCY || 'USD').toUpperCase();

function isPaymobConfigured() {
  return Boolean(
    process.env.PAYMOB_API_KEY && process.env.PAYMOB_INTEGRATION_ID && process.env.PAYMOB_IFRAME_ID
  );
}

function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function activeProvider() {
  const forced = String(process.env.PAYMENT_PROVIDER || '').toLowerCase();
  if (forced === 'paymob' || forced === 'stripe' || forced === 'fawry' || forced === 'mock') return forced;
  if (isPaymobConfigured()) return 'paymob';
  if (isStripeConfigured()) return 'stripe';
  return 'mock';
}

/** Currency the Paymob integration is set up for (USD or EGP). */
function paymobChargeCurrency() {
  const v = String(process.env.PAYMOB_CURRENCY || 'EGP').toUpperCase();
  return v === 'USD' ? 'USD' : 'EGP';
}

function requestJson(method, urlString, body, headers = {}) {
  const url = new URL(urlString);
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function getJson(urlString) {
  return requestJson('GET', urlString);
}

/**
 * Live FX: 1 unit of `from` in `to`. Cached briefly.
 * Override with PAYMOB_USD_EGP_RATE (fixed) or PAYMOB_FX_URL.
 */
const fxCache = { at: 0, rate: null };
const FX_TTL_MS = 30 * 60_000;

async function exchangeRate(from, to) {
  const a = String(from).toUpperCase();
  const b = String(to).toUpperCase();
  if (a === b) return 1;

  const fixed = Number(process.env.PAYMOB_USD_EGP_RATE);
  if (a === 'USD' && b === 'EGP' && Number.isFinite(fixed) && fixed > 0) return fixed;
  if (a === 'EGP' && b === 'USD' && Number.isFinite(fixed) && fixed > 0) return 1 / fixed;

  if (fxCache.rate && Date.now() - fxCache.at < FX_TTL_MS && fxCache.from === a && fxCache.to === b) {
    return fxCache.rate;
  }

  const custom = process.env.PAYMOB_FX_URL;
  let rate;
  if (custom) {
    const url = custom.replace('{from}', a).replace('{to}', b);
    const { data, status } = await getJson(url);
    if (status >= 400) throw new Error(`FX lookup failed: ${status}`);
    rate = Number(data?.rate ?? data?.rates?.[b] ?? data?.result);
  } else {
    // Frankfurter (ECB) — free, no key
    const { data, status } = await getJson(`https://api.frankfurter.app/latest?from=${a}&to=${b}`);
    if (status >= 400 || !data?.rates?.[b]) {
      throw new Error(`FX lookup failed: ${JSON.stringify(data)}`);
    }
    rate = Number(data.rates[b]);
  }
  if (!(rate > 0)) throw new Error(`Invalid FX rate ${a}→${b}`);
  fxCache.at = Date.now();
  fxCache.from = a;
  fxCache.to = b;
  fxCache.rate = rate;
  return rate;
}

/** Convert booking amount into what Paymob will charge. */
async function amountForPaymob(amount, bookingCurrency) {
  const from = String(bookingCurrency || SITE_CURRENCY).toUpperCase();
  const to = paymobChargeCurrency();
  const value = Number(amount);
  if (!(value > 0)) throw new Error('Payment amount must be positive');

  if (from === to) {
    return {
      chargeAmount: value,
      chargeCurrency: to,
      displayAmount: value,
      displayCurrency: from,
      fxRate: 1,
      converted: false,
    };
  }

  const fxRate = await exchangeRate(from, to);
  const chargeAmount = Math.round(value * fxRate * 100) / 100;
  return {
    chargeAmount,
    chargeCurrency: to,
    displayAmount: value,
    displayCurrency: from,
    fxRate,
    converted: true,
  };
}

async function paymobAuthToken() {
  const { data, status } = await requestJson('POST', `${PAYMOB_BASE}/auth/tokens`, {
    api_key: process.env.PAYMOB_API_KEY,
  });
  if (status >= 400 || !data?.token) {
    throw new Error(`Paymob auth failed: ${JSON.stringify(data)}`);
  }
  return data.token;
}

async function initializePaymobEmbedded({ amount, currency, merchantOrderId, billing }) {
  const priced = await amountForPaymob(amount, currency);
  const amountCents = Math.round(Number(priced.chargeAmount) * 100);
  const token = await paymobAuthToken();

  const orderRes = await requestJson('POST', `${PAYMOB_BASE}/ecommerce/orders`, {
    auth_token: token,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: priced.chargeCurrency,
    merchant_order_id: merchantOrderId,
    items: [],
  });
  if (orderRes.status >= 400 || !orderRes.data?.id) {
    throw new Error(`Paymob order failed: ${JSON.stringify(orderRes.data)}`);
  }

  const nameParts = String(billing.name || 'Guest').trim().split(/\s+/);
  const firstName = nameParts[0] || 'Guest';
  const lastName = nameParts.slice(1).join(' ') || 'Prime';

  const keyRes = await requestJson('POST', `${PAYMOB_BASE}/acceptance/payment_keys`, {
    auth_token: token,
    amount_cents: amountCents,
    expiration: 3600,
    order_id: orderRes.data.id,
    billing_data: {
      apartment: 'NA',
      email: billing.email || 'guest@primehospitality.com',
      floor: 'NA',
      first_name: firstName,
      street: 'NA',
      building: 'NA',
      phone_number: billing.phone || '+200000000000',
      shipping_method: 'NA',
      postal_code: 'NA',
      city: 'Cairo',
      country: 'EG',
      last_name: lastName,
      state: 'NA',
    },
    currency: priced.chargeCurrency,
    integration_id: Number(process.env.PAYMOB_INTEGRATION_ID),
  });
  if (keyRes.status >= 400 || !keyRes.data?.token) {
    throw new Error(`Paymob payment key failed: ${JSON.stringify(keyRes.data)}`);
  }

  const paymentKey = keyRes.data.token;
  const iframeId = process.env.PAYMOB_IFRAME_ID;
  const iframeSrc = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;

  return {
    provider: 'paymob',
    mode: 'embedded_iframe',
    amountCents,
    currency: priced.chargeCurrency,
    displayAmount: priced.displayAmount,
    displayCurrency: priced.displayCurrency,
    chargeAmount: priced.chargeAmount,
    chargeCurrency: priced.chargeCurrency,
    fxRate: priced.fxRate,
    converted: priced.converted,
    merchantOrderId,
    providerOrderId: String(orderRes.data.id),
    paymentKey,
    iframeSrc,
    redirectForbidden: true,
  };
}

/**
 * Stripe PaymentIntent for Elements (embedded card fields on our domain).
 * Client confirms with Stripe.js — no redirect Checkout Session.
 */
async function initializeStripeEmbedded({ amount, merchantOrderId, billing, currency = 'usd' }) {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }
  const amountCents = Math.round(Number(amount) * 100);
  const params = new URLSearchParams({
    amount: String(amountCents),
    currency: String(currency).toLowerCase(),
    'metadata[merchant_order_id]': merchantOrderId,
    'metadata[email]': billing.email || '',
    'automatic_payment_methods[enabled]': 'true',
  });
  const formBody = params.toString();

  const raw = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.stripe.com',
        path: '/v1/payment_intents',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(formBody),
        },
      },
      (r) => {
        let data = '';
        r.on('data', (c) => {
          data += c;
        });
        r.on('end', () => {
          try {
            resolve({ status: r.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: r.statusCode, data });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(formBody);
    req.end();
  });

  if (raw.status >= 400 || !raw.data?.client_secret) {
    throw new Error(`Stripe PaymentIntent failed: ${JSON.stringify(raw.data)}`);
  }

  return {
    provider: 'stripe',
    mode: 'embedded_elements',
    amountCents,
    currency: String(currency).toUpperCase(),
    displayAmount: Number(amount),
    displayCurrency: String(currency).toUpperCase(),
    merchantOrderId,
    providerOrderId: raw.data.id,
    clientSecret: raw.data.client_secret,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    redirectForbidden: true,
  };
}

/** Dev / offline: mock embedded session so UI can be tested without gateways */
function initializeMockEmbedded({ amount, merchantOrderId, currency = SITE_CURRENCY }) {
  return {
    provider: 'mock',
    mode: 'embedded_mock',
    amountCents: Math.round(Number(amount) * 100),
    currency: String(currency || SITE_CURRENCY).toUpperCase(),
    displayAmount: Number(amount),
    displayCurrency: String(currency || SITE_CURRENCY).toUpperCase(),
    merchantOrderId,
    providerOrderId: `mock_${merchantOrderId}`,
    iframeSrc: null,
    mockPayable: true,
    redirectForbidden: true,
  };
}

/**
 * Start an on-site payment session.
 * Returns embed payload for PaymentModal — never a navigation redirect.
 */
async function createPaymentSession({ amount, currency = SITE_CURRENCY, merchantOrderId, billing }) {
  const provider = activeProvider();
  const cur = String(currency || SITE_CURRENCY).toUpperCase();
  if (provider === 'paymob') {
    return initializePaymobEmbedded({ amount, currency: cur, merchantOrderId, billing });
  }
  if (provider === 'stripe') {
    return initializeStripeEmbedded({
      amount,
      merchantOrderId,
      billing,
      currency: cur.toLowerCase(),
    });
  }
  if (provider === 'fawry') {
    const err = new Error('Fawry embedded integration pending — set PAYMENT_PROVIDER=paymob|stripe|mock');
    err.status = 501;
    throw err;
  }
  return initializeMockEmbedded({ amount, merchantOrderId, currency: cur });
}

function verifyPaymobHmac(obj, receivedHmac) {
  const secret = process.env.PAYMOB_HMAC_SECRET;
  if (!secret || !receivedHmac) return false;
  const order = [
    'amount_cents',
    'created_at',
    'currency',
    'error_occured',
    'has_parent_transaction',
    'id',
    'integration_id',
    'is_3d_secure',
    'is_auth',
    'is_capture',
    'is_refunded',
    'is_standalone_payment',
    'is_voided',
    'order',
    'owner',
    'pending',
    'source_data_pan',
    'source_data_sub_type',
    'source_data_type',
    'success',
  ];
  const concat = order.map((k) => String(obj[k] ?? '')).join('');
  const calc = crypto.createHmac('sha512', secret).update(concat).digest('hex');
  return calc === receivedHmac;
}

module.exports = {
  activeProvider,
  isPaymobConfigured,
  isStripeConfigured,
  createPaymentSession,
  verifyPaymobHmac,
  initializePaymobEmbedded,
  initializeStripeEmbedded,
  initializeMockEmbedded,
  paymobChargeCurrency,
  SITE_CURRENCY,
};
