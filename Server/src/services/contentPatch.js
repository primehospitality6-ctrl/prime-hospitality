/**
 * One-time content updates for units and properties (see src/data/contentPatch*.js).
 * Each patch runs once per database (recorded in data_patches); later admin edits are kept.
 */

const store = require('../lib/cmsStore');
const content = require('../data/contentPatch2026-11-24');

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const word = (n) => NUMBER_WORDS[n] || String(n);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function unitTypeOf(spec) {
  if (spec.unitType) return spec.unitType;
  return spec.bedrooms > 0 ? `${Math.min(6, spec.bedrooms)}BR` : 'Studio';
}

const VIEW_FEATURES = ['Nile View', 'Sea View', 'Pool View', 'Garden View', 'City View', 'Pyramids View'];

/** In-unit amenities, one tidy vocabulary for every unit. */
function amenitiesOf(spec) {
  const kitchen = spec.kitchen || 'full';
  const list = ['Free Wi-Fi', 'Air Conditioning', spec.tv === 'TV' ? 'TV' : 'Smart TV'];
  if (kitchen === 'full' || kitchen === 'american') list.push(kitchen === 'american' ? 'Open American Kitchen' : 'Fully Equipped Kitchen', 'Oven', 'Microwave', 'Refrigerator');
  if (kitchen === 'kitchenette') list.push('Kitchenette with Cooktop', 'Microwave', 'Refrigerator');
  if (kitchen === 'fridge') list.push('Refrigerator');
  if (spec.washer !== false && (kitchen === 'full' || kitchen === 'american' || kitchen === 'kitchenette')) list.push('Washing Machine');
  if (spec.nespresso) list.push('Nespresso Machine');
  list.push('Coffee & Tea Tray', 'Kettle', 'Safe Box', 'Iron & Ironing Board');
  if (spec.bedrooms > 0 && !/^Hotel|Room/.test(spec.title) && kitchen !== 'none') list.push('Living Area');
  for (const f of spec.features || []) {
    const name = { 'Private Garden': 'Private Garden', Rooftop: 'Private Rooftop', Duplex: 'Duplex Layout', Beachfront: 'Beachfront' }[f] || f;
    if (!list.includes(name)) list.push(name);
  }
  for (const extra of spec.extraAmenities || []) if (!list.includes(extra)) list.push(extra);
  return list;
}

function bathPhrase(spec) {
  const full = `${word(spec.bathrooms)} bathroom${spec.bathrooms === 1 ? '' : 's'}`;
  return spec.half ? `${full} and a guest half bath` : full;
}

function kitchenPhrase(spec) {
  const washer = spec.washer !== false;
  switch (spec.kitchen || 'full') {
    case 'american':
      return `An open American kitchen comes fully equipped with oven, microwave and refrigerator${spec.nespresso ? ', plus a Nespresso machine' : ''}${washer ? ', and there is a washing machine for longer stays' : ''}.`;
    case 'kitchenette':
      return `A kitchenette with cooktop, microwave and refrigerator covers light meals${washer ? ', and a washing machine makes longer stays easy' : ''}.`;
    case 'fridge':
      return 'A refrigerator keeps drinks and snacks cold.';
    case 'none':
      return (spec.extraAmenities || []).includes('Mini Bar') ? 'A mini bar is stocked for your stay.' : '';
    default:
      return `The fully equipped kitchen has an oven, microwave and refrigerator${spec.nespresso ? ', plus a Nespresso machine' : ''}${washer ? ', and a washing machine makes longer stays easy' : ''}.`;
  }
}

function featurePhrase(spec) {
  const f = spec.features || [];
  const views = f.filter((x) => VIEW_FEATURES.includes(x)).map((x) => x.replace(' View', '')).map((x) => (/Nile|Pyramids/.test(x) ? x : x.toLowerCase()));
  const spaces = [];
  if (f.includes('Private Garden')) spaces.push('a private garden');
  if (f.includes('Terrace')) spaces.push('a private terrace');
  if (f.includes('Rooftop')) spaces.push('a private rooftop');
  if (f.includes('Balcony') && !f.includes('Terrace')) spaces.push('a balcony');
  const bits = [];
  if (spaces.length) bits.push(spaces.join(' and '));
  if (views.length) bits.push(`${views.join(' and ')} views`);
  if (f.includes('Beachfront')) bits.unshift('a beachfront setting');
  return bits.length ? ` with ${bits.join(' and ')}` : '';
}

/** Commercial description, the same shape for every unit. */
function describe(spec, property, rawPropertyName) {
  const propertyName = String(rawPropertyName || '').replace('Mountain ViewRas ElHekma', 'Mountain View Ras El Hekma');
  const isRoom = /Room|Suite/.test(spec.title) && !/Apartment|Chalet|Villa|Studio/.test(spec.title);
  const kind = isRoom
    ? /Suite/.test(spec.title) ? 'suite' : 'guest room'
    : spec.bedrooms === 0 ? 'studio' : /Villa/.test(spec.title) ? 'villa' : /Chalet/.test(spec.title) ? 'chalet' : 'apartment';
  const layout = spec.bedrooms > 0 && !isRoom ? `${word(spec.bedrooms)}-bedroom ${/Duplex/.test(spec.title) ? 'duplex ' : ''}${kind}` : kind;
  const first = `Enjoy ${spec.areaSqm} m² of newly furnished space in this ${layout}${featurePhrase(spec)} at ${propertyName}.`;
  const second = `It offers ${spec.beds}, plus ${bathPhrase(spec)}.`;
  const kitchen = kitchenPhrase(spec);
  const comfort = `Free Wi-Fi, air conditioning, a ${spec.tv === 'TV' ? 'TV' : 'smart TV'}, a safe box and a coffee & tea tray are ready on arrival${spec.beachNote ? `, and the beach is ${spec.beachNote}` : ''}.`;
  const services = (property.facilities || [])
    .filter((x) => !/No On-site|Wi-Fi/.test(x))
    .filter((x) => !/Beach Nearby/.test(x))
    .map((x) => x.toLowerCase());
  const facilities = services.length ? `Guests also enjoy ${services.length > 1 ? `${services.slice(0, -1).join(', ')} and ${services.at(-1)}` : services[0]}.` : '';
  const where = property.near ? `The property is ${property.near}.` : '';
  return [first, second, kitchen, comfort, facilities, where].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** The values a unit gets from the patch. */
function unitPatch(spec, property, propertyName) {
  return {
    title: spec.title,
    unitType: unitTypeOf(spec),
    bedrooms: spec.bedrooms,
    bathrooms: spec.bathrooms,
    areaSqm: spec.areaSqm,
    bedType: spec.bedType,
    amenities: amenitiesOf(spec),
    facilities: property.facilities || [],
    description: describe(spec, property, propertyName),
  };
}

async function alreadyApplied(id) {
  try {
    return await store.isDataPatchApplied(id);
  } catch {
    return true; // cannot tell — do nothing rather than overwrite edits
  }
}

/** Apply the 2026-11-24 unit content once. Returns a short report. */
async function applyContentPatch({ force = false } = {}) {
  const id = content.PATCH_ID;
  if (!force && (await alreadyApplied(id))) return { id, skipped: true };
  const report = { id, units: 0, properties: 0, missing: [] };
  const compounds = await store.listCompounds();
  const units = await store.listUnits();
  const bySlug = new Map(units.map((unit) => [unit.slug, unit]));

  for (const [compoundId, property] of Object.entries(content.PROPERTIES)) {
    const compound = compounds.find((c) => c.id === compoundId);
    if (!compound) continue;
    const patch = { facilities: property.facilities || [] };
    if (property.address) patch.address = property.address;
    if (property.mapsUrl && !compound.mapsUrl) patch.mapsUrl = property.mapsUrl;
    try {
      await store.updateCompound(compoundId, patch);
      report.properties += 1;
    } catch (err) {
      console.warn(`[content] property ${compoundId}:`, err.message);
    }
  }

  for (const spec of content.UNITS) {
    const unit = bySlug.get(spec.slug);
    if (!unit) {
      report.missing.push(spec.slug);
      continue;
    }
    const property = content.PROPERTIES[unit.compoundId] || { facilities: [], near: unit.destination || '' };
    try {
      await store.updateUnit(unit.id, unitPatch(spec, property, unit.compound || ''));
      report.units += 1;
    } catch (err) {
      console.warn(`[content] unit ${spec.slug}:`, err.message);
    }
  }

  await store.markDataPatchApplied(id, report);
  console.log(`[content] ${id}: ${report.units} unit types and ${report.properties} properties updated${report.missing.length ? `, not found: ${report.missing.join(', ')}` : ''}`);
  return report;
}

module.exports = { applyContentPatch, unitPatch, amenitiesOf, describe };
