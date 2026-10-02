const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const unitsRoutes = require('./routes/units');
const compoundsRoutes = require('./routes/compounds');
const contentRoutes = require('./routes/content');
const bookingsRoutes = require('./routes/bookings');
const inquiriesRoutes = require('./routes/inquiries');
const adminRoutes = require('./routes/admin');
const { ensureReady, usingDatabase } = require('./lib/cmsStore');
const { isCloudinaryConfigured } = require('./config/cloudinary');
const { normalizeImageUrls } = require('./lib/googleDrive');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  const origins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (origins.includes('*') || origins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/', (_req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body) => json(normalizeImageUrls(body));
    next();
  });

  app.use(
    '/api/',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 800,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'prime-hospitality-api',
      env: process.env.NODE_ENV || 'development',
      database: usingDatabase() ? 'postgres' : 'json',
      databaseConfigured: usingDatabase(),
      cloudinaryConfigured: isCloudinaryConfigured(),
      unitPhotos: 'google-drive',
      otherPhotos: 'cloudinary',
      kwentra: require('./services/kwentraService').isConfigured(),
      paymentProvider: require('./services/paymentService').activeProvider(),
      zeroRedirect: true,
    });
  });

  app.use('/api/units', unitsRoutes);
  app.use('/api/compounds', compoundsRoutes);
  app.use('/api/properties', compoundsRoutes);
  app.use('/api/destinations', require('./routes/destinations'));
  app.use('/api/booking', require('./routes/booking'));
  app.use('/api/content', contentRoutes);
  app.use('/api/bookings', bookingsRoutes);
  app.use('/api/inquiries', inquiriesRoutes);
  app.use('/api/admin', adminRoutes);

  // Headless Kwentra + on-site payments (zero guest redirects)
  const kwentraRoutes = require('./routes/kwentraRoutes');
  const webhookRoutes = require('./routes/webhookRoutes');
  app.use('/api/kwentra', kwentraRoutes);
  app.use('/api/webhooks', webhookRoutes);
  // Convenience aliases from the integration brief
  app.post('/api/book-direct', require('./controllers/kwentraController').bookDirect);
  app.get('/api/availability', require('./controllers/kwentraController').getAvailability);

  app.get('/api/pms/status', (_req, res) => {
    const kwentra = require('./services/kwentraService');
    const payment = require('./services/paymentService');
    res.json({
      connected: kwentra.isConfigured(),
      provider: 'kwentra',
      paymentProvider: payment.activeProvider(),
      zeroRedirect: true,
      message: kwentra.isConfigured()
        ? 'Kwentra headless API configured'
        : 'Add the Kwentra API credentials and tenant ID to Server/.env when ready',
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

async function bootApp() {
  await ensureReady();
  return createApp();
}

module.exports = { createApp, bootApp };
