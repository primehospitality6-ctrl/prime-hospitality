/**
 * Kwentra room-type occupation scenarios.
 * A stay is legal only when the adult/child pair exists on roomtypeoccupancy_set.
 */

function normalizeOccupancies(set) {
  const rows = Array.isArray(set) ? set : [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (row == null || typeof row !== 'object') continue;
    const adults = Number(row.adults ?? row.number_of_adults ?? row.adult);
    const children = Number(row.children ?? row.number_of_children ?? row.child ?? 0);
    if (!Number.isInteger(adults) || adults < 1) continue;
    if (!Number.isInteger(children) || children < 0) continue;
    const key = `${adults}:${children}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ adults, children });
  }
  return out.sort((a, b) => a.adults - b.adults || a.children - b.children);
}

/** Empty list means the room type has no scenarios yet, so the caller may still use max guests. */
function partyFits(rows, adults, children) {
  const list = normalizeOccupancies(rows);
  if (!list.length) return true;
  const a = Number(adults) || 0;
  const c = Number(children) || 0;
  return list.some((row) => row.adults === a && row.children === c);
}

function occupancyMax(set) {
  const list = normalizeOccupancies(set);
  if (!list.length) return undefined;
  return Math.max(...list.map((row) => row.adults + row.children));
}

module.exports = {
  normalizeOccupancies,
  partyFits,
  occupancyMax,
};
