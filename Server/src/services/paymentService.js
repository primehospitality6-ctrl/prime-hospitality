/**
 * On-site payment gateways — embedded iframe / hosted fields only.
 * NEVER return a top-level redirect URL for the guest to leave our domain.
 * Paymob iframe is rendered inside PaymentModal on our React app.
 *
 * Site amounts are USD. Paymob charges EGP only. Each booking reads Kwentra's
 * currency factor again and charges USD × that factor. No other rate is used.
 */

const https = require('https');
const crypto = require('crypto');
const kwentra = require('./kwentraService');

const PAYMOB_BASE = process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com/api';
/** Rates on the website are USD. Paymob's charge is always EGP. */
const SITE_CURRENCY = 'USD';

const envSet = (name) => Boolean(String(process.env[name] || '').trim());
const env = (name) => String(process.env[name] || '').trim();

/** New Paymob checkout (Intention API): needs the secret + public keys, no iframe. */
function isPaymobCheckoutConfigured() {
  return ['PAYMOB_SECRET_KEY', 'PAYMOB_PUBLIC_KEY', 'PAYMOB_INTEGRATION_ID'].every(envSet);
}

/** Older Paymob iframe flow. */
function isPaymobIframeConfigured() {
  return ['PAYMOB_API_KEY', 'PAYMOB_INTEGRATION_ID', 'PAYMOB_IFRAME_ID'].every(envSet);
}

function isPaymobConfigured() {
  return isPaymobCheckoutConfigured() || isPaymobIframeConfigured();
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

/** Paymob accepts EGP only. */
function paymobChargeCurrency() {
  return 'EGP';
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

/**
 * EGP Paymob will charge for this stay. The factor is read from Kwentra at this moment.
 * A missing factor fails the payment instead of using another source.
 */
async function amountForPaymob(amount, bookingCurrency, tenantId) {
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

  // The property's own Kwentra tenant: its rate is the one Kwentra uses for this reservation's folio.
  const quote = await kwentra.currencyRate({ from, to, tenantId, fresh: true });
  const chargeAmount = Math.round(value * quote.rate * 100) / 100;
  return {
    chargeAmount,
    chargeCurrency: to,
    displayAmount: value,
    displayCurrency: from,
    fxRate: quote.rate,
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

function paymobBilling(billing = {}) {
  const nameParts = String(billing.name || 'Guest').trim().split(/\s+/);
  return {
    apartment: 'NA',
    email: billing.email || 'guest@primehospitality.com',
    floor: 'NA',
    first_name: nameParts[0] || 'Guest',
    street: 'NA',
    building: 'NA',
    phone_number: billing.phone || '+200000000000',
    shipping_method: 'NA',
    postal_code: 'NA',
    city: 'Cairo',
    country: 'EG',
    last_name: nameParts.slice(1).join(' ') || 'Prime',
    state: 'NA',
  };
}

/** Public address of this API, for Paymob's callbacks. Render sets RENDER_EXTERNAL_URL itself. */
function publicApiUrl() {
  return (env('PUBLIC_API_URL') || env('RENDER_EXTERNAL_URL')).replace(/\/$/, '');
}

/**
 * Paymob's current checkout. Creates a payment intention and returns the
 * Unified Checkout page, which our popup shows in its frame. No iframe ID needed.
 */
async function initializePaymobCheckout({ amount, currency, merchantOrderId, billing, tenantId }) {
  const priced = await amountForPaymob(amount, currency, tenantId);
  const amountCents = Math.round(Number(priced.chargeAmount) * 100);
  const integrationIds = env('PAYMOB_INTEGRATION_ID')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter(Boolean);
  const api = publicApiUrl();
  const base = PAYMOB_BASE.replace(/\/api\/?$/, '');

  const res = await requestJson(
    'POST',
    `${base}/v1/intention/`,
    {
      amount: amountCents,
      currency: priced.chargeCurrency,
      payment_methods: integrationIds,
      items: [{ name: 'Stay booking', amount: amountCents, description: merchantOrderId, quantity: 1 }],
      billing_data: paymobBilling(billing),
      special_reference: merchantOrderId,
      expiration: 3600,
      ...(api
        ? {
            notification_url: `${api}/api/webhooks/paymob`,
            redirection_url: `${api}/api/webhooks/paymob/response`,
          }
        : {}),
    },
    { Authorization: `Token ${env('PAYMOB_SECRET_KEY')}` }
  );
  if (res.status >= 400 || !res.data?.client_secret) {
    throw new Error(`Paymob intention failed: ${JSON.stringify(res.data)}`);
  }

  const iframeSrc = `${base}/unifiedcheckout/?publicKey=${encodeURIComponent(env('PAYMOB_PUBLIC_KEY'))}&clientSecret=${encodeURIComponent(res.data.client_secret)}`;
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
    providerOrderId: String(res.data.intention_order_id || res.data.id || ''),
    iframeSrc,
    redirectForbidden: true,
  };
}

async function initializePaymobEmbedded({ amount, currency, merchantOrderId, billing, tenantId }) {
  if (isPaymobCheckoutConfigured()) {
    return initializePaymobCheckout({ amount, currency, merchantOrderId, billing, tenantId });
  }
  const missing = ['PAYMOB_API_KEY', 'PAYMOB_INTEGRATION_ID', 'PAYMOB_IFRAME_ID'].filter(
    (name) => !String(process.env[name] || '').trim()
  );
  if (missing.length) {
    console.error(
      `[paymob] cannot start a card payment: set PAYMOB_SECRET_KEY + PAYMOB_PUBLIC_KEY + PAYMOB_INTEGRATION_ID (or ${missing.join(', ')})`
    );
    const err = new Error('Card payment is not set up yet. Please try again later.');
    err.status = 503;
    throw err;
  }
  const priced = await amountForPaymob(amount, currency, tenantId);
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

  const keyRes = await requestJson('POST', `${PAYMOB_BASE}/acceptance/payment_keys`, {
    auth_token: token,
    amount_cents: amountCents,
    expiration: 3600,
    order_id: orderRes.data.id,
    billing_data: paymobBilling(billing),
    currency: priced.chargeCurrency,
    integration_id: Number(String(process.env.PAYMOB_INTEGRATION_ID).trim()),
  });
  if (keyRes.status >= 400 || !keyRes.data?.token) {
    throw new Error(`Paymob payment key failed: ${JSON.stringify(keyRes.data)}`);
  }

  const paymentKey = keyRes.data.token;
  const iframeId = encodeURIComponent(String(process.env.PAYMOB_IFRAME_ID).trim());
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
async function initializeMockEmbedded({ amount, merchantOrderId, currency = SITE_CURRENCY, tenantId }) {
  let priced = null;
  try {
    priced = await amountForPaymob(amount, currency, tenantId);
  } catch (err) {
    console.warn('[payment] Kwentra exchange rate unavailable:', err.message);
  }
  const displayCurrency = String(currency || SITE_CURRENCY).toUpperCase();
  return {
    provider: 'mock',
    mode: 'embedded_mock',
    amountCents: priced ? Math.round(Number(priced.chargeAmount) * 100) : Math.round(Number(amount) * 100),
    currency: priced?.chargeCurrency || displayCurrency,
    displayAmount: Number(amount),
    displayCurrency,
    chargeAmount: priced?.chargeAmount ?? null,
    chargeCurrency: priced?.chargeCurrency || null,
    fxRate: priced?.fxRate ?? null,
    converted: Boolean(priced?.converted),
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
async function createPaymentSession({ amount, currency = SITE_CURRENCY, merchantOrderId, billing, tenantId }) {
  const provider = activeProvider();
  const cur = String(currency || SITE_CURRENCY).toUpperCase();
  if (provider === 'paymob') {
    return initializePaymobEmbedded({ amount, currency: cur, merchantOrderId, billing, tenantId });
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
  return initializeMockEmbedded({ amount, merchantOrderId, currency: cur, tenantId });
}

/**
 * Does a gateway's "paid" report cover what this booking was charged? Compared in the smallest unit.
 * Bookings made before the charge was stored have nothing to compare, so they pass.
 */
function paidAmountCovers(booking, { amountCents, currency } = {}) {
  const expected = Number(booking?.chargeAmount);
  if (!(expected > 0)) return { ok: true };
  const expectedCents = Math.round(expected * 100);
  const paidCents = Math.round(Number(amountCents));
  const expectedCurrency = String(booking.chargeCurrency || '').toUpperCase();
  const paidCurrency = String(currency || '').toUpperCase();
  const currencyOk = !expectedCurrency || !paidCurrency || expectedCurrency === paidCurrency;
  const ok = Number.isFinite(paidCents) && paidCents >= expectedCents && currencyOk;
  return {
    ok,
    expected: `${(expectedCents / 100).toFixed(2)} ${expectedCurrency}`.trim(),
    paid: Number.isFinite(paidCents) ? `${(paidCents / 100).toFixed(2)} ${paidCurrency}`.trim() : 'unknown',
  };
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
    'order.id',
    'owner',
    'pending',
    'source_data.pan',
    'source_data.sub_type',
    'source_data.type',
    'success',
  ];
  // The processed callback (POST) nests order and source_data; the response callback (GET)
  // sends them flat ("order", "source_data.pan"). Read either shape.
  const pick = (key) => {
    if (!key.includes('.')) return obj[key];
    const [parent, child] = key.split('.');
    const nested = obj[parent];
    if (nested && typeof nested === 'object') return nested[child];
    if (key in obj) return obj[key];
    return parent === 'order' ? nested : undefined;
  };
  const concat = order.map((k) => String(pick(k) ?? '')).join('');
  const calc = crypto.createHmac('sha512', secret).update(concat).digest('hex');
  const a = Buffer.from(calc);
  const b = Buffer.from(String(receivedHmac).toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  activeProvider,
  isPaymobConfigured,
  isPaymobCheckoutConfigured,
  isStripeConfigured,
  createPaymentSession,
  verifyPaymobHmac,
  initializePaymobEmbedded,
  initializeStripeEmbedded,
  initializeMockEmbedded,
  paidAmountCovers,
  paymobChargeCurrency,
  SITE_CURRENCY,
};
