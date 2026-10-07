/**
 * Kwentra PMS — headless HTTP client aligned to the Kwentra API pack (OpenAPI files):
 *
 *  roomtype                  GET  /api/reservation/roomtype/
 *
 * Lists are dynamic-rest: only ids come back unless the wanted fields are asked for with include[].
 *  room-v2                   GET  /api/reservation/room/v2/?filter{type}=…&filter{from_date}…&filter{showvacantrooms}
 *  room-availability         GET  /api/reservation/rooms/availability/{room_type_id}/?start_date&end_date
 *  rate-v2                   GET  /api/reservation/rate/v2/ · /api/reservation/rate/v2/totalstay/
 *  channelprofile            GET  /api/core/channelprofile/
 *  individualprofile-v3      GET/POST/PUT /api/core/individualprofile/v3/
 *  individualreservation-v2  POST /api/reservation/individualreservation/v2/ · PUT {id}/ · POST {id}/note/
 *                            PATCH /api/reservation/individualreservation/{id}/change_state/
 *  market · source           GET  /api/core/market/ · /api/core/source/  → {id, code, description}
 *  billing                   POST /api/income/payment/ · GET /api/income/posting/
 *
 * Every request carries `tenant_id` — the Kwentra tenant of the property the unit belongs to
 * (property "Kwentra tenant ID" in the admin), falling back to KWENTRA_TENANT_ID.
 * Paths can be overridden with KWENTRA_PATH_* env vars.
 *
 * Guest browser NEVER calls these — only our Node gateway does.
 */

const DEFAULT_BASE = 'https://manage.kwentra.com';
const DEFAULT_TIMEOUT_MS = 30_000;

/** key → [env overrides…, default path from the API pack] */
const PATHS = {
  roomTypes: ['KWENTRA_PATH_ROOM_TYPES', '/api/reservation/roomtype/'],
  roomType: ['KWENTRA_PATH_ROOM_TYPE', '/api/reservation/roomtype/:id/'],
  rooms: ['KWENTRA_PATH_ROOMS', '/api/reservation/room/v2/'],
  availability: ['KWENTRA_PATH_AVAILABILITY', '/api/reservation/rooms/availability/:id/'],
  rates: ['KWENTRA_PATH_RATES', '/api/reservation/rate/v3/'],
  totalStay: ['KWENTRA_PATH_TOTAL_STAY', '/api/reservation/rate/v2/totalstay/'],
  channelProfiles: ['KWENTRA_PATH_CHANNEL_PROFILES', '/api/core/channelprofile/'],
  profiles: ['KWENTRA_PATH_PROFILES', 'KWENTRA_PATH_CREATE_PROFILE', '/api/core/individualprofile/v3/'],
  reservations: ['KWENTRA_PATH_RESERVATIONS', 'KWENTRA_PATH_CREATE_RESERVATION', '/api/reservation/individualreservation/v2/'],
  reservation: ['KWENTRA_PATH_RESERVATION', '/api/reservation/individualreservation/v2/:id/'],
  reservationNote: ['KWENTRA_PATH_RESERVATION_NOTE', '/api/reservation/individualreservation/v2/:id/note/'],
  reservationState: ['KWENTRA_PATH_RESERVATION_STATE', '/api/reservation/individualreservation/:id/change_state/'],
  markets: ['KWENTRA_PATH_MARKETS', '/api/core/market/'],
  sources: ['KWENTRA_PATH_SOURCES', '/api/core/source/'],
  // Billing API: credit posting on a billing account window
  payment: ['KWENTRA_PATH_PAYMENT', '/api/income/payment/'],
  postings: ['KWENTRA_PATH_POSTINGS', '/api/income/posting/'],
  departments: ['KWENTRA_PATH_DEPARTMENTS', '/api/income/department/v3/'],
};

function pathFor(key, id) {
  const spec = PATHS[key];
  const fallback = spec[spec.length - 1];
  const override = spec.slice(0, -1).map((name) => String(process.env[name] || '').trim()).find(Boolean);
  const path = override || fallback;
  return id != null ? path.replace(':id', encodeURIComponent(id)) : path;
}

const RESERVATION_INCLUDES = [
  'name.first_name',
  'name.last_name',
  'name.name',
  'name.guest_preferences',
  'check_in_time',
  'check_out_time',
  'channel.name',
  'country',
  'market',
  'source',
  'group_reservation.name',
  'group_reservation.confirmation_number',
  'state.name',
  'current_room_night.room_number',
  'current_room_night.actual_room_type.room_type',
  'current_room_night.number_of_adults',
  'current_room_night.number_of_children',
  'room_nights.board_type.description',
];

const PROFILE_INCLUDES = [
  'name',
  'nationality_object.name',
  'email',
  'telephone',
  'mobile',
  'id',
  'passport',
  'first_name',
  'last_name',
  'document_type.name',
  'issue_date',
  'issue_place',
  'work_phone',
  'driving_license_number',
  'old_id',
  'ID_number',
  'occupation',
  'individualprofilecontactinfo_set.city',
  'individualprofilecontactinfo_set.country.name',
  'guest_preferences',
];

function isConfigured() {
  return Boolean(
    process.env.KWENTRA_API_TOKEN ||
      (process.env.KWENTRA_USERNAME && process.env.KWENTRA_PASSWORD) ||
      process.env.KWENTRA_BASIC_TOKEN ||
      process.env.KWENTRA_API_KEY
  );
}

/** Tenant used when a property has no tenant of its own (single-hotel setups) */
function getTenantId() {
  return String(process.env.KWENTRA_TENANT_ID || process.env.KWENTRA_PROPERTY_ID || '').trim();
}

function baseUrl() {
  return String(process.env.KWENTRA_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
}

/**
 * The pack defines no security scheme, so every common option is supported:
 *  KWENTRA_API_TOKEN (+ KWENTRA_AUTH_SCHEME, default "Token") · KWENTRA_USERNAME/PASSWORD (Basic) · KWENTRA_BASIC_TOKEN
 */
function authHeader() {
  const apiToken = String(process.env.KWENTRA_API_TOKEN || '').trim();
  if (apiToken) {
    if (/^\S+\s+\S/.test(apiToken)) return apiToken;
    return `${String(process.env.KWENTRA_AUTH_SCHEME || 'Token').trim()} ${apiToken}`;
  }
  if (process.env.KWENTRA_BASIC_TOKEN) {
    const token = process.env.KWENTRA_BASIC_TOKEN;
    return token.startsWith('Basic ') ? token : `Basic ${token}`;
  }
  if (process.env.KWENTRA_USERNAME && process.env.KWENTRA_PASSWORD) {
    const raw = `${process.env.KWENTRA_USERNAME}:${process.env.KWENTRA_PASSWORD}`;
    return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;
  }
  if (process.env.KWENTRA_API_KEY) {
    const key = process.env.KWENTRA_API_KEY;
    return key.startsWith('Basic ') ? key : `Basic ${key}`;
  }
  return null;
}

/** DRF error bodies: {detail}, {message}, or {field: [messages]} */
function errorMessage(data, status) {
  if (data && typeof data === 'object') {
    if (data.detail || data.message || data.error) return String(data.detail || data.message || data.error);
    const parts = Object.entries(data)
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : typeof v === 'object' ? JSON.stringify(v) : v}`);
    if (parts.length) return parts.join(' · ');
  }
  return `Kwentra ${status}`;
}

const MAX_RATE_LIMIT_RETRIES = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const AUTH_PAUSE_MS = 15 * 60_000;
let authBlocked = null;

/** Rejected login / expired password / locked account — repeated attempts would keep the account locked */
const isAuthFailure = (err) => err.status === 401 || err.status === 423 || (err.status === 403 && /password|credential|locked|authenticat/i.test(err.message));

function authStatus() {
  return authBlocked && Date.now() < authBlocked.until ? { ...authBlocked } : null;
}

/**
 * Kwentra API passwords expire every 70 days (KWENTRA_PASSWORD_DAYS). With KWENTRA_PASSWORD_CHANGED_ON
 * (YYYY-MM-DD) set, the admin shows when the next change is due. No password value is ever read here.
 */
function passwordStatus() {
  const changedOn = String(process.env.KWENTRA_PASSWORD_CHANGED_ON || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(changedOn) || process.env.KWENTRA_API_TOKEN) return null;
  const lifetime = Math.max(1, Number(process.env.KWENTRA_PASSWORD_DAYS) || 70);
  const expiresOn = addDays(changedOn, lifetime);
  const daysLeft = Math.ceil((Date.parse(`${expiresOn}T00:00:00Z`) - Date.now()) / 864e5);
  return { changedOn, expiresOn, daysLeft, dueSoon: daysLeft <= 10 };
}

/**
 * Kwentra API passwords expire every 70 days. KWENTRA_PASSWORD_CHANGED_ON (YYYY-MM-DD, the day the
 * password was last set) lets the admin warn before bookings stop. null when the date is not set.
 */
function passwordStatus() {
  const changed = String(process.env.KWENTRA_PASSWORD_CHANGED_ON || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(changed) || process.env.KWENTRA_API_TOKEN) return null;
  const days = Math.max(1, Number(process.env.KWENTRA_PASSWORD_DAYS) || 70);
  const expires = new Date(`${changed}T00:00:00Z`);
  expires.setUTCDate(expires.getUTCDate() + days);
  const daysLeft = Math.ceil((expires.getTime() - Date.now()) / 864e5);
  return { changedOn: changed, expiresOn: expires.toISOString().slice(0, 10), daysLeft };
}

/*
 * Kwentra allows 7 calls per second. Every request takes a slot first; at most KWENTRA_MAX_RPS
 * (default 6, a margin under the limit) start in any one-second window, the rest wait their turn.
 */
const startTimes = [];
let slotQueue = Promise.resolve();

function maxPerSecond() {
  const n = Math.floor(Number(process.env.KWENTRA_MAX_RPS));
  return n > 0 ? Math.min(n, 7) : 6;
}

function takeSlot() {
  const turn = slotQueue.then(async () => {
    for (;;) {
      const now = Date.now();
      while (startTimes.length && now - startTimes[0] >= 1000) startTimes.shift();
      if (startTimes.length < maxPerSecond()) {
        startTimes.push(now);
        return;
      }
      await sleep(1000 - (now - startTimes[0]) + 5);
    }
  });
  slotQueue = turn.catch(() => {});
  return turn;
}

/** Throttled to Kwentra's per-second limit; waits and retries on 429 */
async function kwentraFetch(path, options = {}) {
  const blocked = authStatus();
  if (blocked) {
    const err = new Error(`Kwentra login paused until ${new Date(blocked.until).toLocaleTimeString()} after: ${blocked.message}`);
    err.status = blocked.status;
    err.code = 'KWENTRA_AUTH_PAUSED';
    throw err;
  }
  for (let attempt = 0; ; attempt += 1) {
    try {
      await takeSlot();
      return await kwentraRequest(path, options);
    } catch (err) {
      if (isAuthFailure(err)) {
        authBlocked = { status: err.status, message: err.message, until: Date.now() + AUTH_PAUSE_MS };
        console.warn(`[kwentra] login refused (${err.status} ${err.message}) — pausing Kwentra calls for 15 minutes`);
      }
      if (err.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) throw err;
      const retryAfter = Number(err.retryAfter);
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 60) * 1000 : 2000 * 2 ** attempt);
    }
  }
}

async function kwentraRequest(path, { method = 'GET', query, body, formData, tenantId } = {}) {
  if (!isConfigured()) {
    const err = new Error('Kwentra is not configured. Set the Kwentra API credentials and tenant ID in Server/.env.');
    err.status = 503;
    err.code = 'KWENTRA_NOT_CONFIGURED';
    throw err;
  }

  const url = new URL(path.startsWith('http') ? path : `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`);
  const tenant = String(tenantId || getTenantId()).trim();
  if (tenant && !url.searchParams.has('tenant_id')) url.searchParams.set('tenant_id', tenant);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, String(item)));
      else url.searchParams.set(k, String(v));
    });
  }

  const headers = { Accept: 'application/json, text/plain, */*', Authorization: authHeader() };
  if (body !== undefined && !formData) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(errorMessage(data, res.status));
      err.status = res.status;
      err.data = data;
      err.retryAfter = res.headers.get('retry-after');
      throw err;
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeout = new Error('Kwentra did not answer in time');
      timeout.status = 504;
      throw timeout;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Lists arrive as an array, under a named key, or under results (array or {Entity_List: […]}) */
function extractList(data, keys = []) {
  if (Array.isArray(data)) return data;
  for (const holder of [data, data?.results]) {
    if (!holder || typeof holder !== 'object') continue;
    if (Array.isArray(holder)) return holder;
    for (const key of keys) if (Array.isArray(holder[key])) return holder[key];
    const arrays = Object.values(holder).filter(Array.isArray);
    if (holder === data?.results && arrays.length === 1) return arrays[0];
  }
  return [];
}

/**
 * GET every page of a Kwentra list — DRF `next` links or dynamic-rest `meta.total_pages` —
 * so new records are never missed because they landed past the first page.
 */
async function listAll(path, { query = {}, keys = [], tenantId, maxPages = 50 } = {}) {
  const origin = new URL(baseUrl()).origin;
  const items = [];
  let data = await kwentraFetch(path, { query: { page_size: 500, per_page: 500, ...query }, tenantId });
  items.push(...extractList(data, keys));
  for (let page = 2; page <= maxPages; page += 1) {
    if (typeof data?.next === 'string' && data.next) {
      // Credentials go with every request — only follow links back to the Kwentra host
      if (new URL(data.next, origin).origin !== origin) break;
      data = await kwentraFetch(new URL(data.next, origin).toString(), { tenantId });
    } else if (Number(data?.meta?.total_pages) >= page) {
      data = await kwentraFetch(path, { query: { per_page: 500, ...query, page }, tenantId });
    } else break;
    items.push(...extractList(data, keys));
  }
  return items;
}

/* ——— Inventory ——— */

const ROOM_TYPE_INCLUDES = [
  'room_type',
  'code',
  'description',
  'capacity',
  'category',
  'child_related',
  'room_features',
  'roomtypeoccupancy_set',
];
const LOOKUP_INCLUDES = ['code', 'description'];

async function listRoomTypes({ tenantId } = {}) {
  return listAll(pathFor('roomTypes'), {
    tenantId,
    query: { 'include[]': ROOM_TYPE_INCLUDES },
    keys: ['RoomType_Entities', 'room_types', 'roomtypes', 'roomtype'],
  });
}

/** Physical rooms; with from/to + vacantOnly → rooms free on every night from `from` to `to` (to = the last night, not departure) */
async function listRooms({ tenantId, roomTypeId, from, to, vacantOnly = false } = {}) {
  const query = {};
  if (roomTypeId) query['filter{type}'] = roomTypeId;
  if (from && to) {
    query['filter{from_date}'] = from;
    query['filter{to_date}'] = to;
    if (vacantOnly) query['filter{showvacantrooms}'] = 'true';
  }
  return listAll(pathFor('rooms'), { tenantId, query, keys: ['rooms', 'Room_Entities', 'room'] });
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/*
 * Kwentra limits requests per minute, so identical availability / price lookups share one answer for
 * KWENTRA_CACHE_SECONDS (default 60) and concurrent identical calls share one request.
 * Booking checks pass fresh: true and always ask Kwentra.
 */
const liveCache = new Map();
const LIVE_CACHE_MAX = 500;

function liveCacheMs() {
  const seconds = Number(process.env.KWENTRA_CACHE_SECONDS);
  return (Number.isFinite(seconds) && seconds >= 0 ? seconds : 60) * 1000;
}

function cachedLive(key, fresh, fn) {
  const ttl = liveCacheMs();
  const hit = liveCache.get(key);
  if (!fresh && ttl && hit && Date.now() - hit.at < ttl) return hit.promise;
  const promise = fn();
  liveCache.set(key, { at: Date.now(), promise });
  promise.catch(() => liveCache.get(key)?.promise === promise && liveCache.delete(key));
  if (liveCache.size > LIVE_CACHE_MAX) {
    for (const [k, v] of liveCache) if (Date.now() - v.at >= ttl) liveCache.delete(k);
    while (liveCache.size > LIVE_CACHE_MAX) liveCache.delete(liveCache.keys().next().value);
  }
  return promise;
}

/** Drop cached availability / prices — all, or one tenant's (after a booking or a Kwentra webhook) */
function clearLiveCache(tenantId) {
  if (tenantId == null) return liveCache.clear();
  const prefix = `${tenantId}|`;
  for (const k of liveCache.keys()) if (k.split(':')[1]?.startsWith(prefix)) liveCache.delete(k);
}

/**
 * GET /api/reservation/rooms/availability/{room_type_id}/ → [{dt, avail, occupancy, room_count, ooo}]
 * A night is blocked when no room of the type is free. The list is per night, so checking out on the
 * morning of a blocked night is already allowed — no separate checkout dates.
 */
function getAvailability(roomTypeId, { from, to, tenantId, fresh = false } = {}) {
  const tenant = String(tenantId || getTenantId());
  return cachedLive(`avail:${tenant}|${roomTypeId}|${from}|${to}`, fresh, () =>
    fetchAvailability(roomTypeId, { from, to, tenantId: tenant })
  );
}

async function fetchAvailability(roomTypeId, { from, to, tenantId } = {}) {
  const data = await kwentraFetch(pathFor('availability', roomTypeId), {
    query: { start_date: from, end_date: to },
    tenantId,
  });
  const days = extractList(data, ['availability', 'days', 'total']);
  const free = new Map();
  for (const day of days) {
    const date = String(day?.dt || day?.date || '').slice(0, 10);
    if (!date) continue;
    const avail = Number(day.avail ?? day.available ?? day.availability);
    free.set(date, Number.isFinite(avail) ? avail : 0);
  }
  if (!free.size && from && to && from < to) {
    const err = new Error('Kwentra returned no availability days for this room type');
    err.status = 502;
    throw err;
  }
  // A night Kwentra did not report is treated as unavailable
  for (let date = from; from && to && date < to; date = addDays(date, 1)) {
    if (!free.has(date)) free.set(date, 0);
  }
  const blocked = [...free.entries()].filter(([, avail]) => avail <= 0).map(([date]) => date).sort();
  return {
    blocked,
    checkoutDates: [],
    roomsFree: Object.fromEntries(free),
    roomTypeId: roomTypeId || null,
    source: 'kwentra',
  };
}

/* ——— Rates ——— */

async function listRates({ tenantId, from, to, roomTypeId, channel } = {}) {
  const data = await kwentraFetch(pathFor('rates'), {
    query: { start_date: from, end_date: to, room_type: roomTypeId, channel },
    tenantId,
  });
  return extractList(data, ['rates', 'Rate_Entities']);
}

function childrenAgesParam(ages = []) {
  if (process.env.KWENTRA_CHILDREN_AGES_FORMAT === 'repeat') return ages.length ? ages : '[]';
  return JSON.stringify(ages);
}

/**
 * GET /api/reservation/rate/v2/totalstay/ — every applicable rate and its total for the stay,
 * grouped by room type name. Returns a flat list; empty when Kwentra answers 204 (no rates).
 */
function quoteTotalStay({ fresh = false, ...params } = {}) {
  const tenant = String(params.tenantId || getTenantId());
  const { arrivalDate, departureDate, adults = 1, childrenAges = [], channel, rate, company } = params;
  const key = `quote:${tenant}|${arrivalDate}|${departureDate}|${adults}|${childrenAges.join(',')}|${channel || ''}|${rate || ''}|${company || ''}`;
  return cachedLive(key, fresh, () => fetchTotalStay({ ...params, tenantId: tenant }));
}

async function fetchTotalStay({ tenantId, arrivalDate, departureDate, adults = 1, childrenAges = [], channel, rate, company } = {}) {
  const data = await kwentraFetch(pathFor('totalStay'), {
    query: {
      arrival_date: arrivalDate,
      departure_date: departureDate,
      adults,
      children: childrenAges.length,
      children_ages: childrenAgesParam(childrenAges),
      channel,
      rate,
      company,
    },
    tenantId,
  });
  if (!data || typeof data !== 'object') return [];
  const groups = Array.isArray(data) ? [data] : Object.values(data).filter(Array.isArray);
  return groups.flat().map((r) => ({
    rateId: r.id != null ? String(r.id) : '',
    rateCode: r.rate_code || '',
    roomTypeId: r.room_type_id != null ? String(r.room_type_id) : '',
    roomType: r.room_type || '',
    quote: Number(r.quote) || 0,
    nights: (r.nights || []).map((n) => Number(n.gross_rate ?? n.rate) || 0),
  }));
}

async function listChannelProfiles({ tenantId } = {}) {
  const list = await listAll(pathFor('channelProfiles'), {
    tenantId,
    maxPages: 5,
    query: { 'include[]': ['name', 'rates.code'] },
    keys: ['channel_profiles', 'channelprofiles'],
  });
  return list.map((c) => ({
    id: c.id != null ? String(c.id) : '',
    name: c.name || '',
    rates: (c.rates || []).map((r) => ({ id: String(r.id), code: r.code || '' })),
  }));
}

const channelCache = new Map();
const CHANNEL_TTL_MS = 10 * 60_000;

/**
 * Website channel of a tenant → { id, rateIds }: KWENTRA_CHANNEL_IDS (JSON per tenant) / KWENTRA_CHANNEL_ID,
 * else the profile matching KWENTRA_CHANNEL_NAME, else the one named "Hotel Website" (Prime's revenue
 * manager), else the first Website/Direct one. rateIds = rates Kwentra offers on that channel, in order.
 */
async function websiteChannel(tenantId) {
  const key = String(tenantId || getTenantId());
  const cached = channelCache.get(key);
  if (cached && Date.now() - cached.at < CHANNEL_TTL_MS) return cached.value;
  const forcedId = tenantMapValue('KWENTRA_CHANNEL_IDS', key) || String(process.env.KWENTRA_CHANNEL_ID || '').trim();
  let value = { id: forcedId, rateIds: [] };
  try {
    const profiles = await listChannelProfiles({ tenantId });
    const named = (re) => profiles.find((c) => re.test(String(c.name || '').trim()));
    const profile = forcedId
      ? profiles.find((c) => c.id === forcedId)
      : process.env.KWENTRA_CHANNEL_NAME
        ? named(new RegExp(process.env.KWENTRA_CHANNEL_NAME, 'i'))
        : named(/^hotel\s*website$/i) || named(/^website$/i) || named(/\bdirect\b/i);
    value = { id: forcedId || profile?.id || '', rateIds: (profile?.rates || []).map((r) => r.id) };
  } catch (err) {
    console.warn('[kwentra] channel profiles lookup failed:', err.message);
    return value;
  }
  channelCache.set(key, { at: Date.now(), value });
  return value;
}

async function websiteChannelId(tenantId) {
  return (await websiteChannel(tenantId)).id;
}

const lookupCache = new Map();

async function cached(key, fn) {
  const hit = lookupCache.get(key);
  if (hit && Date.now() - hit.at < CHANNEL_TTL_MS) return hit.value;
  const value = await fn();
  lookupCache.set(key, { at: Date.now(), value });
  return value;
}

function clearLookupCache() {
  lookupCache.clear();
  channelCache.clear();
  liveCache.clear();
}

const isTrue = (v) => v === true || v === 1 || v === 'true' || v === 'True';

/**
 * Rates flagged web=true in a tenant (Kwentra: `filter{web}=true`) — the rates the previous online
 * booking engine sold. Only trusted when the filter actually narrows the list: a server that ignores
 * it returns every rate, and then this is empty so callers fall back to the website channel profile.
 */
async function webRateIds(tenantId) {
  const tenant = String(tenantId || getTenantId());
  try {
    return await cached(`web-rates:${tenant}`, async () => {
      const ids = async (filter) =>
        (await listAll(pathFor('rates'), { tenantId: tenant, maxPages: 5, query: filter, keys: ['rates', 'Rate_Entities'] }))
          .filter((r) => r?.id != null && (filter['filter{web}'] !== 'true' || r.web == null || isTrue(r.web)))
          .map((r) => String(r.id));
      const [web, all] = await Promise.all([ids({ 'filter{web}': 'true' }), ids({})]);
      return web.length && web.length < all.length ? web : [];
    });
  } catch (err) {
    console.warn('[kwentra] web rates lookup failed:', err.message);
    return [];
  }
}

/** Markets or sources of a tenant → [{id, code, description}] */
async function listLookup(key, { tenantId } = {}) {
  return listAll(pathFor(key), {
    tenantId,
    maxPages: 5,
    query: { 'include[]': LOOKUP_INCLUDES },
    keys: [key, 'results'],
  });
}

/**
 * Billing departments of a tenant → [{id, code, name, type, paymentType, active}].
 * type: "debit" = charges (Room Revenue…), "credit" = payments (cash, card, city ledger), "tax".
 */
async function listDepartments({ tenantId } = {}) {
  const tenant = String(tenantId || getTenantId());
  return cached(`departments:${tenant}`, async () =>
    (await listAll(pathFor('departments'), { tenantId: tenant, maxPages: 5, keys: ['departments', 'results'] })).map((d) => ({
      id: String(d.id),
      code: d.code != null ? String(d.code) : '',
      name: d.description || d.name || '',
      type: String(d.type || '').toLowerCase(),
      paymentType: d.payment_type || null,
      active: d.is_active !== false,
    }))
  );
}

/** Per-tenant id from a JSON env map like {"394": "2", "375": "5"} */
function tenantMapValue(envName, tenant) {
  try {
    const map = JSON.parse(process.env[envName] || '{}');
    const value = map?.[tenant];
    return value != null ? String(value).trim() : '';
  } catch {
    console.warn(`[kwentra] ${envName} is not valid JSON`);
    return '';
  }
}

/**
 * Market and source ids for website bookings in a tenant, first found of:
 * KWENTRA_MARKET_IDS / KWENTRA_SOURCE_IDS (JSON per tenant), KWENTRA_MARKET_ID / KWENTRA_SOURCE_ID,
 * the entry whose name matches KWENTRA_MARKET_NAME / KWENTRA_SOURCE_NAME.
 * Without a name setting: source = "Individual" / "Independent" (code IN preferred), market = none —
 * Prime does not tie markets to the channel, so the reservation is sent without one.
 */
async function websiteMarketSource(tenantId) {
  const tenant = String(tenantId || getTenantId());
  const pick = async (key, envId, envName, defaultName) => {
    const forced = tenantMapValue(`${envId}S`, tenant) || String(process.env[envId] || '').trim();
    if (forced) return forced;
    const wanted = process.env[envName] ? new RegExp(process.env[envName], 'i') : defaultName;
    if (!wanted) return '';
    try {
      return await cached(`${key}:${tenant}`, async () => {
        const list = await listLookup(key, { tenantId: tenant });
        const matches = list.filter((m) => wanted.test(String(m.description || m.name || '').trim()) || wanted.test(String(m.code || '').trim()));
        const match = matches.find((m) => /^IN$/i.test(String(m.code || '').trim())) || matches[0];
        return match?.id != null ? String(match.id) : '';
      });
    } catch (err) {
      console.warn(`[kwentra] ${key} lookup failed:`, err.message);
      return '';
    }
  };
  return {
    market: await pick('markets', 'KWENTRA_MARKET_ID', 'KWENTRA_MARKET_NAME', null),
    source: await pick('sources', 'KWENTRA_SOURCE_ID', 'KWENTRA_SOURCE_NAME', /^(individual|independent)$/i),
  };
}

/* ——— Reservations ——— */

function extractReservations(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.results?.reservations)) return payload.results.reservations;
  if (Array.isArray(payload.reservations)) return payload.reservations;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload)) return payload;
  return [];
}

function appendIncludes(url, includes) {
  for (const field of includes) url.searchParams.append('include[]', field);
}

/** GET /api/reservation/individualreservation/v2/ */
async function listReservations({
  arrivalGte,
  arrivalLte,
  stateRegex = 'Checked In|Checked Out|No Show|Expected|Canceled',
  sort = '-id',
  includes = RESERVATION_INCLUDES,
  extraQuery = {},
  tenantId,
} = {}) {
  const url = new URL(`${baseUrl()}${pathFor('reservations')}`);
  appendIncludes(url, includes);
  if (sort) url.searchParams.append('sort[]', sort);
  if (stateRegex) url.searchParams.set('filter{state.name.regex}', stateRegex);
  if (arrivalGte) url.searchParams.set('filter{arrival_date.gte}', arrivalGte);
  if (arrivalLte) url.searchParams.set('filter{arrival_date.lte}', arrivalLte);
  Object.entries(extraQuery).forEach(([k, v]) => {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  });

  const data = await kwentraFetch(url.toString(), { tenantId });
  const reservations = extractReservations(data);
  return {
    count: data?.count ?? reservations.length,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    reservations,
    raw: data,
  };
}

/** POST /api/reservation/individualreservation/v2/ → { id } (400 = overbooking / validation) */
async function createReservation(body, { tenantId } = {}) {
  const data = await kwentraFetch(pathFor('reservations'), { method: 'POST', body, tenantId });
  return { id: data?.id ?? data?.reservation?.id ?? null, data };
}

/** PUT /api/reservation/individualreservation/v2/{id}/ */
async function updateReservation(id, body, { tenantId } = {}) {
  return kwentraFetch(pathFor('reservation', id), { method: 'PUT', body, tenantId });
}

/** GET /api/reservation/individualreservation/v2/{id}/ */
async function getReservation(id, { tenantId, includes = ['state.name'] } = {}) {
  const data = await kwentraFetch(pathFor('reservation', id), { tenantId, query: { 'include[]': includes } });
  return data?.reservation || data;
}

/** Kwentra cancels an unpaid ON_HOLD reservation at its hold date; the state turns "Canceled" */
const isCancelledReservation = (reservation) => /cancel/i.test(String(reservation?.state?.name || reservation?.state || ''));

/** Billing account of a reservation — the field Kwentra uses is configurable (KWENTRA_RESERVATION_ACCOUNT_FIELD) */
function reservationAccountId(reservation) {
  const fields = [process.env.KWENTRA_RESERVATION_ACCOUNT_FIELD, 'billing_account', 'account_id', 'reservation_account', 'account'].filter(Boolean);
  for (const field of fields) {
    const v = reservation?.[field];
    const id = v && typeof v === 'object' ? v.id : v;
    if (id != null && id !== '' && Number.isFinite(Number(id))) return Number(id);
  }
  return null;
}

/**
 * Billing API — POST /api/income/payment/?account={id}&window_number={n} (or ?window={id}) with
 * [{ department, amount, comments, credit_card_number?, cc_type? }]. Prime posts on its room revenue
 * department (finance offsets it at bank reconciliation). Allowed while the reservation is Expected or
 * Checked In, and only for an API user that is a cashier.
 */
async function postPayment({ tenantId, accountId, windowId, windowNumber = 1, department, amount, comments, cardLast4, cardType } = {}) {
  const query = windowId ? { window: windowId } : { account: accountId, window_number: windowNumber };
  const posting = { department: Number(department), amount: Number(amount), comments: comments || '' };
  if (/^\d{4}$/.test(String(cardLast4 || ''))) posting.credit_card_number = String(cardLast4);
  if (cardType) posting.cc_type = String(cardType);
  return kwentraFetch(pathFor('payment'), { method: 'POST', query, body: [posting], tenantId });
}

/** GET /api/income/posting/?account={id} — postings on a billing account */
async function listPostings({ tenantId, accountId, windowId } = {}) {
  const data = await kwentraFetch(pathFor('postings'), { query: { account: accountId, window: windowId }, tenantId });
  return extractList(data, ['postings']);
}

const UPDATE_INCLUDES = [
  'state.name',
  'room_nights.number_of_adults',
  'room_nights.number_of_children',
  'room_nights.room_number',
  'room_nights.manual_rate',
  'room_nights.rate_amount',
  'room_nights.daily_charges_posted',
];

/** Linked records come back as {id, …}; Kwentra's update body takes the id, or "" when empty */
const refId = (v) => (v && typeof v === 'object' ? v.id ?? '' : v ?? '');

/**
 * The full body Kwentra's Update Reservation expects, rebuilt from GET — an update must carry the
 * whole reservation (not just the changed fields) plus its current updated_on (edit lock).
 */
function reservationUpdateBody(r, changes = {}) {
  return {
    id: r.id,
    arrival_date: r.arrival_date,
    departure_date: r.departure_date,
    check_in_time: r.check_in_time,
    check_out_time: r.check_out_time,
    purpose_of_stay: r.purpose_of_stay,
    rate_confirmation: r.rate_confirmation,
    reservation_confirmation: r.reservation_confirmation,
    guarantee_type: refId(r.guarantee_type),
    reservation_mode: r.reservation_mode || 'daily',
    room_nights: (r.room_nights || []).map((n) => ({
      room_type: refId(n.room_type),
      actual_room_type: refId(n.actual_room_type),
      rate: refId(n.rate),
      room_number: refId(n.room_number) || null,
      from_date: n.from_date,
      to_date: n.to_date,
      number_of_adults: n.number_of_adults,
      number_of_children: n.number_of_children,
      children: n.children || [],
      manual_rate: Boolean(n.manual_rate),
      ...(n.manual_rate && n.rate_amount != null ? { rate_amount: n.rate_amount } : {}),
      daily_charges_posted: Boolean(n.daily_charges_posted),
      board_type: refId(n.board_type) || null,
      discount_amount: n.discount_amount ?? 0,
      discount_percentage: n.discount_percentage ?? 0,
    })),
    market: refId(r.market),
    source: refId(r.source),
    channel: refId(r.channel),
    voucher_no: r.voucher_no || '',
    block: refId(r.block),
    country: r.country?.iso || refId(r.country),
    state: r.state,
    arrival_flight_number: r.arrival_flight_number ?? null,
    arrival_flight_time: r.arrival_flight_time ?? null,
    departure_flight_number: r.departure_flight_number ?? null,
    departure_flight_time: r.departure_flight_time ?? null,
    booker: refId(r.booker),
    name: refId(r.name),
    other_names: (r.other_names || []).map(refId),
    group_reservation: refId(r.group_reservation),
    account: refId(r.account),
    credit_card: r.credit_card || '',
    guest_flag: refId(r.guest_flag),
    order: refId(r.order),
    first_meal: refId(r.first_meal),
    language: refId(r.language),
    company: refId(r.company),
    remarks: r.remarks || '',
    hold_date: r.hold_date ?? null,
    hold_status: r.hold_status || 'CONFIRMED',
    do_not_move: Boolean(r.do_not_move),
    auto_send_folio: Boolean(r.auto_send_folio),
    updated_on: r.updated_on ?? null,
    ...changes,
  };
}

/** Change fields on a reservation: GET it, apply the changes to the full body, PUT it back */
async function updateReservationFields(id, changes, { tenantId } = {}) {
  const current = await getReservation(id, { tenantId, includes: UPDATE_INCLUDES });
  return updateReservation(id, reservationUpdateBody(current, changes), { tenantId });
}

/** ON_HOLD → CONFIRMED after payment: the hold date is removed so Kwentra no longer auto-cancels it */
async function confirmHeldReservation(id, { tenantId } = {}) {
  return updateReservationFields(id, { hold_status: 'CONFIRMED', hold_date: null }, { tenantId });
}

/**
 * PUT …/v2/{id}/reinstate/ — bring a cancelled reservation back (same reservation, same id), confirmed.
 * Used when the guest paid after Kwentra auto-cancelled the hold; fails when the room is gone.
 */
async function reinstateReservation(id, reason, { tenantId } = {}) {
  const current = await getReservation(id, { tenantId, includes: UPDATE_INCLUDES });
  const body = reservationUpdateBody(current, { hold_status: 'CONFIRMED', hold_date: null, reason });
  delete body.state;
  return kwentraFetch(`${pathFor('reservation', id).replace(/\/$/, '')}/reinstate/`, { method: 'PUT', body, tenantId });
}

/** Kept for callers that pass a partial patch — sent as a full update */
async function patchReservation(id, patch, { tenantId } = {}) {
  return updateReservationFields(id, patch, { tenantId });
}

/** PATCH …/{id}/change_state/ — Expected | Checked In | Checked Out | Canceled | No'Show */
async function changeReservationState(id, state, reason = '', { tenantId } = {}) {
  return kwentraFetch(pathFor('reservationState', id), { method: 'PATCH', body: { state, reason }, tenantId });
}

async function cancelReservation(id, reason = 'Cancelled from the website', { tenantId } = {}) {
  return changeReservationState(id, 'Canceled', reason, { tenantId });
}

/** POST …/v2/{id}/note/ — type: internal | external | billing */
async function addReservationNote(id, note, { type = 'internal', tenantId } = {}) {
  return kwentraFetch(pathFor('reservationNote', id), { method: 'POST', body: { type, note }, tenantId });
}

/* ——— Guest profiles ——— */

const profilePath = (id) => `${pathFor('profiles').replace(/\/$/, '')}/${encodeURIComponent(id)}/`;

/** GET /api/core/individualprofile/v3/:id */
async function getGuestProfile(profileId, { includes = PROFILE_INCLUDES, tenantId } = {}) {
  const url = new URL(`${baseUrl()}${profilePath(profileId)}`);
  appendIncludes(url, includes);
  const data = await kwentraFetch(url.toString(), { tenantId });
  return data?.individual_profile || data;
}

/** PUT /api/core/individualprofile/v3/:id/ — the docs ask for every field from GET */
async function updateGuestProfile(profileId, body, { tenantId } = {}) {
  const data = await kwentraFetch(profilePath(profileId), { method: 'PUT', body, tenantId });
  return data?.individual_profile || data;
}

/** GET profile → merge patch → PUT full body (documented edit flow) */
async function patchGuestProfile(profileId, patch = {}, { tenantId } = {}) {
  const current = await getGuestProfile(profileId, { tenantId });
  const next = {
    first_name: current.first_name,
    last_name: current.last_name,
    date_of_birth: current.date_of_birth,
    language: current.language,
    gender: current.gender,
    nationality_object: current.nationality_object?.id || current.nationality || null,
    guest_preferences: current.guest_preferences,
    letter_greeting: current.letter_greeting,
    place_of_birth: current.place_of_birth || '',
    company: current.company,
    occupation: current.occupation,
    old_id: current.old_id,
    loyalty_points: current.loyalty_points ?? null,
    document_type: current.document_type || '',
    ID_number: current.ID_number,
    issue_place: current.issue_place,
    issue_date: current.issue_date,
    expiry_date: current.expiry_date,
    passport: current.passport,
    driving_license_number: current.driving_license_number,
    email: current.email,
    mobile: current.mobile,
    telephone: current.telephone || '',
    work_phone: current.work_phone,
    keep_email: current.keep_email ?? false,
    email_third_party: current.email_third_party ?? false,
    keep_personal_info: current.keep_personal_info ?? false,
    individualprofilecontactinfo_set: current.individualprofilecontactinfo_set || [],
    attachments: current.attachments ?? null,
    ...patch,
  };
  return updateGuestProfile(profileId, next, { tenantId });
}

function splitName(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  const first_name = parts[0] || 'Guest';
  const last_name = parts.slice(1).join(' ') || first_name;
  return { first_name, last_name, name: parts.join(' ') || first_name };
}

const isoCountry = (value) => (/^[A-Za-z]{2}$/.test(String(value || '').trim()) ? String(value).trim().toUpperCase() : null);

/**
 * Individual Profile v3 body from the website guest form, in the shape of Kwentra's example:
 * nationality_object = ISO-2 code, one contact entry (contact_type "1") carrying the country of
 * residence, unused fields null. ID / passport numbers are not collected online — front desk takes them.
 */
function buildProfilePayloadFromGuest({ name, email, phone, notes, nationality, country, address, city } = {}) {
  const { first_name, last_name } = splitName(name);
  const iso = isoCountry(nationality);
  const residence = isoCountry(country) || iso;
  const contacts = residence
    ? [{ address: address || '', city: city || '', country: residence, zip_code: '', id: null, profile: null, po_box: '', contact_type: '1' }]
    : [];
  return {
    first_name,
    last_name,
    date_of_birth: null,
    language: null,
    gender: null,
    nationality_object: iso,
    guest_preferences: notes || null,
    letter_greeting: null,
    place_of_birth: null,
    company: null,
    occupation: null,
    old_id: null,
    loyalty_points: null,
    is_house_use_officer: null,
    document_type: null,
    ID_number: null,
    version_number: null,
    issue_place: null,
    issue_date: null,
    expiry_date: null,
    passport: null,
    driving_license_number: null,
    email: email || null,
    mobile: phone || null,
    telephone: null,
    work_phone: null,
    keep_email: null,
    email_third_party: null,
    keep_personal_info: null,
    individualprofilecontactinfo_set: contacts,
    attachments: null,
  };
}

/** POST /api/core/individualprofile/v3/ */
async function createGuestProfile(guest, { tenantId } = {}) {
  const data = await kwentraFetch(pathFor('profiles'), { method: 'POST', body: buildProfilePayloadFromGuest(guest), tenantId });
  return data?.individual_profile || data;
}

/**
 * Website → Kwentra guest profile: update when we know the profile id, otherwise create one.
 */
async function sendGuestFromWebsite(guest = {}, { tenantId } = {}) {
  const { profileId, name, email, phone, notes, nationality, country, address, city } = guest;
  if (!name || !email) {
    const err = new Error('name and email are required to send guest to Kwentra');
    err.status = 400;
    throw err;
  }
  if (profileId) {
    const patch = { ...splitName(name), email, mobile: phone || '', guest_preferences: notes || '' };
    if (/^[A-Za-z]{2}$/.test(String(nationality || ''))) patch.nationality_object = String(nationality).toUpperCase();
    return { action: 'updated', profile: await patchGuestProfile(profileId, patch, { tenantId }) };
  }
  const profile = await createGuestProfile({ name, email, phone, notes, nationality, country, address, city }, { tenantId });
  return { action: 'created', profile };
}

/** POST /api/core/individualprofile/v3/:id/attachments (multipart) */
async function uploadGuestAttachment(profileId, fileBuffer, filename, contentType = 'application/octet-stream', { tenantId } = {}) {
  const form = new FormData();
  form.append('file', new Blob([fileBuffer], { type: contentType }), filename);
  return kwentraFetch(`${profilePath(profileId)}attachments`, { method: 'POST', formData: form, tenantId });
}

module.exports = {
  isConfigured,
  authStatus,
  passwordStatus,
  getTenantId,
  baseUrl,
  pathFor,
  kwentraFetch,
  extractList,
  listAll,
  listRoomTypes,
  listRooms,
  getAvailability,
  listRates,
  quoteTotalStay,
  listChannelProfiles,
  websiteChannel,
  websiteChannelId,
  webRateIds,
  listDepartments,
  listLookup,
  websiteMarketSource,
  clearLookupCache,
  clearLiveCache,
  listReservations,
  createReservation,
  updateReservation,
  patchReservation,
  updateReservationFields,
  confirmHeldReservation,
  reinstateReservation,
  reservationUpdateBody,
  getReservation,
  isCancelledReservation,
  reservationAccountId,
  postPayment,
  listPostings,
  changeReservationState,
  cancelReservation,
  addReservationNote,
  getGuestProfile,
  updateGuestProfile,
  patchGuestProfile,
  createGuestProfile,
  sendGuestFromWebsite,
  buildProfilePayloadFromGuest,
  uploadGuestAttachment,
  RESERVATION_INCLUDES,
  PROFILE_INCLUDES,
};
