const { Router } = require('express');
const { getPublicUnits, findUnit, findCompound } = require('../lib/cmsStore');
const { resolveWindow, buildPricing } = require('../lib/mockCalendar');
const sync = require('../services/kwentraSync');
const { publicProperty } = sync;

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Room numbers, Drive links and sync bookkeeping are for staff only */
function publicUnit(unit) {
  const { unitNumbers: _n, kwentraSnapshot: _s, driveFolderUrl: _d, completeness: _c, live: _l, ...rest } = unit;
  return { ...rest, currency: 'USD' };
}

function matchesFilters(listing, params = {}) {
  const { destination, compound, region, city, unitType, propertyType, guests, beds, q, featured } = params;

  if (featured === true || featured === 'true') {
    if (!listing.featured) return false;
  }
  if (destination && listing.destinationId !== destination && listing.destination !== destination) {
    return false;
  }
  if (compound && listing.compoundId !== compound && listing.compound !== compound) {
    return false;
  }
  if (region && listing.region !== region) return false;
  if (city && listing.city !== city) return false;
  if (unitType && listing.unitType !== unitType) return false;
  if (propertyType && propertyType !== 'All' && listing.propertyType !== propertyType) {
    return false;
  }
  if (guests && listing.maxGuests < Number(guests)) return false;
  if (beds) {
    const n = Number(beds);
    if (n >= 5) {
      if (listing.bedrooms < 5) return false;
    } else if (listing.bedrooms < n) {
      return false;
    }
  }
  if (q) {
    const hay = [
      listing.title,
      listing.compound,
      listing.destination,
      listing.city,
      listing.region,
      listing.unitType,
      listing.brand,
    ]
      .join(' ')
      .toLowerCase();
    if (!hay.includes(String(q).toLowerCase())) return false;
  }
  return true;
}

router.get(
  '/',
  wrap(async (req, res) => {
    const featuredOnly = req.query.featured === true || req.query.featured === 'true';
    // Kwentra details reach the store via the background sync, so listings never wait on the PMS
    let items = await getPublicUnits({ featuredOnly, publishedOnly: true });

    items = items.filter((l) => matchesFilters(l, req.query));
    if (featuredOnly) items = items.filter((l) => l.featured);

    const total = items.length;
    const limit = req.query.limit ? Number(req.query.limit) : items.length;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    items = items.slice(offset, offset + limit).map(publicUnit);
    res.json({ items, total });
  })
);

router.get(
  '/:slug/availability',
  wrap(async (req, res) => {
    const item = await findUnit(req.params.slug);
    if (!item?.live) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const { from, to } = resolveWindow(req.query);
    let avail;
    try {
      avail = await sync.blockedNights(item, { from, to });
    } catch (err) {
      console.warn('[availability]', item.slug, err.message);
      avail = { source: 'kwentra-unreachable', blocked: [], checkoutDates: [] };
    }
    res.json({
      id: item.id,
      slug: item.slug,
      source: avail.source,
      from,
      to,
      blocked: (avail.blocked || []).map((b) => (typeof b === 'string' ? { date: b } : b)),
      checkout_dates: avail.checkoutDates || [],
    });
  })
);

router.get(
  '/:slug/pricing',
  wrap(async (req, res) => {
    const item = await findUnit(req.params.slug);
    if (!item?.live) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const { from, to } = resolveWindow(req.query);
    let avail;
    try {
      avail = await sync.pullAvailability(item, {
        from,
        to,
        adults: Number(req.query.adults) || 2,
        children: Number(req.query.children) || 0,
      });
    } catch (err) {
      console.warn('[pricing]', item.slug, err.message);
      avail = { source: 'kwentra-unreachable', prices: {}, currency: 'USD' };
    }
    const { rows } = buildPricing(item, from, to);
    res.json({
      id: item.id,
      slug: item.slug,
      source: avail.source,
      from,
      to,
      currency: 'USD',
      prices: avail.prices || {},
      occupancy: avail.occupancy || {},
      rows,
    });
  })
);

router.get(
  '/:slug',
  wrap(async (req, res) => {
    const item = await findUnit(req.params.slug);
    if (!item?.live) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const compound = item.compoundId ? await findCompound(item.compoundId) : null;
    res.json({ item: { ...publicUnit(item), property: compound ? publicProperty(compound) : null } });
  })
);

module.exports = router;
