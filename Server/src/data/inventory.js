/**
 * PHMG inventory layering: Destination > Property > Unit Type.
 * Source: "PHMG-Total Inventory" sample sheet — replace/extend as the live inventory grows.
 */

const BRANDS = ['Inn', 'Residence', 'Select'];

const UNIT_TYPES = ['Studio', '1 BDR', '2 BDR', '3 BDR', '4 BDR'];

const UNIT_TYPE_SPECS = {
  Studio: { label: 'Studio', bedrooms: 0, bathrooms: 1, areaSqm: 45, maxGuests: 2, basePrice: 2400 },
  '1 BDR': { label: '1 Bedroom', bedrooms: 1, bathrooms: 1, areaSqm: 75, maxGuests: 3, basePrice: 3400 },
  '2 BDR': { label: '2 Bedrooms', bedrooms: 2, bathrooms: 2, areaSqm: 125, maxGuests: 5, basePrice: 5000 },
  '3 BDR': { label: '3 Bedrooms', bedrooms: 3, bathrooms: 3, areaSqm: 175, maxGuests: 7, basePrice: 7200 },
  '4 BDR': { label: '4 Bedrooms', bedrooms: 4, bathrooms: 4, areaSqm: 240, maxGuests: 9, basePrice: 9800 },
};

const BRAND_PRICE_FACTOR = { Inn: 0.8, Residence: 1, Select: 1.3 };

const IMG = (id, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const PHOTO_IDS = [
  '1600585154340-be6161a56a0c',
  '1600607687939-ce8a6c25118c',
  '1600566753190-17f0baa2a6c3',
  '1600596542815-ffad4c1539a9',
  '1502672260266-1c1ef2d93688',
  '1560448204-e02f11c3d0e2',
  '1522708323590-d24dbb6b0267',
  '1600047509807-ba8f99d2cdde',
  '1600210492486-724fe5c67fb0',
  '1600585154526-990dced4db0d',
  '1600566753086-00f18fb6b3ea',
  '1600607687644-c7171b42498b',
  '1600210492493-0946911123ea',
  '1613490493576-7fde63acd811',
  '1512917774080-9991f1c4c750',
];

const INVENTORY = [
  {
    name: '10th of Ramadan',
    image: IMG('1560448204-e02f11c3d0e2', 1400),
    properties: [{ name: 'Prime Inn 10th Of Ramadan', city: '10th of Ramadan', unitTypes: ['Studio'] }],
  },
  {
    name: 'Alexandria',
    image: IMG('1512917774080-9991f1c4c750', 1400),
    properties: [
      { name: 'Prime Select Gleem', city: 'Gleem', unitTypes: ['2 BDR'] },
      { name: 'Prime Select San Stefano', city: 'San Stefano', unitTypes: ['2 BDR'] },
    ],
  },
  {
    name: 'East Cairo',
    image: IMG('1600596542815-ffad4c1539a9', 1400),
    properties: [
      { name: 'Prime Residence Kattameya', city: 'Kattameya', unitTypes: ['1 BDR', '2 BDR', 'Studio'] },
      { name: 'Prime Residence New Cairo', city: 'New Cairo', unitTypes: ['1 BDR', '2 BDR', 'Studio'] },
      { name: 'Prime Residence Point 90', city: 'New Cairo', unitTypes: ['1 BDR', '2 BDR', 'Studio'] },
      { name: 'Prime Select 90 Avenue', city: 'New Cairo', unitTypes: ['2 BDR'] },
      { name: 'Prime Select Eastown New Cairo', city: 'New Cairo', unitTypes: ['3 BDR', 'Studio'] },
      { name: 'Prime Select Galleria Moon Valley', city: 'New Cairo', unitTypes: ['2 BDR'] },
      { name: 'Prime Select Kattameya Bavaria', city: 'Kattameya', unitTypes: ['1 BDR', '2 BDR', 'Studio'] },
      { name: 'Prime Select Lake View', city: 'New Cairo', unitTypes: ['2 BDR'] },
      { name: 'Prime Select Lotus New Cairo', city: 'New Cairo', unitTypes: ['2 BDR'] },
      { name: 'Prime Select Marvel City', city: 'New Cairo', unitTypes: ['3 BDR'] },
      { name: 'Prime Select One Kattameya', city: 'Kattameya', unitTypes: ['2 BDR', '3 BDR', 'Studio'] },
      { name: 'Prime Select Point 90', city: 'New Cairo', unitTypes: ['2 BDR', '3 BDR'] },
      { name: 'Prime Select Porto New Cairo', city: 'New Cairo', unitTypes: ['2 BDR'] },
      { name: 'Prime Select Village Gate', city: 'New Cairo', unitTypes: ['2 BDR'] },
    ],
  },
  {
    name: 'Heliopolis & Nasr City',
    image: IMG('1502672260266-1c1ef2d93688', 1400),
    properties: [
      { name: 'Prime Residence Heliopolis', city: 'Heliopolis', unitTypes: ['1 BDR', 'Studio'] },
      { name: 'Prime Select Masaken Sheraton', city: 'Heliopolis', unitTypes: ['2 BDR'] },
    ],
  },
  {
    name: 'Mohandseen & Downtown',
    image: IMG('1600607687644-c7171b42498b', 1400),
    properties: [
      { name: 'Prime Select Arkadia', city: 'Downtown', unitTypes: ['2 BDR', '4 BDR', 'Studio'] },
      { name: 'Prime Select Elbatal', city: 'Mohandseen', unitTypes: ['1 BDR', 'Studio'] },
      { name: 'Prime Select Gameat Eldewal', city: 'Mohandseen', unitTypes: ['1 BDR', 'Studio'] },
      { name: 'Prime Select Old Cairo Nile View', city: 'Old Cairo', unitTypes: ['4 BDR'] },
    ],
  },
  {
    name: 'West Cairo',
    image: IMG('1522708323590-d24dbb6b0267', 1400),
    properties: [
      { name: 'Prime Inn Almanzel Sheikh Zayed', city: 'Sheikh Zayed', unitTypes: ['Studio'] },
      { name: 'Prime Residence Sheikh Zayed', city: 'Sheikh Zayed', unitTypes: ['1 BDR', 'Studio'] },
      { name: 'Prime Residence Zayed Heights', city: 'Sheikh Zayed', unitTypes: ['2 BDR', '3 BDR'] },
      { name: 'Prime Select Mall Of Arabia', city: '6th of October', unitTypes: ['2 BDR'] },
      { name: 'Prime Select New Giza', city: 'New Giza', unitTypes: ['2 BDR', '3 BDR'] },
      { name: 'Prime Select the Crown', city: '6th of October', unitTypes: ['3 BDR'] },
      { name: 'Prime Select West Sodic', city: 'Sheikh Zayed', unitTypes: ['2 BDR', 'Studio'] },
    ],
  },
];

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Brand names from the CMS (Admin › Brands); the built-in three until the site content is first read */
let brandNames = BRANDS;

function setBrandNames(names) {
  brandNames = [...names].sort((a, b) => b.length - a.length);
}

/** "Prime Select Gleem" → "Select" */
function brandFromName(name) {
  const full = String(name || '').trim();
  const rest = full.replace(/^Prime\s+/i, '').toLowerCase();
  if (rest === full.toLowerCase()) return '';
  return brandNames.find((b) => rest === b.toLowerCase() || rest.startsWith(`${b.toLowerCase()} `)) || '';
}

function sortUnitTypes(list) {
  return [...list].sort((a, b) => UNIT_TYPES.indexOf(a) - UNIT_TYPES.indexOf(b));
}

const BRAND_AMENITIES = {
  Inn: ['Wi-Fi', 'AC', 'Smart TV', 'Kitchenette', 'Housekeeping on request'],
  Residence: ['Wi-Fi', 'AC', 'Smart TV', 'Fully equipped kitchen', 'Washer', 'Weekly housekeeping'],
  Select: [
    'Wi-Fi',
    'AC',
    'Smart TV',
    'Fully equipped kitchen',
    'Washer & dryer',
    'Balcony',
    'Parking',
    'Weekly housekeeping',
  ],
};

const BRAND_BLURB = {
  Inn: 'smart, efficient comfort for short stays and business trips',
  Residence: 'serviced-apartment living with the space and routine of home',
  Select: 'our most refined homes — designer interiors and premium compound settings',
};

function buildInventory() {
  const destinations = [];
  const properties = [];
  const unitTypes = [];
  let photoCursor = 0;

  INVENTORY.forEach((dest, dIndex) => {
    const destinationId = slugify(dest.name);
    destinations.push({
      id: destinationId,
      name: dest.name,
      description: '',
      image: dest.image,
      sortOrder: dIndex,
      showOnHome: true,
      published: true,
      kwentraDestinationId: '',
    });

    dest.properties.forEach((prop) => {
      const name = prop.name.trim();
      const propertyId = slugify(name);
      const brand = brandFromName(name);
      const types = sortUnitTypes(prop.unitTypes);
      properties.push({
        id: propertyId,
        name,
        brand,
        destinationId,
        region: dest.name,
        city: prop.city || '',
        unitCount: types.length,
        image: IMG(PHOTO_IDS[properties.length % PHOTO_IDS.length], 900),
        sortOrder: properties.length,
        showOnHome: true,
        published: true,
        kwentraProjectId: '',
        kwentraDestinationId: '',
      });

      types.forEach((unitType) => {
        const spec = UNIT_TYPE_SPECS[unitType];
        const price =
          Math.round((spec.basePrice * (BRAND_PRICE_FACTOR[brand] || 1)) / 50) * 50;
        const images = Array.from(
          { length: 6 },
          (_, i) => IMG(PHOTO_IDS[(photoCursor + i) % PHOTO_IDS.length])
        );
        photoCursor += 1;
        unitTypes.push({
          id: String(unitTypes.length + 1),
          slug: slugify(`${name} ${unitType}`),
          title: `${name} · ${spec.label}`,
          unitType,
          brand,
          compoundId: propertyId,
          compound: name,
          destinationId,
          destination: dest.name,
          region: dest.name,
          city: prop.city || '',
          propertyType: unitType === 'Studio' ? 'Studio' : 'Apartment',
          bedrooms: spec.bedrooms,
          bathrooms: spec.bathrooms,
          areaSqm: spec.areaSqm,
          maxGuests: spec.maxGuests,
          pricePerNight: price,
          currency: 'EGP',
          featured: false,
          available: true,
          amenities: BRAND_AMENITIES[brand] || BRAND_AMENITIES.Residence,
          description: `${spec.label === 'Studio' ? 'A Studio' : `A ${spec.label.toLowerCase()} apartment`} at ${name}, ${prop.city || dest.name} — Prime ${brand}: ${BRAND_BLURB[brand] || 'curated comfort'}.`,
          images,
        });
      });
    });
  });

  // Feature one unit type per destination for the homepage
  const seen = new Set();
  for (const unit of unitTypes) {
    if (seen.has(unit.destinationId)) continue;
    seen.add(unit.destinationId);
    unit.featured = true;
  }
  unitTypes
    .filter((u) => u.brand === 'Select' && !u.featured)
    .slice(0, 2)
    .forEach((u) => {
      u.featured = true;
    });

  return { destinations, properties, unitTypes };
}

module.exports = {
  BRANDS,
  UNIT_TYPES,
  UNIT_TYPE_SPECS,
  INVENTORY,
  brandFromName,
  setBrandNames,
  buildInventory,
  slugify,
};
