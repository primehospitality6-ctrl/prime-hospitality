const crypto = require('crypto');
const { Router } = require('express');
const payment = require('../services/paymentService');
const kwentra = require('../services/kwentraService');
const sync = require('../services/kwentraSync');
const emailService = require('../services/emailService');
const { listBookings, updateBooking, findBooking } = require('../lib/cmsStore');

const router = Router();

async function markPaidAndPush(booking, { provider, transactionId, merchantOrderId, cardLast4, cardType }) {
  if (!booking) return null;
  if (booking.paymentStatus === 'paid') return { pushed: false, reason: 'already_paid' };
  await updateBooking(booking.id, { status: 'confirmed', paymentStatus: 'paid' });
  const confirmed = (await findBooking(booking.id).catch(() => null)) || {
    ...booking,
    status: 'confirmed',
    paymentStatus: 'paid',
  };
  emailService.sendBookingConfirmation(confirmed).catch((err) => {
    console.warn('[email] confirmation failed:', err.message);
  });
  if (!kwentra.isConfigured()) return { pushed: false, reason: 'not_configured' };
  const result = await sync.pushPaidBooking(booking, {
    amount: booking.rateAmount ?? booking.amount,
    currency: booking.rateCurrency || booking.currency || 'USD',
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

function websiteStatus(state) {
  const name = String(state || '');
  if (/cancel/i.test(name)) return 'cancelled';
  if (/checked\s*out/i.test(name)) return 'checked_out';
  if (/checked\s*in/i.test(name)) return 'checked_in';
  if (/no\s*show/i.test(name)) return 'no_show';
  if (/expected|confirm/i.test(name)) return 'confirmed';
  return '';
}

const RESERVATION_INCLUDES = [
  'state.name',
  'room_nights.room_number',
  'room_nights.room_type',
  'room_nights.actual_room_type',
];

/** Pull one reservation from Kwentra, update the website booking, and instantly patch blocked nights. */
async function pullReservationEvent(body, tenantId = null) {
  const hinted = body.reservation || (body.data && !Array.isArray(body.data) ? body.data : null) || body;
  const id = String(hinted.id ?? hinted.reservation_id ?? body.reservation_id ?? '');
  if (!id) return { matched: false, reason: 'no_id' };
  let reservation = hinted;
  if (kwentra.isConfigured()) {
    try {
      reservation = await kwentra.getReservation(id, { tenantId, includes: RESERVATION_INCLUDES });
    } catch (err) {
      console.warn('[webhook/kwentra] reservation pull failed:', err.message);
    }
  }
  const state = reservation?.state?.name || reservation?.state || reservation?.status || hinted.state || '';
  const status = websiteStatus(state);
  let booking = null;
  for (const item of await listBookings()) {
    if (String(item.kwentraReservationId || '') !== id) continue;
    if (tenantId == null || String(await sync.tenantForBooking(item)) === String(tenantId)) {
      booking = item;
      break;
    }
  }

  // Always patch the room calendar from the Kwentra reservation — even when there is no website booking.
  const availability = sync.syncReservationAvailability(reservation, tenantId, {
    previousArrival: booking?.arrivalDate || null,
    previousDeparture: booking?.departureDate || null,
  });

  if (!booking) return { matched: false, pulled: true, reservationId: id, status, availability };
  const patch = {};
  if (reservation?.arrival_date) patch.arrivalDate = String(reservation.arrival_date).slice(0, 10);
  if (reservation?.departure_date) patch.departureDate = String(reservation.departure_date).slice(0, 10);
  if (status === 'cancelled' && booking.paymentStatus === 'paid' && booking.status !== 'cancelled') {
    patch.kwentraIssue = `Kwentra cancelled reservation ${id} although the guest paid — rebook or refund.`;
  } else if (status && status !== booking.status) {
    patch.status = status;
    if (status !== 'cancelled') patch.kwentraIssue = '';
  }
  if (!Object.keys(patch).length) return { matched: true, unchanged: booking.id, status, availability };
  await updateBooking(booking.id, patch);
  return { matched: true, updated: booking.id, status: patch.status || booking.status, availability };
}

/**
 * Kwentra webhooks — POST JSON envelope { event_id, tenant_id, data_type, event_time, data }:
 *   reservation  → pull reservation, update website booking, instantly patch blocked nights
 *   availability → pull blocked nights for that tenant
 *   room / room type / inventory → pull units for that tenant
 *   rates → drop cached rate lookups
 * Website bookings push to Kwentra and block calendars immediately.
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
    rememberEvent(body.event_id);

    let reservations;
    if (/reserv/.test(type)) {
      kwentra.clearLiveCache(tenantId ?? undefined);
      const items = Array.isArray(body.data) ? body.data : [body.data || body];
      reservations = [];
      for (const item of items) reservations.push(await pullReservationEvent(item || {}, tenantId));
    }

    const action = sync.onKwentraWebhook({ type, tenantId });
    res.json({ received: true, type, tenant_id: tenantId, action, reservations });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
