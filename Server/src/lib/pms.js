/**
 * PMS data contract for website bookings ("PMS Data Fields" sheet).
 * Every reservation pushed to the PMS carries these 17 fields; the booking engine
 * collects the guest-facing ones and the server derives / enforces the rest.
 */

const CHANNEL = 'Website';

/** source: guest = typed by booker · auto = computed by server · listing = from inventory · constant */
const PMS_FIELDS = [
  { no: 1, key: 'primaryGuestName', label: 'Primary Guest Name', type: 'Alphabetic', required: true, source: 'guest' },
  { no: 2, key: 'otherGuestNames', label: 'Other Guests Names', type: 'Alphabetic', required: false, source: 'guest' },
  { no: 3, key: 'nationality', label: 'Primary Guest Nationality', type: 'Alphabetic', required: false, source: 'guest', autofill: 'ip' },
  { no: 4, key: 'arrivalDate', label: 'Arrival Date', type: 'Date', required: true, source: 'guest' },
  { no: 5, key: 'departureDate', label: 'Departure Date', type: 'Date', required: true, source: 'guest' },
  { no: 6, key: 'nights', label: 'Nights', type: 'Numeric', required: true, source: 'auto' },
  { no: 7, key: 'checkInTime', label: 'Check-In Time', type: 'Time', required: false, source: 'guest' },
  { no: 8, key: 'checkOutTime', label: 'Check-Out Time', type: 'Time', required: false, source: 'guest' },
  { no: 9, key: 'reservationCountry', label: 'Reservation Country', type: 'Alphabetic', required: true, source: 'guest', autofill: 'ip' },
  { no: 10, key: 'channel', label: 'Channel', type: 'Alphabetic', required: true, source: 'constant', value: CHANNEL },
  { no: 11, key: 'voucherNumber', label: 'Voucher Number', type: 'Alpha-Numeric', required: true, source: 'auto' },
  { no: 12, key: 'adults', label: 'Number of guests (Adults)', type: 'Numeric', required: true, source: 'guest' },
  { no: 13, key: 'children', label: 'Number of guests (Children)', type: 'Numeric', required: true, source: 'guest' },
  { no: 14, key: 'roomType', label: 'Room Type Booked', type: 'List', required: true, source: 'listing' },
  { no: 15, key: 'ratePlanName', label: 'Rate Plan Name', type: 'Alphabetic', required: true, source: 'guest' },
  { no: 16, key: 'rateAmount', label: 'Rate Amount', type: 'Numeric', required: true, source: 'auto' },
  { no: 17, key: 'rateCurrency', label: 'Rate Currency', type: 'Currency', required: true, source: 'listing' },
];

const RATE_PLANS = [
  {
    code: 'FLEX',
    name: 'Flexible Rate',
    description: 'Free cancellation up to 48 hours before arrival.',
    adjustmentPct: 0,
    minNights: 1,
    refundable: true,
  },
  {
    code: 'NRF',
    name: 'Non-Refundable Rate',
    description: 'Save 10% — prepaid, no changes or refunds.',
    adjustmentPct: -10,
    minNights: 1,
    refundable: false,
  },
  {
    code: 'WEEKLY',
    name: 'Weekly Stay Rate',
    description: 'Save 15% on stays of 7 nights or more. Free cancellation up to 7 days before arrival.',
    adjustmentPct: -15,
    minNights: 7,
    refundable: true,
  },
];

const STANDARD_CHECK_IN = '15:00';
const STANDARD_CHECK_OUT = '12:00';

const hours = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${String(from + i).padStart(2, '0')}:00`);

const CHECK_IN_TIMES = hours(12, 23);
const CHECK_OUT_TIMES = hours(6, 12);

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s()-]{7,20}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

function countryName(code) {
  const c = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  try {
    const name = regionNames.of(c);
    return name && name !== c ? name : '';
  } catch {
    return '';
  }
}

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isIsoDate(value) {
  if (!ISO_DATE_RE.test(String(value || ''))) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function nightsBetween(arrival, departure) {
  if (!isIsoDate(arrival) || !isIsoDate(departure)) return 0;
  const ms = new Date(`${departure}T00:00:00Z`) - new Date(`${arrival}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function findRatePlan(code) {
  return RATE_PLANS.find((p) => p.code === String(code || '').toUpperCase()) || null;
}

function ratePlansForStay(nights) {
  return RATE_PLANS.map((plan) => ({ ...plan, eligible: nights >= plan.minNights }));
}

/**
 * Price a stay for a rate plan from nightly base prices ({ 'YYYY-MM-DD': amount }).
 */
function priceStay({ arrivalDate, departureDate, nightlyPrices = {}, fallbackNightly = 0, ratePlan, currency = 'EGP' }) {
  const nights = nightsBetween(arrivalDate, departureDate);
  const factor = 1 + (Number(ratePlan?.adjustmentPct) || 0) / 100;
  const nightly = [];
  const cursor = new Date(`${arrivalDate}T00:00:00Z`);
  for (let i = 0; i < nights; i += 1) {
    const iso = cursor.toISOString().slice(0, 10);
    const base = Number(nightlyPrices[iso] ?? fallbackNightly) || 0;
    const rate = Math.round(base * factor * 100) / 100;
    nightly.push({ date: iso, base, rate });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const baseTotal = nightly.reduce((s, n) => s + n.base, 0);
  const rateAmount = nightly.reduce((s, n) => s + n.rate, 0);
  return {
    nights,
    baseTotal,
    rateAmount,
    discount: baseTotal - rateAmount,
    averageNightlyRate: nights ? Math.round((rateAmount / nights) * 100) / 100 : 0,
    currency,
    nightly,
  };
}

function formatVoucher(serial, date = new Date()) {
  return `PHW-${date.getFullYear()}-${String(serial).padStart(6, '0')}`;
}

/**
 * Validate the booking-engine payload against the PMS contract.
 * Returns { errors: { field: message }, value } — value is normalized and ready to price/persist.
 */
function validateBookingRequest(body = {}, listing = {}) {
  const errors = {};

  const primaryGuestName = cleanName(body.primaryGuestName ?? body.name);
  if (!primaryGuestName) errors.primaryGuestName = 'Primary guest name is required';
  else if (!NAME_RE.test(primaryGuestName)) errors.primaryGuestName = 'Use letters only';
  else if (primaryGuestName.split(' ').length < 2) errors.primaryGuestName = 'Enter first and last name';
  else if (primaryGuestName.length > 80) errors.primaryGuestName = 'Name is too long';

  const adults = Number(body.adults ?? body.guests);
  const children = Number(body.children ?? 0);
  const maxGuests = Number(listing.maxGuests) || 8;
  if (!Number.isInteger(adults) || adults < 1) errors.adults = 'At least 1 adult is required';
  if (!Number.isInteger(children) || children < 0) errors.children = 'Children must be 0 or more';
  if (!errors.adults && !errors.children && adults + children > maxGuests) {
    errors.adults = `This unit type sleeps up to ${maxGuests} guests`;
  }

  const rawOthers = Array.isArray(body.otherGuestNames) ? body.otherGuestNames : [];
  const otherGuestNames = rawOthers.map(cleanName).filter(Boolean);
  const maxOthers = Math.max(0, (adults || 1) + (children || 0) - 1);
  if (otherGuestNames.length > maxOthers) {
    errors.otherGuestNames = `Up to ${maxOthers} additional guest name(s)`;
  } else if (otherGuestNames.some((n) => !NAME_RE.test(n) || n.length > 80)) {
    errors.otherGuestNames = 'Guest names must use letters only';
  }

  const nationality = String(body.nationality || '').toUpperCase();
  if (nationality && !countryName(nationality)) errors.nationality = 'Select a valid nationality';

  const reservationCountry = String(body.reservationCountry || '').toUpperCase();
  if (!reservationCountry) errors.reservationCountry = 'Reservation country is required';
  else if (!countryName(reservationCountry)) errors.reservationCountry = 'Select a valid country';

  const arrivalDate = String(body.arrivalDate ?? body.checkIn ?? '');
  const departureDate = String(body.departureDate ?? body.checkOut ?? '');
  if (!isIsoDate(arrivalDate)) errors.arrivalDate = 'Arrival date is required';
  else if (arrivalDate < todayIso()) errors.arrivalDate = 'Arrival date cannot be in the past';
  if (!isIsoDate(departureDate)) errors.departureDate = 'Departure date is required';
  else if (!errors.arrivalDate && departureDate <= arrivalDate) {
    errors.departureDate = 'Departure must be after arrival';
  }
  const nights = errors.arrivalDate || errors.departureDate ? 0 : nightsBetween(arrivalDate, departureDate);

  const checkInTime = String(body.checkInTime || '');
  const checkOutTime = String(body.checkOutTime || '');
  if (checkInTime && !TIME_RE.test(checkInTime)) errors.checkInTime = 'Use HH:MM';
  if (checkOutTime && !TIME_RE.test(checkOutTime)) errors.checkOutTime = 'Use HH:MM';

  const ratePlan = findRatePlan(body.ratePlanCode);
  if (!ratePlan) errors.ratePlanCode = 'Select a rate plan';
  else if (nights && nights < ratePlan.minNights) {
    errors.ratePlanCode = `${ratePlan.name} requires ${ratePlan.minNights}+ nights`;
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (!email) errors.email = 'Email is required for your confirmation';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email';

  const phone = String(body.phone || '').trim();
  if (!phone) errors.phone = 'Phone is required';
  else if (!PHONE_RE.test(phone)) errors.phone = 'Enter a valid phone number';

  const notes = String(body.notes || '').trim().slice(0, 1000);

  return {
    errors,
    value: {
      primaryGuestName,
      otherGuestNames,
      nationality,
      reservationCountry,
      arrivalDate,
      departureDate,
      nights,
      checkInTime,
      checkOutTime,
      adults,
      children,
      ratePlan,
      email,
      phone,
      notes,
    },
  };
}

/** PMS field rows in sheet order for a stored booking */
function toPmsRows(booking = {}) {
  const display = {
    otherGuestNames: (booking.otherGuestNames || []).join(', '),
    nationality: booking.nationality ? `${countryName(booking.nationality)} (${booking.nationality})` : '',
    reservationCountry: booking.reservationCountry
      ? `${countryName(booking.reservationCountry)} (${booking.reservationCountry})`
      : '',
  };
  return PMS_FIELDS.map((f) => ({
    no: f.no,
    field: f.label,
    key: f.key,
    required: f.required,
    value: display[f.key] ?? booking[f.key] ?? '',
  }));
}

function bookingConfig() {
  return {
    channel: CHANNEL,
    fields: PMS_FIELDS,
    ratePlans: RATE_PLANS,
    checkInTimes: CHECK_IN_TIMES,
    checkOutTimes: CHECK_OUT_TIMES,
    standardCheckIn: STANDARD_CHECK_IN,
    standardCheckOut: STANDARD_CHECK_OUT,
  };
}

module.exports = {
  CHANNEL,
  PMS_FIELDS,
  RATE_PLANS,
  STANDARD_CHECK_IN,
  STANDARD_CHECK_OUT,
  countryName,
  nightsBetween,
  findRatePlan,
  ratePlansForStay,
  priceStay,
  formatVoucher,
  validateBookingRequest,
  toPmsRows,
  bookingConfig,
};
