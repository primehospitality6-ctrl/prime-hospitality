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
export function normalizeOccupancies(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const adults = Number(row?.adults ?? row?.number_of_adults);
    const children = Number(row?.children ?? row?.number_of_children ?? 0);
    if (!Number.isInteger(adults) || adults < 1) continue;
    if (!Number.isInteger(children) || children < 0) continue;
    const key = `${adults}:${children}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ adults, children });
  }
  return out.sort((a, b) => a.adults - b.adults || a.children - b.children);
}

export function partyFits(rows, adults, children) {
  const list = normalizeOccupancies(rows);
  if (!list.length) return true;
  return list.some((row) => row.adults === Number(adults) && row.children === Number(children));
}

/** Snap a party onto an allowed row. With no scenarios, keep the count inside max guests. */
export function clampParty(rows, adults, children, maxGuests = 8) {
  const list = normalizeOccupancies(rows);
  let a = Math.max(1, Number(adults) || 1);
  let c = Math.max(0, Number(children) || 0);
  if (!list.length) {
    if (a > maxGuests) a = maxGuests;
    if (a + c > maxGuests) c = Math.max(0, maxGuests - a);
    return { adults: a, children: c };
  }
  if (list.some((row) => row.adults === a && row.children === c)) return { adults: a, children: c };
  const sameAdults = list.filter((row) => row.adults === a);
  const pool = sameAdults.length ? sameAdults : list;
  return pool.reduce((pick, row) => {
    const score = Math.abs(row.adults - a) * 100 + Math.abs(row.children - c);
    const pickScore = Math.abs(pick.adults - a) * 100 + Math.abs(pick.children - c);
    return score < pickScore ? row : pick;
  });
}

/** Move one step to the next allowed adult or child count. Gaps in the scenario list are skipped. */
export function stepParty(rows, adults, children, field, delta, maxGuests = 8) {
  const list = normalizeOccupancies(rows);
  const a = Number(adults) || 1;
  const c = Number(children) || 0;
  if (!list.length) {
    if (field === 'adults') return { adults: Math.min(maxGuests - c, Math.max(1, a + delta)), children: c };
    return { adults: a, children: Math.min(Math.max(0, maxGuests - a), Math.max(0, c + delta)) };
  }
  if (field === 'adults') {
    const options = [...new Set(list.map((row) => row.adults))].sort((x, y) => x - y);
    const next = delta > 0 ? options.find((n) => n > a) : [...options].reverse().find((n) => n < a);
    if (next == null) return { adults: a, children: c };
    return clampParty(list, next, c, maxGuests);
  }
  const options = list.filter((row) => row.adults === a).map((row) => row.children).sort((x, y) => x - y);
  const next = delta > 0 ? options.find((n) => n > c) : [...options].reverse().find((n) => n < c);
  if (next == null) return { adults: a, children: c };
  return { adults: a, children: next };
}

export function validateStay(stay, maxGuests, minNights = 1, occupancies = []) {
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
  const rows = normalizeOccupancies(occupancies);
  if (rows.length) {
    if (!partyFits(rows, stay.adults, stay.children)) errors.adults = 'bm.err.occupancy';
  } else if (stay.adults + stay.children > maxGuests) errors.adults = 'bm.err.tooManyGuests';
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
