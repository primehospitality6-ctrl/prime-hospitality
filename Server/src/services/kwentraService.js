/**
 * Kwentra PMS — headless HTTP client aligned to the Kwentra API pack (OpenAPI files):
 *
 *  roomtype                  GET  /api/core/roomtype/
 *  room-v2                   GET  /api/reservation/room/v2/?filter{type}=…&filter{from_date}…&filter{showvacantrooms}
 *  room-availability         GET  /api/reservation/rooms/availability/{room_type_id}/?start_date&end_date
 *  rate-v2                   GET  /api/reservation/rate/v2/ · /api/reservation/rate/v2/totalstay/
 *  channelprofile            GET  /api/core/channelprofile/
 *  individualprofile-v3      GET/POST/PUT /api/core/individualprofile/v3/
 *  individualreservation-v2  POST /api/reservation/individualreservation/v2/ · PUT {id}/ · POST {id}/note/
 *                            PATCH /api/reservation/individualreservation/{id}/change_state/
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
  roomTypes: ['KWENTRA_PATH_ROOM_TYPES', '/api/core/roomtype/'],
  roomType: ['KWENTRA_PATH_ROOM_TYPE', '/api/core/roomtype/:id/'],
  rooms: ['KWENTRA_PATH_ROOMS', '/api/reservation/room/v2/'],
  availability: ['KWENTRA_PATH_AVAILABILITY', '/api/reservation/rooms/availability/:id/'],
  rates: ['KWENTRA_PATH_RATES', '/api/reservation/rate/v2/'],
  totalStay: ['KWENTRA_PATH_TOTAL_STAY', '/api/reservation/rate/v2/totalstay/'],
  channelProfiles: ['KWENTRA_PATH_CHANNEL_PROFILES', '/api/core/channelprofile/'],
  profiles: ['KWENTRA_PATH_PROFILES', 'KWENTRA_PATH_CREATE_PROFILE', '/api/core/individualprofile/v3/'],
  reservations: ['KWENTRA_PATH_RESERVATIONS', 'KWENTRA_PATH_CREATE_RESERVATION', '/api/reservation/individualreservation/v2/'],
  reservation: ['KWENTRA_PATH_RESERVATION', '/api/reservation/individualreservation/v2/:id/'],
  reservationNote: ['KWENTRA_PATH_RESERVATION_NOTE', '/api/reservation/individualreservation/v2/:id/note/'],
  reservationState: ['KWENTRA_PATH_RESERVATION_STATE', '/api/reservation/individualreservation/:id/change_state/'],
  // Market / Source / Billing APIs were sent separately — set the paths once their docs are in hand
  markets: ['KWENTRA_PATH_MARKETS', '/api/core/market/'],
  sources: ['KWENTRA_PATH_SOURCES', '/api/core/source/'],
  payment: ['KWENTRA_PATH_PAYMENT', ''],
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

/** Kwentra allows a limited number of requests per minute — wait and retry on 429 */
async function kwentraFetch(path, options = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await kwentraRequest(path, options);
    } catch (err) {
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

async function listRoomTypes({ tenantId } = {}) {
  return listAll(pathFor('roomTypes'), { tenantId, keys: ['RoomType_Entities', 'room_types', 'roomtypes', 'roomtype'] });
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

/**
 * GET /api/reservation/rooms/availability/{room_type_id}/ → [{dt, avail, occupancy, room_count, ooo}]
 * A night is blocked when no room of the type is free. The list is per night, so checking out on the
 * morning of a blocked night is already allowed — no separate checkout dates.
 */
async function getAvailability(roomTypeId, { from, to, tenantId } = {}) {
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
async function quoteTotalStay({ tenantId, arrivalDate, departureDate, adults = 1, childrenAges = [], channel, rate, company } = {}) {
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
  const data = await kwentraFetch(pathFor('channelProfiles'), { tenantId });
  const raw = data?.channel_profiles ?? data?.results ?? data;
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => ({
    id: c.id != null ? String(c.id) : '',
    name: c.name || '',
    rates: (c.rates || []).map((r) => ({ id: String(r.id), code: r.code || '' })),
  }));
}

const channelCache = new Map();
const CHANNEL_TTL_MS = 10 * 60_000;

/**
 * Website channel of a tenant → { id, rateIds }: KWENTRA_CHANNEL_ID, else the channel profile named
 * Website/Direct/Online. rateIds = rates Kwentra offers on that channel, in Kwentra's order.
 */
async function websiteChannel(tenantId) {
  const key = String(tenantId || getTenantId());
  const cached = channelCache.get(key);
  if (cached && Date.now() - cached.at < CHANNEL_TTL_MS) return cached.value;
  const forcedId = String(process.env.KWENTRA_CHANNEL_ID || '').trim();
  let value = { id: forcedId, rateIds: [] };
  try {
    const profiles = await listChannelProfiles({ tenantId });
    const wanted = new RegExp(process.env.KWENTRA_CHANNEL_NAME || 'website|web|direct|online', 'i');
    const profile = forcedId ? profiles.find((c) => c.id === forcedId) : profiles.find((c) => wanted.test(c.name));
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
}

const isTrue = (v) => v === true || v === 1 || v === 'true' || v === 'True';

/**
 * Rates flagged web=true in a tenant — the rates Kwentra's own booking engine sold online.
 * Empty when the tenant has none or the lookup fails (callers then fall back to the channel profile).
 */
async function webRateIds(tenantId) {
  const tenant = String(tenantId || getTenantId());
  try {
    return await cached(`web-rates:${tenant}`, async () => {
      const today = new Date().toISOString().slice(0, 10);
      const rates = await listRates({ tenantId: tenant, from: today, to: addDays(today, 30) });
      return rates.filter((r) => isTrue(r.web)).map((r) => String(r.id));
    });
  } catch (err) {
    console.warn('[kwentra] web rates lookup failed:', err.message);
    return [];
  }
}

/**
 * Market and source ids for website bookings in a tenant: KWENTRA_MARKET_ID / KWENTRA_SOURCE_ID when set,
 * else the entry whose name matches KWENTRA_MARKET_NAME / KWENTRA_SOURCE_NAME (default website/web/online/internet).
 */
async function websiteMarketSource(tenantId) {
  const tenant = String(tenantId || getTenantId());
  const pick = async (key, envId, envName) => {
    const forced = String(process.env[envId] || '').trim();
    if (forced) return forced;
    try {
      return await cached(`${key}:${tenant}`, async () => {
        const list = await listAll(pathFor(key), { tenantId: tenant, maxPages: 5, keys: [key, 'results'] });
        const wanted = new RegExp(process.env[envName] || 'website|web|online|internet', 'i');
        const match = list.find((m) => wanted.test(`${m.name || ''} ${m.description || ''} ${m.code || ''}`));
        return match?.id != null ? String(match.id) : '';
      });
    } catch (err) {
      console.warn(`[kwentra] ${key} lookup failed:`, err.message);
      return '';
    }
  };
  return {
    market: await pick('markets', 'KWENTRA_MARKET_ID', 'KWENTRA_MARKET_NAME'),
    source: await pick('sources', 'KWENTRA_SOURCE_ID', 'KWENTRA_SOURCE_NAME'),
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

/** Partial update (e.g. only hold_status) — PATCH, or PUT when the server does not allow PATCH */
async function patchReservation(id, body, { tenantId } = {}) {
  try {
    return await kwentraFetch(pathFor('reservation', id), { method: 'PATCH', body, tenantId });
  } catch (err) {
    if (err.status !== 405) throw err;
    return updateReservation(id, body, { tenantId });
  }
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

/** Individual Profile v3 body from the website guest form */
function buildProfilePayloadFromGuest({ name, email, phone, notes, nationality = 'EG', address = '', city = '' } = {}) {
  const { first_name, last_name } = splitName(name);
  return {
    first_name,
    last_name,
    date_of_birth: null,
    language: null,
    gender: null,
    nationality_object: nationality,
    guest_preferences: notes || '',
    letter_greeting: null,
    place_of_birth: '',
    company: null,
    occupation: null,
    old_id: null,
    loyalty_points: null,
    document_type: '',
    ID_number: null,
    issue_place: null,
    issue_date: null,
    expiry_date: null,
    passport: null,
    driving_license_number: null,
    email: email || '',
    mobile: phone || '',
    telephone: '',
    work_phone: null,
    keep_email: false,
    email_third_party: false,
    keep_personal_info: false,
    individualprofilecontactinfo_set: [
      {
        address: address || '',
        city: city || '',
        country: { id: nationality, iso: nationality, name: nationality === 'EG' ? 'EGYPT' : nationality },
        zip_code: '',
        po_box: '',
        contact_type: { id: 1, description: 'Main' },
      },
    ],
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
  const { profileId, name, email, phone, notes, nationality, address, city } = guest;
  if (!name || !email) {
    const err = new Error('name and email are required to send guest to Kwentra');
    err.status = 400;
    throw err;
  }
  if (profileId) {
    const patch = { ...splitName(name), email, mobile: phone || '', guest_preferences: notes || '' };
    if (nationality) patch.nationality_object = nationality;
    return { action: 'updated', profile: await patchGuestProfile(profileId, patch, { tenantId }) };
  }
  const profile = await createGuestProfile({ name, email, phone, notes, nationality, address, city }, { tenantId });
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
  websiteMarketSource,
  clearLookupCache,
  listReservations,
  createReservation,
  updateReservation,
  patchReservation,
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
