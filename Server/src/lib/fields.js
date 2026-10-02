/**
 * Extra inventory attributes (from the property fact sheets / Kwentra) shared by both CMS backends.
 */

const COMPOUND_FIELDS = {
  text: ['description', 'address', 'mapsUrl', 'buildingNumber', 'phone', 'driveFolderUrl', 'factSheetUrl', 'kwentraTenantId'],
  num: ['latitude', 'longitude'],
  list: ['facilities'],
  json: ['kwentraSnapshot'],
};

const UNIT_FIELDS = {
  text: ['floor', 'bedType'],
  num: ['roomCount'],
  list: ['unitNumbers'],
  json: ['kwentraSnapshot'],
};

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

function toList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  if (value == null) return [];
  return String(value)
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toNumberOrNull(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Copy the listed fields that are present on `body` onto `target`, normalised. */
function applyFields(target, body, spec) {
  if (!body) return target;
  for (const key of spec.text) {
    if (body[key] !== undefined) target[key] = String(body[key] ?? '').trim();
  }
  for (const key of spec.num) {
    if (body[key] !== undefined) target[key] = toNumberOrNull(body[key]);
  }
  for (const key of spec.list) {
    if (body[key] !== undefined) target[key] = toList(body[key]);
  }
  for (const key of spec.json || []) {
    if (isPlainObject(body[key])) target[key] = body[key];
  }
  return target;
}

/** Defaults for a new record — every field present so the admin forms stay controlled. */
function defaults(spec) {
  const out = {};
  spec.text.forEach((k) => (out[k] = ''));
  spec.num.forEach((k) => (out[k] = null));
  spec.list.forEach((k) => (out[k] = []));
  (spec.json || []).forEach((k) => (out[k] = null));
  return out;
}

/** Pin coordinates from a Google Maps link (place pin first, then viewport centre, then ?q=). */
function coordsFromMapsUrl(url) {
  const s = String(url || '');
  const patterns = [/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const latitude = Number(m[1]);
      const longitude = Number(m[2]);
      if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { latitude, longitude };
    }
  }
  return null;
}

/** Fill latitude/longitude from mapsUrl when the link changes and no explicit coordinates were sent. */
function syncCoords(target, body = {}) {
  if (body.mapsUrl === undefined || body.latitude !== undefined || body.longitude !== undefined) return target;
  const coords = coordsFromMapsUrl(target.mapsUrl);
  target.latitude = coords?.latitude ?? null;
  target.longitude = coords?.longitude ?? null;
  return target;
}

module.exports = {
  COMPOUND_FIELDS,
  UNIT_FIELDS,
  toList,
  applyFields,
  defaults,
  coordsFromMapsUrl,
  syncCoords,
};
