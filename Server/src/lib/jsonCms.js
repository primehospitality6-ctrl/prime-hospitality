/**
 * Local JSON CMS (dev fallback when DATABASE_URL is missing).
 * Inventory layering: destinations → compounds (properties) → units (unit types).
 */
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const {
  destinations: seedDestinations,
  compounds: seedCompounds,
  listings: seedListings,
  propertyTypes,
  partners,
  trustPoints,
  faqs,
} = require('../data/mock');
const { brandFromName } = require('../data/inventory');
const { COMPOUND_FIELDS, UNIT_FIELDS, applyFields, defaults, syncCoords } = require('./fields');
const { normalizeSite, mergeSite, sanitizeContentLists } = require('./siteContent');
const { isLive } = require('./unitCompleteness');

const STORE_PATH = path.join(__dirname, '../../data/cms-store.json');
const STORE_VERSION = 2;

const DEFAULT_SLIDESHOW = [
  {
    id: 'slide-1',
    image:
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=85',
    alt: 'Prime stay interior',
    enabled: true,
    sortOrder: 0,
  },
  {
    id: 'slide-2',
    image:
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2200&q=85',
    alt: 'Coastal villa',
    enabled: true,
    sortOrder: 1,
  },
  {
    id: 'slide-3',
    image:
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=2200&q=85',
    alt: 'Living space',
    enabled: true,
    sortOrder: 2,
  },
];

function buildInventorySeed() {
  const destinations = seedDestinations.map((d) => ({ ...d }));
  const compounds = seedCompounds.map((c) => ({ ...c }));
  const units = seedListings.map((l, i) => ({
    ...l,
    published: l.available !== false,
    homeOrder: l.featured ? i : 1000 + i,
    searchOrder: i,
    driveFolderUrl: '',
    kwentraRoomTypeId: l.kwentraRoomTypeId || '',
  }));
  return { destinations, compounds, units };
}

function buildSeed() {
  return {
    version: STORE_VERSION,
    updatedAt: new Date().toISOString(),
    slideshow: DEFAULT_SLIDESHOW,
    ...buildInventorySeed(),
    bookings: [],
    counters: { voucher: 0 },
    settings: {
      metaPixelId: '',
      facebookPixelId: '',
      googleAdsId: '',
      gtmId: '',
    },
    content: { propertyTypes, partners, trustPoints, faqs },
  };
}

/** v1 stores held the old sample compounds/units — swap in the PHMG inventory, keep site settings. */
function migrate(store) {
  if ((store.version || 1) >= STORE_VERSION) return store;
  console.warn('[prime] Migrating cms-store.json to v2 (Destination > Property > Unit Type inventory)');
  return {
    ...store,
    version: STORE_VERSION,
    ...buildInventorySeed(),
    bookings: store.bookings || [],
    counters: store.counters || { voucher: 0 },
    content: { ...(store.content || {}), propertyTypes, trustPoints },
  };
}

function ensureStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(buildSeed(), null, 2), 'utf8');
    return;
  }
  const current = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  if ((current.version || 1) < STORE_VERSION) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(migrate(current), null, 2), 'utf8');
  }
}

function readStore() {
  ensureStore();
  const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  store.destinations = store.destinations || [];
  store.bookings = store.bookings || [];
  store.counters = store.counters || { voucher: 0 };
  return store;
}

function writeStore(data) {
  ensureStore();
  const next = { ...data, updatedAt: new Date().toISOString() };
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
  return next;
}

function updateStore(mutator) {
  return writeStore(mutator(structuredClone(readStore())));
}

function sortBy(arr, key) {
  return [...arr].sort((a, b) => (Number(a[key]) || 0) - (Number(b[key]) || 0));
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function newId(prefix = 'id') {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function applyOrder(items, orderedIds, orderKey) {
  const map = new Map(items.map((item) => [item.id, item]));
  orderedIds.forEach((id, index) => {
    const item = map.get(id);
    if (item) item[orderKey] = index;
  });
  return items;
}

function conflict(message) {
  const err = new Error(message);
  err.status = 409;
  return err;
}

/** Copy destination onto a property (denormalized for fast filtering). */
function linkCompound(compound, destinations) {
  const dest = destinations.find((d) => d.id === compound.destinationId);
  compound.region = dest?.name || compound.region || '';
  compound.brand = compound.brand || brandFromName(compound.name);
}

/** Copy property + destination onto a unit type. */
function linkUnit(unit, compounds) {
  const compound = compounds.find((c) => c.id === unit.compoundId);
  if (!compound) return;
  unit.compound = compound.name;
  unit.brand = compound.brand || '';
  unit.destinationId = compound.destinationId || '';
  unit.destination = compound.region || '';
  unit.region = compound.region || '';
  if (!unit.city) unit.city = compound.city || '';
}

function refreshCounts(store) {
  for (const c of store.compounds) {
    c.unitCount = store.units.filter((u) => u.compoundId === c.id && isLive(u)).length;
  }
}

function recountUnits() {
  const store = readStore();
  const before = store.compounds.map((c) => c.unitCount);
  refreshCounts(store);
  if (store.compounds.some((c, i) => c.unitCount !== before[i])) writeStore(store);
}

async function getDashboard() {
  const store = readStore();
  return {
    counts: {
      destinations: store.destinations.length,
      compounds: store.compounds.length,
      units: store.units.length,
      publishedUnits: store.units.filter((u) => u.published !== false).length,
      featuredUnits: store.units.filter((u) => u.featured).length,
      slides: store.slideshow.length,
      bookings: store.bookings.length,
    },
    updatedAt: store.updatedAt,
  };
}

async function getPublicUnits({ featuredOnly = false, publishedOnly = true } = {}) {
  const { units } = readStore();
  let list = units.filter((u) => (publishedOnly ? u.published !== false : true));
  if (featuredOnly) list = list.filter((u) => u.featured);
  return sortBy(list, featuredOnly ? 'homeOrder' : 'searchOrder');
}

async function getPublicCompounds({ homeOnly = false } = {}) {
  const { compounds } = readStore();
  let list = compounds.filter((c) => c.published !== false);
  if (homeOnly) list = list.filter((c) => c.showOnHome !== false);
  return sortBy(list, 'sortOrder');
}

async function getPublicDestinations({ homeOnly = false } = {}) {
  const { destinations } = readStore();
  let list = destinations.filter((d) => d.published !== false);
  if (homeOnly) list = list.filter((d) => d.showOnHome !== false);
  return sortBy(list, 'sortOrder');
}

async function getSlideshow() {
  const { slideshow } = readStore();
  return sortBy(
    (slideshow || []).filter((s) => s.enabled !== false),
    'sortOrder'
  );
}

async function getSettings() {
  return readStore().settings || {};
}

async function getContent() {
  return readStore().content || buildSeed().content;
}

async function saveContent(body) {
  const store = updateStore((s) => {
    s.content = sanitizeContentLists(body, s.content || buildSeed().content);
    return s;
  });
  return store.content;
}

async function getSite() {
  return normalizeSite(readStore().site);
}

async function saveSite(patch) {
  const store = updateStore((s) => {
    s.site = mergeSite(s.site, patch);
    return s;
  });
  return store.site;
}

async function findUnit(idOrSlug) {
  const { units } = readStore();
  return units.find((u) => u.id === idOrSlug || u.slug === idOrSlug) || null;
}

async function findCompound(id) {
  const { compounds } = readStore();
  return compounds.find((c) => c.id === id) || null;
}

async function findDestination(id) {
  const { destinations } = readStore();
  return destinations.find((d) => d.id === id) || null;
}

async function listDestinations() {
  return sortBy(readStore().destinations || [], 'sortOrder');
}

async function listCompounds() {
  return sortBy(readStore().compounds || [], 'sortOrder');
}

async function listUnits() {
  return sortBy(readStore().units || [], 'searchOrder');
}

async function listSlides() {
  return sortBy(readStore().slideshow || [], 'sortOrder');
}

async function createSlide({ image, alt = '', enabled = true }) {
  const store = updateStore((s) => {
    s.slideshow.push({
      id: newId('slide'),
      image,
      alt,
      enabled: enabled !== false,
      sortOrder: (s.slideshow || []).length,
    });
    return s;
  });
  return store.slideshow[store.slideshow.length - 1];
}

async function updateSlide(id, patch) {
  let item = null;
  updateStore((s) => {
    const slide = (s.slideshow || []).find((x) => x.id === id);
    if (!slide) return s;
    Object.assign(slide, patch);
    item = slide;
    return s;
  });
  return item;
}

async function deleteSlide(id) {
  const store = updateStore((s) => {
    s.slideshow = (s.slideshow || []).filter((x) => x.id !== id);
    s.slideshow.forEach((x, i) => {
      x.sortOrder = i;
    });
    return s;
  });
  return sortBy(store.slideshow, 'sortOrder');
}

async function reorderSlides(ids) {
  const store = updateStore((s) => {
    s.slideshow = applyOrder(s.slideshow || [], ids, 'sortOrder');
    return s;
  });
  return sortBy(store.slideshow, 'sortOrder');
}

/* ——— Destinations ——— */
async function createDestination(body) {
  const id = body.id || slugify(body.name);
  if (await findDestination(id)) throw conflict('Destination id already exists');
  const store = updateStore((s) => {
    s.destinations.push({
      id,
      name: body.name,
      description: body.description || '',
      image: body.image || '',
      sortOrder: s.destinations.length,
      showOnHome: body.showOnHome !== false,
      published: body.published !== false,
      kwentraDestinationId: body.kwentraDestinationId || '',
    });
    return s;
  });
  return store.destinations.find((d) => d.id === id);
}

async function updateDestination(id, body) {
  let item = null;
  updateStore((s) => {
    const found = s.destinations.find((d) => d.id === id);
    if (!found) return s;
    const fields = ['name', 'description', 'image', 'sortOrder', 'showOnHome', 'published', 'kwentraDestinationId'];
    for (const key of fields) {
      if (body?.[key] !== undefined) found[key] = body[key];
    }
    if (body?.name !== undefined) {
      s.compounds.filter((c) => c.destinationId === id).forEach((c) => linkCompound(c, s.destinations));
      s.units.forEach((u) => linkUnit(u, s.compounds));
    }
    item = found;
    return s;
  });
  return item;
}

async function deleteDestination(id) {
  const { compounds } = readStore();
  if (compounds.some((c) => c.destinationId === id)) {
    throw conflict('Move or delete the properties in this destination first');
  }
  const store = updateStore((s) => {
    s.destinations = s.destinations.filter((d) => d.id !== id);
    s.destinations.forEach((d, i) => {
      d.sortOrder = i;
    });
    return s;
  });
  return sortBy(store.destinations, 'sortOrder');
}

async function reorderDestinations(ids) {
  const store = updateStore((s) => {
    s.destinations = applyOrder(s.destinations, ids, 'sortOrder');
    return s;
  });
  return sortBy(store.destinations, 'sortOrder');
}

/* ——— Properties (compounds) ——— */
async function createCompound(body) {
  const id = body.id || slugify(body.name);
  if (await findCompound(id)) throw conflict('Property id already exists');
  const store = updateStore((s) => {
    const compound = {
      id,
      name: body.name,
      brand: body.brand || brandFromName(body.name),
      destinationId: body.destinationId || '',
      region: body.region || '',
      city: body.city || '',
      unitCount: 0,
      image: body.image || '',
      sortOrder: s.compounds.length,
      showOnHome: body.showOnHome !== false,
      published: body.published !== false,
      kwentraProjectId: body.kwentraProjectId || '',
      kwentraDestinationId: body.kwentraDestinationId || '',
      ...defaults(COMPOUND_FIELDS),
    };
    applyFields(compound, body, COMPOUND_FIELDS);
    syncCoords(compound, body);
    linkCompound(compound, s.destinations);
    s.compounds.push(compound);
    return s;
  });
  return store.compounds.find((c) => c.id === id);
}

async function updateCompound(id, body) {
  let item = null;
  updateStore((s) => {
    const found = (s.compounds || []).find((c) => c.id === id);
    if (!found) return s;
    const fields = [
      'name',
      'brand',
      'destinationId',
      'city',
      'image',
      'showOnHome',
      'published',
      'sortOrder',
      'kwentraProjectId',
      'kwentraDestinationId',
    ];
    for (const key of fields) {
      if (body?.[key] !== undefined) found[key] = body[key];
    }
    applyFields(found, body, COMPOUND_FIELDS);
    syncCoords(found, body);
    linkCompound(found, s.destinations);
    s.units.filter((u) => u.compoundId === id).forEach((u) => linkUnit(u, s.compounds));
    item = found;
    return s;
  });
  return item;
}

async function deleteCompound(id) {
  const { units } = readStore();
  if (units.some((u) => u.compoundId === id)) {
    throw conflict('Delete or move the unit types in this property first');
  }
  const store = updateStore((s) => {
    s.compounds = (s.compounds || []).filter((c) => c.id !== id);
    s.compounds.forEach((c, i) => {
      c.sortOrder = i;
    });
    return s;
  });
  return sortBy(store.compounds, 'sortOrder');
}

async function reorderCompounds(ids) {
  const store = updateStore((s) => {
    s.compounds = applyOrder(s.compounds || [], ids, 'sortOrder');
    return s;
  });
  return sortBy(store.compounds, 'sortOrder');
}

/* ——— Unit types (units) ——— */
async function createUnit(body) {
  const slug = body.slug || slugify(body.title);
  if (await findUnit(slug)) throw conflict('Slug already exists');
  let created = null;
  updateStore((s) => {
    const unit = {
      id: newId('unit'),
      slug,
      title: body.title,
      unitType: body.unitType || '',
      compoundId: body.compoundId || '',
      compound: '',
      brand: '',
      destinationId: '',
      destination: '',
      region: '',
      city: body.city || '',
      propertyType: body.propertyType || (body.unitType === 'Studio' ? 'Studio' : 'Apartment'),
      bedrooms: Number(body.bedrooms) || 0,
      bathrooms: Number(body.bathrooms) || 1,
      areaSqm: Number(body.areaSqm) || 0,
      maxGuests: Number(body.maxGuests) || 2,
      pricePerNight: Number(body.pricePerNight) || 0,
      currency: body.currency || 'EGP',
      featured: Boolean(body.featured),
      available: body.available !== false,
      published: body.published !== false,
      amenities: Array.isArray(body.amenities) ? body.amenities : [],
      facilities: Array.isArray(body.facilities) ? body.facilities : [],
      description: body.description || '',
      images: Array.isArray(body.images) ? body.images : [],
      driveFolderUrl: body.driveFolderUrl || '',
      kwentraRoomTypeId: body.kwentraRoomTypeId || '',
      homeOrder: Number.isFinite(Number(body.homeOrder)) ? Number(body.homeOrder) : 999,
      searchOrder: s.units.length,
      averageRating: body.averageRating || 0,
      reviewCount: body.reviewCount || 0,
      reviews: Array.isArray(body.reviews) ? body.reviews : [],
      ...defaults(UNIT_FIELDS),
    };
    applyFields(unit, body, UNIT_FIELDS);
    linkUnit(unit, s.compounds);
    s.units.push(unit);
    refreshCounts(s);
    created = unit;
    return s;
  });
  return created;
}

async function updateUnit(idOrSlug, body) {
  let item = null;
  updateStore((s) => {
    const found = (s.units || []).find((u) => u.id === idOrSlug || u.slug === idOrSlug);
    if (!found) return s;
    const scalar = [
      'title',
      'slug',
      'unitType',
      'compoundId',
      'city',
      'propertyType',
      'currency',
      'description',
      'featured',
      'available',
      'published',
      'homeOrder',
      'searchOrder',
      'driveFolderUrl',
      'kwentraRoomTypeId',
    ];
    for (const key of scalar) {
      if (body[key] !== undefined) found[key] = body[key];
    }
    ['bedrooms', 'bathrooms', 'areaSqm', 'maxGuests', 'pricePerNight'].forEach((key) => {
      if (body[key] !== undefined) found[key] = Number(body[key]) || 0;
    });
    if (Array.isArray(body.amenities)) found.amenities = body.amenities;
    if (Array.isArray(body.facilities)) found.facilities = body.facilities;
    if (Array.isArray(body.images)) found.images = body.images;
    applyFields(found, body, UNIT_FIELDS);
    linkUnit(found, s.compounds);
    refreshCounts(s);
    item = found;
    return s;
  });
  return item;
}

async function deleteUnit(idOrSlug) {
  const store = updateStore((s) => {
    s.units = (s.units || []).filter((u) => u.id !== idOrSlug && u.slug !== idOrSlug);
    s.units.forEach((u, i) => {
      u.searchOrder = i;
    });
    refreshCounts(s);
    return s;
  });
  return sortBy(store.units, 'searchOrder');
}

async function reorderHomeUnits(ids) {
  const store = updateStore((s) => {
    s.units = applyOrder(s.units || [], ids, 'homeOrder');
    return s;
  });
  return sortBy(
    store.units.filter((u) => u.featured),
    'homeOrder'
  );
}

async function reorderSearchUnits(ids) {
  const store = updateStore((s) => {
    s.units = applyOrder(s.units || [], ids, 'searchOrder');
    return s;
  });
  return sortBy(store.units, 'searchOrder');
}

async function saveSettings(body) {
  const store = updateStore((s) => {
    s.settings = {
      ...(s.settings || {}),
      metaPixelId: String(body.metaPixelId ?? s.settings?.metaPixelId ?? ''),
      facebookPixelId: String(body.facebookPixelId ?? s.settings?.facebookPixelId ?? ''),
      googleAdsId: String(body.googleAdsId ?? s.settings?.googleAdsId ?? ''),
      gtmId: String(body.gtmId ?? s.settings?.gtmId ?? ''),
    };
    return s;
  });
  return store.settings;
}

/* ——— Bookings ——— */
async function nextVoucherSerial() {
  let serial = 0;
  updateStore((s) => {
    s.counters.voucher = (Number(s.counters.voucher) || 0) + 1;
    serial = s.counters.voucher;
    return s;
  });
  return serial;
}

async function createBooking(booking) {
  updateStore((s) => {
    s.bookings.unshift(booking);
    return s;
  });
  return booking;
}

async function updateBooking(id, patch) {
  let item = null;
  updateStore((s) => {
    const found = s.bookings.find((b) => b.id === id);
    if (!found) return s;
    Object.assign(found, patch);
    item = found;
    return s;
  });
  return item;
}

async function listBookings() {
  return readStore().bookings;
}

async function findBooking(id) {
  return readStore().bookings.find((b) => b.id === id || b.voucherNumber === id) || null;
}

/** Whole local store, or null when it was never created (used to fill an empty Postgres). */
function exportStore() {
  return fs.existsSync(STORE_PATH) ? readStore() : null;
}

module.exports = {
  STORE_PATH,
  ensureStore,
  exportStore,
  recountUnits,
  sortBy,
  slugify,
  newId,
  getDashboard,
  getPublicUnits,
  getPublicCompounds,
  getPublicDestinations,
  getSlideshow,
  getSettings,
  getContent,
  saveContent,
  getSite,
  saveSite,
  findUnit,
  findCompound,
  findDestination,
  listDestinations,
  listCompounds,
  listUnits,
  listSlides,
  createSlide,
  updateSlide,
  deleteSlide,
  reorderSlides,
  createDestination,
  updateDestination,
  deleteDestination,
  reorderDestinations,
  createCompound,
  updateCompound,
  deleteCompound,
  reorderCompounds,
  createUnit,
  updateUnit,
  deleteUnit,
  reorderHomeUnits,
  reorderSearchUnits,
  saveSettings,
  nextVoucherSerial,
  createBooking,
  updateBooking,
  listBookings,
  findBooking,
};
