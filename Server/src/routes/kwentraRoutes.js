const { Router } = require('express');
const kwentraController = require('../controllers/kwentraController');
const paymentController = require('../controllers/paymentController');
const { requireAdmin } = require('../middleware/adminAuth');

const router = Router();

/**
 * Headless Kwentra gateway — React talks ONLY to these routes.
 * Zero redirects to Kwentra's hosted booking engine.
 */

router.get('/units', kwentraController.getUnits);
router.get('/destinations', async (req, res, next) => {
  try {
    const sync = require('../services/kwentraSync');
    const homeOnly = req.query.home === true || req.query.home === 'true';
    const tree = await sync.pullDestinationsTree({ homeOnly });
    res.json({
      source: tree.source,
      items: tree.destinations,
      projects: tree.projects,
      needFromKwentra: tree.needFromKwentra,
    });
  } catch (err) {
    next(err);
  }
});
router.get('/projects', async (req, res, next) => {
  try {
    const sync = require('../services/kwentraSync');
    const homeOnly = req.query.home === true || req.query.home === 'true';
    const merged = await sync.pullProjectsMerged({ homeOnly });
    res.json(merged);
  } catch (err) {
    next(err);
  }
});
router.get('/reservations', requireAdmin, kwentraController.listReservationsHandler);
router.get('/profiles/:profileId', requireAdmin, kwentraController.getGuestProfileHandler);
router.put('/profiles/:profileId', requireAdmin, kwentraController.updateGuestProfileHandler);
router.post('/guests', requireAdmin, kwentraController.sendGuestHandler);
router.get('/availability', kwentraController.getAvailability);
router.get('/availability/:unitId', kwentraController.getAvailability);
router.post('/quote', kwentraController.getQuote);
router.post('/book-direct', kwentraController.bookDirect);
router.post('/payments/mock-confirm', kwentraController.confirmMockPayment);

router.get('/payments/status', paymentController.getProviderStatus);
router.get('/payments/order/:merchantOrderId', paymentController.paymentStatus);

module.exports = router;
