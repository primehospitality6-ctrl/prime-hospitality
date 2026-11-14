const crypto = require('crypto');
const { Router } = require('express');
const payment = require('../services/paymentService');
const kwentra = require('../services/kwentraService');
const sync = require('../services/kwentraSync');
const emailService = require('../services/emailService');
const { listBookings, updateBooking, findBooking } = require('../lib/cmsStore');

const router = Router();

async function markPaidAndPush(booking, { provider, transactionId, merchantOrderId, cardLast4, cardType, paidCents, paidCurrency, paidIntegrationId }) {
  if (!booking) return null;
  if (booking.paymentStatus === 'paid') return { pushed: false, reason: 'already_paid' };
  if (paidCents !== undefined) {
    const check = payment.paidAmountCovers(booking, { amountCents: paidCents, currency: paidCurrency });
    if (!check.ok) {
      const issue = `${provider} reported a payment of ${check.paid} (ref ${transactionId || 'n/a'}) but this booking was charged ${check.expected}. It was NOT confirmed or sent to Kwentra — check the payment in the ${provider} dashboard.`;
      console.error(`[payment] amount mismatch on booking ${booking.voucherNumber || booking.id}: ${issue}`);
      await updateBooking(booking.id, { kwentraIssue: issue });
      return { pushed: false, reason: 'amount_mismatch', issue };
    }
  }
  const paidPatch = {
    status: 'confirmed',
    paymentStatus: 'paid',
    paymentTransactionId: transactionId != null ? String(transactionId) : null,
    paidIntegrationId: paidIntegrationId != null && paidIntegrationId !== '' ? String(paidIntegrationId) : null,
  };
  await updateBooking(booking.id, paidPatch);
  Object.assign(booking, paidPatch);
  const confirmed = (await findBooking(booking.id).catch(() => null)) || { ...booking };
  emailService.sendBookingConfirmation(confirmed).catch((err) => {
    console.warn('[email] confirmation failed:', err.message);
  });
  if (!kwentra.isConfigured()) return { pushed: false, reason: 'not_configured' };
  let result;
  try {
    result = await sync.pushPaidBooking(booking, {
      amount: booking.rateAmount ?? booking.amount,
      currency: booking.rateCurrency || booking.currency || 'USD',
      merchantOrderId: merchantOrderId || booking.externalRef,
      provider,
      transactionId,
      cardLast4,
      cardType,
      paidIntegrationId,
    });
  } catch (err) {
    // The booking is already marked paid, so a retry from the gateway would skip Kwentra.
    // Record the failure where staff will see it instead of losing it.
    console.error('[kwentra] paid booking push failed:', err.message);
    result = {
      pushed: false,
      errors: [err.message],
      issue: `Guest paid online (${provider}${transactionId ? ` ref ${transactionId}` : ''}) but sending it to Kwentra failed (${err.message}). Create the reservation and post the payment in Kwentra by hand.`,
    };
  }
  await sync.recordPaymentResult(booking, result);
  return result;
}

router.post('/paymob', async (req, res, next) => {
  try {
    const obj = req.body?.obj || req.body || {};
    const hmac = req.query.hmac || req.body?.hmac || req.headers['x-paymob-hmac'];
    if (process.env.PAYMOB_HMAC_SECRET) {
      if (!payment.verifyPaymobHmac(obj, hmac)) {
        console.warn('[webhook/paymob] rejected: HMAC does not match PAYMOB_HMAC_SECRET');
        return res.status(401).json({ error: 'Invalid Paymob HMAC' });
      }
    } else if (payment.isHosted()) {
      // Without the secret anyone could post a fake "paid" callback and confirm a stay in Kwentra.
      console.error('[webhook/paymob] rejected: PAYMOB_HMAC_SECRET is not set');
      return res.status(503).json({ error: 'PAYMOB_HMAC_SECRET is not configured' });
    }

    const merchantOrderId = obj.order?.merchant_order_id || obj.merchant_order_id;
    const settled = payment.paymobPaymentSettled(obj);
    if (!settled.ok || !merchantOrderId) {
      if (merchantOrderId && (obj.success === true || obj.success === 'true')) {
        console.warn(`[webhook/paymob] ${merchantOrderId} not confirmed: ${settled.reason}`);
      }
      const failed = obj.success === false || obj.success === 'false';
      const pendingNow = obj.pending === true || obj.pending === 'true';
      if (merchantOrderId && failed && !pendingNow) {
        const all = await listBookings();
        const booking = all.find((b) => b.externalRef === merchantOrderId);
        await payment.closeUnpaidBooking(booking, 'failed', `Paymob declined (${obj.data?.message || 'no reason given'})`);
      }
      return res.json({ received: true, handled: false, reason: settled.reason || 'no order reference' });
    }

    const all = await listBookings();
    const booking = all.find((b) => b.externalRef === merchantOrderId);
    const kwentraPayment = await markPaidAndPush(booking, {
      provider: 'paymob',
      transactionId: obj.id,
      merchantOrderId,
      cardLast4: String(obj.source_data?.pan || '').slice(-4),
      cardType: obj.source_data?.sub_type,
      paidCents: obj.amount_cents,
      paidCurrency: obj.currency,
      paidIntegrationId: obj.integration_id,
    });

    res.json({ received: true, handled: true, merchantOrderId, kwentraPayment });
  } catch (err) {
    next(err);
  }
});

/**
 * Paymob "Transaction response callback" — after the card step the Paymob iframe navigates here,
 * inside the payment popup. The page tells the website (window.parent) how it went, so the popup
 * can react at once. The server-side processed callback above stays the source of truth; this also
 * confirms the booking when its signature checks out, in case that callback is slow or missing.
 */
router.get('/paymob/response', async (req, res) => {
  const q = req.query || {};
  const merchantOrderId = String(q.merchant_order_id || '');
  const signed = Boolean(process.env.PAYMOB_HMAC_SECRET) && payment.verifyPaymobHmac(q, q.hmac);
  const settled = signed ? payment.paymobPaymentSettled(q) : { ok: false };
  const success = signed && settled.ok;
  if (signed && String(q.success) === 'true' && !settled.ok) {
    console.warn(`[webhook/paymob/response] ${merchantOrderId} not confirmed: ${settled.reason}`);
  }
  const pending = signed && String(q.pending) === 'true';
  if (signed && merchantOrderId && String(q.success) === 'false' && !pending) {
    try {
      const all = await listBookings();
      const booking = all.find((b) => b.externalRef === merchantOrderId);
      await payment.closeUnpaidBooking(booking, 'failed', `Paymob declined (${q['data.message'] || 'no reason given'})`);
    } catch (err) {
      console.warn('[webhook/paymob/response] could not mark the booking failed:', err.message);
    }
  }

  if (success && merchantOrderId) {
    try {
      const all = await listBookings();
      const booking = all.find((b) => b.externalRef === merchantOrderId);
      await markPaidAndPush(booking, {
        provider: 'paymob',
        transactionId: q.id,
        merchantOrderId,
        cardLast4: String(q['source_data.pan'] || '').slice(-4),
        cardType: q['source_data.sub_type'],
        paidCents: q.amount_cents,
        paidCurrency: q.currency,
        paidIntegrationId: q.integration_id,
      });
    } catch (err) {
      console.warn('[webhook/paymob/response] could not confirm booking:', err.message);
    }
  }

  const status = success ? 'paid' : pending ? 'pending' : signed ? 'declined' : 'unknown';
  const message = String(q['data.message'] || q.message || '').slice(0, 200);
  const payload = JSON.stringify({ source: 'prime-paymob', status, merchantOrderId, message }).replace(/</g, '\\u003c');
  const text = {
    paid: 'Payment received',
    pending: 'Payment is processing',
    declined: 'Payment did not go through',
    unknown: 'Checking your payment',
  }[status];

  // This page is framed by the guest website (another origin) and runs one inline script.
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors *"
  );
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:transparent;font:500 14px/1.5 system-ui,sans-serif;color:#58595b}body{display:grid;place-items:center;text-align:center}</style>
</head><body><p>${text}…</p><script>try{window.parent.postMessage(${payload},'*')}catch(e){}</script></body></html>`);
});

/** Stripe-Signature: t=<time>,v1=<hex>. Signed payload is "<time>.<raw body>", HMAC-SHA256 with the endpoint secret. */
function verifyStripeSignature(req) {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  const header = String(req.headers['stripe-signature'] || '');
  if (!secret || !header || !req.rawBody) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=').map((x) => x.trim())).filter((p) => p.length === 2));
  const time = Number(parts.t);
  if (!time || Math.abs(Date.now() / 1000 - time) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${req.rawBody.toString('utf8')}`).digest('hex');
  const given = header
    .split(',')
    .filter((p) => p.trim().startsWith('v1='))
    .map((p) => p.trim().slice(3));
  return given.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

router.post('/stripe', async (req, res, next) => {
  try {
    // Only a signed event from Stripe, and only while Stripe is the site's gateway, may confirm a booking.
    if (payment.activeProvider() !== 'stripe' || !verifyStripeSignature(req)) {
      console.warn('[webhook/stripe] rejected: Stripe is not the active gateway or the signature is missing/invalid');
      return res.status(401).json({ error: 'Invalid Stripe signature' });
    }
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
 *   availability → store the notice, then pull each room-type calendar from Kwentra
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

    const action = sync.onKwentraWebhook({ type, tenantId, body });
    res.json({ received: true, type, tenant_id: tenantId, action, reservations });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
