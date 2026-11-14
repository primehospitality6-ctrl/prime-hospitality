/**
 * Each property (Kwentra tenant) takes its card payments on its own Paymob integration, so the accountant
 * can match every Paymob transaction to the property it belongs to. The integration list comes from
 * the company's accountant (Paymob integration ID ↔ Kwentra instance).
 *
 * Which integration a payment opens on, first match wins:
 *   1. the property's "Paymob integration ID" in the admin (compound.paymobIntegrationId)
 *   2. PAYMOB_PROPERTY_INTEGRATIONS on the server, JSON by Kwentra tenant: {"427": "2203562"}
 *   3. the accountant's list below
 *   4. the website's own integration, PAYMOB_INTEGRATION_ID (the payment is then flagged for the accountant)
 *
 * Keyed by Kwentra tenant ID, which never changes when a property is renamed on the website or in Kwentra.
 */

/** Kwentra tenant → Paymob integration (from the accountant, 2026-11-14). */
const PROPERTY_INTEGRATIONS = {
  87: { id: '2180431', name: 'new cairo' }, // Prime Residence New Cairo
  340: { id: '2207902', name: 'east town' }, // Prime Select Eastown Sodic
  382: { id: '2203475', name: 'amwaj' }, // Prime Holidays Amwaj
  386: { id: '2203491', name: 'village gate' }, // The Village Gate
  427: { id: '2203562', name: 'seashell' }, // Prime Holidays Seashell
  455: { id: '2203495', name: 'batal' }, // Prime Select El Batal
  456: { id: '2203493', name: 'bavaria' }, // Prime Select Katameya Bavaria Town
  465: { id: '2203557', name: 'porto new cairo' }, // Porto New Cairo
  486: { id: '2203496', name: 'arkadia' }, // Prime Select Arkadia
  491: { id: '2203555', name: 'new alamein' }, // Prime Residence New Alamein
  493: { id: '2203561', name: '10 ramadan' }, // Prime Inn 10th of Ramadan
  494: { id: '2203563', name: 'hacienda' }, // Prime Holidays Hacienda Bay
  559: { id: '2203556', name: 'prime select lotus new cairo' }, // Al Manzel Lotus New Cairo
  562: { id: '4266786', name: 'crown' }, // Prime Select The Crown
  573: { id: '2203482', name: 'gamet el dewal' }, // Prime Select Gamet El Dewal
  591: { id: '2203488', name: 'manzel zayed' }, // Almanzel Sheikh Zayed
  596: { id: '2203490', name: 'masaken sheraton' }, // Prime Select Masaken Sheraton
  622: { id: '2767292', name: 'cesar bay' }, // Prime Holidays Cesar Bay
  624: { id: '2767293', name: 'r. zayed' }, // Prime Residence Sheikh Zayed
  637: { id: '2767291', name: 'marvel' }, // Marvel City New Cairo
  650: { id: '3420697', name: 's. point 90' }, // Point 90 New Cairo (the Select one)
  679: { id: '3419634', name: 'west sodic' }, // Prime Select West Sodic
  680: { id: '3419835', name: 'giza' }, // Prime Select New Giza
  740: { id: '4351264', name: 'moon valley' }, // Prime Select Galleria Moon Valley
  778: { id: '4044784', name: 'r. kattameya' }, // Prime Residence Kattameya
  781: { id: '4044768', name: 'san stefano' }, // Prime Select San Stefano Alexandria
  830: { id: '4351205', name: 'one kattameya' }, // Prime Select One Kattameya
  878: { id: '4569989', name: 'point 90' }, // Prime Residence Point 90
  889: { id: '5065251', name: 'lake view' }, // Prime Select Lake View
  913: { id: '5065255', name: 'avenue 90' }, // Prime Select 90 Avenue
  977: { id: '5065253', name: 'mall of arabia' }, // Prime Select Mall Of Arabia
  1110: { id: '5065250', name: 'residence zayed heights' }, // Prime Residence Zayed Heights
  1126: { id: '5065249', name: 'heliopolis' }, // Prime Residence Heliopolis
  1131: { id: '5065254', name: 'prime select gleem' }, // Prime Select Gleem
  1144: { id: '5207719', name: 'zayed hills' }, // Prime Residence Zayed Hills
  1155: { id: '5209916', name: 'prime residence golf kattameya' }, // Prime Residence Kattameya Golf
  1169: { id: '5206101', name: 'prime select raml station alexandria' }, // Prime Select Raml Station Alexandria
  1170: { id: '5206102', name: 'mountain view ras elhekma' }, // Prime Holidays Mountain View Ras ElHekma
  1192: { id: '5196387', name: 'village garden hills kattameya' }, // Prime Select Palm Hills Village Garden Kattameya
  1276: { id: '5346916', name: 'heliopolis terrace' }, // Prime Boutique (Korba, Heliopolis)
  1286: { id: '5357619', name: 'prime select sodic villette' }, // Prime Select Sodic Villette
  1312: { id: '5385608', name: 'zamalek saray algezira' }, // Prime Select West Zamalek (beside the Marriott)
  1509: { id: '5852145', name: 'prime inn andalus' }, // tenant with no name in Kwentra yet
  1532: { id: '5852146', name: 'zamalek central' }, // Prime Select Zamalek Central
};

const clean = (v) => String(v ?? '').trim();
const isId = (v) => /^\d+$/.test(clean(v));

function envMap() {
  try {
    const map = JSON.parse(process.env.PAYMOB_PROPERTY_INTEGRATIONS || '{}');
    return map && typeof map === 'object' ? map : {};
  } catch {
    console.warn('[paymob] PAYMOB_PROPERTY_INTEGRATIONS is not valid JSON — ignoring it');
    return {};
  }
}

/** The website's own integrations (PAYMOB_INTEGRATION_ID, comma-separated; the first is the card one). */
function defaultIntegrationIds() {
  return clean(process.env.PAYMOB_INTEGRATION_ID)
    .split(',')
    .map(clean)
    .filter(isId);
}

/**
 * The Paymob integration this property's payments belong to → { id, name, source } or null.
 * `compound` is the website property (optional); `tenantId` its Kwentra tenant.
 */
function integrationForProperty({ tenantId, compound } = {}) {
  const own = clean(compound?.paymobIntegrationId);
  if (isId(own)) return { id: own, name: compound?.name || '', source: 'property' };
  const tenant = clean(tenantId || compound?.kwentraTenantId);
  if (!tenant) return null;
  const fromEnv = envMap()[tenant];
  const envId = clean(typeof fromEnv === 'object' ? fromEnv?.id : fromEnv);
  if (isId(envId)) return { id: envId, name: clean(fromEnv?.name), source: 'server setting' };
  const listed = PROPERTY_INTEGRATIONS[tenant];
  if (listed) return { ...listed, source: 'accountant list' };
  return null;
}

/* Integrations Paymob said do not exist on our account. Remembered for a while so every guest
   does not wait on a refused call; checked again afterwards in case Paymob has added it. */
const UNAVAILABLE_TTL_MS = 6 * 60 * 60 * 1000;
const unavailable = new Map();

function markUnavailable(id, reason) {
  unavailable.set(clean(id), { at: Date.now(), reason: clean(reason).slice(0, 200) });
}

function isKnownUnavailable(id) {
  const hit = unavailable.get(clean(id));
  if (!hit) return false;
  if (Date.now() - hit.at > UNAVAILABLE_TTL_MS) {
    unavailable.delete(clean(id));
    return false;
  }
  return true;
}

function markAvailable(id) {
  unavailable.delete(clean(id));
}

/** Paymob's answer when an integration is not on our account (vs. any other refusal). */
function isMissingIntegrationError(status, data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data || {});
  return status === 404 || /integration/i.test(text);
}

/** For the admin: every listed property and whether Paymob refused its integration recently. */
function integrationReport() {
  return Object.entries(PROPERTY_INTEGRATIONS).map(([tenantId, item]) => {
    const resolved = integrationForProperty({ tenantId }) || item;
    const hit = unavailable.get(resolved.id);
    return { tenantId, ...resolved, unavailable: Boolean(hit), unavailableReason: hit?.reason || '' };
  });
}

module.exports = {
  PROPERTY_INTEGRATIONS,
  defaultIntegrationIds,
  integrationForProperty,
  integrationReport,
  isKnownUnavailable,
  isMissingIntegrationError,
  markAvailable,
  markUnavailable,
};
