const { Router } = require('express');
const { getPublicCompounds, findCompound } = require('../lib/cmsStore');
const { isConfigured } = require('../services/kwentraService');
const sync = require('../services/kwentraSync');

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Projects (Kwentra properties) — formerly compounds-only CMS list */
router.get(
  '/',
  wrap(async (req, res) => {
    const homeOnly = req.query.home === true || req.query.home === 'true';
    if (isConfigured()) {
      const merged = await sync.pullProjectsMerged({ homeOnly });
      return res.json({
        source: merged.source,
        items: merged.items,
        total: merged.total,
        needFromKwentra: merged.needFromKwentra,
      });
    }
    const items = await getPublicCompounds({ homeOnly });
    res.json({ source: 'cms', items, total: items.length });
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    if (isConfigured()) {
      const merged = await sync.pullProjectsMerged({ homeOnly: false });
      const item = (merged.items || []).find(
        (c) => c.id === req.params.id || c.kwentraProjectId === req.params.id
      );
      if (item) return res.json({ source: merged.source, item });
    }
    const item = await findCompound(req.params.id);
    if (!item || item.published === false || require('../services/paymobGate').isHiddenCompound(item.id)) {
      return res.status(404).json({ error: 'Compound not found' });
    }
    res.json({ source: 'cms', item });
  })
);

module.exports = router;
