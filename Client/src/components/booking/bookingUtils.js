export const STEPS = ['stay', 'rate', 'guests', 'review', 'pay'];

/** Which step owns each PMS field — used to jump back to server-side validation errors */
export const STEP_OF_FIELD = {
  arrivalDate: 'stay',
  departureDate: 'stay',
  adults: 'stay',
  children: 'stay',
  checkInTime: 'stay',
  checkOutTime: 'stay',
  ratePlanCode: 'rate',
  primaryGuestName: 'guests',
  otherGuestNames: 'guests',
  nationality: 'guests',
  email: 'guests',
  phone: 'guests',
  notes: 'stay',
};

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s()-]{7,20}$/;

export function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function nightsBetween(arrival, departure) {
  if (!arrival || !departure) return 0;
  const ms = Date.parse(`${departure}T00:00:00Z`) - Date.parse(`${arrival}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : 0;
}

/** Same arithmetic as the server (Server/src/lib/pms.js priceStay) so the shown total matches the charge */
export function priceStay({ arrivalDate, departureDate, dailyPrices = {}, fallbackNightly = 0, plan }) {
  const nights = nightsBetween(arrivalDate, departureDate);
  const factor = 1 + (Number(plan?.adjustmentPct) || 0) / 100;
  let baseTotal = 0;
  let rateAmount = 0;
  const cursor = new Date(`${arrivalDate}T00:00:00Z`);
  for (let i = 0; i < nights; i += 1) {
    const iso = cursor.toISOString().slice(0, 10);
    const base = Number(dailyPrices[iso] ?? fallbackNightly) || 0;
    baseTotal += base;
    rateAmount += Math.round(base * factor * 100) / 100;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return {
    nights,
    baseTotal,
    rateAmount,
    discount: baseTotal - rateAmount,
    averageNightlyRate: nights ? Math.round((rateAmount / nights) * 100) / 100 : 0,
  };
}

/** One night from the rate grid: adult column, plus child range 1 for each child. */
export function priceForOccupancy(cell, adults, children) {
  if (cell == null || typeof cell !== 'object') return Number(cell) || 0;
  const count = Math.min(6, Math.max(1, Number(adults) || 1));
  const adult = Number(cell.adults?.[count - 1]) || 0;
  if (!(adult > 0)) return 0;
  const eachChild = Number(cell.children?.[0]) || 0;
  return adult + Math.max(0, Number(children) || 0) * eachChild;
}

export function pricesForGuests(occupancy, adults, children) {
  const prices = {};
  for (const [date, cell] of Object.entries(occupancy || {})) {
    const amount = priceForOccupancy(cell, adults, children);
    if (amount > 0) prices[date] = amount;
  }
  return prices;
}

/** Error values are LocaleContext keys; server messages pass through t() unchanged */
export function validateStay(stay, maxGuests, minNights = 1) {
  const errors = {};
  if (!stay.arrivalDate) errors.arrivalDate = 'bm.err.arrival';
  else if (stay.arrivalDate < todayIso()) errors.arrivalDate = 'bm.err.arrivalPast';
  if (!stay.departureDate) errors.departureDate = 'bm.err.departure';
  else if (stay.arrivalDate && stay.departureDate <= stay.arrivalDate) errors.departureDate = 'bm.err.departureOrder';
  else {
    const nights = nightsBetween(stay.arrivalDate, stay.departureDate);
    const brandMin = Math.max(1, Number(minNights) || 1);
    if (nights < brandMin) errors.departureDate = 'bm.err.minStay';
  }
  if (stay.adults < 1) errors.adults = 'bm.err.adults';
  if (stay.adults + stay.children > maxGuests) errors.adults = 'bm.err.tooManyGuests';
  return errors;
}

export function validateRate(plan, nights) {
  if (!plan) return { ratePlanCode: 'bm.err.rate' };
  if (nights < plan.minNights) return { ratePlanCode: 'bm.err.rateMinNights' };
  return {};
}

export function validateGuest(guest, stay = {}) {
  const errors = {};
  const name = cleanName(guest.primaryGuestName);
  if (!name) errors.primaryGuestName = 'bm.err.name';
  else if (!NAME_RE.test(name)) errors.primaryGuestName = 'bm.err.nameLetters';
  else if (name.split(' ').length < 2) errors.primaryGuestName = 'bm.err.nameFull';

  const extra = Math.max(0, Number(stay.adults || 1) + Number(stay.children || 0) - 1);
  const others = Array.from({ length: extra }, (_, i) => cleanName(guest.otherGuestNames?.[i]));
  if (extra && others.some((n) => !n)) errors.otherGuestNames = 'bm.err.otherGuests';
  else if (others.some((n) => n && !NAME_RE.test(n))) errors.otherGuestNames = 'bm.err.nameLetters';
  else if (others.some((n) => n && n.split(' ').length < 2)) errors.otherGuestNames = 'bm.err.nameFull';

  const email = guest.email.trim();
  if (!email) errors.email = 'bm.err.email';
  else if (!EMAIL_RE.test(email)) errors.email = 'bm.err.emailInvalid';

  const phone = guest.phone.trim();
  if (!phone) errors.phone = 'bm.err.phone';
  else if (!PHONE_RE.test(phone)) errors.phone = 'bm.err.phoneInvalid';
  return errors;
}

export function formatTime(hhmm, localeTag = 'en-US') {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(localeTag, { hour: 'numeric', minute: '2-digit' });
}

export function formatIsoDate(iso, localeTag = 'en-US', opts = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(localeTag, opts);
}
