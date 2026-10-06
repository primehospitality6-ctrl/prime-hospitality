/**
 * Kwentra ↔ Prime orchestration (paths and shapes from the Kwentra API pack — see kwentraService.js).
 *
 * Tenants: each property can carry its own Kwentra tenant ID; units use their property's tenant,
 * falling back to KWENTRA_TENANT_ID for single-hotel setups.
 *
 * PULL (persisted into the CMS store by syncFromKwentra — page views never wait on the PMS):
 *  - Room types → website unit types (name, description, capacity), rooms → unit numbers
 *  - Destinations / properties only when Kwentra provides those APIs (KWENTRA_PATH_DESTINATIONS / _PROJECTS)
 * LIVE:
 *  - Availability (rooms/availability) and nightly prices (rate/v2/totalstay)
 * PUSH:
 *  - Reservations (individualreservation/v2) with a vacant room of the booked type
 *  - Payment confirmation as a billing note (+ KWENTRA_PATH_PAYMENT when Kwentra provides one)
 *
 * Photos, featured, published and ordering always stay website-only.
 */

const kwentra = require('./kwentraService');
const {
  listUnits: listCmsUnits,
  listCompounds: listCmsCompounds,
  listDestinations: listCmsDestinations,
  findUnit,
  updateUnit,
  createUnit,
  createCompound,
  updateCompound,
  createDestination,
  updateDestination,
  updateBooking,
  slugify,
} = require('../lib/cmsStore');
const { brandFromName } = require('../data/inventory');
const { coordsFromMapsUrl } = require('../lib/fields');
const { isLive } = require('../lib/unitCompleteness');
const pms = require('../lib/pms');

const envPath = (name) => String(process.env[name] || '').trim();
const envFlag = (name, fallback = false) => {
  const v = String(process.env[name] ?? '').trim().toLowerCase();
  return v ? v === 'true' || v === '1' || v === 'yes' : fallback;
};

const PRICE_WINDOW_NIGHTS = 92;

/**
 * KWENTRA_HOLD_UNTIL_PAID=true → reserve ON_HOLD at checkout and confirm after payment. Kwentra advises
 * against holds (auto-cancelled at the hold date) unless the property agrees, so the default is off:
 * the reservation is created, confirmed, only after the payment succeeds.
 */
const holdUntilPaid = () => envFlag('KWENTRA_HOLD_UNTIL_PAID');

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ——— Tenants ——— */

/** Kwentra tenant for a unit: its property's tenant, else KWENTRA_TENANT_ID */
async function tenantForUnit(listing, compounds) {
  const list = compounds || (listing?.compoundId ? await listCmsCompounds() : []);
  const compound = list.find((c) => c.id === listing?.compoundId);
  return String(compound?.kwentraTenantId || '').trim() || kwentra.getTenantId();
}

async function tenantForBooking(booking) {
  if (!booking?.propertyId) return kwentra.getTenantId();
  return tenantForUnit({ compoundId: booking.propertyId });
}

/** One sync target per tenant: the properties that use it, plus the default tenant for the rest */
function tenantTargets(compounds) {
  const targets = new Map();
  for (const c of compounds) {
    const tenantId = String(c.kwentraTenantId || '').trim();
    if (!tenantId) continue;
    if (!targets.has(tenantId)) targets.set(tenantId, { tenantId, compounds: [], fallback: false });
    targets.get(tenantId).compounds.push(c);
  }
  const fallback = kwentra.getTenantId();
  if ((fallback && !targets.has(fallback)) || !targets.size) {
    targets.set(fallback, { tenantId: fallback, compounds: [], fallback: true });
  }
  return [...targets.values()];
}

/* ——— Normalizers ——— */

const firstOf = (...values) => values.find((v) => v != null && v !== '');
const nameOf = (v) => (v && typeof v === 'object' ? v.name || v.title || v.description || '' : v || '');
const positive = (v) => (Number(v) > 0 ? Number(v) : undefined);

/** Kwentra lists come as strings, {name} objects, or a delimited string */
function namesList(value) {
  if (Array.isArray(value)) return value.map(nameOf).map((s) => String(s).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\r?\n|,|\s\/\s|\s-\s/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

/** capacity is a number (rooms API) or a {id, code, description} category (roomtype API) */
function capacityOf(value) {
  if (value == null) return undefined;
  if (typeof value !== 'object') return positive(value);
  return positive(value.code) ?? positive(String(value.description || '').match(/\d+/)?.[0]);
}

function normalizeDestination(raw = {}) {
  const id = raw.id ?? raw.destination_id ?? raw.destinationId;
  return {
    kwentraDestinationId: id != null ? String(id) : '',
    name: raw.name || raw.title || raw.destination || `Destination ${id}`,
    description: raw.description || '',
    country: raw.country?.name || raw.country || raw.country_iso || '',
    raw,
  };
}

function normalizeProject(raw = {}) {
  const id = raw.id ?? raw.property_id ?? raw.project_id ?? raw.projectId;
  const destId = raw.destination_id ?? raw.destinationId ?? raw.destination?.id ?? raw.parent_id ?? null;
  const address = raw.address && typeof raw.address === 'object' ? raw.address : null;
  const lat = Number(firstOf(raw.latitude, raw.lat, raw.location?.latitude, address?.latitude));
  const lng = Number(firstOf(raw.longitude, raw.lng, raw.long, raw.location?.longitude, address?.longitude));
  return {
    kwentraProjectId: id != null ? String(id) : '',
    kwentraDestinationId: destId != null ? String(destId) : '',
    name: raw.name || raw.property_name || raw.title || `Project ${id}`,
    region: raw.destination?.name || raw.region || raw.area || '',
    city: nameOf(firstOf(raw.city, address?.city, raw.location)) || '',
    description: raw.description || raw.long_description || '',
    unitCount: Number(raw.unit_count ?? raw.room_count ?? raw.units ?? 0) || 0,
    address: firstOf(address?.street, address?.line1, typeof raw.address === 'string' ? raw.address : '', raw.street) || '',
    buildingNumber: String(firstOf(raw.building_number, raw.building_no, address?.building_number) || ''),
    phone: String(firstOf(raw.phone, raw.telephone, raw.mobile, raw.contact_phone) || ''),
    mapsUrl: firstOf(raw.google_maps, raw.google_maps_url, raw.map_url, raw.maps_url) || '',
    latitude: Number.isFinite(lat) && lat !== 0 ? lat : undefined,
    longitude: Number.isFinite(lng) && lng !== 0 ? lng : undefined,
    facilities: namesList(firstOf(raw.facilities, raw.amenities, raw.services)),
    raw,
  };
}

/** Largest party a room type takes, from its allowed adult/child combinations (roomtypeoccupancy_set) */
function occupancyMax(set) {
  if (!Array.isArray(set) || !set.length) return undefined;
  return positive(Math.max(...set.map((o) => (Number(o?.number_of_adults) || 0) + (Number(o?.number_of_children) || 0))));
}

/**
 * Room type (GET /api/reservation/roomtype/): id, code, room_type, description, capacity, category,
 * room_features [{code, description}], roomtypeoccupancy_set [{number_of_adults, number_of_children}]
 */
function normalizeRoomType(raw = {}) {
  const id = raw.id ?? raw.room_type_id ?? raw.roomTypeId;
  const name = raw.room_type || raw.name || raw.title || raw.description || `Room type ${id}`;
  const rooms = Array.isArray(raw.rooms) ? raw.rooms : null;
  const unitNumbers = rooms
    ? rooms.map((r) => String(r?.room_number ?? r?.number ?? r?.name ?? r ?? '').trim()).filter(Boolean)
    : namesList(raw.room_numbers);
  return {
    kwentraRoomTypeId: id != null ? String(id) : '',
    code: raw.code || '',
    title: name,
    propertyType: nameOf(raw.category) || raw.property_type || undefined,
    bedrooms: positive(raw.bedrooms ?? raw.number_of_bedrooms),
    bathrooms: positive(raw.bathrooms ?? raw.number_of_bathrooms),
    maxGuests:
      positive(raw.max_adults ?? raw.max_guests ?? raw.occupancy ?? raw.max_occupancy) ??
      occupancyMax(raw.roomtypeoccupancy_set) ??
      capacityOf(raw.capacity),
    areaSqm: positive(raw.area_sqm ?? raw.size ?? raw.area),
    description: raw.long_description || (raw.room_type || raw.name ? raw.description : '') || '',
    amenities: namesList(firstOf(raw.room_features, raw.amenities, raw.features, raw.facilities)),
    pricePerNight: positive(raw.rack_rate ?? raw.base_rate ?? raw.price),
    currency: raw.currency?.code || raw.currency_code || (typeof raw.currency === 'string' ? raw.currency : undefined),
    roomCount: positive(raw.number_of_rooms ?? raw.rooms_count ?? raw.room_count ?? raw.inventory) ?? (unitNumbers?.length || undefined),
    unitNumbers: unitNumbers?.length ? unitNumbers : undefined,
    floor: nameOf(firstOf(raw.floor, raw.floor_name)) || undefined,
    bedType: nameOf(firstOf(raw.bed_type, raw.bedding)) || undefined,
    raw,
  };
}

/** Room (GET /api/reservation/room/v2/): id, number, type {id, room_type} */
function normalizeRoom(raw = {}) {
  const type = raw.type ?? raw.room_type ?? raw.actual_room_type;
  const typeId = type && typeof type === 'object' ? type.id : type ?? raw.room_type_id ?? raw.roomTypeId;
  return {
    id: raw.id != null ? String(raw.id) : '',
    roomTypeId: typeId != null ? String(typeId) : '',
    number: String(raw.number ?? raw.room_number ?? raw.name ?? '').trim(),
    floor: nameOf(firstOf(raw.floor, raw.floor_name, raw.floor_number)),
  };
}

function groupRooms(rawRooms) {
  const byType = new Map();
  for (const room of rawRooms.map(normalizeRoom)) {
    if (!room.roomTypeId || !room.number) continue;
    if (!byType.has(room.roomTypeId)) byType.set(room.roomTypeId, { unitNumbers: [], floors: new Set() });
    const entry = byType.get(room.roomTypeId);
    entry.unitNumbers.push(room.number);
    if (room.floor) entry.floors.add(String(room.floor));
  }
  return byType;
}

/* ——— Optional pulls (destinations / properties are not in the API pack) ——— */

async function pullDestinations({ tenantId } = {}) {
  const path = envPath('KWENTRA_PATH_DESTINATIONS');
  if (!kwentra.isConfigured() || !path) return { ok: true, skipped: true, items: [] };
  try {
    const raw = await kwentra.listAll(path, { tenantId, keys: ['destinations', 'items', 'data'] });
    return { ok: true, path, items: raw.map(normalizeDestination).filter((d) => d.kwentraDestinationId) };
  } catch (err) {
    err.hint = 'Check KWENTRA_PATH_DESTINATIONS with Kwentra.';
    throw err;
  }
}

async function pullProjects({ tenantId } = {}) {
  const path = envPath('KWENTRA_PATH_PROJECTS');
  if (!kwentra.isConfigured() || !path) return { ok: true, skipped: true, items: [] };
  try {
    const raw = await kwentra.listAll(path, { tenantId, keys: ['properties', 'projects', 'items', 'data'] });
    return { ok: true, path, items: raw.map(normalizeProject).filter((p) => p.kwentraProjectId) };
  } catch (err) {
    err.hint = 'Check KWENTRA_PATH_PROJECTS with Kwentra.';
    throw err;
  }
}

/** Live room types for one tenant (admin diagnostics) */
async function pullRoomTypes({ tenantId } = {}) {
  if (!kwentra.isConfigured()) return { ok: false, reason: 'not_configured', items: [] };
  const raw = await kwentra.listRoomTypes({ tenantId });
  return { ok: true, items: raw.map(normalizeRoomType).filter((u) => u.kwentraRoomTypeId) };
}

async function pullRooms({ tenantId } = {}) {
  return { ok: true, byType: groupRooms(await kwentra.listRooms({ tenantId })) };
}

/* ——— Public read models (served from the CMS store) ——— */

/** Public projection of a property — internal fields (phone, Drive links, tenant, sync snapshot) stay server-side */
function publicProperty(c) {
    return {
    id: c.id,
    name: c.name,
    brand: c.brand || brandFromName(c.name),
    destinationId: c.destinationId || '',
    region: c.region || '',
    city: c.city || '',
    unitCount: Number(c.unitCount) || 0,
    description: c.description || '',
    address: c.address || '',
    mapsUrl: c.mapsUrl || '',
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
    facilities: c.facilities || [],
    image: c.image || '',
    sortOrder: c.sortOrder ?? 999,
    showOnHome: c.showOnHome !== false,
    published: c.published !== false,
    kwentraProjectId: String(c.kwentraProjectId || ''),
    kwentraDestinationId: String(c.kwentraDestinationId || ''),
  };
}

/** Destination → Properties tree */
async function pullDestinationsTree({ homeOnly = false } = {}) {
  const [cmsDestinations, cmsCompounds] = await Promise.all([listCmsDestinations(), listCmsCompounds()]);
  const projects = cmsCompounds.map(publicProperty);

  const tree = cmsDestinations.map((d, index) => {
    const destProjects = projects
      .filter((p) => (p.destinationId ? p.destinationId === d.id : p.region === d.name))
      .map((p) => ({ ...p, destinationId: d.id, region: d.name }))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const visible = destProjects.filter((p) => p.published !== false);
    return {
      id: d.id,
      name: d.name,
      description: d.description || '',
      country: d.country || '',
      image: d.image || visible[0]?.image || '',
      sortOrder: d.sortOrder ?? index,
      showOnHome: d.showOnHome !== false,
      published: d.published !== false,
      kwentraDestinationId: String(d.kwentraDestinationId || ''),
      projectCount: visible.length,
      unitTypeCount: visible.reduce((s, p) => s + (Number(p.unitCount) || 0), 0),
      projects: visible,
      source: d.kwentraDestinationId ? 'kwentra+cms' : 'cms',
    };
  });

  let list = tree.filter((d) => d.published !== false);
  if (homeOnly) list = list.filter((d) => d.showOnHome !== false);
  list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const flatProjects = list.flatMap((d) => d.projects);
  return {
    source: kwentra.isConfigured() ? 'kwentra+cms' : 'cms',
    destinations: list,
    projects: homeOnly ? flatProjects.filter((p) => p.showOnHome !== false) : flatProjects,
    errors: [],
    needFromKwentra: null,
  };
}

async function pullProjectsMerged({ homeOnly = false } = {}) {
  const tree = await pullDestinationsTree({ homeOnly: false });
  let items = tree.projects || [];
  if (homeOnly) items = items.filter((p) => p.showOnHome !== false);
  items = items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return {
    source: tree.source,
    items,
    destinations: tree.destinations,
    errors: tree.errors,
    needFromKwentra: tree.needFromKwentra,
    total: items.length,
  };
}

/** Units as stored — Kwentra details arrive through the persisted sync, photos from the admin */
async function pullUnitsMerged({ publishedOnly = true } = {}) {
  let list = await listCmsUnits();
  if (publishedOnly) list = list.filter(isLive);
  return {
    source: kwentra.isConfigured() ? 'kwentra+cms' : 'cms',
    items: list.map((u) => ({ ...u, source: u.kwentraRoomTypeId ? 'kwentra+cms' : 'cms' })),
    pullError: null,
    total: list.length,
  };
}

/* ——— Rates ——— */

/** KWENTRA_RATE_MAP={"FLEX":12,"NRF":14} — website rate plan → Kwentra rate id */
function rateMap() {
  try {
    const parsed = JSON.parse(process.env.KWENTRA_RATE_MAP || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    console.warn('[kwentra] KWENTRA_RATE_MAP is not valid JSON — ignoring it');
    return {};
  }
}

function mappedRateId(planCode) {
  const id = rateMap()[String(planCode || '').toUpperCase()];
  return id != null && id !== '' ? String(id) : '';
}

/**
 * Kwentra rate a website plan is booked on: the plan's mapped rate, else the base rate —
 * KWENTRA_DEFAULT_RATE_ID → the rate mapped to FLEX → the cheapest web=true rate →
 * the first rate on the website channel → cheapest.
 */
function pickRate(rates = [], planCode) {
  const usable = rates.filter((r) => r.quote > 0);
  const byId = (id) => (id ? usable.find((r) => r.rateId === String(id)) : null);
  const cheapest = (list) => [...list].sort((a, b) => a.quote - b.quote)[0];
  const own = byId(mappedRateId(planCode));
  if (own) return { ...own, mapped: true };
  const base =
    byId(process.env.KWENTRA_DEFAULT_RATE_ID) ||
    byId(mappedRateId('FLEX')) ||
    cheapest(usable.filter((r) => r.onWeb)) ||
    usable.find((r) => r.onChannel) ||
    cheapest(usable);
  return base ? { ...base, mapped: false } : null;
}

const nightsToPrices = (arrivalDate, nights = []) =>
  Object.fromEntries(
    nights
      .map((amount, i) => [addDays(arrivalDate, i), amount])
      .filter(([, amount]) => amount > 0)
  );

function defaultChildAges(children) {
  const age = Number(process.env.KWENTRA_DEFAULT_CHILD_AGE || 8);
  return Array.from({ length: Math.max(0, Number(children) || 0) }, () => age);
}

/**
 * Kwentra rates offered for this unit's room type over [arrival, departure).
 * When the tenant flags rates web=true, only those (plus explicitly mapped rates) are sold.
 * Returns [] when Kwentra has no rates for the period.
 */
async function roomTypeRates(listing, { arrivalDate, departureDate, adults = 2, children = 0, tenantId, fresh = false } = {}) {
  const roomTypeId = String(listing?.kwentraRoomTypeId || '');
  if (!roomTypeId) return [];
  const tenant = tenantId ?? (await tenantForUnit(listing));
  const [channel, webIds] = await Promise.all([kwentra.websiteChannel(tenant), kwentra.webRateIds(tenant)]);
  const allowed = new Set([...webIds, ...Object.values(rateMap()).map(String), String(process.env.KWENTRA_DEFAULT_RATE_ID || '')]);
  const rates = await kwentra.quoteTotalStay({
    tenantId: tenant,
    arrivalDate,
    departureDate,
    adults: Math.max(1, Number(adults) || 1),
    childrenAges: defaultChildAges(children),
    channel: channel.id || undefined,
    fresh,
  });
  const order = (r) => {
    const i = channel.rateIds.indexOf(r.rateId);
    return i < 0 ? Infinity : i;
  };
  return rates
    .filter((r) => r.roomTypeId === roomTypeId)
    .filter((r) => !webIds.length || allowed.has(r.rateId))
    .map((r) => ({ ...r, onWeb: webIds.includes(r.rateId), onChannel: channel.rateIds.includes(r.rateId) }))
    .sort((a, b) => order(a) - order(b));
}

/* ——— Availability ——— */

const isLinked = (listing) => Boolean(kwentra.isConfigured() && listing?.kwentraRoomTypeId);

/**
 * Calendar for a unit: Kwentra availability + nightly prices when the unit is linked to a room type,
 * the mock calendar otherwise.
 */
async function pullAvailability(listingOrSlug, { from, to, adults = 2, children = 0 } = {}) {
  const listing = typeof listingOrSlug === 'object' && listingOrSlug ? listingOrSlug : await findUnit(listingOrSlug);
  if (!listing) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }
  const roomTypeId = listing.kwentraRoomTypeId || null;
  const { resolveWindow, buildAvailability, buildPricing } = require('../lib/mockCalendar');
  const window = resolveWindow({ from, to });

  if (isLinked(listing)) {
    const tenantId = await tenantForUnit(listing);
    const avail = await kwentra.getAvailability(roomTypeId, { from: window.from, to: window.to, tenantId });
    let prices = {};
    let rate = null;
    const priceTo = window.to < addDays(window.from, PRICE_WINDOW_NIGHTS) ? window.to : addDays(window.from, PRICE_WINDOW_NIGHTS);
    try {
      const rates = await roomTypeRates(listing, { arrivalDate: window.from, departureDate: priceTo, adults, children, tenantId });
      rate = pickRate(rates, 'FLEX');
      if (rate) prices = nightsToPrices(window.from, rate.nights);
    } catch (err) {
      console.warn('[kwentra] rates lookup failed:', err.message);
    }
    return {
      source: 'kwentra',
      slug: listing.slug,
      roomTypeId,
      tenantId,
      blocked: avail.blocked,
      checkoutDates: avail.checkoutDates,
      prices,
      rate: rate ? { id: rate.rateId, code: rate.rateCode } : null,
      currency: listing.currency || process.env.KWENTRA_CURRENCY || 'EGP',
    };
  }

  const { blocked, checkout_dates } = buildAvailability(listing, window.from, window.to);
  const { prices, currency } = buildPricing(listing, window.from, window.to);
  return { source: 'mock', slug: listing.slug, roomTypeId, blocked, checkoutDates: checkout_dates, prices, currency };
}

/* ——— Push: unit edits (opt-in) ——— */

/**
 * The website does not rename PMS room types unless KWENTRA_PUSH_UNIT_EDITS=true
 * (then PATCH room_type + description on /api/core/roomtype/{id}/).
 */
async function pushUnitEdit(unit) {
  if (!kwentra.isConfigured()) return { pushed: false, reason: 'not_configured' };
  if (!unit?.kwentraRoomTypeId) return { pushed: false, reason: 'missing_kwentraRoomTypeId' };
  if (!envFlag('KWENTRA_PUSH_UNIT_EDITS')) return { pushed: false, reason: 'website_only' };
  const path = kwentra.pathFor('roomType', unit.kwentraRoomTypeId);
  try {
    const data = await kwentra.kwentraFetch(path, {
      method: 'PATCH',
      body: { room_type: unit.title, description: unit.description || '' },
      tenantId: await tenantForUnit(unit),
    });
    return { pushed: true, path, data };
  } catch (err) {
    return { pushed: false, path, error: err.message };
  }
}

async function saveUnitWithSync(idOrSlug, body) {
  const saved = await updateUnit(idOrSlug, body);
  if (!saved) return { unit: null, kwentra: { pushed: false } };
  return { unit: saved, kwentra: await pushUnitEdit(saved) };
}

/* ——— Push: reservations ——— */

const intOrUndefined = (v) => {
  const n = Number(v);
  return v !== '' && v != null && Number.isInteger(n) ? n : undefined;
};
const toKwentraTime = (hhmm, fallback) => (hhmm ? String(hhmm).slice(0, 5) : fallback);

/** Today's date at the hotels (KWENTRA_TIMEZONE, default Africa/Cairo) — not the UTC date */
function hotelToday() {
  const zone = process.env.KWENTRA_TIMEZONE || 'Africa/Cairo';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Kwentra cancels an ON_HOLD reservation once its hold date is reached, so the hold ends at least one full day ahead */
function holdUntilDate() {
  const days = Math.max(1, Math.floor(Number(process.env.KWENTRA_HOLD_DAYS) || 1));
  return addDays(hotelToday(), days);
}

/**
 * CreateReservation body (individualreservation-v2): integer ids, one room night block for the stay.
 * to_date is the last night (departure − 1), as in Kwentra's examples.
 */
function buildReservationPayload({ booking, roomTypeId, roomId, rateId, channelId, marketId, sourceId, guestProfileId, discountPct = 0, hold = false }) {
  const remarks = [
    `Website booking ${booking.voucherNumber}`,
    `${booking.ratePlanName} — ${booking.rateAmount} ${booking.rateCurrency}`,
    `Guest: ${booking.primaryGuestName} · ${booking.email} · ${booking.phone}`,
    booking.otherGuestNames?.length ? `Other guests: ${booking.otherGuestNames.join(', ')}` : '',
    booking.notes ? `Notes: ${booking.notes}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  const childAge = Number(process.env.KWENTRA_DEFAULT_CHILD_AGE || 8);
  return {
    arrival_date: booking.arrivalDate,
    departure_date: booking.departureDate,
    check_in_time: toKwentraTime(booking.checkInTime, process.env.KWENTRA_DEFAULT_CHECKIN || '15:00'),
    check_out_time: toKwentraTime(booking.checkOutTime, process.env.KWENTRA_DEFAULT_CHECKOUT || '12:00'),
    market: intOrUndefined(marketId),
    source: intOrUndefined(sourceId),
    channel: intOrUndefined(channelId),
    account: intOrUndefined(process.env.KWENTRA_ACCOUNT_ID),
    country: booking.reservationCountry || booking.nationality || undefined,
    name: intOrUndefined(guestProfileId),
    guarantee_type: process.env.KWENTRA_GUARANTEE_TYPE || undefined,
    purpose_of_stay: process.env.KWENTRA_PURPOSE_OF_STAY || '1',
    remarks,
    reservation_mode: 'daily',
    hold_status: hold ? 'ON_HOLD' : 'CONFIRMED',
    hold_date: hold ? holdUntilDate() : undefined,
    voucher_no: booking.voucherNumber,
    // Kwentra's edit lock: required on every write, null on create
    updated_on: null,
    room_nights: [
      {
        room_number: intOrUndefined(roomId),
        room_type: intOrUndefined(roomTypeId),
        actual_room_type: intOrUndefined(roomTypeId),
        rate: intOrUndefined(rateId),
        from_date: booking.arrivalDate,
        to_date: addDays(booking.departureDate, -1),
        number_of_adults: booking.adults,
        number_of_children: booking.children,
        children: Array.from({ length: booking.children || 0 }, () => ({ age: childAge, child_rate: 'child' })),
        discount_percentage: discountPct > 0 ? discountPct : undefined,
      },
    ],
  };
}

/** First room of the type that is vacant for the whole stay */
async function findVacantRoom({ tenantId, roomTypeId, arrivalDate, departureDate }) {
  const rooms = (
    await kwentra.listRooms({ tenantId, roomTypeId, from: arrivalDate, to: addDays(departureDate, -1), vacantOnly: true })
  ).map(normalizeRoom);
  const room = rooms.find((r) => r.id && (!r.roomTypeId || r.roomTypeId === String(roomTypeId)));
  if (!room) return null;
  return { ...room, ref: process.env.KWENTRA_ROOM_REF === 'number' ? room.number : room.id };
}

const isConflict = (err) => err?.status === 409 || /overbook|not available|no (vacant )?room/i.test(err?.message || '');

/**
 * Create the reservation in the unit's Kwentra tenant.
 * conflict: true when Kwentra has no room left for those dates (the booking must not go ahead).
 */
async function pushReservation({ booking, listing, guestProfileId, ratePlan, rates, hold = holdUntilPaid() }) {
  if (!kwentra.isConfigured()) return { pushed: false, reason: 'not_configured' };
  const roomTypeId = String(listing?.kwentraRoomTypeId || '');
  if (!roomTypeId) return { pushed: false, reason: 'missing_kwentraRoomTypeId' };
  const tenantId = await tenantForUnit(listing);
  const path = kwentra.pathFor('reservations');
  try {
    const room = await findVacantRoom({ tenantId, roomTypeId, arrivalDate: booking.arrivalDate, departureDate: booking.departureDate });
    if (!room) {
      return { pushed: false, conflict: true, path, error: 'No vacant room of this type in Kwentra for those dates' };
    }
    const offered =
      rates ||
      (await roomTypeRates(listing, {
        arrivalDate: booking.arrivalDate,
        departureDate: booking.departureDate,
        adults: booking.adults,
        children: booking.children,
        tenantId,
      }).catch(() => []));
    const rate = pickRate(offered, ratePlan?.code);
    const discountPct = rate && !rate.mapped ? -(Number(ratePlan?.adjustmentPct) || 0) : 0;
    const [channelId, { market, source }] = await Promise.all([kwentra.websiteChannelId(tenantId), kwentra.websiteMarketSource(tenantId)]);
    const payload = buildReservationPayload({
      booking,
      roomTypeId,
      roomId: room.ref,
      rateId: rate?.rateId || process.env.KWENTRA_DEFAULT_RATE_ID,
      channelId,
      marketId: market,
      sourceId: source,
      guestProfileId,
      discountPct,
      hold,
    });
    const { id } = await kwentra.createReservation(payload, { tenantId });
    kwentra.clearLiveCache(tenantId);
    return { pushed: true, path, tenantId, reservationId: id != null ? String(id) : null, room: room.number, rateId: rate?.rateId || null };
  } catch (err) {
    return { pushed: false, conflict: isConflict(err), path, status: err.status, error: err.message };
  }
}

/**
 * Credit department online payments are posted to, per tenant:
 * KWENTRA_PAYMENT_DEPARTMENTS={"394":53,"375":12}, else KWENTRA_PAYMENT_DEPARTMENT_ID.
 */
function paymentDepartment(tenantId) {
  try {
    const map = JSON.parse(process.env.KWENTRA_PAYMENT_DEPARTMENTS || '{}');
    if (map && map[String(tenantId)] != null) return String(map[String(tenantId)]);
  } catch {
    console.warn('[kwentra] KWENTRA_PAYMENT_DEPARTMENTS is not valid JSON — ignoring it');
  }
  return String(process.env.KWENTRA_PAYMENT_DEPARTMENT_ID || '').trim();
}

/**
 * A paid website booking → Kwentra. Without holds (Kwentra's advice) the reservation is created only
 * now, confirmed, so unpaid checkouts never take a room. Then the payment is recorded on it.
 * `issue` says what staff must do by hand when something could not be done.
 */
async function pushPaidBooking(booking, payment = {}) {
  if (!kwentra.isConfigured()) return { pushed: false, reason: 'not_configured' };
  let reservationId = booking.kwentraReservationId || null;
  let profileId = booking.kwentraProfileId || null;
  if (!reservationId) {
    const listing = await findUnit(booking.listingId || booking.slug);
    if (!isLinked(listing)) return { pushed: false, reason: 'not_linked' };
    const tenantId = await tenantForUnit(listing);
    if (!profileId) {
      try {
        const guest = await kwentra.sendGuestFromWebsite(
          {
            name: booking.primaryGuestName || booking.name,
            email: booking.email,
            phone: booking.phone,
            notes: [`Voucher: ${booking.voucherNumber}`, booking.notes || ''].filter(Boolean).join(' | '),
            nationality: booking.nationality || booking.reservationCountry,
          },
          { tenantId }
        );
        profileId = guest.profile?.id != null ? String(guest.profile.id) : null;
      } catch (err) {
        console.warn('[kwentra] guest profile push failed:', err.message);
      }
    }
    const nights = Number(booking.nights) || 1;
    const plan = pms.ratePlansForStay(nights).find((p) => p.code === booking.ratePlanCode) || { code: booking.ratePlanCode, adjustmentPct: 0 };
    const created = await pushReservation({ booking, listing, guestProfileId: profileId, ratePlan: plan, hold: false });
    if (!created.pushed) {
      const why = created.conflict ? 'no room of this type is free in Kwentra any more' : `Kwentra refused the reservation (${created.error || created.reason})`;
      return {
        pushed: false,
        profileId,
        errors: [created.error || created.reason],
        issue: `Guest paid but ${why}. Book it by hand in Kwentra or refund the guest.`,
      };
    }
    reservationId = created.reservationId;
  }
  const result = await pushPayment({ ...payment, booking, reservationId });
  return { ...result, profileId };
}

/**
 * Record a website payment on its Kwentra reservation: an ON_HOLD reservation is confirmed (full update,
 * hold date removed); one Kwentra already auto-cancelled is reinstated — the same reservation, never a
 * second booking. Then the payment is posted on the billing account (Billing API) with a billing note.
 */
async function pushPayment({ booking, reservationId, amount, currency = 'EGP', merchantOrderId, provider, transactionId, cardLast4, cardType }) {
  if (!kwentra.isConfigured() || !reservationId) {
    return { pushed: false, reason: !reservationId ? 'missing_reservation_id' : 'not_configured' };
  }
  const tenantId = await tenantForBooking(booking);
  const result = { pushed: false, confirmed: false, noted: false, posted: false, reservationId, errors: [] };
  const attempt = async (key, fn) => {
    try {
      await fn();
      result[key] = true;
  } catch (err) {
      result.errors.push(`${key}: ${err.message}`);
    }
  };

  const current = await kwentra.getReservation(reservationId, { tenantId }).catch((err) => {
    result.errors.push(`lookup: ${err.message}`);
    return null;
  });
  const wasCancelled = kwentra.isCancelledReservation(current);
  const onHold = String(current?.hold_status || '').toUpperCase() === 'ON_HOLD';
  if (wasCancelled) {
    await attempt('confirmed', () =>
      kwentra.reinstateReservation(reservationId, 'Paid online on the website after the hold date', { tenantId })
    );
    if (!result.confirmed) {
      result.issue = `Guest paid but Kwentra had already cancelled reservation ${reservationId} and it could not be reinstated (${result.errors.at(-1) || 'unknown error'}). Reinstate or rebook it by hand, or refund the guest.`;
      return result;
    }
    result.reinstated = true;
  } else if (onHold) {
    await attempt('confirmed', () => kwentra.confirmHeldReservation(reservationId, { tenantId }));
  } else {
    result.confirmed = Boolean(current);
  }
  const ref = transactionId || merchantOrderId || '';
  const summary = `Paid online on the website: ${Number(amount)} ${currency} via ${provider || 'online payment'}${ref ? ` (ref ${ref})` : ''}${booking?.voucherNumber ? ` — voucher ${booking.voucherNumber}` : ''}`;

  const department = paymentDepartment(tenantId);
  if (department) {
    await attempt('posted', async () => {
      const accountId = kwentra.reservationAccountId(await kwentra.getReservation(reservationId, { tenantId }));
      if (!accountId) throw new Error('the reservation has no billing account id — set KWENTRA_RESERVATION_ACCOUNT_FIELD');
      await kwentra.postPayment({
        tenantId,
        accountId,
        windowNumber: Number(process.env.KWENTRA_PAYMENT_WINDOW || 1),
        department,
        amount,
        comments: summary,
        cardLast4,
        cardType,
      });
    });
  } else {
    result.errors.push('posted: no payment department set (KWENTRA_PAYMENT_DEPARTMENT_ID) — recorded as a note only');
  }
  await attempt('noted', () => kwentra.addReservationNote(reservationId, summary, { type: 'billing', tenantId }));
  result.pushed = result.noted || result.posted || result.confirmed;
  if (!result.posted) {
    result.issue = `Payment of ${Number(amount)} ${currency} is not on the Kwentra folio of reservation ${reservationId} — post it by hand.`;
  }
  if (onHold && !result.confirmed) {
    result.issue = `Reservation ${reservationId} is still ON HOLD in Kwentra although the guest paid — confirm it before its hold date or Kwentra will cancel it. ${result.issue || ''}`.trim();
  }
  return result;
}

/** Keep the booking pointing at the reservation the payment landed on, and surface anything staff must fix */
async function recordPaymentResult(booking, result) {
  if (!booking?.id || !result) return null;
  const patch = { kwentraIssue: result.issue || '' };
  if (result.reservationId && result.reservationId !== booking.kwentraReservationId) {
    patch.kwentraReservationId = result.reservationId;
  }
  if (result.profileId && result.profileId !== booking.kwentraProfileId) patch.kwentraProfileId = result.profileId;
  if (result.issue) console.warn(`[kwentra] booking ${booking.voucherNumber || booking.id}: ${result.issue}`);
  return updateBooking(booking.id, patch);
}

/* ——— Persisted sync: Kwentra → CMS store ——— */

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const PROPERTY_PMS_FIELDS = ['name', 'description', 'city', 'address', 'buildingNumber', 'phone', 'mapsUrl', 'latitude', 'longitude', 'facilities'];

const UNIT_PMS_FIELDS = [
  'title',
  'description',
  'propertyType',
  'bedrooms',
  'bathrooms',
  'maxGuests',
  'areaSqm',
  'amenities',
  'pricePerNight',
  'currency',
  'roomCount',
  'unitNumbers',
  'floor',
  'bedType',
];

/**
 * Take a PMS value only when it changed in Kwentra since the last sync (tracked in kwentraSnapshot),
 * so edits made in the admin survive.
 */
function mergeFromPms(current, incoming, keys) {
  const snapshot = current?.kwentraSnapshot || {};
  const nextSnapshot = { ...snapshot };
  const patch = {};
  for (const key of keys) {
    const value = incoming[key];
    if (isEmpty(value)) continue;
    nextSnapshot[key] = value;
    if (same(snapshot[key], value)) continue;
    if (!same(current?.[key], value)) patch[key] = value;
  }
  if (!same(snapshot, nextSnapshot)) patch.kwentraSnapshot = nextSnapshot;
  return patch;
}

function pick(obj, keys) {
  return Object.fromEntries(keys.filter((k) => !isEmpty(obj[k])).map((k) => [k, obj[k]]));
}

const syncState = { running: false, last: null, timer: null, debounce: null, pending: false, lastTrigger: null };

async function syncDestinationsAndProperties(report, fail) {
  const [destRes, projRes] = await Promise.allSettled([pullDestinations(), pullProjects()]);
  const kwDestinations = destRes.status === 'fulfilled' ? destRes.value.items : (fail('destinations', destRes.reason), []);
  const kwProjects = projRes.status === 'fulfilled' ? projRes.value.items : (fail('properties', projRes.reason), []);

  let destinations = await listCmsDestinations();
  for (const d of kwDestinations) {
    const found =
      destinations.find((x) => x.kwentraDestinationId && x.kwentraDestinationId === d.kwentraDestinationId) ||
      destinations.find((x) => norm(x.name) === norm(d.name));
    if (!found) {
      await createDestination({
        id: slugify(d.name) || `dest-${d.kwentraDestinationId}`,
        name: d.name,
        description: d.description,
        kwentraDestinationId: d.kwentraDestinationId,
      });
      report.destinations.created += 1;
    } else {
      const patch = {};
      if (!found.kwentraDestinationId) patch.kwentraDestinationId = d.kwentraDestinationId;
      if (!found.description && d.description) patch.description = d.description;
      if (Object.keys(patch).length) {
        await updateDestination(found.id, patch);
        report.destinations.updated += 1;
      }
    }
  }
  destinations = await listCmsDestinations();

  const compounds = await listCmsCompounds();
  for (const p of kwProjects) {
    const incoming = { ...p };
    if (isEmpty(incoming.latitude) && incoming.mapsUrl) Object.assign(incoming, coordsFromMapsUrl(incoming.mapsUrl) || {});
    const found =
      compounds.find((c) => c.kwentraProjectId && c.kwentraProjectId === p.kwentraProjectId) ||
      compounds.find((c) => norm(c.name) === norm(p.name));
    const dest = destinations.find((d) => d.kwentraDestinationId && d.kwentraDestinationId === p.kwentraDestinationId);
    if (!found) {
      const fields = pick(incoming, PROPERTY_PMS_FIELDS);
      await createCompound({
        ...fields,
        id: slugify(p.name) || `proj-${p.kwentraProjectId}`,
        destinationId: dest?.id || '',
        kwentraProjectId: p.kwentraProjectId,
        kwentraDestinationId: p.kwentraDestinationId,
        kwentraSnapshot: fields,
      });
      report.properties.created += 1;
    } else {
      const patch = mergeFromPms(found, incoming, PROPERTY_PMS_FIELDS);
      if (!found.kwentraProjectId) patch.kwentraProjectId = p.kwentraProjectId;
      if (!found.kwentraDestinationId && p.kwentraDestinationId) patch.kwentraDestinationId = p.kwentraDestinationId;
      if (!found.destinationId && dest) patch.destinationId = dest.id;
      if (Object.keys(patch).length) {
        await updateCompound(found.id, patch);
        report.properties.updated += 1;
      }
    }
  }
}

/** Room types + rooms of one tenant → unit types of the properties that use that tenant */
async function syncTenant(target, compounds, report, fail) {
  const label = target.compounds.length ? target.compounds.map((c) => c.name).join(', ') : `tenant ${target.tenantId || '(default)'}`;
  let types;
  try {
    types = (await kwentra.listRoomTypes({ tenantId: target.tenantId })).map(normalizeRoomType).filter((t) => t.kwentraRoomTypeId);
  } catch (err) {
    fail(`unit types — ${label}`, err);
    return;
  }
  let roomsByType = new Map();
  try {
    roomsByType = groupRooms(await kwentra.listRooms({ tenantId: target.tenantId }));
  } catch (err) {
    fail(`rooms — ${label}`, err);
  }

  const tenantOf = new Map(compounds.map((c) => [c.id, String(c.kwentraTenantId || '').trim()]));
  const ownIds = new Set(target.compounds.map((c) => c.id));
  // Room type ids are only unique inside a tenant, so matching stays within this tenant's properties
  const inScope = (u) => (target.fallback ? !tenantOf.get(u.compoundId) : ownIds.has(u.compoundId));
  const home = target.compounds.length === 1 ? target.compounds[0] : null;

  const allUnits = await listCmsUnits();
  const units = allUnits.filter(inScope);
  const slugs = new Set(allUnits.map((u) => u.slug));
  report.tenants.push({ tenantId: target.tenantId, properties: target.compounds.map((c) => c.name), roomTypes: types.length });

  for (const t of types) {
    const rooms = roomsByType.get(t.kwentraRoomTypeId);
    const incoming = { ...t };
    if (rooms) {
      incoming.unitNumbers = rooms.unitNumbers;
      incoming.roomCount = rooms.unitNumbers.length;
      if (!incoming.floor && rooms.floors.size) incoming.floor = [...rooms.floors].join(', ');
    }
    const found =
      units.find((u) => u.kwentraRoomTypeId && String(u.kwentraRoomTypeId) === t.kwentraRoomTypeId) ||
      (home && units.find((u) => !u.kwentraRoomTypeId && u.compoundId === home.id && norm(u.title) === norm(t.title)));

    if (!found) {
      const fields = pick(incoming, UNIT_PMS_FIELDS);
      const base = slugify(`${home?.name || ''} ${t.title}`) || `room-type-${t.kwentraRoomTypeId}`;
      let slug = base;
      for (let n = 2; slugs.has(slug); n += 1) slug = `${base}-${n}`;
      slugs.add(slug);
      await createUnit({
        ...fields,
        slug,
        compoundId: home?.id || '',
        // Each unit needs its own Drive gallery; the completeness check keeps it hidden until then
        images: [],
        driveFolderUrl: '',
        kwentraRoomTypeId: t.kwentraRoomTypeId,
        kwentraSnapshot: fields,
        published: true,
      });
      report.units.created += 1;
      continue;
    }

    const patch = mergeFromPms(found, incoming, UNIT_PMS_FIELDS);
    if (!found.kwentraRoomTypeId) patch.kwentraRoomTypeId = t.kwentraRoomTypeId;
    if (!found.compoundId && home) patch.compoundId = home.id;
    if (Object.keys(patch).length) {
      await updateUnit(found.id, patch);
      report.units.updated += 1;
    } else {
      report.units.unchanged += 1;
    }
  }
}

async function syncFromKwentra() {
  if (!kwentra.isConfigured()) {
    return { ok: false, reason: 'not_configured', message: 'Kwentra credentials are not set in Server/.env' };
  }
  if (syncState.running) return { ok: false, reason: 'already_running', message: 'A sync is already running' };
  syncState.running = true;
  const report = {
    ok: true,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    tenants: [],
    destinations: { created: 0, updated: 0 },
    properties: { created: 0, updated: 0 },
    units: { created: 0, updated: 0, unchanged: 0 },
    incomplete: { count: 0, items: [] },
    errors: [],
    needFromKwentra: [],
  };
  const fail = (kind, err) => {
    report.errors.push({ kind, message: err.message });
    if (err.hint) report.needFromKwentra.push(err.hint);
    if (err.status === 401 || err.status === 403) report.needFromKwentra.push('Check the Kwentra API credentials and tenant IDs.');
  };

  try {
    await syncDestinationsAndProperties(report, fail);
    const compounds = await listCmsCompounds();
    for (const target of tenantTargets(compounds)) {
      await syncTenant(target, compounds, report, fail);
    }

    const incomplete = (await listCmsUnits()).filter((u) => u.kwentraRoomTypeId && !u.completeness.complete);
    report.incomplete = {
      count: incomplete.length,
      items: incomplete.slice(0, 50).map((u) => ({ id: u.id, title: u.title, missing: u.completeness.missing.map((m) => m.label) })),
    };
  } catch (err) {
    report.ok = false;
    fail('sync', err);
  } finally {
    report.finishedAt = new Date().toISOString();
    report.needFromKwentra = [...new Set(report.needFromKwentra)];
    syncState.last = report;
    syncState.running = false;
    console.log(
      `[kwentra-sync] ${report.ok ? 'done' : 'failed'} — ${report.tenants.length} tenant(s), units +${report.units.created} ~${report.units.updated}, ${report.incomplete.count} incomplete (hidden)${report.errors.length ? `, ${report.errors.length} error(s)` : ''}`
    );
    if (syncState.pending) {
      syncState.pending = false;
      requestSync('queued during previous sync');
    }
  }
  return report;
}

/**
 * Ask for a sync soon (Kwentra webhook, admin actions). Bursts of events collapse into one run;
 * events that arrive mid-sync schedule exactly one follow-up run.
 */
function requestSync(reason = 'manual', { delayMs = 3_000 } = {}) {
  if (!kwentra.isConfigured()) return { queued: false, reason: 'not_configured' };
  syncState.lastTrigger = { reason, at: new Date().toISOString() };
  if (syncState.running) {
    syncState.pending = true;
    return { queued: true, when: 'after current sync' };
  }
  clearTimeout(syncState.debounce);
  syncState.debounce = setTimeout(() => {
    syncState.debounce = null;
    syncFromKwentra().catch((err) => console.warn('[kwentra-sync]', err.message));
  }, delayMs);
  syncState.debounce.unref?.();
  return { queued: true, when: `in ${Math.round(delayMs / 1000)}s` };
}

function syncMinutes() {
  const raw = String(process.env.KWENTRA_SYNC_MINUTES ?? '').trim();
  const n = raw === '' ? 5 : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

async function syncStatus() {
  const configured = kwentra.isConfigured();
  const compounds = await listCmsCompounds();
  const linked = compounds.filter((c) => String(c.kwentraTenantId || '').trim());
  return {
    configured,
    running: syncState.running,
    autoSyncMinutes: configured ? syncMinutes() : 0,
    last: syncState.last,
    lastTrigger: syncState.lastTrigger,
    loginPaused: kwentra.authStatus(),
    password: kwentra.passwordStatus(),
    bookingMode: holdUntilPaid() ? 'hold_until_paid' : 'after_payment',
    tenants: {
      defaultTenant: Boolean(kwentra.getTenantId()),
      properties: linked.map((c) => ({ id: c.id, name: c.name, tenantId: c.kwentraTenantId })),
      propertiesWithoutTenant: compounds.length - linked.length,
    },
    webhook: {
      path: '/api/webhooks/kwentra',
      url: process.env.PUBLIC_API_URL ? `${String(process.env.PUBLIC_API_URL).replace(/\/$/, '')}/api/webhooks/kwentra` : '',
      secretConfigured: Boolean(process.env.KWENTRA_WEBHOOK_SECRET),
      auth: process.env.KWENTRA_WEBHOOK_USERNAME && process.env.KWENTRA_WEBHOOK_PASSWORD
        ? 'basic'
        : process.env.KWENTRA_WEBHOOK_TOKEN
          ? 'token'
          : process.env.KWENTRA_WEBHOOK_SECRET
            ? 'secret'
            : null,
    },
    paths: {
      unitTypes: kwentra.pathFor('roomTypes'),
      rooms: kwentra.pathFor('rooms'),
      availability: kwentra.pathFor('availability'),
      rates: kwentra.pathFor('totalStay'),
      reservations: kwentra.pathFor('reservations'),
      destinations: envPath('KWENTRA_PATH_DESTINATIONS') || null,
      properties: envPath('KWENTRA_PATH_PROJECTS') || null,
      payment: kwentra.pathFor('payment') || null,
    },
  };
}

/** Sync once at boot, then every KWENTRA_SYNC_MINUTES (0 = only manual syncs). */
function startAutoSync() {
  if (!kwentra.isConfigured() || syncState.timer) return;
  const run = () => syncFromKwentra().catch((err) => console.warn('[kwentra-sync]', err.message));
  setTimeout(run, 5_000).unref?.();
  const minutes = syncMinutes();
  if (minutes > 0) {
    syncState.timer = setInterval(run, minutes * 60_000);
    syncState.timer.unref?.();
  }
}

module.exports = {
  tenantForUnit,
  tenantForBooking,
  tenantTargets,
  pullRoomTypes,
  pullRooms,
  pullUnitsMerged,
  pullAvailability,
  pullDestinations,
  pullProjects,
  pullDestinationsTree,
  pullProjectsMerged,
  roomTypeRates,
  pickRate,
  mappedRateId,
  nightsToPrices,
  isLinked,
  pushUnitEdit,
  pushReservation,
  holdUntilPaid,
  pushPayment,
  pushPaidBooking,
  recordPaymentResult,
  buildReservationPayload,
  saveUnitWithSync,
  normalizeRoomType,
  normalizeDestination,
  normalizeProject,
  normalizeRoom,
  publicProperty,
  syncFromKwentra,
  requestSync,
  syncStatus,
  startAutoSync,
};
