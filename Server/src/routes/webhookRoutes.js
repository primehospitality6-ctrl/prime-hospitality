const crypto = require('crypto');
const { Router } = require('express');
const payment = require('../services/paymentService');
const kwentra = require('../services/kwentraService');
const sync = require('../services/kwentraSync');
const { listBookings, updateBooking } = require('../lib/cmsStore');

const router = Router();

async function markPaidAndPush(booking, { provider, transactionId, merchantOrderId, cardLast4, cardType }) {
  if (!booking) return null;
  if (booking.paymentStatus === 'paid') return { pushed: false, reason: 'already_paid' };
  await updateBooking(booking.id, { status: 'confirmed', paymentStatus: 'paid' });
  if (!kwentra.isConfigured()) return { pushed: false, reason: 'not_configured' };
  const result = await sync.pushPaidBooking(booking, {
    amount: booking.rateAmount ?? booking.amount,
    currency: booking.rateCurrency || booking.currency || 'EGP',
    merchantOrderId: merchantOrderId || booking.externalRef,
    provider,
    transactionId,
    cardLast4,
    cardType,
  });
  await sync.recordPaymentResult(booking, result);
  return result;
}

router.post('/paymob', async (req, res, next) => {
  try {
    const obj = req.body?.obj || req.body || {};
    const hmac = req.query.hmac || req.body?.hmac || req.headers['x-paymob-hmac'];
    if (process.env.PAYMOB_HMAC_SECRET && !payment.verifyPaymobHmac(obj, hmac)) {
      return res.status(401).json({ error: 'Invalid Paymob HMAC' });
    }

    const success = obj.success === true || obj.success === 'true';
    const merchantOrderId = obj.order?.merchant_order_id || obj.merchant_order_id;
    if (!success || !merchantOrderId) {
      return res.json({ received: true, handled: false });
    }

    const all = await listBookings();
    const booking = all.find((b) => b.externalRef === merchantOrderId);
    const kwentraPayment = await markPaidAndPush(booking, {
      provider: 'paymob',
      transactionId: obj.id,
      merchantOrderId,
      cardLast4: String(obj.source_data?.pan || '').slice(-4),
      cardType: obj.source_data?.sub_type,
    });

    res.json({ received: true, handled: true, merchantOrderId, kwentraPayment });
  } catch (err) {
    next(err);
  }
});

router.post('/stripe', async (req, res, next) => {
  try {
    const event = req.body;
    if (event?.type === 'payment_intent.succeeded') {
      const merchantOrderId = event.data?.object?.metadata?.merchant_order_id;
      if (merchantOrderId) {
        const all = await listBookings();
        const booking = all.find((b) => b.externalRef === merchantOrderId);
        await markPaidAndPush(booking, {
          provider: 'stripe',
          transactionId: event.data?.object?.id,
          merchantOrderId,
        });
      }
    }
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

const safeEqual = (given, expected) => {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
};

/**
 * Kwentra webhooks authenticate with Basic auth or a token, set by the property's admin in
 * Kwentra (Settings > Integrations > Webhooks). Accepted, whichever is configured here:
 *   KWENTRA_WEBHOOK_USERNAME + KWENTRA_WEBHOOK_PASSWORD → Authorization: Basic …
 *   KWENTRA_WEBHOOK_TOKEN → Authorization: Bearer|Token|JWT …
 *   KWENTRA_WEBHOOK_SECRET → X-Kwentra-Secret header or ?secret=
 * With none configured, calls are only accepted outside production.
 */
function kwentraWebhookAuthorized(req) {
  const user = process.env.KWENTRA_WEBHOOK_USERNAME;
  const pass = process.env.KWENTRA_WEBHOOK_PASSWORD;
  const token = process.env.KWENTRA_WEBHOOK_TOKEN;
  const secret = process.env.KWENTRA_WEBHOOK_SECRET;
  if (!(user && pass) && !token && !secret) return process.env.NODE_ENV !== 'production';

  const header = String(req.headers.authorization || '');
  const [scheme, value = ''] = header.split(/\s+/, 2);
  if (user && pass && /^basic$/i.test(scheme)) {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i > 0 && safeEqual(decoded.slice(0, i), user) && safeEqual(decoded.slice(i + 1), pass)) return true;
  }
  if (token && /^(bearer|token|jwt)$/i.test(scheme) && safeEqual(value, token)) return true;
  if (secret && safeEqual(req.headers['x-kwentra-secret'] || req.headers['x-webhook-secret'] || req.query.secret, secret)) return true;
  return false;
}

/** Kwentra may deliver an event more than once — remember recent event_ids once they were handled */
const seenEvents = new Map();
const alreadySeen = (eventId) => Boolean(eventId) && seenEvents.has(String(eventId));
function rememberEvent(eventId) {
  if (!eventId) return;
  seenEvents.set(String(eventId), Date.now());
  if (seenEvents.size > 2000) seenEvents.delete(seenEvents.keys().next().value);
}

/** A reservation Kwentra cancelled (e.g. an unpaid hold that reached its hold date) → cancel the website booking */
async function applyReservationEvent(body, tenantId = null) {
  const r = body.reservation || body.data || body;
  const id = String(r.id ?? r.reservation_id ?? body.reservation_id ?? '');
  const state = String(r.state?.name || r.state || r.status || r.hold_status || '');
  if (!id || !/cancel/i.test(state)) return { matched: false };
  // Reservation ids are only unique within a tenant
  let booking = null;
  for (const b of await listBookings()) {
    if (String(b.kwentraReservationId || '') !== id) continue;
    if (tenantId == null || String(await sync.tenantForBooking(b)) === String(tenantId)) {
      booking = b;
      break;
    }
  }
  if (!booking || booking.status === 'cancelled') return { matched: Boolean(booking) };
  if (booking.paymentStatus === 'paid') {
    // A paid booking is never cancelled silently — staff decide between rebooking and a refund
    await updateBooking(booking.id, { kwentraIssue: `Kwentra cancelled reservation ${id} although the guest paid — rebook or refund.` });
    return { matched: true, flagged: booking.id };
  }
  await updateBooking(booking.id, { status: 'cancelled' });
  return { matched: true, cancelled: booking.id };
}

/**
 * Kwentra webhooks — POST JSON envelope { event_id, tenant_id, data_type, event_time, data }:
 *   reservation  → data: [{ reservation, postings, accommodation }] — cancellations update website bookings
 *   availability → data: { tenant_id, inventory_counts: [...] }    — drop that tenant's cached availability
 *   rates        → data: { tenant_id, rates: [...] }               — drop cached rates and rate lookups
 * Availability and prices are always read live from Kwentra, so the cache refresh is all that is needed.
 */
router.post('/kwentra', async (req, res, next) => {
  try {
    if (!kwentraWebhookAuthorized(req)) {
      res.set('WWW-Authenticate', 'Basic realm="kwentra-webhook"');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const body = req.body || {};
    const type = String(body.data_type || body.event || body.type || 'change').toLowerCase();
    const tenantId = body.tenant_id ?? body.data?.tenant_id ?? null;
    if (alreadySeen(body.event_id)) return res.json({ received: true, duplicate: true });
    console.log('[webhook/kwentra]', type, `tenant ${tenantId ?? '?'}`, body.event_id || '');

    if (/reserv/.test(type)) {
      kwentra.clearLiveCache(tenantId ?? undefined);
      const items = Array.isArray(body.data) ? body.data : [body.data || body];
      const results = [];
      for (const item of items) results.push(await applyReservationEvent(item || {}, tenantId));
      rememberEvent(body.event_id);
      return res.json({ received: true, type, reservations: results });
    }
    rememberEvent(body.event_id);
    if (/avail/.test(type)) {
      kwentra.clearLiveCache(tenantId ?? undefined);
      return res.json({ received: true, type });
    }
    if (/rate/.test(type)) {
      kwentra.clearLookupCache();
      return res.json({ received: true, type });
    }
    res.json({ received: true, type, sync: sync.requestSync(`kwentra webhook: ${type}`) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
