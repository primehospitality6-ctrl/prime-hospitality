/**
 * End-to-end booking test on a Kwentra TEST tenant — the flow a website booking goes through:
 *   guest profile → vacant room → website rate → reservation ON_HOLD → confirm (hold_status only)
 *   → payment on the billing account (only when a payment department is set) → cancel.
 *
 *   npm run kwentra:test-booking -- 394          → tenant 394, first room type with a rate
 *   npm run kwentra:test-booking -- 394 7        → room type 7
 *   npm run kwentra:test-booking -- 394 7 --keep → leave the reservation (not cancelled)
 *
 * Writes to Kwentra, so it refuses to run unless KWENTRA_API_BASE_URL points at test.kwentra.com.
 * Credentials are never printed.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const kwentra = require('../services/kwentraService');
const sync = require('../services/kwentraSync');

const args = process.argv.slice(2);
const keep = args.includes('--keep');
const [tenantArg, roomTypeArg] = args.filter((a) => !a.startsWith('--'));

const iso = (d) => d.toISOString().slice(0, 10);
const inDays = (n) => iso(new Date(Date.now() + n * 864e5));

function show(label, reservation) {
  const r = reservation || {};
  console.log(
    `  ${label}: #${r.id} · state ${r.state?.name || r.state?.id || '?'} · hold ${r.hold_status || '—'}` +
      `${r.hold_date ? ` until ${r.hold_date}` : ''} · market ${r.market?.id ?? r.market ?? '—'} · source ${r.source?.id ?? r.source ?? '—'}` +
      ` · billing account ${kwentra.reservationAccountId(r) ?? '—'}`
  );
}

async function main() {
  if (!/test\.kwentra\.com/i.test(kwentra.baseUrl())) {
    console.log('Refusing to run: this test writes reservations and only runs against test.kwentra.com');
    process.exit(1);
  }
  const tenantId = String(tenantArg || kwentra.getTenantId());
  const arrivalDate = inDays(45);
  const departureDate = inDays(46);
  console.log(`Kwentra ${new URL(kwentra.baseUrl()).host} · tenant ${tenantId} · stay ${arrivalDate} → ${departureDate}`);

  const [channel, lookups] = await Promise.all([kwentra.websiteChannel(tenantId), kwentra.websiteMarketSource(tenantId)]);
  console.log(`  website channel ${channel.id || '—'} (${channel.rateIds.length} rates) · market ${lookups.market || '—'} · source ${lookups.source || '—'}`);

  const roomTypes = roomTypeArg ? [{ id: roomTypeArg }] : await kwentra.listRoomTypes({ tenantId });
  let pick = null;
  for (const type of roomTypes) {
    const listing = { kwentraRoomTypeId: String(type.id) };
    const rates = await sync.roomTypeRates(listing, { arrivalDate, departureDate, adults: 2, tenantId, fresh: true });
    const rate = sync.pickRate(rates, 'FLEX');
    if (rate) {
      pick = { roomTypeId: String(type.id), name: type.room_type || type.id, rate };
      break;
    }
  }
  if (!pick) throw new Error('No room type has a rate for that stay');
  console.log(`  room type ${pick.roomTypeId} (${pick.name}) · rate ${pick.rate.rateId} ${pick.rate.rateCode} · ${pick.rate.quote}`);

  const rooms = await kwentra.listRooms({ tenantId, roomTypeId: pick.roomTypeId, from: arrivalDate, to: arrivalDate, vacantOnly: true });
  const room = rooms.map(sync.normalizeRoom).find((r) => r.id);
  if (!room) throw new Error('No vacant room of that type');
  console.log(`  vacant room ${room.number} (internal id ${room.id})`);

  const guest = await kwentra.sendGuestFromWebsite(
    { name: 'Prime Api Test', email: 'api-test@stayatprime.com', phone: '+201000000000', notes: 'Website integration test' },
    { tenantId }
  );
  const guestId = guest.profile?.id;
  console.log(`  guest profile ${guestId} (${guest.action})`);

  const booking = {
    voucherNumber: `PHW-TEST-${Date.now().toString().slice(-6)}`,
    ratePlanName: 'Flexible',
    rateAmount: pick.rate.quote,
    rateCurrency: process.env.KWENTRA_CURRENCY || 'EGP',
    primaryGuestName: 'Prime Api Test',
    email: 'api-test@stayatprime.com',
    phone: '+201000000000',
    arrivalDate,
    departureDate,
    adults: 2,
    children: 0,
    reservationCountry: 'EG',
    notes: 'Integration test — safe to delete',
  };
  const payload = sync.buildReservationPayload({
    booking,
    roomTypeId: pick.roomTypeId,
    roomId: room.id,
    rateId: pick.rate.rateId,
    channelId: channel.id,
    marketId: lookups.market,
    sourceId: lookups.source,
    guestProfileId: guestId,
    hold: true,
  });
  const { id } = await kwentra.createReservation(payload, { tenantId });
  if (!id) throw new Error('Kwentra did not return a reservation id');
  show('created', await kwentra.getReservation(id, { tenantId }));

  let confirmed = null;
  try {
    await kwentra.patchReservation(id, { hold_status: 'CONFIRMED' }, { tenantId });
    confirmed = await kwentra.getReservation(id, { tenantId });
    show('confirmed', confirmed);
  } catch (err) {
    console.log(`  ✗ confirm (update with hold_status only): ${err.status || ''} ${err.message}`);
    confirmed = await kwentra.getReservation(id, { tenantId });
  }

  const department = String(process.env.KWENTRA_PAYMENT_DEPARTMENT_ID || '').trim() ||
    (() => {
      try {
        return String(JSON.parse(process.env.KWENTRA_PAYMENT_DEPARTMENTS || '{}')[tenantId] || '');
      } catch {
        return '';
      }
    })();
  const accountId = kwentra.reservationAccountId(confirmed);
  if (department && accountId) {
    await kwentra.postPayment({ tenantId, accountId, windowNumber: Number(process.env.KWENTRA_PAYMENT_WINDOW || 1), department, amount: 1, comments: `Integration test ${booking.voucherNumber}` });
    const postings = await kwentra.listPostings({ tenantId, accountId });
    console.log(`  payment of 1 posted · ${postings.length} posting(s) on account ${accountId}`);
  } else {
    console.log('  payment skipped: no payment department set (KWENTRA_PAYMENT_DEPARTMENT_ID)');
  }

  await kwentra.addReservationNote(id, `Website integration test ${booking.voucherNumber}`, { type: 'internal', tenantId });
  console.log('  note added');

  if (keep) {
    console.log(`  kept reservation #${id}`);
  } else {
    await kwentra.cancelReservation(id, 'Website integration test', { tenantId });
    show('cancelled', await kwentra.getReservation(id, { tenantId }));
  }
}

main().catch((err) => {
  console.error(`✗ ${err.status || ''} ${err.message}`);
  if (err.data) console.error(`  ${JSON.stringify(err.data).slice(0, 600)}`);
  process.exit(1);
});
