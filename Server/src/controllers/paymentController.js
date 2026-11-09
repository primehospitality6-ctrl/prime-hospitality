const payment = require('../services/paymentService');
const kwentra = require('../services/kwentraService');
const { listBookings } = require('../lib/cmsStore');

/** POST { merchantOrderId } — the guest left without paying. Ends that unpaid booking. */
async function cancelUnpaid(req, res, next) {
  try {
    const merchantOrderId = String(req.body?.merchantOrderId || '').trim();
    if (!merchantOrderId) return res.status(400).json({ error: 'merchantOrderId required' });
    const all = await listBookings();
    const booking = all.find((b) => b.externalRef === merchantOrderId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.paymentStatus === 'paid') return res.json({ ok: true, paymentStatus: 'paid' });
    const closed = await payment.closeUnpaidBooking(booking, 'cancelled', 'the guest left the payment');
    res.json({ ok: true, paymentStatus: closed?.paymentStatus || 'cancelled' });
  } catch (err) {
    next(err);
  }
}

async function getProviderStatus(_req, res) {
  res.json({
    provider: payment.activeProvider(),
    paymob: payment.isPaymobConfigured(),
    stripe: payment.isStripeConfigured(),
    zeroRedirect: true,
  });
}

/**
 * After Paymob iframe succeeds, SPA can poll or we rely on webhook.
 * This endpoint lets the client ask "is this order paid?" without leaving the site.
 */
async function paymentStatus(req, res, next) {
  try {
    const merchantOrderId = req.params.merchantOrderId || req.query.merchantOrderId;
    if (!merchantOrderId) return res.status(400).json({ error: 'merchantOrderId required' });
    const all = await listBookings();
    const booking = all.find((b) => b.externalRef === merchantOrderId) || null;
    res.json({
      merchantOrderId,
      paymentStatus: booking?.paymentStatus || 'unknown',
      bookingStatus: booking?.status || 'unknown',
      bookingId: booking?.id || null,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProviderStatus,
  cancelUnpaid,
  paymentStatus,
};
