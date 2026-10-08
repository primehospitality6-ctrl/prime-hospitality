const { buildInventory, UNIT_TYPES } = require('./inventory');

const { destinations, properties: compounds, unitTypes: listings } = buildInventory();

const propertyTypes = [...UNIT_TYPES];

const partners = [
  {
    id: 'homeaway',
    name: 'HomeAway',
    logo: '',
  },
  {
    id: 'tripadvisor',
    name: 'Tripadvisor',
    logo: 'https://cdn.simpleicons.org/tripadvisor/00AF87',
  },
  {
    id: 'booking',
    name: 'Booking.com',
    logo: 'https://cdn.simpleicons.org/bookingdotcom/003580',
  },
  {
    id: 'hotels',
    name: 'Hotels.com',
    logo: 'https://cdn.simpleicons.org/hotelsdotcom/D32F2F',
  },
  {
    id: 'agoda',
    name: 'Agoda',
    logo: '',
  },
  {
    id: 'flipkey',
    name: 'FlipKey',
    logo: '',
  },
  {
    id: 'vrbo',
    name: 'VRBO',
    logo: '',
  },
  {
    id: 'superhost',
    name: 'Superhost',
    logo: 'https://cdn.simpleicons.org/airbnb/FF5A5F',
  },
  {
    id: 'expedia',
    name: 'Expedia',
    logo: 'https://cdn.simpleicons.org/expedia/191E3B',
  },
];

const trustPoints = [
  {
    title: 'Designs that feel like home',
    body: 'Artfully finished interiors and comfortable stays — each space chosen for character and calm.',
    titleAr: 'تصاميم تشعرك بأنك في بيتك',
    bodyAr: 'تشطيبات داخلية متقنة وإقامات مريحة — كل مساحة مختارة لطابعها وهدوئها.',
  },
  {
    title: 'Where you want to be',
    body: 'From Alexandria to East and West Cairo — stays matched to how you live and travel.',
    titleAr: 'حيث تريد أن تكون',
    bodyAr: 'من الإسكندرية إلى شرق وغرب القاهرة — إقامات تناسب أسلوب حياتك وسفرك.',
  },
  {
    title: 'Hotel perks, home warmth',
    body: 'Premium amenities with attentive support — so every stay feels effortless.',
    titleAr: 'مزايا الفندق ودفء البيت',
    bodyAr: 'مرافق راقية ودعم متواصل — لتكون كل إقامة سهلة ومريحة.',
  },
];

const faqs = [
  {
    q: 'Can I stay with my partner?',
    a: 'Following Egyptian law, couples with Egyptian or Arab passports must present an official marriage certificate. Non-Arab passport holders are welcomed without a marriage certificate.',
    qAr: 'هل يمكنني الإقامة مع شريكي؟',
    aAr: 'وفقًا للقانون المصري، يجب على الأزواج من حاملي الجوازات المصرية أو العربية تقديم وثيقة زواج رسمية. ونرحب بحاملي الجوازات غير العربية دون وثيقة زواج.',
  },
  {
    q: 'Are visits allowed?',
    a: 'For Arab guests, visitors of the same gender are allowed; mixed visitors should be first- or second-degree relatives, otherwise please meet in public areas.',
    qAr: 'هل الزيارات مسموحة؟',
    aAr: 'للضيوف العرب يُسمح بزيارة الضيوف من نفس الجنس، أما الزيارات المختلطة فيجب أن تكون من أقارب الدرجة الأولى أو الثانية، وإلا يُرجى الالتقاء في الأماكن العامة.',
  },
  {
    q: 'Do you allow pets?',
    a: 'It depends on each property policy. Check the listing details or ask our team before booking.',
    qAr: 'هل يُسمح بالحيوانات الأليفة؟',
    aAr: 'يعتمد ذلك على سياسة كل عقار. راجع تفاصيل الإقامة أو اسأل فريقنا قبل الحجز.',
  },
  {
    q: 'Are there long-stay discounts?',
    a: 'Yes — weekly and monthly rates are available depending on duration and property.',
    qAr: 'هل توجد خصومات للإقامات الطويلة؟',
    aAr: 'نعم — تتوفر أسعار أسبوعية وشهرية حسب مدة الإقامة والعقار.',
  },
];

const STOCK_IMAGES = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80',
];

const DEFAULT_FACILITIES = [
  'Compound security',
  'Shared pools',
  'Landscaped gardens',
  'Guest parking',
  '24/7 access control',
];

const REVIEW_POOL = [
  {
    guestName: 'Nour A.',
    rating: 5,
    comment: 'Immaculate stay — quiet, polished, and exactly as pictured. Prime’s team made check-in seamless.',
  },
  {
    guestName: 'James K.',
    rating: 5,
    comment: 'Beautiful interiors and a calm compound setting. We will book again for our next coast trip.',
  },
  {
    guestName: 'Sara M.',
    rating: 4,
    comment: 'Spacious and well equipped. Communication was clear from inquiry through departure.',
  },
  {
    guestName: 'Omar H.',
    rating: 5,
    comment: 'Felt like a private residence, not a rental. Details were thoughtful throughout.',
  },
];

listings.forEach((listing, index) => {
  const images = [...(listing.images || [])];
  let cursor = index % STOCK_IMAGES.length;
  while (images.length < 6) {
    const next = STOCK_IMAGES[cursor % STOCK_IMAGES.length];
    if (!images.includes(next)) images.push(next);
    cursor += 1;
  }
  listing.images = images;

  if (!listing.facilities?.length) {
    listing.facilities = DEFAULT_FACILITIES.slice(0, 3 + (index % 3));
  }

  const reviewCount = 2 + (index % 3);
  const reviews = Array.from({ length: reviewCount }, (_, r) => {
    const base = REVIEW_POOL[(index + r) % REVIEW_POOL.length];
    const day = 4 + ((index * 3 + r * 5) % 20);
    return {
      id: `${listing.id}-rev-${r}`,
      guestName: base.guestName,
      rating: base.rating,
      comment: base.comment,
      createdAt: `2026-0${1 + ((index + r) % 8)}-${String(day).padStart(2, '0')}`,
    };
  });
  const averageRating =
    Math.round((reviews.reduce((sum, rev) => sum + rev.rating, 0) / reviews.length) * 10) / 10;

  listing.reviews = reviews;
  listing.reviewCount = reviews.length;
  listing.averageRating = averageRating;
});

module.exports = { destinations, compounds, listings, propertyTypes, partners, trustPoints, faqs };
