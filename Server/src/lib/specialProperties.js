/**
 * Properties that must keep working on the website whatever goes wrong around them.
 *
 * Prime Inn Andalus New Cairo (Kwentra tenant 1509, Paymob integration 5852145):
 *  - Kwentra has no hotel name for it, so it gets one here (see TENANT_NAMES in kwentraSync).
 *  - It is never hidden by the Paymob check.
 *  - If Paymob refuses its own integration on a payment, the guest pays on the website's integration
 *    and the booking is flagged for the accountant, instead of the payment being refused.
 *  - Its Kwentra room types are named with whole paragraphs; the website shows a short title and keeps
 *    Kwentra's text as the description. An admin edit of the title still wins.
 */

const ALWAYS_ON = {
  1509: {
    name: 'Prime Inn Andalus New Cairo',
    roomTypes: {
      1: { title: 'Two Bedroom Apartment', unitType: '2BR', bedrooms: 2 },
      2: { title: 'One Bedroom Apartment', unitType: '1BR', bedrooms: 1 },
      3: { title: 'Studio with Kitchenette', unitType: 'Studio', bedrooms: 0 },
      4: { title: 'Studio with Full Kitchen', unitType: 'Studio', bedrooms: 0 },
      5: { title: 'Queen Room', unitType: 'Studio', bedrooms: 0 },
    },
  },
};

const key = (v) => String(v ?? '').trim();

function isAlwaysOn(tenantId) {
  return Boolean(ALWAYS_ON[key(tenantId)]);
}

/** Short title (and type) for a room type of an always-on property; Kwentra's text becomes the description. */
function roomTypeOverride(tenantId, roomType) {
  const special = ALWAYS_ON[key(tenantId)];
  const fix = special?.roomTypes?.[key(roomType?.kwentraRoomTypeId)];
  if (!fix) return {};
  const original = String(roomType?.title || '').trim();
  const out = { ...fix };
  if (original && original !== fix.title && !String(roomType?.description || '').trim()) out.description = original;
  return out;
}

module.exports = { ALWAYS_ON, isAlwaysOn, roomTypeOverride };
