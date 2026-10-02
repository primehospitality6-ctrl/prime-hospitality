/**
 * Postgres CMS (DATABASE_URL). Same API as jsonCms.
 * Inventory layering: destinations → compounds (properties) → units (unit types).
 */
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { query, getPool } = require('../config/database');
const {
  destinationFromRow,
  destinationToRow,
  compoundFromRow,
  compoundToRow,
  unitFromRow,
  unitToRow,
  slideFromRow,
  slideToRow,
  settingsFromRow,
  bookingFromRow,
  bookingToRow,
} = require('./mappers');
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
const { isLive } = require('./unitCompleteness');
const { COMPOUND_FIELDS, UNIT_FIELDS, applyFields, defaults, syncCoords } = require('./fields');
const { normalizeSite, mergeSite, sanitizeContentLists } = require('./siteContent');

const SCHEMA_PATH = path.join(__dirname, '../../supabase/schema.sql');

/* ——— SQL helpers (table/column names always come from this file, never from requests) ——— */
const ident = (name) => `"${name}"`;

function param(v) {
  if (v === undefined) return null;
  if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
  return v;
}

async function rows(sql, params, db = { query }) {
  return (await db.query(sql, params)).rows;
}

async function one(sql, params, db = { query }) {
  return (await db.query(sql, params)).rows[0] || null;
}

async function insertRow(table, row, db) {
  const cols = Object.keys(row).filter((k) => row[k] !== undefined);
  const sql = `insert into ${table} (${cols.map(ident).join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning *`;
  return one(sql, cols.map((c) => param(row[c])), db);
}

async function upsertRow(table, row, db) {
  const cols = Object.keys(row).filter((k) => row[k] !== undefined);
  const updates = cols.filter((c) => c !== 'id').map((c) => `${ident(c)} = excluded.${ident(c)}`);
  const sql = `insert into ${table} (${cols.map(ident).join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})
    on conflict (id) do ${updates.length ? `update set ${updates.join(', ')}` : 'nothing'} returning *`;
  return one(sql, cols.map((c) => param(row[c])), db);
}

async function updateRow(table, id, row, db) {
  const cols = Object.keys(row).filter((k) => k !== 'id' && row[k] !== undefined);
  if (!cols.length) return one(`select * from ${table} where id = $1`, [id], db);
  const sets = cols.map((c, i) => `${ident(c)} = $${i + 2}`).join(', ');
  return one(`update ${table} set ${sets} where id = $1 returning *`, [id, ...cols.map((c) => param(row[c]))], db);
}

async function setOrder(table, column, ids, { touch = false } = {}) {
  await query(
    `update ${table} t set ${ident(column)} = o.ord - 1${touch ? ', updated_at = now()' : ''}
     from unnest($1::text[]) with ordinality as o(id, ord) where t.id = o.id`,
    [ids.map(String)]
  );
}

async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function sortBy(arr, key) {
  return [...arr].sort((a, b) => (Number(a[key]) || 0) - (Number(b[key]) || 0));
}

function conflict(message) {
  const err = new Error(message);
  err.status = 409;
  return err;
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

const DEFAULT_SLIDESHOW = [
  {
    id: 'slide-1',
    image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=85',
    alt: 'Prime stay interior',
    enabled: true,
    sortOrder: 0,
  },
  {
    id: 'slide-2',
    image: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdbc?auto=format&fit=crop&w=2200&q=85',
    alt: 'Coastal villa',
    enabled: true,
    sortOrder: 1,
  },
  {
    id: 'slide-3',
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=2200&q=85',
    alt: 'Living space',
    enabled: true,
    sortOrder: 2,
  },
];

function defaultContent() {
  return { propertyTypes, partners, trustPoints, faqs };
}

/* ——— Reads ——— */
async function listDestinations() {
  return (await rows('select * from destinations order by sort_order')).map(destinationFromRow);
}

async function listCompounds() {
  return (await rows('select * from compounds order by sort_order')).map(compoundFromRow);
}

async function listUnits() {
  return (await rows('select * from units order by search_order')).map(unitFromRow);
}

async function listSlides() {
  return (await rows('select * from slideshow_slides order by sort_order')).map(slideFromRow);
}

async function getSettingsRow() {
  return settingsFromRow(await one(`select * from site_settings where id = 'default'`));
}

async function getDashboard() {
  const [units, compounds, destinations, slides, bookings] = await Promise.all([
    listUnits(),
    listCompounds(),
    listDestinations(),
    listSlides(),
    one('select count(*)::int as n from bookings'),
  ]);
  return {
    counts: {
      destinations: destinations.length,
      compounds: compounds.length,
      units: units.length,
      publishedUnits: units.filter((u) => u.published !== false).length,
      featuredUnits: units.filter((u) => u.featured).length,
      slides: slides.length,
      bookings: bookings?.n || 0,
    },
    updatedAt: new Date().toISOString(),
  };
}

async function getPublicUnits({ featuredOnly = false, publishedOnly = true } = {}) {
  const where = [];
  if (publishedOnly) where.push('published = true');
  if (featuredOnly) where.push('featured = true');
  const sql = `select * from units ${where.length ? `where ${where.join(' and ')}` : ''} order by ${featuredOnly ? 'home_order' : 'search_order'}`;
  return (await rows(sql)).map(unitFromRow);
}

async function getPublicCompounds({ homeOnly = false } = {}) {
  const sql = `select * from compounds where published = true ${homeOnly ? 'and show_on_home = true' : ''} order by sort_order`;
  return (await rows(sql)).map(compoundFromRow);
}

async function getPublicDestinations({ homeOnly = false } = {}) {
  const sql = `select * from destinations where published = true ${homeOnly ? 'and show_on_home = true' : ''} order by sort_order`;
  return (await rows(sql)).map(destinationFromRow);
}

async function getSlideshow() {
  return (await rows('select * from slideshow_slides where enabled = true order by sort_order')).map(slideFromRow);
}

async function getSettings() {
  const row = await getSettingsRow();
  return {
    metaPixelId: row.metaPixelId,
    facebookPixelId: row.facebookPixelId,
    googleAdsId: row.googleAdsId,
    gtmId: row.gtmId,
  };
}

async function getContent() {
  const row = await getSettingsRow();
  return row.content && Object.keys(row.content).length ? row.content : defaultContent();
}

async function upsertSettingsColumns(columns) {
  return settingsFromRow(await upsertRow('site_settings', { id: 'default', ...columns, updated_at: new Date().toISOString() }));
}

async function saveContent(body) {
  const current = await getContent();
  const row = await upsertSettingsColumns({ content: sanitizeContentLists(body, current) });
  return row.content;
}

async function getSite() {
  const row = await getSettingsRow();
  return normalizeSite(row.site);
}

async function saveSite(patch) {
  const row = await getSettingsRow();
  const saved = await upsertSettingsColumns({ site: mergeSite(row.site, patch) });
  return normalizeSite(saved.site);
}

async function findUnit(idOrSlug) {
  return unitFromRow(await one('select * from units where id = $1 or slug = $1 order by (id = $1) desc limit 1', [String(idOrSlug)]));
}

async function findCompound(id) {
  return compoundFromRow(await one('select * from compounds where id = $1', [String(id)]));
}

async function findDestination(id) {
  return destinationFromRow(await one('select * from destinations where id = $1', [String(id)]));
}

/** Denormalized copies: property ← destination name, unit type ← property + destination. */
async function linkCompound(compound) {
  const dest = compound.destinationId ? await findDestination(compound.destinationId) : null;
  compound.region = dest?.name || compound.region || '';
  compound.brand = compound.brand || brandFromName(compound.name);
  return compound;
}

async function linkUnit(unit) {
  const compound = unit.compoundId ? await findCompound(unit.compoundId) : null;
  if (!compound) return unit;
  unit.compound = compound.name;
  unit.brand = compound.brand || '';
  unit.destinationId = compound.destinationId || '';
  unit.destination = compound.region || '';
  unit.region = compound.region || '';
  if (!unit.city) unit.city = compound.city || '';
  return unit;
}

async function syncUnitsForCompound(compound) {
  await query(
    `update units set compound = $2, brand = $3, destination_id = $4, destination = $5, region = $5, updated_at = now()
     where compound_id = $1`,
    [compound.id, compound.name, compound.brand || '', compound.destinationId || '', compound.region || '']
  );
}

async function refreshUnitCount(compoundId) {
  if (!compoundId) return;
  const units = (await rows('select * from units where compound_id = $1 and published = true', [compoundId])).map(unitFromRow);
  await query('update compounds set unit_count = $2 where id = $1', [compoundId, units.filter(isLive).length]);
}

/* ——— Destinations CRUD ——— */
async function createDestination(body) {
  const id = body.id || slugify(body.name);
  if (await findDestination(id)) throw conflict('Destination id already exists');
  const all = await listDestinations();
  const item = {
    id,
    name: body.name,
    description: body.description || '',
    image: body.image || '',
    sortOrder: all.length,
    showOnHome: body.showOnHome !== false,
    published: body.published !== false,
    kwentraDestinationId: body.kwentraDestinationId || '',
  };
  return destinationFromRow(await insertRow('destinations', destinationToRow(item)));
}

async function updateDestination(id, body) {
  const current = await findDestination(id);
  if (!current) return null;
  const next = { ...current };
  for (const key of ['name', 'description', 'image', 'sortOrder', 'showOnHome', 'published', 'kwentraDestinationId']) {
    if (body?.[key] !== undefined) next[key] = body[key];
  }
  const row = await updateRow('destinations', id, destinationToRow(next));
  if (body?.name !== undefined) {
    const compounds = (await listCompounds()).filter((c) => c.destinationId === id);
    for (const c of compounds) {
      c.region = next.name;
      await query('update compounds set region = $2 where id = $1', [c.id, next.name]);
      await syncUnitsForCompound(c);
    }
  }
  return destinationFromRow(row);
}

async function deleteDestination(id) {
  const compounds = await listCompounds();
  if (compounds.some((c) => c.destinationId === id)) {
    throw conflict('Move or delete the properties in this destination first');
  }
  await query('delete from destinations where id = $1', [id]);
  const remaining = await listDestinations();
  return reorderDestinations(remaining.map((d) => d.id));
}

async function reorderDestinations(ids) {
  await setOrder('destinations', 'sort_order', ids);
  return listDestinations();
}

/* ——— Slideshow CRUD ——— */
async function createSlide({ image, alt = '', enabled = true }) {
  const slides = await listSlides();
  const item = { id: newId('slide'), image, alt, enabled: enabled !== false, sortOrder: slides.length };
  return slideFromRow(await insertRow('slideshow_slides', slideToRow(item)));
}

async function updateSlide(id, patch) {
  const current = (await listSlides()).find((s) => s.id === id);
  if (!current) return null;
  return slideFromRow(await updateRow('slideshow_slides', id, slideToRow({ ...current, ...patch, id })));
}

async function deleteSlide(id) {
  await query('delete from slideshow_slides where id = $1', [id]);
  const remaining = await listSlides();
  await reorderSlides(remaining.map((s) => s.id));
  return listSlides();
}

async function reorderSlides(ids) {
  await setOrder('slideshow_slides', 'sort_order', ids);
  return listSlides();
}

/* ——— Compounds CRUD ——— */
async function createCompound(body) {
  const id = body.id || slugify(body.name);
  if (await findCompound(id)) throw conflict('Property id already exists');
  const compounds = await listCompounds();
  const item = await linkCompound({
    id,
    name: body.name,
    brand: body.brand || brandFromName(body.name),
    destinationId: body.destinationId || '',
    region: body.region || '',
    city: body.city || '',
    unitCount: 0,
    image: body.image || '',
    sortOrder: compounds.length,
    showOnHome: body.showOnHome !== false,
    published: body.published !== false,
    kwentraProjectId: body.kwentraProjectId || '',
    kwentraDestinationId: body.kwentraDestinationId || '',
    ...syncCoords(applyFields(defaults(COMPOUND_FIELDS), body, COMPOUND_FIELDS), body),
  });
  return compoundFromRow(await insertRow('compounds', compoundToRow(item)));
}

async function updateCompound(id, body) {
  const current = await findCompound(id);
  if (!current) return null;
  const next = { ...current };
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
    if (body?.[key] !== undefined) next[key] = body[key];
  }
  applyFields(next, body, COMPOUND_FIELDS);
  syncCoords(next, body);
  await linkCompound(next);
  const row = await updateRow('compounds', id, compoundToRow(next));
  await syncUnitsForCompound(next);
  return compoundFromRow(row);
}

async function deleteCompound(id) {
  const used = await one('select count(*)::int as n from units where compound_id = $1', [id]);
  if (used?.n) throw conflict('Delete or move the unit types in this property first');
  await query('delete from compounds where id = $1', [id]);
  const remaining = await listCompounds();
  await reorderCompounds(remaining.map((c) => c.id));
  return listCompounds();
}

async function reorderCompounds(ids) {
  await setOrder('compounds', 'sort_order', ids, { touch: true });
  return listCompounds();
}

/* ——— Units CRUD ——— */
async function createUnit(body) {
  const slug = body.slug || slugify(body.title);
  if (await findUnit(slug)) throw conflict('Slug already exists');
  const units = await listUnits();
  const item = {
    id: newId('unit'),
    slug,
    title: body.title,
    unitType: body.unitType || '',
    compoundId: body.compoundId || '',
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
    searchOrder: units.length,
    averageRating: body.averageRating || 0,
    reviewCount: body.reviewCount || 0,
    reviews: Array.isArray(body.reviews) ? body.reviews : [],
    ...applyFields(defaults(UNIT_FIELDS), body, UNIT_FIELDS),
  };
  await linkUnit(item);
  const row = await insertRow('units', unitToRow(item));
  await refreshUnitCount(item.compoundId);
  return unitFromRow(row);
}

async function updateUnit(idOrSlug, body) {
  const current = await findUnit(idOrSlug);
  if (!current) return null;
  const next = { ...current };
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
    if (body[key] !== undefined) next[key] = body[key];
  }
  for (const key of ['bedrooms', 'bathrooms', 'areaSqm', 'maxGuests', 'pricePerNight']) {
    if (body[key] !== undefined) next[key] = Number(body[key]) || 0;
  }
  if (Array.isArray(body.amenities)) next.amenities = body.amenities;
  if (Array.isArray(body.facilities)) next.facilities = body.facilities;
  if (Array.isArray(body.images)) next.images = body.images;
  applyFields(next, body, UNIT_FIELDS);
  await linkUnit(next);
  const row = await updateRow('units', current.id, unitToRow(next));
  await refreshUnitCount(next.compoundId);
  if (current.compoundId !== next.compoundId) await refreshUnitCount(current.compoundId);
  return unitFromRow(row);
}

async function deleteUnit(idOrSlug) {
  const current = await findUnit(idOrSlug);
  if (!current) return listUnits();
  await query('delete from units where id = $1', [current.id]);
  await refreshUnitCount(current.compoundId);
  const remaining = await listUnits();
  await reorderSearchUnits(remaining.map((u) => u.id));
  return listUnits();
}

async function reorderHomeUnits(ids) {
  await setOrder('units', 'home_order', ids, { touch: true });
  const units = await listUnits();
  return sortBy(
    units.filter((u) => u.featured),
    'homeOrder'
  );
}

async function reorderSearchUnits(ids) {
  await setOrder('units', 'search_order', ids, { touch: true });
  return listUnits();
}

async function saveSettings(body) {
  const current = await getSettings();
  const row = await upsertSettingsColumns({
    meta_pixel_id: String(body.metaPixelId ?? current.metaPixelId ?? ''),
    facebook_pixel_id: String(body.facebookPixelId ?? current.facebookPixelId ?? ''),
    google_ads_id: String(body.googleAdsId ?? current.googleAdsId ?? ''),
    gtm_id: String(body.gtmId ?? current.gtmId ?? ''),
  });
  return {
    metaPixelId: row.metaPixelId,
    facebookPixelId: row.facebookPixelId,
    googleAdsId: row.googleAdsId,
    gtmId: row.gtmId,
  };
}

/* ——— Bookings ——— */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function nextVoucherSerial() {
  const row = await one('select next_voucher_serial() as n');
  return Number(row.n);
}

async function createBooking(booking) {
  return bookingFromRow(await insertRow('bookings', bookingToRow(booking)));
}

async function updateBooking(id, patch) {
  const row = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.paymentStatus !== undefined) row.payment_status = patch.paymentStatus;
  if (patch.kwentraReservationId !== undefined) row.kwentra_reservation_id = patch.kwentraReservationId;
  if (!UUID_RE.test(String(id))) return null;
  return bookingFromRow(await updateRow('bookings', id, row));
}

async function listBookings() {
  return (await rows('select * from bookings order by created_at desc')).map(bookingFromRow);
}

async function findBooking(id) {
  const column = UUID_RE.test(String(id)) ? 'id' : 'voucher_number';
  return bookingFromRow(await one(`select * from bookings where ${column} = $1`, [String(id)]));
}

/* ——— Schema + first-run data ——— */
async function applySchema() {
  await query(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

function demoData() {
  return {
    destinations: seedDestinations,
    compounds: seedCompounds.map((c, i) => ({ ...c, sortOrder: i, showOnHome: true, published: true })),
    units: seedListings.map((l, i) => ({
      ...l,
      published: l.available !== false,
      homeOrder: l.featured ? i : 1000 + i,
      searchOrder: i,
      driveFolderUrl: '',
    })),
    slideshow: DEFAULT_SLIDESHOW,
    settings: {},
    content: defaultContent(),
    site: {},
    bookings: [],
    counters: { voucher: 0 },
  };
}

/**
 * First connect to an empty database: copy the local JSON store (admin edits, imported inventory)
 * when it exists, otherwise the demo inventory.
 */
async function seedIfEmpty(localStore = null) {
  const existing = await one('select count(*)::int as n from compounds');
  if (existing?.n) return { seeded: false };
  const data = localStore || demoData();

  await withTransaction(async (tx) => {
    for (const d of data.destinations || []) await upsertRow('destinations', destinationToRow(d), tx);
    const compoundIds = new Set();
    for (const c of data.compounds || []) {
      await upsertRow('compounds', compoundToRow(c), tx);
      compoundIds.add(c.id);
    }
    for (const u of data.units || []) {
      const unit = {
        ...u,
        amenities: u.amenities || [],
        facilities: u.facilities || [],
        reviews: u.reviews || [],
        compoundId: compoundIds.has(u.compoundId) ? u.compoundId : '',
      };
      await upsertRow('units', unitToRow(unit), tx);
    }
    for (const s of data.slideshow?.length ? data.slideshow : DEFAULT_SLIDESHOW) {
      await upsertRow('slideshow_slides', slideToRow(s), tx);
    }
    const settings = data.settings || {};
    await upsertRow(
      'site_settings',
      {
        id: 'default',
        meta_pixel_id: settings.metaPixelId || '',
        facebook_pixel_id: settings.facebookPixelId || '',
        google_ads_id: settings.googleAdsId || '',
        gtm_id: settings.gtmId || '',
        content: data.content && Object.keys(data.content).length ? data.content : defaultContent(),
        site: data.site || {},
        updated_at: new Date().toISOString(),
      },
      tx
    );
    for (const b of data.bookings || []) {
      if (!UUID_RE.test(String(b.id))) continue;
      await upsertRow('bookings', { ...bookingToRow(b), created_at: b.createdAt || undefined }, tx);
    }
    const voucher = Number(data.counters?.voucher) || 0;
    if (voucher > 0) await tx.query('select setval($1, $2)', ['booking_voucher_seq', voucher]);
  });

  return { seeded: true, source: localStore ? 'local' : 'demo' };
}

module.exports = {
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
  applySchema,
  seedIfEmpty,
  DEFAULT_SLIDESHOW,
  defaultContent,
};
