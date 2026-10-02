/** Map DB snake_case ↔ app camelCase */

const numOrNull = (v) => (v == null || v === '' ? null : Number(v));
const list = (v) => (Array.isArray(v) ? v : []);

function destinationFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    image: row.image || '',
    sortOrder: Number(row.sort_order) || 0,
    showOnHome: row.show_on_home !== false,
    published: row.published !== false,
    kwentraDestinationId: row.kwentra_destination_id || '',
  };
}

function destinationToRow(item) {
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    image: item.image || '',
    sort_order: Number(item.sortOrder) || 0,
    show_on_home: item.showOnHome !== false,
    published: item.published !== false,
    kwentra_destination_id: item.kwentraDestinationId || '',
    updated_at: new Date().toISOString(),
  };
}

function compoundFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    brand: row.brand || '',
    destinationId: row.destination_id || '',
    region: row.region || '',
    city: row.city || '',
    unitCount: Number(row.unit_count) || 0,
    image: row.image || '',
    sortOrder: Number(row.sort_order) || 0,
    showOnHome: row.show_on_home !== false,
    published: row.published !== false,
    kwentraProjectId: row.kwentra_project_id || '',
    kwentraDestinationId: row.kwentra_destination_id || '',
    kwentraTenantId: row.kwentra_tenant_id || '',
    description: row.description || '',
    address: row.address || '',
    mapsUrl: row.maps_url || '',
    latitude: numOrNull(row.latitude),
    longitude: numOrNull(row.longitude),
    buildingNumber: row.building_number || '',
    phone: row.phone || '',
    facilities: list(row.facilities),
    driveFolderUrl: row.drive_folder_url || '',
    factSheetUrl: row.fact_sheet_url || '',
    kwentraSnapshot: row.kwentra_snapshot || null,
  };
}

function compoundToRow(item) {
  return {
    id: item.id,
    name: item.name,
    brand: item.brand || '',
    destination_id: item.destinationId || '',
    region: item.region || '',
    city: item.city || '',
    unit_count: Number(item.unitCount) || 0,
    image: item.image || '',
    sort_order: Number(item.sortOrder) || 0,
    show_on_home: item.showOnHome !== false,
    published: item.published !== false,
    kwentra_project_id: item.kwentraProjectId || '',
    kwentra_destination_id: item.kwentraDestinationId || '',
    kwentra_tenant_id: item.kwentraTenantId || '',
    description: item.description || '',
    address: item.address || '',
    maps_url: item.mapsUrl || '',
    latitude: numOrNull(item.latitude),
    longitude: numOrNull(item.longitude),
    building_number: item.buildingNumber || '',
    phone: item.phone || '',
    facilities: list(item.facilities),
    drive_folder_url: item.driveFolderUrl || '',
    fact_sheet_url: item.factSheetUrl || '',
    kwentra_snapshot: item.kwentraSnapshot || null,
    updated_at: new Date().toISOString(),
  };
}

function unitFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    unitType: row.unit_type || '',
    brand: row.brand || '',
    compoundId: row.compound_id || '',
    compound: row.compound || '',
    destinationId: row.destination_id || '',
    destination: row.destination || row.region || '',
    region: row.region || '',
    city: row.city || '',
    propertyType: row.property_type || 'Apartment',
    bedrooms: Number(row.bedrooms) || 0,
    bathrooms: Number(row.bathrooms) || 1,
    areaSqm: Number(row.area_sqm) || 0,
    maxGuests: Number(row.max_guests) || 2,
    pricePerNight: Number(row.price_per_night) || 0,
    currency: row.currency || 'EGP',
    featured: Boolean(row.featured),
    available: row.available !== false,
    published: row.published !== false,
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    facilities: Array.isArray(row.facilities) ? row.facilities : [],
    description: row.description || '',
    images: Array.isArray(row.images) ? row.images : [],
    driveFolderUrl: row.drive_folder_url || '',
    kwentraRoomTypeId: row.kwentra_room_type_id || '',
    homeOrder: Number(row.home_order) || 999,
    searchOrder: Number(row.search_order) || 0,
    averageRating: Number(row.average_rating) || 0,
    reviewCount: Number(row.review_count) || 0,
    reviews: Array.isArray(row.reviews) ? row.reviews : [],
    roomCount: numOrNull(row.room_count),
    unitNumbers: list(row.unit_numbers),
    floor: row.floor || '',
    bedType: row.bed_type || '',
    kwentraSnapshot: row.kwentra_snapshot || null,
  };
}

function unitToRow(item) {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    unit_type: item.unitType || '',
    brand: item.brand || '',
    compound_id: item.compoundId || null,
    compound: item.compound || '',
    destination_id: item.destinationId || '',
    destination: item.destination || '',
    region: item.region || '',
    city: item.city || '',
    property_type: item.propertyType || 'Apartment',
    bedrooms: Number(item.bedrooms) || 0,
    bathrooms: Number(item.bathrooms) || 1,
    area_sqm: Number(item.areaSqm) || 0,
    max_guests: Number(item.maxGuests) || 2,
    price_per_night: Number(item.pricePerNight) || 0,
    currency: item.currency || 'EGP',
    featured: Boolean(item.featured),
    available: item.available !== false,
    published: item.published !== false,
    amenities: item.amenities || [],
    facilities: item.facilities || [],
    description: item.description || '',
    images: item.images || [],
    drive_folder_url: item.driveFolderUrl || '',
    kwentra_room_type_id: item.kwentraRoomTypeId || '',
    home_order: Number.isFinite(Number(item.homeOrder)) ? Number(item.homeOrder) : 999,
    search_order: Number(item.searchOrder) || 0,
    average_rating: Number(item.averageRating) || 0,
    review_count: Number(item.reviewCount) || 0,
    reviews: item.reviews || [],
    room_count: numOrNull(item.roomCount),
    unit_numbers: list(item.unitNumbers),
    floor: item.floor || '',
    bed_type: item.bedType || '',
    kwentra_snapshot: item.kwentraSnapshot || null,
    updated_at: new Date().toISOString(),
  };
}

function slideFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    image: row.image,
    alt: row.alt || '',
    enabled: row.enabled !== false,
    sortOrder: Number(row.sort_order) || 0,
  };
}

function slideToRow(item) {
  return {
    id: item.id,
    image: item.image,
    alt: item.alt || '',
    enabled: item.enabled !== false,
    sort_order: Number(item.sortOrder) || 0,
  };
}

function settingsFromRow(row) {
  if (!row) {
    return {
      metaPixelId: '',
      facebookPixelId: '',
      googleAdsId: '',
      gtmId: '',
      content: {},
      site: {},
    };
  }
  return {
    metaPixelId: row.meta_pixel_id || '',
    facebookPixelId: row.facebook_pixel_id || '',
    googleAdsId: row.google_ads_id || '',
    gtmId: row.gtm_id || '',
    content: row.content || {},
    site: row.site || {},
  };
}

const num = (v) => (v != null ? Number(v) : null);

function bookingFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    voucherNumber: row.voucher_number || '',
    channel: row.channel || '',
    status: row.status,
    paymentStatus: row.payment_status || '',
    createdAt: row.created_at,
    slug: row.slug,
    listingId: row.listing_id,
    listingTitle: row.listing_title,
    destinationId: row.destination_id || '',
    destination: row.destination || '',
    propertyId: row.property_id || '',
    property: row.property || '',
    brand: row.brand || '',
    roomType: row.room_type || '',
    kwentraRoomTypeId: row.kwentra_room_type_id || '',
    primaryGuestName: row.primary_guest_name || row.name,
    otherGuestNames: Array.isArray(row.other_guest_names) ? row.other_guest_names : [],
    nationality: row.nationality || '',
    reservationCountry: row.reservation_country || '',
    name: row.name,
    email: row.email,
    phone: row.phone,
    arrivalDate: row.check_in,
    departureDate: row.check_out,
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: num(row.nights),
    checkInTime: row.check_in_time || '',
    checkOutTime: row.check_out_time || '',
    adults: num(row.adults),
    children: num(row.children),
    guests: row.guests,
    ratePlanCode: row.rate_plan_code || '',
    ratePlanName: row.rate_plan_name || '',
    rateAmount: num(row.rate_amount),
    averageNightlyRate: num(row.average_nightly_rate),
    rateCurrency: row.currency || 'EGP',
    amount: num(row.rate_amount),
    currency: row.currency || 'EGP',
    notes: row.notes,
    pricePerNight: num(row.price_per_night),
    externalRef: row.external_ref || '',
    kwentraReservationId: row.kwentra_reservation_id || null,
    kwentraProfileId: row.kwentra_profile_id || null,
  };
}

function bookingToRow(b) {
  return {
    id: b.id,
    voucher_number: b.voucherNumber || null,
    channel: b.channel || null,
    status: b.status || 'requested',
    payment_status: b.paymentStatus || null,
    slug: b.slug,
    listing_id: b.listingId,
    listing_title: b.listingTitle,
    destination_id: b.destinationId || null,
    destination: b.destination || null,
    property_id: b.propertyId || null,
    property: b.property || null,
    brand: b.brand || null,
    room_type: b.roomType || null,
    kwentra_room_type_id: b.kwentraRoomTypeId || null,
    primary_guest_name: b.primaryGuestName || null,
    other_guest_names: b.otherGuestNames || [],
    nationality: b.nationality || null,
    reservation_country: b.reservationCountry || null,
    name: b.name || b.primaryGuestName,
    email: b.email,
    phone: b.phone,
    guests: b.guests,
    adults: b.adults,
    children: b.children,
    check_in: b.arrivalDate || b.checkIn,
    check_out: b.departureDate || b.checkOut,
    nights: b.nights,
    check_in_time: b.checkInTime || null,
    check_out_time: b.checkOutTime || null,
    rate_plan_code: b.ratePlanCode || null,
    rate_plan_name: b.ratePlanName || null,
    rate_amount: b.rateAmount ?? b.amount ?? null,
    average_nightly_rate: b.averageNightlyRate ?? null,
    currency: b.rateCurrency || b.currency || 'EGP',
    notes: b.notes,
    price_per_night: b.pricePerNight,
    external_ref: b.externalRef || null,
    kwentra_reservation_id: b.kwentraReservationId || null,
    kwentra_profile_id: b.kwentraProfileId || null,
  };
}

module.exports = {
  destinationFromRow,
  destinationToRow,
  compoundFromRow,
  compoundToRow,
  unitFromRow,
  unitToRow,
  slideFromRow,
  slideToRow,
  settingsFromRow,
  bookingFromRow,
  bookingToRow,
};
