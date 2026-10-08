/**
 * CMS data access — Postgres when DATABASE_URL is set, otherwise local JSON (dev fallback).
 */
const { isDatabaseConfigured } = require('../config/database');
const json = require('./jsonCms');
const pg = require('./postgresCms');
const { withCompleteness, isLive } = require('./unitCompleteness');
const { setBrandNames } = require('../data/inventory');

// Development only: an unreachable database falls back to the local JSON store instead of failing every request
let databaseUnavailable = false;

function backend() {
  return isDatabaseConfigured() && !databaseUnavailable ? pg : json;
}

const decorate = (unit) => withCompleteness(unit);
const decorateAll = (units) => (Array.isArray(units) ? units.map(withCompleteness) : units);

/** Guests only ever see units that are published and pass the completeness check */
async function getPublicUnits(opts = {}) {
  const units = await backend().getPublicUnits(opts);
  const list = opts.publishedOnly === false ? units : units.filter(isLive);
  return decorateAll(list);
}

async function getDashboard(...args) {
  const [dashboard, units] = await Promise.all([backend().getDashboard(...args), backend().listUnits()]);
  const checked = decorateAll(units);
  dashboard.counts = {
    ...dashboard.counts,
    publishedUnits: checked.filter((u) => u.live).length,
    incompleteUnits: checked.filter((u) => !u.completeness.complete).length,
  };
  return dashboard;
}

function rememberBrands(site) {
  setBrandNames((site?.brands?.items || []).map((b) => b.name));
  return site;
}

async function getSite(...args) {
  return rememberBrands(await backend().getSite(...args));
}

async function saveSite(...args) {
  return rememberBrands(await backend().saveSite(...args));
}

function usingDatabase() {
  return isDatabaseConfigured() && !databaseUnavailable;
}

function connectionHint(err) {
  const code = err.code || err.cause?.code;
  if (['ENOTFOUND', 'ENOENT', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code)) {
    return 'Host unreachable. Supabase direct hosts (db.<ref>.supabase.co) are IPv6-only — on an IPv4 network use the Session pooler connection string from Supabase › Connect.';
  }
  if (code === '28P01') return 'Wrong database password in DATABASE_URL.';
  if (code === 'ETIMEDOUT') return 'Connection timed out — check the host/port in DATABASE_URL and your firewall.';
  return '';
}

async function ensureReady() {
  await prepareStore();
  await getSite().catch(() => {});
}

async function prepareStore() {
  if (isDatabaseConfigured()) {
    try {
      if (process.env.DATABASE_AUTO_MIGRATE !== 'false') await pg.applySchema();
      const local = json.exportStore();
      const result = await pg.seedIfEmpty(local);
      if (result.seeded) {
        console.log(`[prime] Empty database — copied ${result.source === 'local' ? 'data/cms-store.json' : 'demo inventory'} into Postgres`);
      }
      console.log('[prime] Using Postgres (DATABASE_URL)');
      return;
    } catch (err) {
      console.error('[prime] Postgres connection/setup failed:', err.message);
      const hint = connectionHint(err);
      if (hint) console.error(`[prime] ${hint}`);
      if (process.env.NODE_ENV === 'production') return;
      databaseUnavailable = true;
    }
  }
  json.ensureStore();
  json.recountUnits();
  console.warn(
    databaseUnavailable
      ? '[prime] Development: using the local JSON store (data/cms-store.json) until DATABASE_URL works.'
      : '[prime] DATABASE_URL not set — using local JSON store (data/cms-store.json).'
  );
}

module.exports = {
  usingDatabase,
  ensureReady,
  sortBy: (...args) => backend().sortBy(...args),
  slugify: (...args) => backend().slugify(...args),
  newId: (...args) => backend().newId(...args),
  getDashboard,
  getPublicUnits,
  getPublicCompounds: (...args) => backend().getPublicCompounds(...args),
  getPublicDestinations: (...args) => backend().getPublicDestinations(...args),
  getSlideshow: (...args) => backend().getSlideshow(...args),
  getSettings: (...args) => backend().getSettings(...args),
  getContent: (...args) => backend().getContent(...args),
  saveContent: (...args) => backend().saveContent(...args),
  getSite,
  saveSite,
  findUnit: async (...args) => decorate(await backend().findUnit(...args)),
  findCompound: (...args) => backend().findCompound(...args),
  findDestination: (...args) => backend().findDestination(...args),
  listDestinations: (...args) => backend().listDestinations(...args),
  createDestination: (...args) => backend().createDestination(...args),
  updateDestination: (...args) => backend().updateDestination(...args),
  deleteDestination: (...args) => backend().deleteDestination(...args),
  reorderDestinations: (...args) => backend().reorderDestinations(...args),
  listCompounds: (...args) => backend().listCompounds(...args),
  listUnits: async (...args) => decorateAll(await backend().listUnits(...args)),
  listSlides: (...args) => backend().listSlides(...args),
  createSlide: (...args) => backend().createSlide(...args),
  updateSlide: (...args) => backend().updateSlide(...args),
  deleteSlide: (...args) => backend().deleteSlide(...args),
  reorderSlides: (...args) => backend().reorderSlides(...args),
  createCompound: (...args) => backend().createCompound(...args),
  updateCompound: (...args) => backend().updateCompound(...args),
  deleteCompound: (...args) => backend().deleteCompound(...args),
  reorderCompounds: (...args) => backend().reorderCompounds(...args),
  createUnit: async (...args) => decorate(await backend().createUnit(...args)),
  updateUnit: async (...args) => decorate(await backend().updateUnit(...args)),
  deleteUnit: async (...args) => decorateAll(await backend().deleteUnit(...args)),
  reorderHomeUnits: async (...args) => decorateAll(await backend().reorderHomeUnits(...args)),
  reorderSearchUnits: async (...args) => decorateAll(await backend().reorderSearchUnits(...args)),
  saveSettings: (...args) => backend().saveSettings(...args),
  nextVoucherSerial: (...args) => backend().nextVoucherSerial(...args),
  createBooking: (...args) => backend().createBooking(...args),
  updateBooking: (...args) => backend().updateBooking(...args),
  listBookings: (...args) => backend().listBookings(...args),
  findBooking: (...args) => backend().findBooking(...args),
};
