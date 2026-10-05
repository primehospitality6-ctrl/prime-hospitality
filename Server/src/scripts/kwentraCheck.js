/**
 * Check the Kwentra connection without starting the API:
 *   npm run kwentra:check            → the tenant in KWENTRA_TENANT_ID
 *   npm run kwentra:check -- 394 375 → those tenants
 * Prints what Kwentra returns (room types, rooms, rates and their web flag, channel profiles,
 * markets, sources, the latest reservation's billing account). Read only. Credentials are never printed.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const kwentra = require('../services/kwentraService');

const brief = (v) => {
  const s = JSON.stringify(v);
  return s && s.length > 160 ? `${s.slice(0, 157)}…` : s;
};

async function step(label, fn) {
  try {
    const out = await fn();
    console.log(`  ✓ ${label}${out ? `: ${out}` : ''}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${label}: ${err.status || ''} ${err.message}`);
    return false;
  }
}

async function listLookup(kind, tenantId) {
  const list = await kwentra.listLookup(kind, { tenantId });
  return `${list.length} → ${list.slice(0, 15).map((m) => `${m.id}:${m.code || ''} ${m.description || m.name || ''}`.trim()).join(', ')}`;
}

async function checkTenant(tenantId) {
  console.log(`\nTenant ${tenantId}`);
  const today = new Date().toISOString().slice(0, 10);
  const inAWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  let roomTypes = [];

  const ok = await step('room types', async () => {
    roomTypes = await kwentra.listRoomTypes({ tenantId });
    if (roomTypes[0]) console.log(`    fields: ${Object.keys(roomTypes[0]).join(', ')}`);
    return `${roomTypes.length} → ${roomTypes.slice(0, 10).map((t) => `${t.id}:${t.room_type || t.name || t.code}`).join(', ')}`;
  });
  if (!ok) return;

  await step('rooms', async () => {
    const rooms = await kwentra.listRooms({ tenantId });
    return `${rooms.length} → ${rooms.slice(0, 8).map((r) => `${r.id}:${r.room_number || r.number || r.name || ''}(type ${r.type?.id ?? r.type ?? '?'})`).join(', ')}`;
  });

  await step('rates', async () => {
    const rates = await kwentra.listRates({ tenantId, from: today, to: inAWeek });
    if (rates[0]) console.log(`    fields: ${Object.keys(rates[0]).join(', ')}`);
    const web = rates.filter((r) => r.web === true);
    return `${rates.length} (web=true: ${web.length}) → ${rates.slice(0, 12).map((r) => `${r.id}:${r.code || r.rate_code || r.name}${r.web ? '[web]' : ''}`).join(', ')}`;
  });

  await step('channel profiles', async () => {
    const profiles = await kwentra.listChannelProfiles({ tenantId });
    return `${profiles.length} → ${profiles.map((c) => `${c.id}:${c.name} (${c.rates.length} rates)`).join(', ')}`;
  });

  const first = roomTypes[0];
  if (first) {
    await step(`availability for room type ${first.id}`, async () => {
      const a = await kwentra.getAvailability(first.id, { from: today, to: inAWeek, tenantId });
      return brief(a.roomsFree);
    });
    await step('total-stay quote, 2 adults, 1 night', async () => {
      const quotes = await kwentra.quoteTotalStay({ tenantId, arrivalDate: inAWeek, departureDate: new Date(Date.now() + 8 * 864e5).toISOString().slice(0, 10), adults: 2 });
      return `${quotes.length} → ${quotes.slice(0, 6).map((q) => `${q.roomType}/${q.rateCode}: ${q.quote}`).join(', ')}`;
    });
  }

  await step('markets', () => listLookup('markets', tenantId));
  await step('sources', () => listLookup('sources', tenantId));
  await step('market + source the website will use', async () => brief(await kwentra.websiteMarketSource(tenantId)));

  await step('latest reservation (read only)', async () => {
    const { reservations } = await kwentra.listReservations({ tenantId, stateRegex: '', includes: [] });
    const latest = reservations[0];
    if (!latest) return 'none yet';
    const full = await kwentra.getReservation(latest.id, { tenantId });
    console.log(`    fields: ${Object.keys(full || {}).join(', ')}`);
    const accountId = kwentra.reservationAccountId(full);
    if (accountId) {
      const postings = await kwentra.listPostings({ tenantId, accountId }).catch((err) => ({ error: err.message }));
      console.log(`    postings on account ${accountId}: ${Array.isArray(postings) ? postings.length : postings.error}`);
    }
    return `#${latest.id} · billing account: ${accountId ?? 'not found'}`;
  });
}

async function main() {
  if (!kwentra.isConfigured()) {
    console.log('Kwentra credentials are not set in Server/.env');
    process.exit(1);
  }
  const auth = process.env.KWENTRA_API_TOKEN ? `token (${process.env.KWENTRA_AUTH_SCHEME || 'Token'})` : 'username + password (Basic)';
  console.log(`Kwentra ${new URL(kwentra.baseUrl()).host} · login: ${auth}`);
  const tenants = process.argv.slice(2).filter(Boolean);
  for (const tenantId of tenants.length ? tenants : [kwentra.getTenantId()]) await checkTenant(tenantId);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
