const { randomUUID } = require('crypto');
const kwentra = require('../services/kwentraService');
const sync = require('../services/kwentraSync');
const payment = require('../services/paymentService');
const {
  findUnit,
  createBooking,
  updateBooking,
  listBookings,
  findBooking,
  nextVoucherSerial,
} = require('../lib/cmsStore');
const pms = require('../lib/pms');
const { resolveWindow, buildAvailability, buildPricing } = require('../lib/mockCalendar');

function pmsRoomTypeId(listing, explicit) {
  return (
    explicit ||
    listing?.kwentraRoomTypeId ||
    listing?.pmsRoomTypeId ||
    listing?.kwentraUnitId ||
    listing?.pmsUnitId ||
    null
  );
}

function pmsProfileId(listing, explicit) {
  return explicit || listing?.kwentraProfileId || null;
}

/** PULL units: Kwentra details + CMS Drive photos */
async function getUnits(req, res, next) {
  try {
    const publishedOnly = req.query.published !== 'false';
    const merged = await sync.pullUnitsMerged({ publishedOnly });
    res.json({
      source: merged.source,
      items: merged.items,
      total: merged.total,
      pullError: merged.pullError || null,
      needFromKwentra: merged.needFromKwentra || null,
    });
  } catch (err) {
    next(err);
  }
}

/** PULL availability: blocked nights from Kwentra reservations */
async function getAvailability(req, res, next) {
  try {
    const unitKey = req.query.unitId || req.query.slug || req.params.unitId;
    if (!unitKey) return res.status(400).json({ error: 'unitId or slug is required' });

    const listing = await findUnit(unitKey);
    const { from, to } = resolveWindow(req.query);

    if (!listing?.live) {
      // Still allow availability by room type id alone
      if (kwentra.isConfigured() && req.query.roomTypeId) {
        const avail = await kwentra.getAvailability(req.query.roomTypeId, { from, to });
        return res.json({
          source: 'kwentra',
          roomTypeId: req.query.roomTypeId,
          from,
          to,
          blocked: avail.blocked,
          checkout_dates: avail.checkoutDates,
          prices: {},
          currency: process.env.KWENTRA_CURRENCY || 'EGP',
        });
      }
      return res.status(404).json({ error: 'Listing not found' });
    }

    try {
      const avail = await sync.pullAvailability(listing, { from, to });
      return res.json({
        source: avail.source,
        id: listing.id,
        slug: listing.slug,
        roomTypeId: avail.roomTypeId || pmsRoomTypeId(listing),
        from,
        to,
        blocked: avail.blocked,
        checkout_dates: avail.checkoutDates || avail.checkout_dates || [],
        prices: avail.prices || {},
        currency: avail.currency || listing.currency || 'EGP',
      });
    } catch (err) {
      console.warn('[kwentra] availability lookup failed:', err.message);
      // Linked units never show demo dates; the booking step re-checks Kwentra strictly
      const linked = sync.isLinked(listing);
      const { blocked, checkout_dates } = linked ? { blocked: [], checkout_dates: [] } : buildAvailability(listing, from, to);
      const { prices, currency } = buildPricing(listing, from, to);
      res.json({
        source: linked ? 'kwentra-unreachable' : 'mock',
        id: listing.id,
        slug: listing.slug,
        from,
        to,
        blocked,
        checkout_dates,
        prices,
        currency,
      });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Occupied nights + nightly prices for [arrival, departure) — Kwentra when the unit is linked, mock otherwise.
 * strict: a linked unit whose Kwentra availability can't be read is not bookable (no guessing).
 */
async function resolveStay(listing, arrivalDate, departureDate, { adults = 2, children = 0, strict = false, freshAvailability = strict } = {}) {
  let avail = null;
  let rates = null;
  if (sync.isLinked(listing)) {
    try {
      const tenantId = await sync.tenantForUnit(listing);
      const [availability, offered] = await Promise.all([
        kwentra.getAvailability(listing.kwentraRoomTypeId, { from: arrivalDate, to: departureDate, tenantId, fresh: freshAvailability }),
        sync.roomTypeRates(listing, { arrivalDate, departureDate, adults, children, tenantId, fresh: strict }).catch((err) => {
          console.warn('[kwentra] rates lookup failed:', err.message);
          return [];
        }),
      ]);
      rates = offered;
      const base = sync.pickRate(offered, 'FLEX');
      avail = {
        source: 'kwentra',
        blocked: availability.blocked,
        checkoutDates: availability.checkoutDates,
        prices: base ? sync.nightsToPrices(arrivalDate, base.nights) : {},
        currency: listing.currency || process.env.KWENTRA_CURRENCY || 'EGP',
      };
    } catch (err) {
      console.warn('[booking] Kwentra availability lookup failed:', err.message);
      if (strict) {
        const unavailable = new Error('We could not confirm availability right now — please try again in a minute');
        unavailable.status = 503;
        throw unavailable;
      }
    }
  }
  if (!avail) {
    const { blocked, checkout_dates } = buildAvailability(listing, arrivalDate, departureDate);
    const { prices, currency } = buildPricing(listing, arrivalDate, departureDate);
    avail = { source: 'mock', blocked, checkoutDates: checkout_dates, prices, currency };
  }
  const turnover = new Set(avail.checkoutDates || avail.checkout_dates || []);
  const occupied = (avail.blocked || [])
    .map((b) => (typeof b === 'string' ? b : b?.date))
    .filter((d) => d && d >= arrivalDate && d < departureDate && !turnover.has(d));
  let prices = avail.prices || {};
  if (!Object.keys(prices).length) prices = buildPricing(listing, arrivalDate, departureDate).prices;
  return {
    source: avail.source,
    occupied,
    prices,
    rates,
    currency: avail.currency || listing.currency || 'EGP',
  };
}

/**
 * Price one website rate plan. A plan mapped to its own Kwentra rate (KWENTRA_RATE_MAP) uses that
 * rate's nightly amounts as-is; otherwise the base nightly prices with the plan's adjustment.
 */
function priceForPlan(plan, stay, listing, arrivalDate, departureDate) {
  const mappedId = sync.mappedRateId(plan.code);
  const mapped = mappedId && stay.rates?.find((r) => r.rateId === mappedId && r.quote > 0);
  return pms.priceStay({
    arrivalDate,
    departureDate,
    nightlyPrices: mapped ? sync.nightsToPrices(arrivalDate, mapped.nights) : stay.prices,
    fallbackNightly: listing.pricePerNight,
    ratePlan: mapped ? { ...plan, adjustmentPct: 0 } : plan,
    currency: stay.currency,
  });
}

/** POST /api/kwentra/quote — price a stay for every rate plan */
async function getQuote(req, res, next) {
  try {
    const { slug, unitId } = req.body || {};
    const arrivalDate = req.body?.arrivalDate || req.body?.checkIn;
    const departureDate = req.body?.departureDate || req.body?.checkOut;
    const listing = await findUnit(slug || unitId);
    if (!listing?.live) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const nights = pms.nightsBetween(arrivalDate, departureDate);
    if (nights < 1) {
      return res.status(400).json({ error: 'arrivalDate and departureDate are required' });
    }
    // The guest is about to book these dates: availability is read live, prices may come from the short cache
    const stay = await resolveStay(listing, arrivalDate, departureDate, {
      adults: Number(req.body?.adults) || 2,
      children: Number(req.body?.children) || 0,
      freshAvailability: true,
    });
    const ratePlans = pms.ratePlansForStay(nights).map((plan) => {
      const q = priceForPlan(plan, stay, listing, arrivalDate, departureDate);
      return { ...plan, rateAmount: q.rateAmount, averageNightlyRate: q.averageNightlyRate, discount: q.discount };
    });
    res.json({
      source: stay.source,
      slug: listing.slug,
      arrivalDate,
      departureDate,
      nights,
      currency: stay.currency,
      available: stay.occupied.length === 0,
      ratePlans,
    });
  } catch (err) {
    next(err);
  }
}

function publicBooking(b) {
  return {
    id: b.id,
    voucherNumber: b.voucherNumber,
    status: b.status,
    paymentStatus: b.paymentStatus,
    slug: b.slug,
    listingTitle: b.listingTitle,
    destination: b.destination,
    property: b.property,
    roomType: b.roomType,
    primaryGuestName: b.primaryGuestName,
    name: b.primaryGuestName,
    arrivalDate: b.arrivalDate,
    departureDate: b.departureDate,
    nights: b.nights,
    adults: b.adults,
    children: b.children,
    ratePlanName: b.ratePlanName,
    rateAmount: b.rateAmount,
    amount: b.rateAmount,
    rateCurrency: b.rateCurrency,
    currency: b.rateCurrency,
  };
}

/**
 * POST /api/book-direct
 * Website booking engine → validates every PMS data field, holds in Kwentra (when configured),
 * stores the booking and opens an embedded payment session. Guest never leaves our React app.
 */
async function bookDirect(req, res, next) {
  try {
    const { slug, unitId } = req.body || {};
    if (!slug && !unitId) return res.status(400).json({ error: 'slug or unitId is required' });

    const listing = await findUnit(slug || unitId);
    if (!listing?.live) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const { errors, value } = pms.validateBookingRequest(req.body, listing);
    if (Object.keys(errors).length) {
      return res.status(422).json({ error: 'Please check the highlighted booking details', fields: errors });
    }

    const stay = await resolveStay(listing, value.arrivalDate, value.departureDate, {
      adults: value.adults,
      children: value.children,
      strict: true,
    });
    if (stay.occupied.length) {
      return res.status(409).json({
        error: 'Some of those nights were just booked — please choose other dates',
        fields: { arrivalDate: 'Dates unavailable' },
        occupied: stay.occupied,
      });
    }

    const quote = priceForPlan(value.ratePlan, stay, listing, value.arrivalDate, value.departureDate);

    const voucherNumber = pms.formatVoucher(await nextVoucherSerial());
    const externalRef = `prime_${randomUUID()}`;

    const booking = {
      id: randomUUID(),
      voucherNumber,
      channel: pms.CHANNEL,
      status: 'pending_payment',
      paymentStatus: 'pending',
      createdAt: new Date().toISOString(),
      slug: listing.slug,
      listingId: listing.id,
      listingTitle: listing.title,
      destinationId: listing.destinationId || '',
      destination: listing.destination || listing.region || '',
      propertyId: listing.compoundId || '',
      property: listing.compound || '',
      brand: listing.brand || '',
      roomType: listing.unitType || listing.title,
      kwentraRoomTypeId: pmsRoomTypeId(listing) || '',
      primaryGuestName: value.primaryGuestName,
      otherGuestNames: value.otherGuestNames,
      nationality: value.nationality,
      reservationCountry: value.reservationCountry,
      email: value.email,
      phone: value.phone,
      arrivalDate: value.arrivalDate,
      departureDate: value.departureDate,
      nights: quote.nights,
      checkInTime: value.checkInTime,
      checkOutTime: value.checkOutTime,
      adults: value.adults,
      children: value.children,
      ratePlanCode: value.ratePlan.code,
      ratePlanName: value.ratePlan.name,
      rateAmount: quote.rateAmount,
      averageNightlyRate: quote.averageNightlyRate,
      rateCurrency: quote.currency,
      notes: value.notes || null,
      pricePerNight: listing.pricePerNight,
      externalRef,
      kwentraReservationId: null,
      kwentraProfileId: null,
      // legacy aliases read by payments/webhooks
      name: value.primaryGuestName,
      checkIn: value.arrivalDate,
      checkOut: value.departureDate,
      guests: value.adults + value.children,
      amount: quote.rateAmount,
      currency: quote.currency,
    };

    let kwentraGuest = null;
    let kwentraReservationPush = null;

    // ON_HOLD mode only (KWENTRA_HOLD_UNTIL_PAID): reserve now, confirm after payment.
    // Otherwise the reservation is created confirmed once the payment succeeds (see pushPaidBooking).
    if (kwentra.isConfigured() && sync.isLinked(listing) && sync.holdUntilPaid()) {
      const tenantId = await sync.tenantForUnit(listing);
      try {
        kwentraGuest = await kwentra.sendGuestFromWebsite(
          {
            profileId: req.body?.profileId || null,
            name: booking.primaryGuestName,
            email: booking.email,
            phone: booking.phone,
            notes: [`Voucher: ${voucherNumber}`, `Unit: ${listing.title}`, booking.notes || '']
              .filter(Boolean)
              .join(' | '),
            nationality: booking.nationality || booking.reservationCountry,
            country: booking.reservationCountry,
            address: '',
            city: listing.city || '',
          },
          { tenantId }
        );
      } catch (err) {
        console.warn('[kwentra] guest profile push failed:', err.message);
        kwentraGuest = { action: 'failed', error: err.message };
      }

      const profileId = kwentraGuest?.profile?.id ?? pmsProfileId(listing, req.body?.profileId);
      booking.kwentraProfileId = profileId != null ? String(profileId) : null;

      kwentraReservationPush = await sync.pushReservation({
        booking,
        listing,
        guestProfileId: booking.kwentraProfileId,
        ratePlan: value.ratePlan,
        rates: stay.rates,
      });
      if (kwentraReservationPush.pushed) {
        booking.kwentraReservationId = kwentraReservationPush.reservationId || null;
      } else if (kwentraReservationPush.conflict) {
        return res.status(409).json({
          error: 'Those nights were just booked — please choose other dates',
          fields: { arrivalDate: 'Dates unavailable' },
        });
      } else if (kwentraReservationPush.error) {
        console.warn('[kwentra] reservation push failed:', kwentraReservationPush.error);
        booking.kwentraIssue = `Not in Kwentra yet: ${kwentraReservationPush.error}`;
      }
    }

    const saved = await createBooking(booking);

    const paymentSession = await payment.createPaymentSession({
      amount: booking.rateAmount,
      currency: booking.rateCurrency,
      merchantOrderId: externalRef,
      billing: { name: booking.primaryGuestName, email: booking.email, phone: booking.phone },
    });

    res.status(201).json({
      booking: publicBooking({ ...booking, ...saved }),
      pms: pms.toPmsRows(booking),
      payment: paymentSession,
      kwentra: {
        guest: kwentraGuest
          ? {
              action: kwentraGuest.action,
              profileId: kwentraGuest.profile?.id || null,
              error: kwentraGuest.error || null,
            }
          : null,
        reservation: kwentraReservationPush
          ? {
              pushed: Boolean(kwentraReservationPush.pushed),
              reservationId: kwentraReservationPush.reservationId || null,
              reason: kwentraReservationPush.reason || null,
              error: kwentraReservationPush.error || null,
            }
          : null,
      },
      experience: {
        zeroRedirect: true,
        paymentMode: paymentSession.mode,
        nextStep: 'embed_payment_modal',
      },
    });
  } catch (err) {
    next(err);
  }
}

/** Confirm mock payment without leaving the site (dev / PAYMENT_PROVIDER=mock) */
async function confirmMockPayment(req, res, next) {
  try {
    const { merchantOrderId, bookingId } = req.body || {};
    if (!merchantOrderId && !bookingId) {
      return res.status(400).json({ error: 'merchantOrderId or bookingId required' });
    }

    let booking = bookingId ? await findBooking(bookingId) : null;
    if (!booking && merchantOrderId) {
      const all = await listBookings();
      booking = all.find((b) => b.externalRef === merchantOrderId) || null;
    }
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.paymentStatus === 'paid') {
      return res.json({ ok: true, booking: publicBooking(booking), kwentraPayment: null, message: 'Already paid.' });
    }
    booking = (await updateBooking(booking.id, { status: 'confirmed', paymentStatus: 'paid' })) || booking;

    let paymentPush = null;
    if (kwentra.isConfigured()) {
      paymentPush = await sync.pushPaidBooking(booking, {
        amount: booking.rateAmount ?? booking.amount,
        currency: booking.rateCurrency || booking.currency || 'EGP',
        merchantOrderId: booking.externalRef,
        provider: 'mock',
        transactionId: `mock_${booking.externalRef}`,
      });
      booking = (await sync.recordPaymentResult(booking, paymentPush)) || booking;
    }

    res.json({
      ok: true,
      booking: publicBooking(booking),
      kwentraPayment: paymentPush,
      message: 'Payment confirmed on-site and recorded on the Kwentra reservation.',
    });
  } catch (err) {
    next(err);
  }
}

async function listReservationsHandler(req, res, next) {
  try {
    if (!kwentra.isConfigured()) {
      return res.status(503).json({ error: 'Kwentra is not configured' });
    }
    const data = await kwentra.listReservations({
      arrivalGte: req.query.arrivalGte || req.query.from,
      arrivalLte: req.query.arrivalLte || req.query.to,
      stateRegex: req.query.stateRegex,
    });
    res.json({
      source: 'kwentra',
      count: data.count,
      items: data.reservations,
      next: data.next,
      previous: data.previous,
    });
  } catch (err) {
    next(err);
  }
}

async function getGuestProfileHandler(req, res, next) {
  try {
    if (!kwentra.isConfigured()) {
      return res.status(503).json({ error: 'Kwentra is not configured' });
    }
    const profile = await kwentra.getGuestProfile(req.params.profileId);
    res.json({ source: 'kwentra', profile });
  } catch (err) {
    next(err);
  }
}

async function updateGuestProfileHandler(req, res, next) {
  try {
    if (!kwentra.isConfigured()) {
      return res.status(503).json({ error: 'Kwentra is not configured' });
    }
    const profile = await kwentra.patchGuestProfile(req.params.profileId, req.body || {});
    res.json({ source: 'kwentra', profile });
  } catch (err) {
    next(err);
  }
}

async function sendGuestHandler(req, res, next) {
  try {
    if (!kwentra.isConfigured()) {
      return res.status(503).json({ error: 'Kwentra is not configured' });
    }
    const result = await kwentra.sendGuestFromWebsite(req.body || {});
    res.status(result.action === 'created' ? 201 : 200).json({
      source: 'kwentra',
      action: result.action,
      profile: result.profile,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getUnits,
  getAvailability,
  getQuote,
  bookDirect,
  confirmMockPayment,
  listReservationsHandler,
  getGuestProfileHandler,
  updateGuestProfileHandler,
  sendGuestHandler,
};
