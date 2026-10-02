const { Router } = require('express');
const {
  getDashboard,
  listSlides,
  createSlide,
  updateSlide,
  deleteSlide,
  reorderSlides,
  listDestinations,
  createDestination,
  updateDestination,
  deleteDestination,
  reorderDestinations,
  listBookings,
  listCompounds,
  createCompound,
  updateCompound,
  deleteCompound,
  reorderCompounds,
  listUnits,
  findUnit,
  createUnit,
  updateUnit,
  deleteUnit,
  reorderHomeUnits,
  reorderSearchUnits,
  getSettings,
  saveSettings,
  getContent,
  saveContent,
  getSite,
  saveSite,
  usingDatabase,
} = require('../lib/cmsStore');
const { getAdminCredentials, signAdminToken, requireAdmin } = require('../middleware/adminAuth');
const {
  upload,
  attachCloudinaryUrls,
  setCloudinaryFolder,
  isCloudinaryConfigured,
  FOLDER_SLIDESHOW,
  FOLDER_COMPOUNDS,
  FOLDER_SITE,
} = require('../config/cloudinary');

const router = Router();

const FOLDER_MAP = {
  slideshow: FOLDER_SLIDESHOW,
  compounds: FOLDER_COMPOUNDS,
  destinations: FOLDER_COMPOUNDS,
  site: FOLDER_SITE,
};

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/auth/login', (req, res) => {
  const { username, email, password } = req.body || {};
  const creds = getAdminCredentials();
  if (
    String(username ?? email ?? '')
      .toLowerCase()
      .trim() !== creds.username ||
    String(password || '') !== creds.password
  ) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = signAdminToken({ username: creds.username });
  res.json({
    token,
    user: { username: creds.username, role: 'admin', name: 'Prime Admin' },
  });
});

router.get('/auth/me', requireAdmin, (req, res) => {
  res.json({
    user: { username: req.admin.username || req.admin.email, role: 'admin', name: 'Prime Admin' },
  });
});

router.post(
  '/drive/folder-images',
  requireAdmin,
  wrap(async (req, res) => {
    const { listFolderImages } = require('../lib/googleDrive');
    const url = req.body?.url || req.body?.folderUrl || '';
    const result = await listFolderImages(url);
    res.json(result);
  })
);

router.post(
  '/upload',
  requireAdmin,
  (req, res, next) => {
    const folderKey = String(req.query.folder || req.body?.folder || 'site').toLowerCase();
    if (folderKey === 'units') {
      return res.status(400).json({
        error: 'Unit photos must use a Google Drive folder link — Cloudinary is not used for units.',
      });
    }
    const folder = FOLDER_MAP[folderKey] || FOLDER_SITE;
    setCloudinaryFolder(folder)(req, res, next);
  },
  upload.single('file'),
  attachCloudinaryUrls,
  (req, res) => {
    if (!req.file?.secure_url) {
      return res.status(400).json({
        error: isCloudinaryConfigured()
          ? 'Upload failed'
          : 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.',
      });
    }
    res.status(201).json({
      url: req.file.secure_url,
      public_id: req.file.cloudinary_public_id,
    });
  }
);

router.get(
  '/dashboard',
  requireAdmin,
  wrap(async (_req, res) => {
    const dash = await getDashboard();
    res.json({
      ...dash,
      cloudinaryConfigured: isCloudinaryConfigured(),
      databaseConfigured: usingDatabase(),
      storage: {
        database: usingDatabase() ? 'postgres' : 'json',
        unitPhotos: 'google-drive',
        otherPhotos: 'cloudinary',
      },
    });
  })
);

/* ——— Slideshow (Cloudinary images) ——— */
router.get(
  '/slideshow',
  requireAdmin,
  wrap(async (_req, res) => {
    res.json({ items: await listSlides() });
  })
);

router.post(
  '/slideshow',
  requireAdmin,
  wrap(async (req, res) => {
    const { image, alt = '', enabled = true } = req.body || {};
    if (!image) return res.status(400).json({ error: 'image is required' });
    await createSlide({ image, alt, enabled });
    res.status(201).json({ items: await listSlides() });
  })
);

router.patch(
  '/slideshow/reorder',
  requireAdmin,
  wrap(async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    res.json({ items: await reorderSlides(ids) });
  })
);

router.patch(
  '/slideshow/:id',
  requireAdmin,
  wrap(async (req, res) => {
    const { image, alt, enabled } = req.body || {};
    const item = await updateSlide(req.params.id, {
      ...(image !== undefined ? { image } : {}),
      ...(alt !== undefined ? { alt } : {}),
      ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
    });
    if (!item) return res.status(404).json({ error: 'Slide not found' });
    res.json({ item });
  })
);

router.delete(
  '/slideshow/:id',
  requireAdmin,
  wrap(async (req, res) => {
    res.json({ items: await deleteSlide(req.params.id) });
  })
);

/* ——— Destinations (top of the inventory layering) ——— */
router.get(
  '/destinations',
  requireAdmin,
  wrap(async (_req, res) => {
    res.json({ items: await listDestinations() });
  })
);

router.post(
  '/destinations',
  requireAdmin,
  wrap(async (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ error: 'name is required' });
    const item = await createDestination(body);
    res.status(201).json({ item });
  })
);

router.patch(
  '/destinations/reorder',
  requireAdmin,
  wrap(async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    res.json({ items: await reorderDestinations(ids) });
  })
);

router.patch(
  '/destinations/:id',
  requireAdmin,
  wrap(async (req, res) => {
    const item = await updateDestination(req.params.id, req.body || {});
    if (!item) return res.status(404).json({ error: 'Destination not found' });
    res.json({ item });
  })
);

router.delete(
  '/destinations/:id',
  requireAdmin,
  wrap(async (req, res) => {
    res.json({ items: await deleteDestination(req.params.id) });
  })
);

/* ——— Bookings (website booking engine → PMS fields) ——— */
router.get(
  '/bookings',
  requireAdmin,
  wrap(async (_req, res) => {
    const { toPmsRows, PMS_FIELDS } = require('../lib/pms');
    const items = await listBookings();
    res.json({
      fields: PMS_FIELDS,
      items: items.map((b) => ({ ...b, pms: toPmsRows(b) })),
    });
  })
);

/* ——— Properties / compounds (Cloudinary cover images) ——— */
router.get(
  '/compounds',
  requireAdmin,
  wrap(async (_req, res) => {
    res.json({ items: await listCompounds() });
  })
);

router.post(
  '/compounds',
  requireAdmin,
  wrap(async (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ error: 'name is required' });
    const item = await createCompound(body);
    res.status(201).json({ item });
  })
);

router.patch(
  '/compounds/reorder',
  requireAdmin,
  wrap(async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    res.json({ items: await reorderCompounds(ids) });
  })
);

router.patch(
  '/compounds/:id',
  requireAdmin,
  wrap(async (req, res) => {
    const item = await updateCompound(req.params.id, req.body || {});
    if (!item) return res.status(404).json({ error: 'Compound not found' });
    res.json({ item });
  })
);

router.delete(
  '/compounds/:id',
  requireAdmin,
  wrap(async (req, res) => {
    res.json({ items: await deleteCompound(req.params.id) });
  })
);

/* ——— Units (Google Drive galleries) ——— */

/**
 * When a Drive folder link is saved without photos, load them from the folder so the unit
 * can pass the completeness check. Never blocks the save — returns a warning instead.
 */
async function fillDrivePhotos(body, current = null) {
  const url = String(body.driveFolderUrl ?? current?.driveFolderUrl ?? '').trim();
  const currentImages = current?.images || [];
  const images = Array.isArray(body.images) ? body.images : currentImages;
  const folderChanged = body.driveFolderUrl !== undefined && url !== String(current?.driveFolderUrl || '').trim();
  // Photos picked in this save (e.g. "Load photos" in the editor) win over an automatic reload
  const freshPhotos = images.length && JSON.stringify(images) !== JSON.stringify(currentImages);
  if (!url || freshPhotos || (images.length && !folderChanged)) return null;
  try {
    const { listFolderImages } = require('../lib/googleDrive');
    const urls = (await listFolderImages(url)).urls || [];
    if (!urls.length) return 'The Google Drive folder has no photos (or is not shared publicly).';
    body.images = urls;
    return null;
  } catch (err) {
    return `Could not load photos from the Drive folder: ${err.message}`;
  }
}
router.get(
  '/units',
  requireAdmin,
  wrap(async (_req, res) => {
    const units = await listUnits();
    const { sortBy } = require('../lib/cmsStore');
    res.json({
      items: sortBy(units, 'searchOrder'),
      home: sortBy(
        units.filter((u) => u.featured),
        'homeOrder'
      ),
    });
  })
);

router.post(
  '/units',
  requireAdmin,
  wrap(async (req, res) => {
    const body = req.body || {};
    if (!body.title) return res.status(400).json({ error: 'title is required' });
    const photoWarning = await fillDrivePhotos(body);
    const item = await createUnit(body);
    const sync = require('../services/kwentraSync');
    const kw = await sync.pushUnitEdit(item);
    res.status(201).json({ item, kwentra: kw, photoWarning });
  })
);

router.patch(
  '/units/reorder-home',
  requireAdmin,
  wrap(async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    res.json({ items: await reorderHomeUnits(ids) });
  })
);

router.patch(
  '/units/reorder-search',
  requireAdmin,
  wrap(async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    res.json({ items: await reorderSearchUnits(ids) });
  })
);

/** Website-only flags in bulk (visibility / homepage) — nothing that belongs to the PMS */
const BULK_UNIT_FIELDS = ['published', 'featured'];

router.patch(
  '/units/bulk',
  requireAdmin,
  wrap(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 500) : [];
    const patch = Object.fromEntries(
      BULK_UNIT_FIELDS.filter((k) => typeof req.body?.patch?.[k] === 'boolean').map((k) => [k, req.body.patch[k]])
    );
    if (!ids.length || !Object.keys(patch).length) {
      return res.status(400).json({ error: 'ids and a published/featured patch are required' });
    }
    let updated = 0;
    for (const id of ids) {
      if (await updateUnit(id, patch)) updated += 1;
    }
    res.json({ updated });
  })
);

router.patch(
  '/units/:id',
  requireAdmin,
  wrap(async (req, res) => {
    const sync = require('../services/kwentraSync');
    const body = req.body || {};
    const current = await findUnit(req.params.id);
    if (!current) return res.status(404).json({ error: 'Unit not found' });
    const photoWarning = await fillDrivePhotos(body, current);
    const result = await sync.saveUnitWithSync(req.params.id, body);
    if (!result.unit) return res.status(404).json({ error: 'Unit not found' });
    res.json({ item: result.unit, kwentra: result.kwentra, photoWarning });
  })
);

router.delete(
  '/units/:id',
  requireAdmin,
  wrap(async (req, res) => {
    res.json({ items: await deleteUnit(req.params.id) });
  })
);

/* ——— Kwentra sync (PMS → website store) ——— */
router.get(
  '/kwentra/status',
  requireAdmin,
  wrap(async (_req, res) => {
    res.json(await require('../services/kwentraSync').syncStatus());
  })
);

router.post(
  '/kwentra/sync',
  requireAdmin,
  wrap(async (_req, res) => {
    const report = await require('../services/kwentraSync').syncFromKwentra();
    res.status(report.reason === 'not_configured' ? 503 : 200).json(report);
  })
);

router.get(
  '/settings',
  requireAdmin,
  wrap(async (_req, res) => {
    res.json({ settings: await getSettings() });
  })
);

router.put(
  '/settings',
  requireAdmin,
  wrap(async (req, res) => {
    res.json({ settings: await saveSettings(req.body || {}) });
  })
);

/* ——— Website content (pages, homepage, business info, announcement, SEO) ——— */
router.get(
  '/site',
  requireAdmin,
  wrap(async (_req, res) => {
    res.json({ site: await getSite() });
  })
);

router.put(
  '/site',
  requireAdmin,
  wrap(async (req, res) => {
    const body = req.body || {};
    const { SECTIONS } = require('../lib/siteContent');
    if (!SECTIONS.some((k) => body[k] !== undefined)) {
      return res.status(400).json({ error: `Send at least one of: ${SECTIONS.join(', ')}` });
    }
    res.json({ site: await saveSite(body) });
  })
);

/* ——— Guest page lists: FAQs, trust points, partners ——— */
router.get(
  '/content',
  requireAdmin,
  wrap(async (_req, res) => {
    const { faqs = [], trustPoints = [], partners = [] } = await getContent();
    res.json({ content: { faqs, trustPoints, partners } });
  })
);

router.put(
  '/content',
  requireAdmin,
  wrap(async (req, res) => {
    const { faqs = [], trustPoints = [], partners = [] } = await saveContent(req.body || {});
    res.json({ content: { faqs, trustPoints, partners } });
  })
);

module.exports = router;
