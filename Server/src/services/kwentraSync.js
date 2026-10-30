/**
 * Kwentra ↔ Prime orchestration (paths and shapes from the Kwentra API pack — see kwentraService.js).
 *
 * Tenants: each property can carry its own Kwentra tenant ID; units use their property's tenant,
 * falling back to KWENTRA_TENANT_ID for single-hotel setups.
 *
 * PULL on a timer (and on webhook):
 *  - Every sync reads each linked room type's availability. That step always runs.
 *  - Room-type notices → one published listing per unit type that is on the room rack and has its own rate.
 *    A type with no rate is never created, and an existing one is removed. A failed rack or rate read does not publish anything new.
 *  - Availability notices → blocked nights for that room type (avail 0)
 *  - Reservation notices → the matching website booking
 * LIVE:
 *  - Nightly prices from the rate definition grid (date range + occupancy). Total-stay is only a fallback.
 * PUSH:
 *  - Reservations (individualreservation/v2) when a guest books on the website
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
  deleteUnit,
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
const { normalizeOccupancies, partyFits: partyAllowed, occupancyMax: maxFromOccupancy } = require('../lib/occupancy');
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
  return maxFromOccupancy(set);
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
    occupancies: normalizeOccupancies(raw.roomtypeoccupancy_set),
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
    bedType: nameOf(firstOf(raw.bed_type, raw.bedding, raw.bedType)) || '',
  };
}

const roomIdOf = (unit) => String(unit?.kwentraRoomId || '').trim();

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
  const raw = await kwentra.listRoomTypes({ tenantId, fresh: true });
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

/** KWENTRA_RATE_MAP={"BB":12,"RO":14} — website rate plan → Kwentra rate id */
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
 * The Hotel Website rate for this plan. Another channel's rate is never used.
 */
function pickRate(rates = [], planCode) {
  const code = String(planCode || '').toUpperCase();
  const usable = rates.filter((rate) => rate.quote > 0 && pms.planCodeForKwentraRate(rate.rateCode) === code);
  const mapped = mappedRateId(code);
  const own = mapped ? usable.find((rate) => rate.rateId === mapped) : null;
  const match = own || usable[0];
  return match ? { ...match, mapped: true } : null;
}

const nightsToPrices = (arrivalDate, nights = []) =>
  Object.fromEntries(
    nights
      .map((amount, i) => [addDays(arrivalDate, i), amount])
      .filter(([, amount]) => amount > 0)
  );

/** 1 adult uses the first column; 6 or more uses the last column ("6 or More"). */
function adultAmount(row, adults) {
  const count = Math.min(6, Math.max(1, Number(adults) || 1));
  const amount = Number(row?.adults?.[count - 1]);
  return amount > 0 ? amount : 0;
}

/** The row that covers this night. A later start date is the more specific override. */
function coveringRow(rows, roomTypeId, date) {
  const id = String(roomTypeId || '');
  const hits = (rows || []).filter(
    (row) => (row.allTypes || row.roomTypeIds.includes(id)) && row.start <= date && date <= row.end
  );
  hits.sort((a, b) => b.start.localeCompare(a.start) || a.end.localeCompare(b.end));
  return hits[0] || null;
}

function ratesForPlan(definitions, planCode = 'BB') {
  const code = String(planCode || 'BB').toUpperCase();
  return (definitions || []).filter((definition) => (definition.plan || pms.planCodeForKwentraRate(definition.rateCode)) === code);
}

/**
 * The row of the Hotel Website rate for this plan and night.
 */
function rateRowForNight(definitions, roomTypeId, date, planCode = 'BB') {
  let fallback = null;
  for (const definition of ratesForPlan(definitions, planCode)) {
    const row = coveringRow(definition.rows, roomTypeId, date);
    if (!row) continue;
    const candidate = { row, rateId: definition.rateId, rateCode: definition.rateCode };
    if ((row.adults || []).some((amount) => amount > 0)) return candidate;
    if (!fallback) fallback = candidate;
  }
  return fallback;
}

/**
 * Adult column plus one child-range-1 amount per child.
 * The site asks for a child count (ages 0–12), and child range 1 is that child price on the rate grid.
 */
function guestAmount(row, adults, children) {
  const adult = adultAmount(row, adults);
  if (!(adult > 0)) return 0;
  const eachChild = Number(row?.children?.[0]) || 0;
  return adult + Math.max(0, Number(children) || 0) * eachChild;
}

/**
 * Card price: the 2-adult amount of the row covering today.
 * When nothing covers today, the latest row still defined for that room type —
 * so a leftover placeholder is not what the listing shows.
 */
function cardAmount(definitions, roomTypeId, adults, today, planCode = 'BB') {
  const defs = ratesForPlan(definitions, planCode);
  const current = rateRowForNight(defs, roomTypeId, today, planCode);
  if (current) {
    const amount = guestAmount(current.row, adults, 0);
    if (amount > 0) return amount;
  }
  for (const definition of defs) {
    let best = null;
    for (const row of definition.rows || []) {
      if (!row.allTypes && !row.roomTypeIds.includes(String(roomTypeId))) continue;
      const amount = adultAmount(row, adults);
      if (!(amount > 0)) continue;
      if (!best || row.end > best.end || (row.end === best.end && row.start > best.start)) {
        best = { end: row.end, start: row.start, amount };
      }
    }
    if (best) return best.amount;
  }
  return 0;
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Prices for [arrival, departure) from Kwentra's rate grid.
 * A night with no row is left out — it is not given a made-up amount.
 */
async function pricesFromRateGrid(listing, arrival, departure, { adults = 2, children = 0, tenantId, planCode = 'BB' } = {}) {
  const roomTypeId = String(listing?.kwentraRoomTypeId || '');
  if (!roomTypeId || !arrival || !departure || arrival >= departure) return { prices: {}, occupancy: {}, rate: null };
  const definitions = await kwentra.rateDefinitions(tenantId);
  const prices = {};
  const occupancy = {};
  let rate = null;
  for (let date = arrival; date < departure; date = addDays(date, 1)) {
    const hit = rateRowForNight(definitions, roomTypeId, date, planCode);
    if (!hit) continue;
    occupancy[date] = { adults: hit.row.adults, children: hit.row.children };
    const amount = guestAmount(hit.row, adults, children);
    if (!amount) continue;
    prices[date] = amount;
    if (!rate) rate = { rateId: hit.rateId, rateCode: hit.rateCode, quote: amount, nights: [] };
  }
  return { prices, occupancy, rate };
}

function defaultChildAges(children) {
  const age = Number(process.env.KWENTRA_DEFAULT_CHILD_AGE || 8);
  return Array.from({ length: Math.max(0, Number(children) || 0) }, () => age);
}

/**
 * Hotel Website BB and Hotel Website Bed Only for this room type over [arrival, departure).
 * Returns [] when those rates have no price for the period.
 */
async function roomTypeRates(listing, { arrivalDate, departureDate, adults = 2, children = 0, tenantId, fresh = false } = {}) {
  const roomTypeId = String(listing?.kwentraRoomTypeId || '');
  if (!roomTypeId) return [];
  const tenant = tenantId ?? (await tenantForUnit(listing));
  const channel = await kwentra.websiteChannel(tenant);
  const rates = await kwentra.quoteTotalStay({
    tenantId: tenant,
    arrivalDate,
    departureDate,
    adults: Math.max(1, Number(adults) || 1),
    childrenAges: defaultChildAges(children),
    channel: channel.id || undefined,
    fresh,
  });
  return rates
    .filter((rate) => rate.roomTypeId === roomTypeId && pms.planCodeForKwentraRate(rate.rateCode))
    .map((rate) => ({ ...rate, onWeb: true, onChannel: channel.rateIds.includes(rate.rateId) }))
    .sort((a, b) => (pms.planCodeForKwentraRate(a.rateCode) === 'BB' ? 0 : 1) - (pms.planCodeForKwentraRate(b.rateCode) === 'BB' ? 0 : 1));
}

/* ——— Availability ——— */

const isLinked = (listing) => Boolean(kwentra.isConfigured() && listing?.kwentraRoomTypeId);

/**
 * Nightly prices for [arrival, departure). A quote that runs past the dates Kwentra has rates for
 * comes back with no nightly breakdown, so a chunk that returns nothing is split until the nights
 * that do have a price are found.
 */
async function collectNightPrices(listing, arrival, departure, ctx, depth = 0) {
  const span = Math.round((Date.parse(`${departure}T00:00:00Z`) - Date.parse(`${arrival}T00:00:00Z`)) / 86400000);
  if (span <= 0) return { prices: {}, rate: null };
  let prices = {};
  let rate = null;
  try {
    const rates = await roomTypeRates(listing, { arrivalDate: arrival, departureDate: departure, ...ctx });
    rate = pickRate(rates, 'BB');
    if (rate) prices = nightsToPrices(arrival, rate.nights);
    } catch (err) {
    console.warn('[kwentra] rates lookup failed:', err.message);
  }
  if (Object.keys(prices).length || span <= 1 || depth >= 6) return { prices, rate };
  const mid = addDays(arrival, Math.ceil(span / 2));
  const left = await collectNightPrices(listing, arrival, mid, ctx, depth + 1);
  const right = await collectNightPrices(listing, mid, departure, ctx, depth + 1);
  return { prices: { ...left.prices, ...right.prices }, rate: left.rate || right.rate };
}

/**
 * Live blocked nights for one physical room when the in-memory snapshot is missing.
 * Near-term nights are checked room-by-room; farther nights use room-type sold-out as a floor.
 */
async function liveBlockedForRoom(listing, from, to, tenantId) {
  const roomId = String(roomIdOf(listing));
  const roomTypeId = String(listing.kwentraRoomTypeId || '').trim();
  const key = `room:${tenantId}|${roomId}`;
  const blocked = new Set();
  const today = localToday();
  const hardEnd = addDays(today, ROOM_SCAN_NIGHTS);
  const scanFrom = from < today ? today : from;
  const scanTo = to < hardEnd ? to : hardEnd;

  if (scanFrom < scanTo) {
    for (let day = scanFrom; day < scanTo; day = addDays(day, 1)) {
      try {
        const vacant = await kwentra.listRooms({
          tenantId,
          roomTypeId: roomTypeId || undefined,
          from: day,
          to: day,
          vacantOnly: true,
        });
        const free = new Set(vacant.map((r) => String(r.id)));
        if (!free.has(roomId)) blocked.add(day);
      } catch (err) {
        console.warn('[kwentra] room night check failed', day, err.message);
      }
    }
  }

  // Beyond the per-room scan horizon: block nights where the whole room type is sold out.
  if (roomTypeId) {
    const typeFrom = scanTo > from ? scanTo : from;
    if (typeFrom < to) {
      try {
        const avail = await kwentra.getAvailability(roomTypeId, { from: typeFrom, to, tenantId, fresh: true });
        for (const date of avail.blocked || []) blocked.add(date);
      } catch (err) {
        console.warn('[kwentra] type availability fallback failed:', err.message);
      }
    }
  }

  const list = [...blocked].sort();
  rememberAvailability(tenantId, roomTypeId, { from, to, blocked: list, checkoutDates: [] }, { force: true, key });
  return { blocked: nightsInside(list, from, to), checkoutDates: [] };
}

/**
 * Blocked nights for a linked unit. Prefer the in-memory snapshot (filled by webhooks / boot /
 * admin sync). Physical rooms never return an empty calendar just because the snapshot is cold —
 * they live-pull from Kwentra instead.
 */
function overlayWebhookInventory(tenantId, roomTypeId, from, to, blocked) {
  const dates = webhookInventory.get(snapshotKey(tenantId, roomTypeId));
  const set = new Set(nightsInside(blocked, from, to));
  if (!dates) return [...set].sort();
  for (let date = from; date < to; date = addDays(date, 1)) {
    if (!dates.has(date)) continue;
    if (Number(dates.get(date)) <= 0) set.add(date);
    else set.delete(date);
  }
  return [...set].sort();
}

async function blockedForListing(listing, from, to, tenantId) {
  // Guests book the room type. A night is closed only when that type has 0 rooms left.
  // The sync timer is what fills this snapshot. Serve it whenever it overlaps the stay,
  // so one failed live call cannot blank the calendar.
  const roomTypeId = listing.kwentraRoomTypeId;
  const snap = availabilitySnapshots.get(snapshotKey(tenantId, roomTypeId));
  const finish = (blocked) => ({
    blocked: overlayWebhookInventory(tenantId, roomTypeId, from, to, blocked),
    checkoutDates: [],
  });
  if (snap && snap.from <= from && snap.to > from) return finish(snap.blocked);
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const avail = await kwentra.getAvailability(roomTypeId, { from, to, tenantId, fresh: true });
      const inventoryKey = snapshotKey(tenantId, roomTypeId);
      const pushed = webhookInventory.get(inventoryKey) || new Map();
      for (const [date, count] of Object.entries(avail.roomsFree || {})) {
        if (date >= from && date < to) pushed.set(date, Number(count));
      }
      webhookInventory.set(inventoryKey, pushed);
      rememberAvailability(tenantId, roomTypeId, {
        from,
        to,
        blocked: avail.blocked,
        checkoutDates: avail.checkoutDates || [],
      });
      return finish(avail.blocked);
    } catch (err) {
      lastErr = err;
    }
  }
  console.warn('[kwentra] room-type availability failed:', lastErr?.message);
  return finish(snap?.blocked || []);
}

/** Blocked nights only — the guest calendar reads this, so it does not wait on price quotes. */
async function blockedNights(listingOrSlug, { from, to } = {}) {
  const listing = typeof listingOrSlug === 'object' && listingOrSlug ? listingOrSlug : await findUnit(listingOrSlug);
  if (!listing) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }
  const { resolveWindow, buildAvailability } = require('../lib/mockCalendar');
  const window = resolveWindow({ from, to });
  if (!isLinked(listing)) {
    const { blocked, checkout_dates } = buildAvailability(listing, window.from, window.to);
    return { source: 'mock', blocked, checkoutDates: checkout_dates };
  }
  const tenantId = await tenantForUnit(listing);
  const avail = await blockedForListing(listing, window.from, window.to, tenantId);
  return { source: 'kwentra', blocked: avail.blocked, checkoutDates: avail.checkoutDates };
}

/** Nights asked room by room. Past this, a night is blocked only when the whole room type is sold out. */
const ROOM_SCAN_NIGHTS = 92;

function stayNightsFromReservation(reservation) {
  const arrival = String(reservation?.arrival_date || '').slice(0, 10);
  const departure = String(reservation?.departure_date || '').slice(0, 10);
  const nights = [];
  for (const night of reservation?.room_nights || []) {
    const roomRaw = night?.room_number ?? night?.room ?? night?.room_id;
    const roomId = roomRaw && typeof roomRaw === 'object' ? roomRaw.id : roomRaw;
    const typeRaw = night?.room_type ?? night?.actual_room_type;
    const roomTypeId = typeRaw && typeof typeRaw === 'object' ? typeRaw.id : typeRaw;
    const start = String(night?.from_date || night?.date || arrival || '').slice(0, 10);
    // Kwentra's room-night to_date is the last occupied night, not the departure morning.
    const lastNight = String(night?.to_date || '').slice(0, 10);
    let end = lastNight ? addDays(lastNight, 1) : '';
    if (!end || end <= start) end = start ? addDays(start, 1) : departure;
    if (roomId && start && end > start) {
      nights.push({ roomId: String(roomId), roomTypeId: roomTypeId != null ? String(roomTypeId) : '', arrival: start, departure: end });
    }
  }
  if (nights.length) return nights;
  const roomId = roomIdFromReservation(reservation);
  const roomTypeId = roomTypeFromReservation(reservation);
  if (roomId && arrival && departure > arrival) {
    return [{ roomId, roomTypeId, arrival, departure }];
  }
  return [];
}

/**
 * Apply an availability webhook body immediately (dates Kwentra already sent).
 * Returns how many nights were written.
 */
function ingestAvailabilityNotice(body, tenantId) {
  const tid = tenantId != null && tenantId !== '' ? tenantId : body?.tenant_id || body?.data?.tenant_id || kwentra.getTenantId();
  if (tid == null || tid === '') return { applied: 0, reason: 'missing_tenant' };
  const days = kwentra.collapseInventoryDays(kwentra.collectAvailabilityDays(body?.data ?? body), tid);
  if (!days.length) return { applied: 0 };
  const byType = new Map();
  for (const day of days) {
    if (!day.roomTypeId) continue;
    if (!byType.has(day.roomTypeId)) byType.set(day.roomTypeId, []);
    byType.get(day.roomTypeId).push(day);
  }
  let applied = 0;
  let closed = 0;
  for (const [roomTypeId, updates] of byType) {
    const key = snapshotKey(tid, roomTypeId);
    const prev = availabilitySnapshots.get(key);
    const blocked = new Set(prev?.blocked || []);
    let from = prev?.from || updates[0].date;
    let to = prev?.to || addDays(updates[0].date, 1);
    for (const day of updates) {
      if (day.date < from) from = day.date;
      const next = addDays(day.date, 1);
      if (next > to) to = next;
      if (day.avail <= 0) {
        blocked.add(day.date);
        closed += 1;
      } else {
        blocked.delete(day.date);
      }
      applied += 1;
    }
    const pushed = webhookInventory.get(key) || new Map();
    for (const day of updates) pushed.set(day.date, day.avail);
    webhookInventory.set(key, pushed);
    rememberAvailability(tid, roomTypeId, { from, to, blocked: [...blocked].sort(), checkoutDates: [] }, { force: true, key });
  }
  return { applied, closed, roomTypes: byType.size };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Try a Kwentra read a few times. A DNS blip must not skip the calendar. */
async function pullWithRetry(label, fn, fail) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (attempt < 3) await wait(700 * attempt);
    }
  }
  fail(label, last);
  return null;
}

/**
 * Blocked nights for every linked room type.
 * This is part of every sync: room-type calendars, then in-house and expected reservations.
 * A failed read keeps the previous calendar. It never leaves the type out of the next attempt.
 */
async function refreshAvailabilitySnapshots(report, fail, onlyTenant = null) {
  const from = localToday();
  const to = addCalendarMonths(from, AVAILABILITY_MONTHS);
  const compounds = await listCmsCompounds();
  const units = await listCmsUnits();
  let refreshed = 0;
  let roomTypes = 0;
  let roomTypesExpected = 0;
  for (const target of tenantTargets(compounds)) {
    if (onlyTenant && String(target.tenantId) !== String(onlyTenant)) continue;
    const rawRooms = (await pullWithRetry(
      `availability rooms — tenant ${target.tenantId}`,
      () => kwentra.listRooms({ tenantId: target.tenantId }),
      fail
    )) || [];
    const rooms = rawRooms.map(normalizeRoom).filter((r) => r.id);
    const blocked = new Map(rooms.map((r) => [r.id, new Set()]));
    const roomTypeOf = new Map(rooms.map((r) => [r.id, r.roomTypeId || '']));
    let rackIds = null;
    try {
      rackIds = (await bookableRoomTypes(target.tenantId)).ids;
    } catch (err) {
      fail(`room rack — tenant ${target.tenantId}`, err);
    }
    const typeIds = new Set();
    for (const room of rooms) {
      if (room.roomTypeId && (!rackIds || rackIds.has(room.roomTypeId))) typeIds.add(room.roomTypeId);
    }
    for (const unit of units) {
      if (unit.published === false) continue;
      const typeId = String(unit.kwentraRoomTypeId || '').trim();
      if (!typeId || (rackIds && !rackIds.has(typeId))) continue;
      const tenant = String(compounds.find((c) => c.id === unit.compoundId)?.kwentraTenantId || '').trim() || kwentra.getTenantId();
      if (String(tenant) === String(target.tenantId)) typeIds.add(typeId);
    }
    roomTypesExpected += typeIds.size;
    let authoritative = false;

    for (const typeId of typeIds) {
      const avail = await pullWithRetry(
        `availability type ${typeId}`,
        () => kwentra.getAvailability(typeId, { from, to, tenantId: target.tenantId, fresh: true }),
        fail
      );
      if (!avail) continue;
      authoritative = true;
      roomTypes += 1;
      const inventoryKey = snapshotKey(target.tenantId, typeId);
      const pushed = webhookInventory.get(inventoryKey) || new Map();
      for (const [date, count] of Object.entries(avail.roomsFree || {})) {
        if (date >= from && date < to) pushed.set(date, Number(count));
      }
      webhookInventory.set(inventoryKey, pushed);
      rememberAvailability(
        target.tenantId,
        typeId,
        { from, to, blocked: avail.blocked || [], checkoutDates: avail.checkoutDates || [] },
        { force: true }
      );
      for (const date of avail.blocked || []) {
        for (const room of rooms) if (room.roomTypeId === typeId && blocked.has(room.id)) blocked.get(room.id).add(date);
      }
    }

    const reservations = await pullWithRetry(
      `availability reservations — tenant ${target.tenantId}`,
      () => kwentra.listBlockingReservations({ tenantId: target.tenantId, from, to }),
      fail
    );
    if (reservations) {
      authoritative = true;
      for (const reservation of reservations) {
        for (const stay of stayNightsFromReservation(reservation)) {
          if (!blocked.has(stay.roomId)) blocked.set(stay.roomId, new Set());
          if (stay.roomTypeId) roomTypeOf.set(stay.roomId, stay.roomTypeId);
          for (const night of nightsOfStay(stay.arrival, stay.departure)) {
            if (night >= from && night < to) blocked.get(stay.roomId).add(night);
          }
        }
      }
    }

    // A night the availability grid still calls free is closed once every physical room of that
    // type is already on a reservation. The guest calendar reads the type snapshot, not each room.
    const roomsOfType = new Map();
    for (const room of rooms) {
      if (!room.roomTypeId) continue;
      if (!roomsOfType.has(room.roomTypeId)) roomsOfType.set(room.roomTypeId, []);
      roomsOfType.get(room.roomTypeId).push(room.id);
    }
    for (const [typeId, ids] of roomsOfType) {
      if (!ids.length) continue;
      const taken = [];
      const dates = new Set();
      for (const id of ids) for (const date of blocked.get(id) || []) dates.add(date);
      for (const date of dates) {
        if (ids.every((id) => blocked.get(id)?.has(date))) taken.push(date);
      }
      if (!taken.length) continue;
      authoritative = true;
      const inventoryKey = snapshotKey(target.tenantId, typeId);
      const prev = availabilitySnapshots.get(inventoryKey);
      const merged = new Set([...(prev?.blocked || []), ...taken]);
      rememberAvailability(
        target.tenantId,
        typeId,
        { from: prev?.from || from, to: prev?.to || to, blocked: [...merged].sort(), checkoutDates: prev?.checkoutDates || [] },
        { force: true }
      );
      const pushed = webhookInventory.get(inventoryKey) || new Map();
      for (const date of taken) pushed.set(date, 0);
      webhookInventory.set(inventoryKey, pushed);
    }

    if (!authoritative) continue;

    const roomIds = new Set([...rooms.map((r) => r.id), ...blocked.keys()]);
    for (const roomId of roomIds) {
      rememberAvailability(
        target.tenantId,
        roomTypeOf.get(roomId) || '',
        { from, to, blocked: [...(blocked.get(roomId) || [])].sort(), checkoutDates: [] },
        { force: true, key: `room:${target.tenantId}|${roomId}` }
      );
      refreshed += 1;
    }
  }
  report.availability = { units: refreshed, refreshed, roomTypes, roomTypesExpected, from, to };
  if (roomTypesExpected && roomTypes < roomTypesExpected) {
    console.warn(`[kwentra] availability incomplete — ${roomTypes}/${roomTypesExpected} room type(s). Previous calendars were kept.`);
  }
}

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
    const avail = await blockedForListing(listing, window.from, window.to, tenantId);
    // The rate definition (date range + adults) is the price. Total-stay is only used when that grid can't be read.
    let prices = {};
    let occupancy = {};
    let rate = null;
    try {
      ({ prices, occupancy, rate } = await pricesFromRateGrid(listing, window.from, window.to, { adults, children, tenantId }));
    } catch (err) {
      console.warn('[kwentra] rate grid failed, using total-stay:', err.message);
    }
    const span = Math.round((Date.parse(`${window.to}T00:00:00Z`) - Date.parse(`${window.from}T00:00:00Z`)) / 86400000);
    // A year-long calendar uses the rate grid already in memory. Total-stay is only for a short quote.
    if (!Object.keys(prices).length && span > 0 && span <= 14) {
      let cursor = window.from;
      const priceEnd = window.to < addDays(window.from, PRICE_WINDOW_NIGHTS) ? window.to : addDays(window.from, PRICE_WINDOW_NIGHTS);
      while (cursor < priceEnd) {
        const departure = addDays(cursor, 14) < priceEnd ? addDays(cursor, 14) : priceEnd;
        const piece = await collectNightPrices(listing, cursor, departure, { adults, children, tenantId });
        Object.assign(prices, piece.prices);
        rate = rate || piece.rate;
        cursor = departure;
      }
    }
    return {
      source: 'kwentra',
      slug: listing.slug,
      roomTypeId,
      tenantId,
      blocked: avail.blocked,
      checkoutDates: avail.checkoutDates,
      prices,
      occupancy,
      rate: rate ? { id: rate.rateId, code: rate.rateCode } : null,
      currency: 'USD',
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
function buildReservationPayload({ booking, roomTypeId, roomId, rateId, channelId, marketId, sourceId, guestProfileId, otherNameIds = [], discountPct = 0, hold = false }) {
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
    other_names: otherNameIds.map((id) => Number(id)).filter((id) => Number.isInteger(id)),
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

function profileIdOf(profile) {
  const id = profile?.id ?? profile?.individual_profile?.id ?? profile?.profile?.id;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * One Kwentra profile per additional guest. These ids go on reservation.other_names,
 * which is the Other Guests field. A name the guest entered must produce a profile.
 */
async function createOtherGuestProfiles(booking, tenantId) {
  const names = (booking?.otherGuestNames || []).map((name) => String(name).trim()).filter(Boolean);
  const ids = [];
  const errors = [];
  const failedNames = [];
  for (const name of names) {
    try {
      const profile = await kwentra.createGuestProfile(
        {
          name,
          nationality: booking.nationality || booking.reservationCountry || 'EG',
          country: booking.reservationCountry || 'EG',
        },
        { tenantId }
      );
      const id = profileIdOf(profile);
      if (!id) throw new Error('Kwentra did not return a profile id');
      ids.push(id);
    } catch (err) {
      failedNames.push(name);
      errors.push(`${name}: ${err.message}`);
      console.warn('[kwentra] other guest profile failed:', name, err.message);
    }
  }
  return { ids, errors, failedNames, expected: names.length };
}

/**
 * Special requests are a row in the reservation Notes panel (type + note).
 * Other guests are already on the create body; this only repairs a missing link.
 */
async function sendReservationExtras(reservationId, booking, tenantId, otherNameIds = []) {
  const extras = { otherGuests: otherNameIds.length, note: false, errors: [] };
  if (reservationId == null || reservationId === '') return extras;

  if (otherNameIds.length) {
    try {
      const current = await kwentra.getReservation(reservationId, { tenantId, includes: ['other_names', 'name'] });
      const linked = Array.isArray(current?.other_names) ? current.other_names.length : 0;
      if (linked < otherNameIds.length) {
        await kwentra.updateReservationFields(reservationId, { other_names: otherNameIds }, { tenantId });
      }
      extras.otherGuests = otherNameIds.length;
  } catch (err) {
      extras.errors.push(`other guests: ${err.message}`);
      console.warn('[kwentra] other guest names were not saved on the reservation:', err.message);
    }
  }

  const note = String(booking?.notes || '').trim();
  if (note) {
    try {
      await kwentra.addReservationNote(reservationId, note, { type: 'external', tenantId });
      extras.note = true;
    } catch (err) {
      extras.errors.push(`note: ${err.message}`);
      console.warn('[kwentra] special request was not saved:', err.message);
    }
  }
  return extras;
}

/** A physical room of this type that is free for every night of the stay. Guests never pick the room. */
async function findVacantRoom({ tenantId, roomTypeId, arrivalDate, departureDate }) {
  const typeId = String(roomTypeId || '');
  if (!typeId || !arrivalDate || !departureDate || arrivalDate >= departureDate) return null;
  const rooms = (
    await kwentra.listRooms({ tenantId, roomTypeId: typeId, from: arrivalDate, to: addDays(departureDate, -1), vacantOnly: true })
  ).map(normalizeRoom);
  const room = rooms.find((r) => r.id && (!r.roomTypeId || r.roomTypeId === typeId));
  if (!room) return null;
  return { ...room, ref: process.env.KWENTRA_ROOM_REF === 'number' ? room.number : room.id };
}

/**
 * Calendar + a live vacant-room check.
 * The stay is unavailable when the type inventory is 0, or when no physical room is free for every night.
 */
async function roomForStay(listing, arrivalDate, departureDate) {
  const roomTypeId = String(listing?.kwentraRoomTypeId || '');
  const tenantId = await tenantForUnit(listing);
  if (!roomTypeId) return { unavailable: false, occupied: [], room: null };
  const calendar = await blockedForListing(listing, arrivalDate, departureDate, tenantId);
  const occupied = (calendar.blocked || []).filter((d) => d >= arrivalDate && d < departureDate);
  if (occupied.length) return { unavailable: true, occupied, room: null, tenantId, roomTypeId };
  const room = await findVacantRoom({ tenantId, roomTypeId, arrivalDate, departureDate });
  if (!room) return { unavailable: true, occupied: nightsOfStay(arrivalDate, departureDate), room: null, tenantId, roomTypeId };
  return { unavailable: false, occupied: [], room, tenantId, roomTypeId };
}

/** After a booking, rewrite the type's free count for those nights so a sold-out date closes immediately. */
async function syncTypeInventoryForStay(tenantId, roomTypeId, arrivalDate, departureDate) {
  const nights = nightsOfStay(arrivalDate, departureDate);
  if (!tenantId || !roomTypeId || nights.length === 0 || nights.length > 14) return;
  const key = snapshotKey(tenantId, roomTypeId);
  const dates = webhookInventory.get(key) || new Map();
  for (const night of nights) {
    try {
      const free = await kwentra.listRooms({ tenantId, roomTypeId, from: night, to: night, vacantOnly: true });
      dates.set(night, free.length);
    } catch (err) {
      console.warn('[kwentra] room-type count failed', night, err.message);
    }
  }
  webhookInventory.set(key, dates);
  const prev = availabilitySnapshots.get(key);
  const blocked = new Set(prev?.blocked || []);
  let from = prev?.from || nights[0];
  let to = prev?.to || departureDate;
  for (const night of nights) {
    if (!dates.has(night)) continue;
    if (Number(dates.get(night)) <= 0) blocked.add(night);
    else blocked.delete(night);
    if (night < from) from = night;
    const next = addDays(night, 1);
    if (next > to) to = next;
  }
  rememberAvailability(tenantId, roomTypeId, { from, to, blocked: [...blocked].sort(), checkoutDates: [] }, { force: true, key });
}

const isConflict = (err) => err?.status === 409 || /overbook|not available|no (vacant )?room/i.test(err?.message || '');

/**
 * Live occupation scenarios for one room type.
 * Kwentra refuses a reservation unless the adult/child pair is one of these rows.
 * Stored rows are only used when the live read fails.
 */
async function readOccupancy(listing, tenantId) {
  const stored = normalizeOccupancies(listing?.occupancies);
  const roomTypeId = String(listing?.kwentraRoomTypeId || '');
  if (!roomTypeId || !kwentra.isConfigured()) {
    return { occupancies: stored, source: stored.length ? 'stored' : 'none' };
  }
  try {
    const types = await kwentra.listRoomTypes({ tenantId: tenantId || (await tenantForUnit(listing)) });
    const type = types.find((item) => String(item.id) === roomTypeId);
    const rawSet = type?.roomtypeoccupancy_set;
    const live = normalizeOccupancies(rawSet);
    if (Array.isArray(rawSet) && rawSet.length && !live.length) {
      console.warn(
        '[kwentra] occupancy set for room type',
        roomTypeId,
        'had no adult/child counts:',
        JSON.stringify(rawSet).slice(0, 400)
      );
    }
    if (live.length) return { occupancies: live, source: 'kwentra' };
  } catch (err) {
    console.warn('[kwentra] occupancy read failed:', err.message);
  }
  return { occupancies: stored, source: stored.length ? 'stored' : 'none' };
}

async function occupancyRows(listing, tenantId) {
  const { occupancies } = await readOccupancy(listing, tenantId);
  return occupancies;
}

function partyFits(rows, adults, children) {
  return partyAllowed(rows, adults, children);
}

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
    const room = await findVacantRoom({
      tenantId,
      roomTypeId,
      arrivalDate: booking.arrivalDate,
      departureDate: booking.departureDate,
    });
    if (!room) {
    return {
      pushed: false,
        conflict: true,
      path,
        error: 'No vacant room of this type in Kwentra for those dates',
      };
    }
    const occupancies = await occupancyRows(listing, tenantId).catch(() => []);
    if (!partyFits(occupancies, booking.adults, booking.children)) {
      const allowed = occupancies.map((row) => `${row.adults} adults${row.children ? ` + ${row.children} children` : ''}`).join(', ');
      return {
        pushed: false,
        path,
        error: `This room type does not allow ${booking.adults} adults and ${booking.children} children${allowed ? ` (Kwentra allows ${allowed})` : ''}`,
      };
    }
    const offered =
      rates ||
      (await roomTypeRates(listing, {
        arrivalDate: booking.arrivalDate,
        departureDate: booking.departureDate,
        adults: booking.adults,
        children: booking.children,
        tenantId,
      }).catch((err) => {
        console.warn('[kwentra] rates lookup failed:', err.message);
        return [];
      }));
    let rate = pickRate(offered, ratePlan?.code);
    // When totalstay fails (e.g. children_ages shape), still book on the website rate from the grid.
    if (!rate?.rateId) {
      const grid = await pricesFromRateGrid(listing, booking.arrivalDate, booking.departureDate, {
        adults: booking.adults,
        children: booking.children,
        tenantId,
        planCode: ratePlan?.code,
      }).catch(() => null);
      if (grid?.rate?.rateId) rate = { ...grid.rate, mapped: false };
    }
    const rateId = rate?.rateId;
    if (!rateId) {
      return {
        pushed: false,
        path,
        error: 'Kwentra has no rate for this room on those dates',
      };
    }
    const discountPct = rate && !rate.mapped ? -(Number(ratePlan?.adjustmentPct) || 0) : 0;
    const [channelId, { market, source }] = await Promise.all([kwentra.websiteChannelId(tenantId), kwentra.websiteMarketSource(tenantId)]);
    const otherGuests = await createOtherGuestProfiles(booking, tenantId);
    if (otherGuests.failedNames.length) {
      const retry = await createOtherGuestProfiles({ ...booking, otherGuestNames: otherGuests.failedNames }, tenantId);
      otherGuests.ids.push(...retry.ids);
      otherGuests.errors = retry.errors;
    }
    const payload = buildReservationPayload({
      booking,
      roomTypeId,
      roomId: room.ref,
      rateId,
      channelId,
      marketId: market,
      sourceId: source,
      guestProfileId,
      otherNameIds: otherGuests.ids,
      discountPct,
      hold,
    });
    const { id, data } = await kwentra.createReservation(payload, { tenantId });
    let accountId = kwentra.reservationAccountId(data);
    if (!accountId && id) {
      const created = await kwentra.getReservation(id, { tenantId, includes: ['account', 'state.name'] }).catch(() => null);
      accountId = kwentra.reservationAccountId(created);
    }
    kwentra.clearLiveCache(tenantId);
    patchRoomStay({
      tenantId,
      roomId: String(room.id),
      roomTypeId,
      arrivalDate: booking.arrivalDate,
      departureDate: booking.departureDate,
      block: true,
    });
    await syncTypeInventoryForStay(tenantId, roomTypeId, booking.arrivalDate, booking.departureDate);
    const extras = await sendReservationExtras(id, booking, tenantId, otherGuests.ids);
    extras.errors.push(...otherGuests.errors);
    if (otherGuests.expected && extras.otherGuests < otherGuests.expected) {
      extras.errors.push(`other guests: ${extras.otherGuests} of ${otherGuests.expected} saved on the reservation`);
    }
    return {
      pushed: true,
      path,
      tenantId,
      reservationId: id != null ? String(id) : null,
      accountId: accountId != null ? String(accountId) : null,
      room: room.number,
      rateId: rate?.rateId || null,
      extras,
    };
  } catch (err) {
    return { pushed: false, conflict: isConflict(err), path, status: err.status, error: err.message };
  }
}

/** Cash departments. Test tenant 394: EGP 2, USD 7. Production tenant 87: EGP 2, USD 3. */
const CASH_DEPARTMENTS = {
  394: { USD: '7', EGP: '2' },
  87: { USD: '3', EGP: '2' },
};

function departmentIdForCurrency(tenantId, currency) {
  const cur = String(currency || 'USD').toUpperCase() === 'EGP' ? 'EGP' : 'USD';
  let map = {};
  try {
    map = JSON.parse(process.env.KWENTRA_PAYMENT_DEPARTMENTS || '{}');
  } catch {
    console.warn('[kwentra] KWENTRA_PAYMENT_DEPARTMENTS is not valid JSON — ignoring it');
  }
  const entry = map[String(tenantId)];
  if (entry && typeof entry === 'object') {
    const id = entry[cur] ?? entry[cur.toLowerCase()];
    if (id != null && String(id) !== '') return String(id);
  } else if (entry != null && String(entry) !== '' && cur === 'USD') {
    return String(entry);
  }
  const known = CASH_DEPARTMENTS[String(tenantId)];
  if (known?.[cur]) return known[cur];
  const single = String(process.env.KWENTRA_PAYMENT_DEPARTMENT_ID || '').trim();
  return cur === 'USD' ? single : '';
}

/**
 * Cash department for the currency the rate is set up in.
 * Kwentra: post the payment in that currency, on the matching cash department.
 */
function paymentDepartment(tenantId, currency = 'USD') {
  const cur = String(currency || 'USD').toUpperCase() === 'EGP' ? 'EGP' : 'USD';
  const id = departmentIdForCurrency(tenantId, cur);
  if (!id) return { id: '', name: '', reason: `no ${cur} cash department is configured for tenant ${tenantId}` };
  return { id, name: cur === 'EGP' ? 'cash' : 'cash USD', type: 'cash' };
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
  let guestIssue = '';
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
            country: booking.reservationCountry,
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
    if (created.accountId) booking.kwentraAccountId = created.accountId;
    if (created.extras?.errors?.length) {
      const missing = created.extras.errors.join('; ');
      guestIssue = `Reservation ${reservationId} is in Kwentra but other guests or the special request were not saved (${missing}). Add them on the reservation before arrival.`;
    }
  }
  const result = await pushPayment({ ...payment, booking, reservationId });
  if (guestIssue) result.issue = [guestIssue, result.issue].filter(Boolean).join(' ');
  return { ...result, profileId };
}

/**
 * Record a website payment on its Kwentra reservation: an ON_HOLD reservation is confirmed (full update,
 * hold date removed); one Kwentra already auto-cancelled is reinstated — the same reservation, never a
 * second booking. Then the payment is posted on the billing account (Billing API) with a billing note.
 */
async function pushPayment({ booking, reservationId, amount, currency = 'USD', merchantOrderId, provider, transactionId }) {
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

  let current = null;
  try {
    current = await kwentra.getReservation(reservationId, { tenantId, includes: ['state.name', 'account'] });
  } catch (err) {
    current = await kwentra.getReservation(reservationId, { tenantId }).catch((fallbackErr) => {
      result.errors.push(`lookup: ${fallbackErr.message}`);
      return null;
    });
    if (!current) result.errors.push(`lookup: ${err.message}`);
  }
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
  const charged = booking?.chargeAmount && booking?.chargeCurrency
    ? ` Card charged ${Number(booking.chargeAmount)} ${booking.chargeCurrency} at Kwentra rate ${booking.fxRate}.`
    : '';
  const summary = `Paid online on the website: ${Number(amount)} ${currency} via ${provider || 'online payment'}${ref ? ` (ref ${ref})` : ''}${booking?.voucherNumber ? ` — voucher ${booking.voucherNumber}` : ''}.${charged}`;

  const { id: department, reason: noDepartment } = paymentDepartment(tenantId, currency);
  if (department) {
    await attempt('posted', async () => {
      const accountId = Number(booking?.kwentraAccountId) || kwentra.reservationAccountId(current);
      if (!accountId) throw new Error('the reservation response did not include a billing account');
      result.accountId = String(accountId);
      await kwentra.postPayment({
        tenantId,
        accountId,
        windowNumber: Number(process.env.KWENTRA_PAYMENT_WINDOW || 1),
        department,
        amount,
        comments: summary,
      });
    });
  } else {
    result.errors.push(`posted: ${noDepartment} — recorded as a note only`);
  }
  await attempt('noted', () => kwentra.addReservationNote(reservationId, summary, { type: 'billing', tenantId }));
  result.pushed = result.noted || result.posted || result.confirmed;
  if (!result.posted) {
    const postError = result.errors.find((e) => e.startsWith('posted:'))?.replace(/^posted:\s*/, '');
    const hint = /cashier/i.test(postError || '') ? ' — the Kwentra API user must be made a cashier' : '';
    result.issue = `Payment of ${Number(amount)} ${currency} is not on the Kwentra folio of reservation ${reservationId} — post it by hand.${postError ? ` (${postError}${hint})` : ''}`;
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
  if (result.accountId && result.accountId !== booking.kwentraAccountId) patch.kwentraAccountId = result.accountId;
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
  'occupancies',
];

// Guest-facing copy stays on the website. Kwentra still supplies these when a unit is first created.
const WEBSITE_COPY_FIELDS = ['title', 'description', 'bedrooms', 'bathrooms', 'areaSqm', 'bedType', 'amenities'];
const UNIT_SYNC_FIELDS = UNIT_PMS_FIELDS.filter((key) => !WEBSITE_COPY_FIELDS.includes(key));

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

/** A timer tick that landed while a sync was running must still pull availability. */
function finishSync() {
  const again = syncState.pending;
  syncState.pending = false;
  syncState.running = false;
  if (again) setImmediate(() => scheduledSync().catch((err) => console.warn('[kwentra] interval sync failed:', err.message)));
}

/** Last Kwentra availability read per tenant + room type. The minute sync fills a 12-month window. */
const availabilitySnapshots = new Map();
/** Dates Kwentra pushed in inventory_counts. These beat a later API calendar for the same night. */
const webhookInventory = new Map();
const AVAILABILITY_MONTHS = 12;
const AVAILABILITY_FRESH_MS = 3 * 60_000;

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addCalendarMonths(iso, n) {
  const [y, m, day] = iso.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function snapshotKey(tenantId, roomTypeId) {
  return `${tenantId}|${roomTypeId}`;
}

function rememberAvailability(tenantId, roomTypeId, snap, { force = false, key = snapshotKey(tenantId, roomTypeId) } = {}) {
  const prev = availabilitySnapshots.get(key);
  if (!force && prev) {
    const prevSpan = Date.parse(prev.to) - Date.parse(prev.from);
    const nextSpan = Date.parse(snap.to) - Date.parse(snap.from);
    if (prevSpan > nextSpan && Date.now() - prev.at < AVAILABILITY_FRESH_MS) return;
  }
  availabilitySnapshots.set(key, { ...snap, at: Date.now() });
}

function nightsInside(blocked, from, to) {
  return (blocked || []).filter((d) => d >= from && d < to);
}

function nightsOfStay(arrival, departure) {
  const nights = [];
  if (!arrival || !departure || arrival >= departure) return nights;
  for (let d = arrival; d < departure; d = addDays(d, 1)) nights.push(d);
  return nights;
}

function roomIdFromReservation(reservation) {
  for (const n of reservation?.room_nights || []) {
    const rn = n?.room_number ?? n?.room ?? n?.room_id;
    const id = rn && typeof rn === 'object' ? rn.id : rn;
    if (id != null && String(id).trim() !== '') return String(id);
  }
  const direct = reservation?.room_id ?? reservation?.room?.id ?? reservation?.room;
  if (direct != null && typeof direct !== 'object') return String(direct);
  if (direct && typeof direct === 'object' && direct.id != null) return String(direct.id);
  return '';
}

function roomTypeFromReservation(reservation) {
  for (const n of reservation?.room_nights || []) {
    const rt = n?.room_type ?? n?.actual_room_type;
    const id = rt && typeof rt === 'object' ? rt.id : rt;
    if (id != null && String(id).trim() !== '') return String(id);
  }
  const direct = reservation?.room_type_id ?? reservation?.room_type?.id;
  return direct != null ? String(direct) : '';
}

function ensureRoomSnap(tenantId, roomId) {
  const key = `room:${tenantId}|${roomId}`;
  let snap = availabilitySnapshots.get(key);
  if (!snap) {
    const from = localToday();
    const to = addCalendarMonths(from, AVAILABILITY_MONTHS);
    snap = { from, to, blocked: [], checkoutDates: [], at: Date.now() };
    availabilitySnapshots.set(key, snap);
  }
  return { key, snap };
}

/**
 * Instantly block or free stay nights on a room calendar (website ↔ Kwentra).
 * Guest calendars read this map, so a patch is visible on the next availability request.
 */
function patchRoomStay({ tenantId, roomId, roomTypeId, arrivalDate, departureDate, block }) {
  if (!tenantId || !roomId || !arrivalDate || !departureDate) return { ok: false };
  const { key, snap } = ensureRoomSnap(tenantId, roomId);
  const set = new Set(snap.blocked || []);
  if (arrivalDate < snap.from) snap.from = arrivalDate;
  if (departureDate > snap.to) snap.to = departureDate;
  for (const n of nightsOfStay(arrivalDate, departureDate)) {
    if (block) set.add(n);
    else set.delete(n);
  }
  snap.blocked = [...set].sort();
  snap.at = Date.now();
  snap.roomTypeId = roomTypeId || snap.roomTypeId || '';
  availabilitySnapshots.set(key, snap);
  return { ok: true, key, nights: nightsOfStay(arrivalDate, departureDate).length, block: Boolean(block) };
}

/** Re-check vacant status for one room over a short window (not a 92-day full tenant scan). */
async function refreshRoomStayWindow(tenantId, roomId, roomTypeId, from, to) {
  if (!tenantId || !roomId || !from || !to || from >= to) return;
  const { snap } = ensureRoomSnap(tenantId, roomId);
  const set = new Set(snap.blocked || []);
  const today = localToday();
  const scanFrom = from < today ? today : from;
  for (let day = scanFrom; day < to; day = addDays(day, 1)) {
    try {
      const vacant = await kwentra.listRooms({
        tenantId,
        roomTypeId: roomTypeId || undefined,
        from: day,
        to: day,
        vacantOnly: true,
      });
      const free = new Set(vacant.map((r) => String(r.id)));
      if (free.has(String(roomId))) set.delete(day);
      else set.add(day);
    } catch (err) {
      console.warn('[kwentra] room window refresh failed', day, err.message);
    }
  }
  snap.blocked = [...set].sort();
  snap.at = Date.now();
  if (roomTypeId) snap.roomTypeId = roomTypeId;
}

const pendingRoomWindows = new Map();

/** Queue a fast per-room vacant check for the stay window. Collapses bursts for the same room. */
function scheduleRoomWindowRefresh({ tenantId, roomId, roomTypeId, from, to }) {
  if (!tenantId || !roomId || !from || !to) return { queued: false };
  const key = `${tenantId}|${roomId}`;
  const prev = pendingRoomWindows.get(key);
  if (prev) {
    pendingRoomWindows.set(key, {
      tenantId,
      roomId,
      roomTypeId: roomTypeId || prev.roomTypeId,
      from: from < prev.from ? from : prev.from,
      to: to > prev.to ? to : prev.to,
    });
  } else {
    pendingRoomWindows.set(key, { tenantId, roomId, roomTypeId: roomTypeId || '', from, to });
  }
  return queueWebhook('room-avail', null, flushRoomWindowRefreshes, 0);
}

async function flushRoomWindowRefreshes() {
  if (!kwentra.isConfigured()) return;
  const jobs = [...pendingRoomWindows.values()];
  pendingRoomWindows.clear();
  for (const job of jobs) {
    try {
      await refreshRoomStayWindow(job.tenantId, job.roomId, job.roomTypeId, job.from, job.to);
    } catch (err) {
      console.warn('[kwentra] room-avail flush failed:', err.message);
    }
  }
  if (jobs.length) {
    syncState.lastTrigger = { reason: 'room-avail', at: new Date().toISOString() };
    console.log(`[kwentra] room-avail — ${jobs.length} room window(s) refreshed`);
  }
}

/**
 * Apply a Kwentra reservation onto the website calendar immediately.
 * Blocks on create/update; frees nights on cancel. Optionally frees a previous stay window.
 */
function syncReservationAvailability(reservation, tenantId, { previousArrival, previousDeparture } = {}) {
  if (!reservation) return { ok: false, reason: 'missing' };
  const tid = tenantId != null && tenantId !== '' ? tenantId : kwentra.getTenantId();
  if (tid == null || tid === '') return { ok: false, reason: 'missing_tenant' };
  const arrival = String(reservation.arrival_date || '').slice(0, 10);
  const departure = String(reservation.departure_date || '').slice(0, 10);
  const roomId = roomIdFromReservation(reservation);
  const roomTypeId = roomTypeFromReservation(reservation);
  const cancelled = kwentra.isCancelledReservation(reservation);
  tenantId = tid;

  if (roomId && previousArrival && previousDeparture && (previousArrival !== arrival || previousDeparture !== departure || cancelled)) {
    patchRoomStay({
      tenantId,
      roomId,
      roomTypeId,
      arrivalDate: previousArrival,
      departureDate: previousDeparture,
      block: false,
    });
  }

  if (!roomId || !arrival || !departure) {
    if (tenantId) scheduleAvailabilityRefresh(tenantId);
    return { ok: false, reason: roomId ? 'missing_dates' : 'missing_room', queuedFull: true };
  }

  const patched = patchRoomStay({
    tenantId,
    roomId,
    roomTypeId,
    arrivalDate: arrival,
    departureDate: departure,
    block: !cancelled,
  });
  if (roomTypeId && arrival && departure) {
    syncTypeInventoryForStay(tenantId, roomTypeId, arrival, departure).catch((err) =>
      console.warn('[kwentra] room-type inventory update failed:', err.message)
    );
  }
  return { ok: true, ...patched, cancelled };
}

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

function uniqueSlug(slugs, base) {
  let slug = base || 'room';
  for (let n = 2; slugs.has(slug); n += 1) slug = `${base}-${n}`;
  slugs.add(slug);
  return slug;
}

function hasListingValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return value > 0;
  return value != null && String(value).trim() !== '';
}

function rackTypeName(row) {
  const type = row?.type;
  const name = type && typeof type === 'object' ? type.room_type || type.name || type.description : type;
  return norm(name);
}

/** Room type ids named on a rate row with a positive adult amount. A row that names no type does not price every type. */
function pricedRoomTypeIds(definitions) {
  const ids = new Set();
  for (const definition of definitions || []) {
    for (const row of definition.rows || []) {
      if (!(row.adults || []).some((amount) => Number(amount) > 0)) continue;
      for (const id of row.roomTypeIds || []) ids.add(String(id));
    }
  }
  return ids;
}

/**
 * Room types that are on the room rack, have a Kwentra website rate, and a room count above zero.
 * Inventory-only types, rack types with no rate, and types with no sellable rooms cannot be booked.
 * Throws when the rack or the rate grid cannot be read, so a failed call does not hide the site.
 */
async function bookableRoomTypes(tenantId) {
  const [rawTypes, rack, definitions] = await Promise.all([
    kwentra.listRoomTypes({ tenantId, fresh: true }),
    kwentra.listRoomRack({ tenantId }),
    kwentra.rateDefinitions(tenantId),
  ]);
  if (!rack.length) {
    const err = new Error('Kwentra room rack returned no rooms');
    err.status = 502;
    throw err;
  }
  const priced = pricedRoomTypeIds(definitions);
  if (!definitions.length || !priced.size) {
    const err = new Error('Kwentra returned no room type rates');
    err.status = 502;
    throw err;
  }
  const numbersByName = new Map();
  for (const row of rack) {
    const name = rackTypeName(row);
    if (!name) continue;
    const number = String(row.number ?? '').trim();
    if (!numbersByName.has(name)) numbersByName.set(name, []);
    if (number) numbersByName.get(name).push(number);
  }
  const types = rawTypes
    .map(normalizeRoomType)
    .filter(
      (type) =>
        type.kwentraRoomTypeId &&
        numbersByName.has(norm(type.title)) &&
        priced.has(type.kwentraRoomTypeId)
    );
  for (const type of types) {
    const numbers = numbersByName.get(norm(type.title)) || [];
    if (!numbers.length) continue;
    type.unitNumbers = numbers;
    type.roomCount = numbers.length;
  }
  const from = new Date().toISOString().slice(0, 10);
  const to = addDays(from, 370);
  const sellable = [];
  for (const type of types) {
    const availability = await kwentra.getAvailability(type.kwentraRoomTypeId, { from, to, tenantId, fresh: true });
    if (availability.maxRoomCount == null || availability.maxRoomCount > 0) sellable.push(type);
  }
  return { types: sellable, ids: new Set(sellable.map((type) => type.kwentraRoomTypeId)) };
}

/**
 * Guests see one listing per room type that is on the room rack and has a rate.
 * Physical Kwentra rooms are unpublished. Photos and details that only lived on a room
 * are copied onto the type so the category stays bookable.
 */
async function showRoomTypesOnly() {
  const compounds = await listCmsCompounds();
  const tenantOfCompound = new Map(
    compounds.map((compound) => [compound.id, String(compound.kwentraTenantId || '').trim() || kwentra.getTenantId()])
  );
  // null means that tenant's rack or rates could not be read, so its listings stay as they are
  const bookableByTenant = new Map();
  for (const target of tenantTargets(compounds)) {
    const tenantId = String(target.tenantId);
    try {
      bookableByTenant.set(tenantId, (await bookableRoomTypes(tenantId)).ids);
    } catch (err) {
      console.warn(`[kwentra] room rack lookup failed for tenant ${tenantId}:`, err.message);
      bookableByTenant.set(tenantId, null);
    }
  }
  const units = await listCmsUnits();
  const tenantOfUnit = (unit) => tenantOfCompound.get(unit.compoundId) || kwentra.getTenantId();
  const groupKey = (unit) => `${tenantOfUnit(unit)}:${unit.kwentraRoomTypeId}`;
  const rooms = units.filter((u) => roomIdOf(u) && u.kwentraRoomTypeId);
  const typeKeys = [...new Set(rooms.map(groupKey))];
  const copyKeys = ['images', 'driveFolderUrl', 'description', 'amenities', 'pricePerNight', 'areaSqm', 'bedrooms', 'bathrooms', 'maxGuests', 'propertyType', 'bedType'];
  let hidden = 0;
  let shown = 0;
  for (const key of typeKeys) {
    const ofType = rooms.filter((u) => groupKey(u) === key);
    const tenantId = String(tenantOfUnit(ofType[0]));
    const allowed = bookableByTenant.get(tenantId);
    const onRack = Boolean(allowed?.has(String(ofType[0].kwentraRoomTypeId)));
    const donor = ofType.slice().sort((a, b) => copyKeys.filter((key) => hasListingValue(b[key])).length - copyKeys.filter((key) => hasListingValue(a[key])).length)[0];
    let template = units.find((u) => !roomIdOf(u) && groupKey(u) === key);
    if (!template && donor && onRack) {
      const title = String(donor.title || '').replace(/\s·\s.*$/, '').trim() || donor.propertyType || donor.title;
      const saved = await updateUnit(donor.id, { kwentraRoomId: '', title, published: true });
      if (saved) {
        Object.assign(donor, saved);
        template = donor;
        shown += 1;
      }
    } else if (template && donor) {
      const patch = {};
      for (const key of copyKeys) {
        if (!hasListingValue(template[key]) && hasListingValue(donor[key])) patch[key] = donor[key];
      }
      if (template.published === false && onRack) patch.published = true;
      if (Object.keys(patch).length) {
        const saved = await updateUnit(template.id, patch);
        if (saved) Object.assign(template, saved);
        if (patch.published === true) shown += 1;
      }
    }
    for (const room of ofType) {
      if (template && room.id === template.id) continue;
      if (room.published === false) continue;
      const saved = await updateUnit(room.id, { published: false });
      if (saved) room.published = false;
      hidden += 1;
    }
  }
  for (const unit of units) {
    const typeId = String(unit.kwentraRoomTypeId || '').trim();
    if (!typeId) continue;
    const allowed = bookableByTenant.get(String(tenantOfUnit(unit)));
    if (!allowed || allowed.has(typeId)) continue;
    await deleteUnit(unit.id);
    hidden += 1;
  }
  if (hidden || shown) console.log(`[kwentra] listings — hid ${hidden} room(s), published ${shown} room type(s)`);
  return { hidden, shown };
}

/** Room types of one tenant → one website listing per type. Physical rooms stay hidden. */
async function syncTenant(target, compounds, report, fail) {
  const label = target.compounds.length ? target.compounds.map((c) => c.name).join(', ') : `tenant ${target.tenantId || '(default)'}`;
  let types;
  let rackIds;
  try {
    const bookable = await bookableRoomTypes(target.tenantId);
    types = bookable.types;
    rackIds = bookable.ids;
  } catch (err) {
    fail(`room rack — ${label}`, err);
    return;
  }
  let rawRooms = [];
  try {
    rawRooms = (await kwentra.listRooms({ tenantId: target.tenantId })).map(normalizeRoom).filter((r) => r.id && r.number);
  } catch (err) {
    fail(`rooms — ${label}`, err);
  }
  const roomsByType = groupRooms(rawRooms);

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
    const grouped = roomsByType.get(t.kwentraRoomTypeId);
    const typeRooms = rawRooms.filter((r) => r.roomTypeId === t.kwentraRoomTypeId);
    const incoming = { ...t };
    if (grouped && !incoming.unitNumbers?.length) {
      incoming.unitNumbers = grouped.unitNumbers;
      incoming.roomCount = grouped.unitNumbers.length;
      if (!incoming.floor && grouped.floors.size) incoming.floor = [...grouped.floors].join(', ');
    }
    let template =
      units.find((u) => !roomIdOf(u) && u.kwentraRoomTypeId && String(u.kwentraRoomTypeId) === t.kwentraRoomTypeId) ||
      (home && units.find((u) => !roomIdOf(u) && !u.kwentraRoomTypeId && u.compoundId === home.id && norm(u.title) === norm(t.title)));

    if (!template) {
      const fields = pick(incoming, UNIT_PMS_FIELDS);
      template = await createUnit({
        ...fields,
        slug: uniqueSlug(slugs, slugify(`${home?.name || ''} ${t.title}`) || `room-type-${t.kwentraRoomTypeId}`),
        compoundId: home?.id || '',
        images: [],
        driveFolderUrl: '',
        kwentraRoomTypeId: t.kwentraRoomTypeId,
        kwentraSnapshot: fields,
        published: true,
      });
      units.push(template);
      report.units.created += 1;
    } else {
      const patch = mergeFromPms(template, incoming, UNIT_SYNC_FIELDS);
      if (!template.kwentraRoomTypeId) patch.kwentraRoomTypeId = t.kwentraRoomTypeId;
      if (!template.compoundId && home) patch.compoundId = home.id;
      if (template.published === false) patch.published = true;
      if (Object.keys(patch).length) {
        const saved = await updateUnit(template.id, patch);
        if (saved) template = saved;
        else Object.assign(template, patch);
        report.units.updated += 1;
      } else {
        report.units.unchanged += 1;
      }
    }

    for (const room of typeRooms) {
      const existing = units.find((u) => roomIdOf(u) === room.id);
      if (existing && existing.published !== false) {
        const saved = await updateUnit(existing.id, { published: false });
        if (saved) Object.assign(existing, saved);
        else existing.published = false;
        report.units.updated += 1;
      }
    }
  }

  if (rackIds.size) {
    for (const unit of units) {
      const typeId = String(unit.kwentraRoomTypeId || '').trim();
      if (!typeId || rackIds.has(typeId)) continue;
      await deleteUnit(unit.id);
      report.units.updated += 1;
    }
  }
}

/** One website property per Kwentra hotel this login can open. */
async function discoverProperties(report, fail) {
  let tenantIds = [];
  try {
    tenantIds = await kwentra.listAccessibleClients();
  } catch (err) {
    fail('properties', err);
    return;
  }
  if (!tenantIds.length) tenantIds = [kwentra.getTenantId()].filter(Boolean);

  for (const tenantId of tenantIds) {
    let company = null;
    try {
      company = await kwentra.getMainCompany(tenantId);
    } catch (err) {
      fail(`property ${tenantId}`, err);
      continue;
    }
    const name = String(company?.name || '').trim();
    if (!name) continue;
    const kind = String(company.instance_type || '').toLowerCase();
    if (/demo|head\s*office|headoffice/.test(kind)) continue;

    const city = String(company.city || '').trim();
    let destinations = await listCmsDestinations();
    let destination = city ? destinations.find((item) => norm(item.name) === norm(city)) : null;
    if (!destination && city) {
      destination = await createDestination({
        id: slugify(city) || `city-${tenantId}`,
        name: city,
        country: company.country || '',
      });
      report.destinations.created += 1;
    }

    const compounds = await listCmsCompounds();
    const found =
      compounds.find((item) => String(item.kwentraTenantId || '') === String(tenantId)) ||
      compounds.find((item) => norm(item.name) === norm(name));
    const mapsUrl = String(company.location || '').trim();
    const coords = mapsUrl ? coordsFromMapsUrl(mapsUrl) || {} : {};
    if (!found) {
      const base = slugify(name) || `property-${tenantId}`;
      const id = compounds.some((item) => item.id === base) ? `${base}-${tenantId}` : base;
      await createCompound({
        id,
        name,
        destinationId: destination?.id || '',
        city,
        address: company.address || '',
        phone: company.phone || '',
        mapsUrl,
        ...coords,
        kwentraTenantId: String(tenantId),
        kwentraProjectId: company.id != null ? String(company.id) : '',
        published: false,
      });
      report.properties.created += 1;
      continue;
    }

    const patch = {};
    if (!found.kwentraTenantId) patch.kwentraTenantId = String(tenantId);
    if (norm(found.name) !== norm(name)) patch.name = name;
    if (!found.city && city) patch.city = city;
    if (!found.address && company.address) patch.address = company.address;
    if (!found.phone && company.phone) patch.phone = company.phone;
    if (!found.mapsUrl && mapsUrl) patch.mapsUrl = mapsUrl;
    if (!found.destinationId && destination) patch.destinationId = destination.id;
    if (!found.kwentraProjectId && company.id != null) patch.kwentraProjectId = String(company.id);
    if (Object.keys(patch).length) {
      await updateCompound(found.id, patch);
      report.properties.updated += 1;
    }
  }
}

/** A property with a bookable unit type is shown. One with none stays off the site. */
async function publishPropertiesWithUnits() {
  const [compounds, units] = await Promise.all([listCmsCompounds(), listCmsUnits()]);
  for (const compound of compounds) {
    if (!String(compound.kwentraTenantId || '').trim()) continue;
    const hasUnit = units.some((unit) => unit.compoundId === compound.id && unit.published !== false && !roomIdOf(unit));
    if (hasUnit && compound.published === false) await updateCompound(compound.id, { published: true });
    if (!hasUnit && compound.published !== false) await updateCompound(compound.id, { published: false });
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
    await discoverProperties(report, fail);
    const compounds = await listCmsCompounds();
    for (const target of tenantTargets(compounds)) {
      try {
        await syncTenant(target, compounds, report, fail);
      } catch (err) {
        fail(`units — tenant ${target.tenantId}`, err);
      }
    }
  } catch (err) {
    report.ok = false;
    fail('sync', err);
  }
  try {
    await refreshAvailabilitySnapshots(report, fail);
  } catch (err) {
    report.ok = false;
    fail('availability', err);
  }
  try {
    await publishPropertiesWithUnits();
  } catch (err) {
    fail('properties', err);
  }
  try {
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
    finishSync();
    console.log(
      `[kwentra-sync] ${report.ok ? 'done' : 'failed'} — ${report.tenants.length} tenant(s), units +${report.units.created} ~${report.units.updated}, availability ${report.availability?.roomTypes ?? 0}/${report.availability?.roomTypesExpected ?? 0} room type(s), ${report.incomplete?.count ?? 0} incomplete (hidden)${report.errors.length ? `, ${report.errors.length} error(s)` : ''}`
    );
  }
  return report;
}

const webhookJobs = { units: null, availability: null, 'room-avail': null };

/** Bursts of the same notice collapse into one pull. delayMs 0 = next tick (instant). */
function queueWebhook(kind, tenantId, fn, delayMs = 50) {
  const key = kind;
  const slot = webhookJobs[key] || { tenants: new Set(), timer: null, running: false, fn };
  webhookJobs[key] = slot;
  slot.fn = fn;
  if (tenantId != null) slot.tenants.add(tenantId ? String(tenantId) : '*');
  else slot.tenants.add('*');
  if (slot.running) return { queued: true, when: 'after the current pull' };
  clearTimeout(slot.timer);
  const run = () => {
    slot.timer = null;
    slot.running = true;
    const tenants = [...slot.tenants];
    slot.tenants.clear();
    Promise.resolve(slot.fn(tenants))
      .catch((err) => console.warn('[kwentra-webhook]', kind, err.message))
      .finally(() => {
        slot.running = false;
        if (slot.tenants.size) queueWebhook(kind, null, slot.fn, delayMs);
      });
  };
  if (delayMs <= 0) {
    slot.timer = setTimeout(run, 0);
  } else {
    slot.timer = setTimeout(run, delayMs);
  }
  slot.timer.unref?.();
  return { queued: true, when: delayMs <= 0 ? 'now' : `in ${delayMs}ms` };
}

async function pullUnitsFromWebhook(tenants) {
  if (!kwentra.isConfigured()) return;
  syncState.running = true;
  const compounds = await listCmsCompounds();
  const wanted = new Set(tenants.filter((id) => id && id !== '*'));
  const targets = tenantTargets(compounds).filter((t) => !wanted.size || wanted.has(String(t.tenantId)));
  const report = {
    ok: true,
    kind: 'units',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    tenants: [],
    units: { created: 0, updated: 0, unchanged: 0 },
    errors: [],
  };
  const fail = (kind, err) => {
    report.errors.push({ kind, message: err.message });
    report.ok = false;
  };
  try {
    for (const target of targets) await syncTenant(target, compounds, report, fail);
    await applyDefinedRates(wanted.size === 1 ? [...wanted][0] : null);
  } catch (err) {
    fail('units', err);
  }
  try {
    await refreshAvailabilitySnapshots(report, fail);
  } catch (err) {
    fail('availability', err);
  } finally {
    report.finishedAt = new Date().toISOString();
    syncState.last = report;
    syncState.lastTrigger = { reason: 'webhook: units', at: report.finishedAt };
    finishSync();
    console.log(
      `[kwentra-webhook] units — ${report.tenants.length} tenant(s), +${report.units.created} ~${report.units.updated}, availability ${report.availability?.roomTypes ?? 0}/${report.availability?.roomTypesExpected ?? 0} room type(s)${report.errors.length ? `, ${report.errors.length} error(s)` : ''}`
    );
  }
}

/**
 * Write each room type's allowed adult/child pairs onto its listing.
 * Called on boot and whenever Kwentra sends an availability or room webhook.
 */
async function refreshRoomTypeOccupancies(onlyTenant = null) {
  if (!kwentra.isConfigured()) return { updated: 0, types: 0 };
  const compounds = await listCmsCompounds();
  const units = await listCmsUnits();
  const tenantOf = new Map(compounds.map((c) => [c.id, String(c.kwentraTenantId || '').trim()]));
  let updated = 0;
  let types = 0;
  for (const target of tenantTargets(compounds)) {
    if (onlyTenant && String(target.tenantId) !== String(onlyTenant)) continue;
    let rawTypes;
    try {
      rawTypes = await kwentra.listRoomTypes({ tenantId: target.tenantId, fresh: true });
    } catch (err) {
      console.warn('[kwentra] occupancy pull failed:', err.message);
      continue;
    }
    const ownIds = new Set(target.compounds.map((c) => c.id));
    const inScope = (unit) => (target.fallback ? !tenantOf.get(unit.compoundId) : ownIds.has(unit.compoundId));
    for (const raw of rawTypes) {
      const normalized = normalizeRoomType(raw);
      if (!normalized.kwentraRoomTypeId || !normalized.occupancies.length) continue;
      types += 1;
      const unit = units.find(
        (item) => inScope(item) && !roomIdOf(item) && String(item.kwentraRoomTypeId) === normalized.kwentraRoomTypeId
      );
      if (!unit) continue;
      const patch = {};
      if (!same(unit.occupancies, normalized.occupancies)) patch.occupancies = normalized.occupancies;
      if (normalized.maxGuests && Number(unit.maxGuests) !== Number(normalized.maxGuests)) patch.maxGuests = normalized.maxGuests;
      if (!Object.keys(patch).length) continue;
      const saved = await updateUnit(unit.id, patch);
      if (saved) Object.assign(unit, saved);
      else Object.assign(unit, patch);
      updated += 1;
    }
  }
  if (updated) console.log(`[kwentra] occupancy — updated ${updated} room type(s)`);
  return { updated, types };
}

async function pullAvailabilityFromWebhook(tenants) {
  if (!kwentra.isConfigured()) return;
  syncState.running = true;
  const report = { ok: true, kind: 'availability', errors: [], startedAt: new Date().toISOString() };
  const fail = (kind, err) => {
    report.errors.push({ kind, message: err.message });
    report.ok = false;
  };
  const ids = tenants.filter((id) => id && id !== '*');
  try {
    await refreshRoomTypeOccupancies(ids.length === 1 ? ids[0] : null).catch((err) => fail('occupancy', err));
    if (!ids.length) await refreshAvailabilitySnapshots(report, fail);
    else for (const id of ids) await refreshAvailabilitySnapshots(report, fail, id);
  } finally {
    report.finishedAt = new Date().toISOString();
    syncState.last = report;
    syncState.lastTrigger = { reason: 'webhook: availability', at: report.finishedAt };
    finishSync();
    console.log(
      `[kwentra-webhook] availability ${report.availability?.roomTypes ?? 0}/${report.availability?.roomTypesExpected ?? 0} room type(s)${report.errors.length ? `, ${report.errors.length} error(s)` : ''}`
    );
  }
}

/**
 * Write the rate-grid amount onto each linked unit's card price.
 * Two adults is the price the listing shows, matching the calendar default.
 */
async function applyDefinedRates(onlyTenant = null) {
  if (!kwentra.isConfigured()) return { updated: 0 };
  const compounds = await listCmsCompounds();
  const units = await listCmsUnits();
  const targets = tenantTargets(compounds).filter((t) => !onlyTenant || String(t.tenantId) === String(onlyTenant));
  const today = localToday();
  let updated = 0;
  for (const target of targets) {
    let definitions;
    try {
      definitions = await kwentra.rateDefinitions(target.tenantId);
    } catch (err) {
      console.warn('[kwentra] rate grid failed:', err.message);
      continue;
    }
    const compoundIds = new Set(target.compounds.map((c) => c.id));
    for (const unit of units) {
      if (!unit.kwentraRoomTypeId || !compoundIds.has(unit.compoundId)) continue;
      const amount =
        cardAmount(definitions, unit.kwentraRoomTypeId, 2, today, 'BB') ||
        cardAmount(definitions, unit.kwentraRoomTypeId, 2, today, 'RO');
      if (!(amount > 0) || Number(unit.pricePerNight) === amount) continue;
      await updateUnit(unit.id, { pricePerNight: amount });
      updated += 1;
    }
  }
  return { updated };
}

async function pullRatesFromWebhook(tenants) {
  if (!kwentra.isConfigured()) return;
  syncState.running = true;
  const ids = tenants.filter((id) => id && id !== '*');
  const report = { ok: true, kind: 'rates', errors: [], startedAt: new Date().toISOString(), rates: { updated: 0 } };
  try {
    const result = await applyDefinedRates(ids.length === 1 ? ids[0] : null);
    report.rates = result;
  } catch (err) {
    report.ok = false;
    report.errors.push({ kind: 'rates', message: err.message });
  }
  try {
    const fail = (kind, err) => {
      report.errors.push({ kind, message: err.message });
      report.ok = false;
    };
    if (ids.length) {
      for (const id of ids) await refreshAvailabilitySnapshots(report, fail, id);
    } else {
      await refreshAvailabilitySnapshots(report, fail);
    }
  } catch (err) {
    report.ok = false;
    report.errors.push({ kind: 'availability', message: err.message });
  } finally {
    report.finishedAt = new Date().toISOString();
    syncState.last = report;
    syncState.lastTrigger = { reason: 'webhook: rates', at: report.finishedAt };
    finishSync();
    console.log(
      `[kwentra-webhook] rates — ${report.rates?.updated ?? 0} card price(s), availability ${report.availability?.roomTypes ?? 0}/${report.availability?.roomTypesExpected ?? 0} room type(s)`
    );
  }
}

/** Full tenant blocked-nights pull (boot / admin / availability webhook). */
function scheduleAvailabilityRefresh(tenantId) {
  if (!kwentra.isConfigured()) return { queued: false };
  return queueWebhook('availability', tenantId, pullAvailabilityFromWebhook, 50);
}

/**
 * What a Kwentra webhook should do after the route handles the payload.
 * Reservation notices apply blocked nights instantly in the route (syncReservationAvailability).
 * Availability notices store the payload, then pull each room-type calendar from Kwentra.
 * A date is closed only when that pull (or the payload) says the type has 0 rooms left.
 * Rate notices store USD occupancy columns. Room notices pull the room-type listing.
 */
function onKwentraWebhook({ type, tenantId, body } = {}) {
  syncState.lastTrigger = { reason: `webhook: ${type}`, at: new Date().toISOString() };
  if (/avail|calendar|occupan/.test(type)) {
    kwentra.clearLiveCache(tenantId ?? undefined);
    const inline = ingestAvailabilityNotice(body, tenantId);
    showRoomTypesOnly().catch((err) => console.warn('[kwentra] room-type listings failed:', err.message));
    return { action: 'availability', inline, ...scheduleAvailabilityRefresh(tenantId) };
  }
  if (/room|unit|inventor/.test(type)) {
    return { action: 'units', ...queueWebhook('units', tenantId, pullUnitsFromWebhook, 50) };
  }
  if (/rate/.test(type)) {
    const inline = kwentra.rememberRatePlans(tenantId || body?.tenant_id || body?.data?.tenant_id, body?.data || body);
    kwentra.clearLookupCache();
    return { action: 'rates', inline, ...queueWebhook('rates', tenantId, pullRatesFromWebhook, 50) };
  }
  if (/reserv/.test(type)) {
    kwentra.clearLiveCache(tenantId ?? undefined);
    return { action: 'reservation', instant: true, ...scheduleAvailabilityRefresh(tenantId) };
  }
  return { action: 'ignored', queued: false };
}

function syncEveryMinutes() {
  const minutes = Number(process.env.KWENTRA_SYNC_MINUTES);
  return Number.isFinite(minutes) && minutes >= 1 ? minutes : 3.5;
}

/** Load each tenant's rate grid into memory so a guest calendar does not wait on Kwentra. */
async function warmRateGrid(report, fail) {
  const compounds = await listCmsCompounds();
  for (const target of tenantTargets(compounds)) {
    try {
      await kwentra.rateDefinitions(target.tenantId);
      const priced = await applyDefinedRates(target.tenantId);
      report.rates = { ...(report.rates || {}), [target.tenantId]: priced.updated };
    } catch (err) {
      fail(`rates — tenant ${target.tenantId}`, err);
    }
  }
}

/**
 * Room types, occupancy, blocked nights, and the rate grid.
 * Runs on a timer so a missed Sync click does not leave the calendar stale.
 */
async function scheduledSync() {
  if (!kwentra.isConfigured()) return { ok: false, reason: 'not_configured' };
  if (syncState.running) {
    syncState.pending = true;
    return { ok: false, reason: 'already_running', queued: true };
  }
  syncState.running = true;
  syncState.pending = false;
  syncState.lastTrigger = { reason: 'interval', at: new Date().toISOString() };
  const report = {
    ok: true,
    kind: 'interval',
    errors: [],
    startedAt: new Date().toISOString(),
    tenants: [],
    destinations: { created: 0, updated: 0 },
    properties: { created: 0, updated: 0 },
    units: { created: 0, updated: 0, unchanged: 0 },
  };
  const fail = (kind, err) => {
    report.errors.push({ kind, message: err.message });
    report.ok = false;
  };
  try {
    await discoverProperties(report, fail);
    const compounds = await listCmsCompounds();
    for (const target of tenantTargets(compounds)) {
      try {
        await syncTenant(target, compounds, report, fail);
      } catch (err) {
        fail(`units — tenant ${target.tenantId}`, err);
      }
    }
    try {
      report.occupancy = await refreshRoomTypeOccupancies();
    } catch (err) {
      fail('occupancy', err);
    }
    try {
      await warmRateGrid(report, fail);
    } catch (err) {
      fail('rates', err);
    }
    try {
      await publishPropertiesWithUnits();
    } catch (err) {
      fail('properties', err);
    }
  } catch (err) {
    fail('interval', err);
  }
  try {
    await refreshAvailabilitySnapshots(report, fail);
  } catch (err) {
    fail('availability', err);
  } finally {
    report.finishedAt = new Date().toISOString();
    syncState.last = report;
    finishSync();
    const avail = report.availability;
    console.log(
      `[kwentra] interval sync — availability ${avail?.roomTypes ?? 0}/${avail?.roomTypesExpected ?? 0} room type(s), ${avail?.refreshed ?? 0} room calendar(s), units +${report.units.created} ~${report.units.updated}${report.errors.length ? `, ${report.errors.length} error(s)` : ''}`
    );
  }
  return report;
}

function startAutoSync() {
  if (syncState.timer) clearInterval(syncState.timer);
  const ms = syncEveryMinutes() * 60 * 1000;
  syncState.timer = setInterval(() => {
    scheduledSync().catch((err) => console.warn('[kwentra] interval sync failed:', err.message));
  }, ms);
  syncState.timer.unref?.();
  console.log(`[kwentra] auto sync every ${syncEveryMinutes()} minutes`);
  return { minutes: syncEveryMinutes() };
}

/** Fill room blocked-night snapshots once the API is up (webhooks alone are not enough). */
async function warmAvailability() {
  if (!kwentra.isConfigured()) return { ok: false, reason: 'not_configured' };
  if (syncState.running) {
    syncState.pending = true;
    return { ok: false, reason: 'already_running', queued: true };
  }
  syncState.running = true;
  syncState.lastTrigger = { reason: 'boot', at: new Date().toISOString() };
  const report = { ok: true, kind: 'availability', errors: [], startedAt: new Date().toISOString() };
  const fail = (kind, err) => {
    report.errors.push({ kind, message: err.message });
    report.ok = false;
  };
  try {
    try {
      await showRoomTypesOnly();
    } catch (err) {
      console.warn('[kwentra] room-type listings failed:', err.message);
    }
    try {
      const occupancy = await refreshRoomTypeOccupancies();
      report.occupancy = occupancy;
    } catch (err) {
      console.warn('[kwentra] occupancy pull failed:', err.message);
    }
    await refreshAvailabilitySnapshots(report, fail);
  } catch (err) {
    fail('availability', err);
  }
  try {
    await warmRateGrid(report, fail);
  } catch (err) {
    fail('rates', err);
  } finally {
    report.finishedAt = new Date().toISOString();
    syncState.last = report;
    finishSync();
    const avail = report.availability;
    console.log(
      `[kwentra] boot availability — ${avail?.roomTypes ?? 0}/${avail?.roomTypesExpected ?? 0} room type(s), ${avail?.refreshed ?? 0} room(s)${report.errors.length ? `, ${report.errors.length} error(s)` : ''}`
    );
  }
  return report;
}

async function syncStatus() {
  const configured = kwentra.isConfigured();
  const compounds = await listCmsCompounds();
  const linked = compounds.filter((c) => String(c.kwentraTenantId || '').trim());
  return {
    configured,
    running: syncState.running,
    autoSyncMinutes: syncEveryMinutes(),
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

module.exports = {
  tenantForUnit,
  tenantForBooking,
  tenantTargets,
  pullRoomTypes,
  pullRooms,
  pullUnitsMerged,
  pullAvailability,
  blockedNights,
  findVacantRoom,
  roomForStay,
  occupancyRows,
  readOccupancy,
  partyFits,
  pricesFromRateGrid,
  applyDefinedRates,
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
  paymentDepartment,
  pushPaidBooking,
  recordPaymentResult,
  buildReservationPayload,
  saveUnitWithSync,
  normalizeRoomType,
  normalizeDestination,
  normalizeProject,
  normalizeRoom,
  publicProperty,
  syncStatus,
  syncFromKwentra,
  warmAvailability,
  startAutoSync,
  onKwentraWebhook,
  syncReservationAvailability,
  patchRoomStay,
};
