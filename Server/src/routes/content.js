const { Router } = require('express');
const { getContent, getSlideshow, getSettings, getSite } = require('../lib/cmsStore');
const { UNIT_TYPES } = require('../data/inventory');
const { publicSite } = require('../lib/siteContent');
const defaults = require('../data/mock');

/** Items saved before Arabic existed pick up the built-in Arabic when their English is still the default */
function withDefaultArabic(items, builtIn, enKey, arKeys) {
  const byEnglish = new Map(builtIn.map((d) => [d[enKey], d]));
  return items.map((item) => {
    const d = byEnglish.get(item[enKey]);
    if (!d || arKeys.every((k) => item[k])) return item;
    return { ...item, ...Object.fromEntries(arKeys.map((k) => [k, item[k] || d[k] || ''])) };
  });
}

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get(
  '/meta',
  wrap(async (_req, res) => {
    const [{ propertyTypes }, site] = await Promise.all([getContent(), getSite()]);
    res.json({ propertyTypes: propertyTypes || [], unitTypes: UNIT_TYPES, brands: site.brands.items.map((b) => b.name) });
  })
);

router.get(
  '/partners',
  wrap(async (_req, res) => {
    const { partners } = await getContent();
    res.json({ items: partners || [] });
  })
);

router.get(
  '/trust',
  wrap(async (_req, res) => {
    const { trustPoints } = await getContent();
    res.json({ items: withDefaultArabic(trustPoints || [], defaults.trustPoints, 'title', ['titleAr', 'bodyAr']) });
  })
);

router.get(
  '/faqs',
  wrap(async (_req, res) => {
    const { faqs } = await getContent();
    res.json({ items: withDefaultArabic(faqs || [], defaults.faqs, 'q', ['qAr', 'aAr']) });
  })
);

router.get(
  '/slideshow',
  wrap(async (_req, res) => {
    res.json({ items: await getSlideshow() });
  })
);

/** Website content document — guest-facing sections only */
router.get(
  '/site',
  wrap(async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ site: publicSite(await getSite()) });
  })
);

router.get(
  '/pixels',
  wrap(async (_req, res) => {
    const [s, site] = await Promise.all([getSettings(), getSite()]);
    res.json({
      metaPixelId: s.metaPixelId || '',
      facebookPixelId: s.facebookPixelId || s.metaPixelId || '',
      googleAdsId: s.googleAdsId || '',
      gtmId: s.gtmId || '',
      ga4Id: site.tracking.ga4Id || '',
    });
  })
);

module.exports = router;
