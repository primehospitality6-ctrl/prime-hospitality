const { Router } = require('express');
const { listBookings, findBooking } = require('../lib/cmsStore');
const { requireAdmin } = require('../middleware/adminAuth');

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get(
  '/',
  requireAdmin,
  wrap(async (_req, res) => {
    res.json({ items: await listBookings() });
  })
);

// There is no POST here: a booking with no payment is not allowed. Every booking goes through
// /api/book-direct and only counts once Paymob confirms the payment.

router.get(
  '/:id',
  wrap(async (req, res) => {
    const booking = await findBooking(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking });
  })
);

module.exports = router;
