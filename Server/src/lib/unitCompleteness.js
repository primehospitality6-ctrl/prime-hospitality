/**
 * Completeness gate for unit types. Kwentra sends details but never photos, so a unit pulled
 * from the PMS usually arrives without its Google Drive gallery. A unit is only shown to guests
 * when it is published AND every required attribute below is filled — the admin `published`
 * flag is left untouched, so a unit goes live by itself as soon as the last field is filled.
 */
const { extractFolderId } = require('./googleDrive');

const filled = (v) => String(v ?? '').trim() !== '';
const positive = (v) => Number(v) > 0;
const nonEmptyList = (v) => Array.isArray(v) && v.some(filled);
const isStudio = (u) => /studio/i.test(`${u.propertyType || ''} ${u.unitType || ''} ${u.title || ''}`);

const REQUIRED = [
  { key: 'title', label: 'Title', ok: (u) => filled(u.title) },
  { key: 'compoundId', label: 'Property', ok: (u) => filled(u.compoundId) },
  { key: 'images', label: 'Photos', ok: (u) => nonEmptyList(u.images) || Boolean(extractFolderId(u.driveFolderUrl)) },
  { key: 'description', label: 'Description', ok: (u) => filled(u.description) },
  { key: 'propertyType', label: 'Property type', ok: (u) => filled(u.propertyType) },
  {
    key: 'bedrooms',
    label: 'Bedrooms',
    ok: (u) => positive(u.bedrooms) || (isStudio(u) && Number(u.bedrooms) === 0),
  },
  { key: 'bathrooms', label: 'Bathrooms', ok: (u) => positive(u.bathrooms) },
  { key: 'maxGuests', label: 'Max guests', ok: (u) => positive(u.maxGuests) },
  { key: 'areaSqm', label: 'Size (m²)', ok: (u) => positive(u.areaSqm) },
  { key: 'pricePerNight', label: 'Price per night', ok: (u) => positive(u.pricePerNight) },
  { key: 'amenities', label: 'Amenities', ok: (u) => nonEmptyList(u.amenities) },
];

function checkUnit(unit) {
  const u = unit || {};
  const missing = REQUIRED.filter((r) => !r.ok(u)).map(({ key, label }) => ({ key, label }));
  return { complete: missing.length === 0, missing };
}

/** Published by the admin and passes the completeness check.
 * A room type linked from Kwentra is shown as soon as it is published. Photos and size are added in admin. */
function isLive(unit) {
  if (!unit || unit.published === false) return false;
  if (String(unit.kwentraRoomTypeId || '').trim()) return true;
  return checkUnit(unit).complete;
}

function withCompleteness(unit) {
  if (!unit) return unit;
  const completeness = checkUnit(unit);
  return { ...unit, completeness, live: isLive(unit) };
}

module.exports = {
  REQUIRED_UNIT_FIELDS: REQUIRED.map(({ key, label }) => ({ key, label })),
  checkUnit,
  isLive,
  withCompleteness,
};
