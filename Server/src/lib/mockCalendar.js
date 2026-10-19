/** Deterministic mock availability + daily prices for guest listing calendars. */

function localIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(iso, n) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return localIso(d);
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function eachNight(from, to, fn) {
  for (let d = parseIso(from); localIso(d) < to; d.setDate(d.getDate() + 1)) {
    fn(localIso(d), d);
  }
}

/**
 * Build blocked nights + checkout turnover for a listing in [from, to).
 * Uses a seeded PRNG over a fixed today → +12 months window, so every caller
 * (listing calendar, booking check) sees the same pattern regardless of the range asked for.
 */
function buildAvailability(listing, from, to) {
  const anchor = resolveWindow({});
  const full = buildAnchoredAvailability(listing, anchor.from, anchor.to);
  return {
    blocked: full.blocked.filter((b) => b.date >= from && b.date < to),
    checkout_dates: full.checkout_dates.filter((d) => d >= from && d <= to),
  };
}

function buildAnchoredAvailability(listing, from, to) {
  const rand = mulberry32(hashSeed(String(listing.id || listing.slug || 'prime')));
  const blockedMap = new Map();
  const checkoutSet = new Set();

  const start = parseIso(from);
  const end = parseIso(to);
  const spanDays = Math.max(1, Math.round((end - start) / 86_400_000));

  // Sparse blocked stays so the calendar stays readable (~3–5 across 12 months)
  const stayCount = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < stayCount; i += 1) {
    const offset = Math.floor(rand() * Math.max(1, spanDays - 14));
    const length = 2 + Math.floor(rand() * 4); // 2–5 nights
    const checkIn = addDays(from, offset);
    const checkOut = addDays(checkIn, length);
    if (checkOut > to) continue;

    eachNight(checkIn, checkOut, (iso) => {
      if (!blockedMap.has(iso)) blockedMap.set(iso, 'booking');
    });
    if (checkOut < to) checkoutSet.add(checkOut);
  }

  // Occasional single-night owner hold
  const holdCount = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < holdCount; i += 1) {
    const offset = Math.floor(rand() * Math.max(1, spanDays - 1));
    const iso = addDays(from, offset);
    if (!blockedMap.has(iso)) blockedMap.set(iso, 'manual');
  }

  // Checkout mornings that are still occupied stay blocked (not open for check-in)
  for (const day of [...checkoutSet]) {
    if (blockedMap.has(day)) checkoutSet.delete(day);
  }

  const blocked = [...blockedMap.entries()]
    .map(([date, source]) => ({ date, source }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const checkout_dates = [...checkoutSet].sort();

  return { blocked, checkout_dates };
}

/**
 * Per-night guest prices for [from, to) when Kwentra is not connected.
 * The amount is the listing's nightly rate itself. Rounding to the nearest 100
 * turned a 211 EGP rate into 200 on the unit page.
 */
function buildPricing(listing, from, to) {
  const base = Number(listing.pricePerNight) || 10000;
  const currency = 'USD';
  const prices = {};
  const rows = [];

  eachNight(from, to, (iso) => {
    prices[iso] = base;
    rows.push({ date: iso, price: base, currency, source: 'mock' });
  });

  return { prices, rows, currency };
}

function resolveWindow(query = {}) {
  const from = query.from || localIso(new Date());
  let to = query.to;
  if (!to) {
    const d = parseIso(from);
    d.setMonth(d.getMonth() + 12);
    to = localIso(d);
  }
  return { from, to };
}

module.exports = {
  localIso,
  resolveWindow,
  buildAvailability,
  buildPricing,
};
