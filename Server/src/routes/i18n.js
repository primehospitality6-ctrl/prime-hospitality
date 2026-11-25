const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { translateTexts, MAX_TEXT } = require('../services/translationService');

const router = Router();

// The website asks for a page's worth of text at a time; this keeps it from being a free translator for others.
router.use(
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const MAX_TEXTS = 200;
const MAX_CHARS = 40000;

/**
 * POST /api/i18n/translate { to: 'ar' | 'en', texts: string[] } → { translations: string[] }
 * Each translation lines up with its text; a text that needs no translation comes back unchanged.
 */
router.post('/translate', async (req, res, next) => {
  try {
    const to = String(req.body?.to || '').toLowerCase();
    const texts = Array.isArray(req.body?.texts) ? req.body.texts : null;
    if (!['ar', 'en'].includes(to) || !texts) return res.status(400).json({ error: 'Send { to: "ar" | "en", texts: [...] }' });
    if (texts.length > MAX_TEXTS) return res.status(413).json({ error: `At most ${MAX_TEXTS} texts per request` });
    const list = texts.map((t) => String(t ?? '').slice(0, MAX_TEXT));
    if (list.reduce((n, t) => n + t.length, 0) > MAX_CHARS) return res.status(413).json({ error: 'Too much text in one request' });
    const translations = await translateTexts(list, to);
    res.set('Cache-Control', 'no-store');
    res.json({ to, translations });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
