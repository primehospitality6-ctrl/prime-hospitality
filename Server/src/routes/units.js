const { Router } = require('express');
const { getPublicUnits, findUnit, findCompound, updateUnit, getSite } = require('../lib/cmsStore');
const { offerIsLive, offerIncludes } = require('../lib/siteContent');
const { resolveWindow, buildPricing } = require('../lib/mockCalendar');
const sync = require('../services/kwentraSync');
const { normalizeOccupancies, occupancyMax } = require('../lib/occupancy');
const { publicProperty } = sync;

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Published catalog. A short memory cache keeps a burst of browsers off Postgres. */
const CATALOG_MS = 15_000;
let catalog = { at: 0, promise: null };

function publicCatalog() {
  if (catalog.promise && Date.now() - catalog.at < CATALOG_MS) return catalog.promise;
  catalog.at = Date.now();
  catalog.promise = getPublicUnits({ publishedOnly: true }).catch((err) => {
    catalog.promise = null;
    catalog.at = 0;
    throw err;
  });
  return catalog.promise;
}

function byOrder(field) {
  return (a, b) => (Number(a[field]) || 0) - (Number(b[field]) || 0);
}

/** Offers running today, cached like the catalog. A site read failure just means no offer badges. */
let offerCache = { at: 0, items: [] };

async function liveOffers() {
  if (Date.now() - offerCache.at >= CATALOG_MS) {
    try {
      const site = await getSite();
      offerCache = { at: Date.now(), items: site?.offers?.items || [] };
    } catch {
      return offerCache.items.filter((o) => offerIsLive(o));
    }
  }
  return offerCache.items.filter((o) => offerIsLive(o));
}

/** The best running offer for a unit, trimmed to what the card shows */
function offerFor(unit, offers) {
  const best = offers.filter((o) => offerIncludes(o, unit)).sort((a, b) => b.percent - a.percent)[0];
  return best ? { id: best.id, name: best.name, percent: best.percent } : null;
}

/** Room numbers, Drive links and sync bookkeeping are for staff only */
function publicUnit(unit, offers = []) {
  const { unitNumbers: _n, kwentraSnapshot: _s, driveFolderUrl: _d, completeness: _c, live: _l, ...rest } = unit;
  return { ...rest, currency: 'USD', offer: offerFor(unit, offers) };
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
  if (guests) {
    const cap = occupancyMax(listing.occupancies) || Number(listing.maxGuests) || 0;
    if (cap < Number(guests)) return false;
  }
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
    let items = [...(await publicCatalog())];
    items.sort(byOrder(featuredOnly ? 'homeOrder' : 'searchOrder'));

    const offers = await liveOffers();
    items = items.filter((l) => matchesFilters(l, req.query));
    if (featuredOnly) items = items.filter((l) => l.featured);
    if (req.query.offer) {
      // An offer that has ended (or never existed) shows no stays rather than everything
      const offer = offers.find((o) => o.id === String(req.query.offer));
      items = offer ? items.filter((l) => offerIncludes(offer, l)) : [];
    }

    const total = items.length;
    const limit = req.query.limit ? Number(req.query.limit) : items.length;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    items = items.slice(offset, offset + limit).map((l) => publicUnit(l, offers));
    res.set('Cache-Control', 'public, max-age=15');
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
    res.set('Cache-Control', 'no-store');
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
    res.set('Cache-Control', 'no-store');
    res.json({
      id: item.id,
      slug: item.slug,
      source: avail.source,
      from,
      to,
      currency: 'USD',
      prices: avail.prices || {},
      occupancy: avail.occupancy || {},
      occupancies: normalizeOccupancies(item.occupancies),
      rows,
    });
  })
);

/** Live adult/child combinations for this room type. Guests may only book one of these. */
router.get(
  '/:slug/occupancy',
  wrap(async (req, res) => {
    const item = await findUnit(req.params.slug);
    if (!item?.live) return res.status(404).json({ error: 'Listing not found' });
    const read = await sync.readOccupancy(item);
    const occupancies = read.occupancies;
    const maxGuests = occupancyMax(occupancies) || item.maxGuests || 2;
    if (read.source === 'kwentra' && JSON.stringify(occupancies) !== JSON.stringify(normalizeOccupancies(item.occupancies))) {
      updateUnit(item.id, { occupancies, maxGuests }).catch((err) => console.warn('[occupancy] save failed', err.message));
    }
    res.set('Cache-Control', 'no-store');
    res.json({ slug: item.slug, source: read.source, occupancies, maxGuests });
  })
);

router.get(
  '/:slug',
  wrap(async (req, res) => {
    const item = await findUnit(req.params.slug);
    if (!item?.live) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const [compound, offers] = await Promise.all([item.compoundId ? findCompound(item.compoundId) : null, liveOffers()]);
    res.json({ item: { ...publicUnit(item, offers), property: compound ? publicProperty(compound) : null } });
  })
);

module.exports = router;
