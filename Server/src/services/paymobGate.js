/**
 * Only properties that can take a payment on their own Paymob integration are shown on the website.
 *
 * A property is shown when its integration (paymobIntegrations.integrationForProperty) last checked as
 * working on our Paymob account. A property with no integration, or one Paymob refuses, is hidden — its
 * units, its page and its bookings — until a later check finds the integration working again.
 *
 * Checks: a 1 EGP unpaid payment session per integration (expires in 5 minutes, nothing is charged).
 * Working integrations are checked once a day, refused ones every PAYMOB_RECHECK_FAILING_HOURS (6 by
 * default). A refusal on a real payment hides the property at once. Results are saved, so a restart
 * neither shows a broken property nor hides a working one.
 */

const integrations = require('../lib/paymobIntegrations');
const { listCompounds, listIntegrationChecks, saveIntegrationCheck } = require('../lib/cmsStore');
const { setHiddenCompoundCheck } = require('../lib/unitCompleteness');

const HOUR = 60 * 60 * 1000;
const hours = (name, fallback) => {
  const v = Number(process.env[name]);
  return v > 0 ? v * HOUR : fallback * HOUR;
};

/** Checked against the live Paymob account on 2026-11-16, used until the first saved check. */
const CHECKED_2026_11_16 = new Set([
  '5196387', '5206102', '5206101', '5207719', '5209916', '5357619', '5346916', '5065250', '5065254',
  '5065251', '5065253', '5385608', '5065252', '5065249', '5065255', '5852146', '5852145',
]);

const state = {
  checks: new Map(), // integration id → { ok, name, reason, checkedAt }
  compounds: [],
  hidden: new Map(), // compound id → reason
  loadedAt: 0,
  checking: false,
};

function gateActive() {
  const payment = require('./paymentService');
  return payment.activeProvider() === 'paymob' && payment.usePropertyIntegrations();
}

function statusOf(integrationId) {
  const id = String(integrationId || '');
  const saved = state.checks.get(id);
  if (saved) return saved;
  return CHECKED_2026_11_16.has(id)
    ? { ok: true, reason: '', checkedAt: '2026-11-16T00:00:00.000Z', seed: true }
    : { ok: false, reason: 'Paymob says this integration does not exist on our account', checkedAt: '2026-11-16T00:00:00.000Z', seed: true };
}

/** Why a property cannot take payments right now, or '' when it can. */
function blockReason(compound) {
  if (!gateActive()) return '';
  // Always-on properties stay on the site; their payments fall back to the website integration if needed.
  if (require('../lib/specialProperties').isAlwaysOn(compound?.kwentraTenantId)) return '';
  const integration = integrations.integrationForProperty({ tenantId: compound?.kwentraTenantId, compound });
  if (!integration) return 'no Paymob integration ID for this property';
  const status = statusOf(integration.id);
  return status.ok ? '' : `Paymob integration ${integration.id}: ${status.reason || 'not working'}`;
}

function recompute() {
  const hidden = new Map();
  for (const c of state.compounds) {
    const why = blockReason(c);
    if (why) hidden.set(c.id, why);
  }
  const before = [...state.hidden.keys()].sort().join(',');
  state.hidden = hidden;
  if (before !== [...hidden.keys()].sort().join(',')) {
    const shown = state.compounds.length - hidden.size;
    console.log(`[paymob-gate] ${shown} properties can take payments, ${hidden.size} hidden from the website`);
  }
}

async function refresh() {
  try {
    const [compounds, checks] = await Promise.all([listCompounds(), listIntegrationChecks().catch(() => [])]);
    state.compounds = compounds;
    state.checks = new Map(checks.map((c) => [String(c.integrationId), c]));
    state.loadedAt = Date.now();
    recompute();
  } catch (err) {
    console.warn('[paymob-gate] could not load properties/checks:', err.message);
  }
}

/** Is this property (compound id) hidden because it cannot take a payment? Synchronous, for isLive. */
function isHiddenCompound(compoundId) {
  if (!gateActive()) return false;
  if (!compoundId) return true; // a unit outside any property has no integration
  if (!state.loadedAt) return false; // before the first load nothing is known; bookings are still checked
  return state.hidden.has(compoundId);
}

function hiddenReason(compoundId) {
  return state.hidden.get(compoundId) || '';
}

/** Save one integration's result and update which properties are shown. */
async function record(integrationId, { ok, name = '', reason = '' }) {
  const entry = { integrationId: String(integrationId), ok: Boolean(ok), name, reason: String(reason || '').slice(0, 300), checkedAt: new Date().toISOString() };
  state.checks.set(entry.integrationId, entry);
  recompute();
  try {
    await saveIntegrationCheck(entry);
  } catch (err) {
    console.warn('[paymob-gate] could not save the check of', integrationId, err.message);
  }
  return entry;
}

/** Every integration a property uses (or could use), deduplicated. */
function integrationIdsInUse() {
  const ids = new Set();
  for (const c of state.compounds) {
    const integration = integrations.integrationForProperty({ tenantId: c.kwentraTenantId, compound: c });
    if (integration) ids.add(integration.id);
  }
  return [...ids];
}

/** Check integrations that are due (or all with force), one at a time. */
async function checkIntegrations({ force = false } = {}) {
  if (!gateActive() || state.checking) return { skipped: true };
  state.checking = true;
  const payment = require('./paymentService');
  const okEvery = hours('PAYMOB_RECHECK_WORKING_HOURS', 24);
  const failEvery = hours('PAYMOB_RECHECK_FAILING_HOURS', 6);
  const results = [];
  try {
    if (!state.loadedAt) await refresh();
    for (const id of integrationIdsInUse()) {
      const status = statusOf(id);
      const age = Date.now() - new Date(status.checkedAt || 0).getTime();
      if (!force && !status.seed && age < (status.ok ? okEvery : failEvery)) continue;
      const result = await payment.checkPaymobIntegration(id);
      // A network failure says nothing about the integration: keep what we knew.
      if (!result.ok && /ETIMEDOUT|ECONNRESET|ENOTFOUND|socket|timeout|EAI_AGAIN/i.test(result.reason || '')) {
        results.push({ id, ok: status.ok, skipped: result.reason });
        continue;
      }
      await record(id, { ok: result.ok, name: result.name, reason: result.ok ? '' : result.reason });
      results.push({ id, ok: result.ok, reason: result.reason || '' });
      await new Promise((r) => setTimeout(r, 400));
    }
  } finally {
    state.checking = false;
  }
  return { checked: results.length, results };
}

let started = false;
function start() {
  if (started) return;
  started = true;
  setHiddenCompoundCheck(isHiddenCompound);
  refresh().then(() => checkIntegrations().catch((err) => console.warn('[paymob-gate] check failed:', err.message)));
  // Property edits in the admin show up within a minute; integrations are re-checked when due.
  setInterval(() => refresh().catch(() => {}), 60 * 1000).unref();
  setInterval(() => checkIntegrations().catch((err) => console.warn('[paymob-gate] check failed:', err.message)), HOUR).unref();
}

/** For the admin: each property, its integration, and whether it is shown. */
function report() {
  return state.compounds.map((c) => {
    const integration = integrations.integrationForProperty({ tenantId: c.kwentraTenantId, compound: c });
    const status = integration ? statusOf(integration.id) : null;
    return {
      propertyId: c.id,
      property: c.name,
      tenantId: c.kwentraTenantId || '',
      integrationId: integration?.id || '',
      integrationName: status?.name || integration?.name || '',
      working: Boolean(status?.ok),
      checkedAt: status?.checkedAt || null,
      shown: !state.hidden.has(c.id),
      hiddenBecause: state.hidden.get(c.id) || '',
    };
  });
}

module.exports = {
  blockReason,
  checkIntegrations,
  gateActive,
  hiddenReason,
  isHiddenCompound,
  record,
  refresh,
  report,
  start,
  statusOf,
};
