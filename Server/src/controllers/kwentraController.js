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
  getSite,
} = require('../lib/cmsStore');
const pms = require('../lib/pms');
const emailService = require('../services/emailService');
const { resolveWindow, buildAvailability, buildPricing } = require('../lib/mockCalendar');

function brandMinNightsFor(listing, site) {
  const key = String(listing?.brand || '')
    .trim()
    .replace(/^prime\s+/i, '')
    .toLowerCase();
  const brand = (site?.brands?.items || []).find((b) => String(b.name || '').toLowerCase() === key);
  return Math.max(1, Number(brand?.minNights) || Number(listing?.minNights) || 1);
}

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
          currency: 'USD',
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
        currency: 'USD',
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
      let availability = { blocked: [], checkoutDates: [] };
      let soldOut = false;
      try {
        const stayRoom = await sync.roomForStay(listing, arrivalDate, departureDate);
        availability = { blocked: stayRoom.occupied, checkoutDates: [] };
        soldOut = stayRoom.unavailable;
      } catch (err) {
        console.warn('[booking] Kwentra availability lookup failed:', err.message);
        if (strict) {
          const unavailable = new Error('We could not confirm availability right now — please try again in a minute');
          unavailable.status = 503;
          throw unavailable;
        }
      }
      if (soldOut && !availability.blocked?.length) {
        availability.blocked = [arrivalDate];
      }
      const offered = await sync
        .roomTypeRates(listing, { arrivalDate, departureDate, adults, children, tenantId, fresh: strict })
        .catch((err) => {
          console.warn('[kwentra] rates lookup failed:', err.message);
          return [];
        });
      rates = offered;
      const planPrices = {};
      let grid = null;
      try {
        const [bb, ro] = await Promise.all([
          sync.pricesFromRateGrid(listing, arrivalDate, departureDate, { adults, children, tenantId, planCode: 'BB' }),
          sync.pricesFromRateGrid(listing, arrivalDate, departureDate, { adults, children, tenantId, planCode: 'RO' }),
        ]);
        planPrices.BB = bb.prices || {};
        planPrices.RO = ro.prices || {};
        grid = bb;
      } catch (err) {
        console.warn('[kwentra] rate grid failed, using total-stay:', err.message);
      }
      const base = sync.pickRate(offered, 'BB');
      avail = {
        source: 'kwentra',
        blocked: availability.blocked,
        checkoutDates: availability.checkoutDates,
        prices: grid ? grid.prices : base ? sync.nightsToPrices(arrivalDate, base.nights) : {},
        planPrices,
        currency: 'USD',
      };
    } catch (err) {
      if (strict || err.status) throw err;
      console.warn('[booking] Kwentra stay lookup failed:', err.message);
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
  if (!Object.keys(prices).length && avail.source !== 'kwentra') {
    prices = buildPricing(listing, arrivalDate, departureDate).prices;
  }
  return {
    source: avail.source,
    occupied,
    prices,
    planPrices: avail.planPrices || {},
    rates,
    currency: 'USD',
  };
}

/**
 * Price one website plan from its Hotel Website rate.
 * Bed and Breakfast is Hotel Website BB. Room only is Hotel Website Bed Only.
 */
function priceForPlan(plan, stay, listing, arrivalDate, departureDate) {
  const picked = sync.pickRate(stay.rates, plan.code);
  const fromGrid = stay.planPrices?.[plan.code];
  const nightlyPrices = picked
    ? sync.nightsToPrices(arrivalDate, picked.nights)
    : fromGrid && Object.keys(fromGrid).length
      ? fromGrid
      : plan.code === 'BB'
        ? stay.prices
        : {};
  return pms.priceStay({
    arrivalDate,
    departureDate,
    nightlyPrices,
    fallbackNightly: stay.source === 'kwentra' ? 0 : listing.pricePerNight,
    ratePlan: { ...plan, adjustmentPct: 0 },
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
    chargeAmount: b.chargeAmount ?? null,
    chargeCurrency: b.chargeCurrency || null,
    fxRate: b.fxRate ?? null,
  };
}

/**
 * POST /api/book-direct
 * Website booking engine → validates every PMS data field, stores a pending booking,
 * and opens payment. Kwentra gets the reservation only after payment succeeds, so unpaid
 * checkouts never hold or block nights.
 */
async function bookDirect(req, res, next) {
  try {
    const { slug, unitId } = req.body || {};
    if (!slug && !unitId) return res.status(400).json({ error: 'slug or unitId is required' });

    const listing = await findUnit(slug || unitId);
    if (!listing?.live) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const site = await getSite().catch(() => null);
    const brandMinNights = brandMinNightsFor(listing, site);
    const { errors, value } = pms.validateBookingRequest(
      { ...req.body, brandMinNights },
      { ...listing, brandMinNights }
    );
    const fieldErrors = { ...errors };
    const occupancyRejected = fieldErrors.adults === 'bm.err.occupancy';
    if (occupancyRejected) delete fieldErrors.adults;
    if (Object.keys(fieldErrors).length) {
      return res.status(422).json({ error: 'Please check the highlighted booking details', fields: fieldErrors });
    }
    if (occupancyRejected) {
      return res.status(422).json({
        code: 'kwentra_rejected',
        error: 'This room type cannot take that combination of adults and children',
      });
    }
    if (sync.isLinked(listing)) {
      const occupancies = await sync.occupancyRows(listing).catch(() => []);
      if (!sync.partyFits(occupancies, value.adults, value.children)) {
        return res.status(422).json({
          code: 'kwentra_rejected',
          error: 'This room type cannot take that combination of adults and children',
        });
      }
    }

    const stay = await resolveStay(listing, value.arrivalDate, value.departureDate, {
      adults: value.adults,
      children: value.children,
      strict: true,
    });
    if (stay.occupied.length) {
      return res.status(422).json({
        code: 'kwentra_rejected',
        conflict: true,
        error: 'Some of those nights were just booked — please choose other dates',
      });
    }

    const quote = priceForPlan(value.ratePlan, stay, listing, value.arrivalDate, value.departureDate);
    if (sync.isLinked(listing) && quote.nightly.some((night) => !(night.base > 0))) {
      return res.status(422).json({
        code: 'kwentra_rejected',
        error: 'Kwentra has no rate for this room on those dates',
      });
    }

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
      locale: req.body?.locale === 'ar' ? 'ar' : 'en',
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

    if (!kwentra.isConfigured() || !sync.isLinked(listing)) {
      return res.status(422).json({
        code: 'kwentra_rejected',
        error: 'Kwentra did not accept this reservation',
      });
    }

    let paymentSession;
    try {
      paymentSession = await payment.createPaymentSession({
        amount: booking.rateAmount,
        currency: booking.rateCurrency,
        merchantOrderId: externalRef,
        billing: { name: booking.primaryGuestName, email: booking.email, phone: booking.phone },
      });
    } catch (err) {
      console.warn('[payment] session failed:', err.message);
      return res.status(422).json({
        code: 'kwentra_rejected',
        error: 'Payment could not be opened',
      });
    }

    booking.chargeAmount = paymentSession.chargeAmount ?? null;
    booking.chargeCurrency = paymentSession.chargeCurrency || null;
    booking.fxRate = paymentSession.fxRate ?? null;

    const saved = await createBooking(booking);

    res.status(201).json({
      booking: publicBooking({ ...booking, ...saved }),
      pms: pms.toPmsRows(booking),
      payment: paymentSession,
      kwentra: {
        guest: null,
        reservation: null,
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

    // Leave while Kwentra creates the reservation. The guest should not wait on that before the mailbox is contacted.
    emailService.sendBookingConfirmation(booking).catch((err) => {
      console.warn('[email] confirmation failed:', err.message);
    });

    let paymentPush = null;
    if (kwentra.isConfigured()) {
      paymentPush = await sync.pushPaidBooking(booking, {
        amount: booking.rateAmount ?? booking.amount,
        currency: booking.rateCurrency || booking.currency || 'USD',
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
