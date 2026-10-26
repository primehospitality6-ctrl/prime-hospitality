/**
 * Place / property / unit-type / amenity names that arrive from Kwentra or the CMS.
 * Whole-string matches first, then phrase-by-phrase composition so mixed labels still make sense.
 * Supports EN→AR and AR→EN so either language can be the stored source.
 */

const CURRENCY_AR = { EGP: 'ج.م', USD: 'دولار', EUR: 'يورو' };
const CURRENCY_EN = { 'ج.م': 'EGP', دولار: 'USD', يورو: 'EUR' };

/** Set by LocaleProvider while rendering so plain helpers like formatMoney follow the language */
let activeLocale = 'en';

export function setActiveLocale(locale) {
  activeLocale = locale;
}

export function currencyLabel(code = 'USD') {
  const c = String(code || 'USD').toUpperCase();
  if (activeLocale === 'ar') return CURRENCY_AR[c] || c;
  return c;
}

const EXACT_EN_AR = {
  // Unit titles
  'standard studio': 'استوديو قياسي',
  'deluxe studio': 'استوديو ديلوكس',
  studio: 'استوديو',
  other: 'أخرى',
  'standard one bedroom apartment': 'شقة قياسية بغرفة نوم واحدة',
  'deluxe one bedroom apartment': 'شقة ديلوكس بغرفة نوم واحدة',
  'deluxe one bedroom apartment (king size bed)': 'شقة ديلوكس بغرفة نوم واحدة (سرير كينج)',
  'deluxe one bedroom apartment (twin size bed)': 'شقة ديلوكس بغرفة نوم واحدة (سريران منفصلان)',
  'standard one bedroom apartment with garden': 'شقة قياسية بغرفة نوم واحدة مع حديقة',
  'one bedroom apartment': 'شقة بغرفة نوم واحدة',
  'two bedroom apartment': 'شقة بغرفتي نوم',
  'standard two bedroom apartment': 'شقة قياسية بغرفتي نوم',
  'deluxe two bedroom apartment': 'شقة ديلوكس بغرفتي نوم',
  'three bedroom apartment': 'شقة بثلاث غرف نوم',
  'four bedroom apartment': 'شقة بأربع غرف نوم',
  apartment: 'شقة',
  'hotel room': 'غرفة فندقية',
  room: 'غرفة',
  villa: 'فيلا',
  chalet: 'شاليه',
  duplex: 'دوبلكس',
  penthouse: 'بنتهاوس',
  'bed & breakfast': 'إفطار وإقامة',
  'bed and breakfast': 'إفطار وإقامة',
  bb: 'إفطار وإقامة',
  'room only': 'غرفة فقط',
  bathrooms: 'حمامات',
  bathroom: 'حمام',
  baths: 'حمامات',
  bath: 'حمام',
  bedrooms: 'غرف نوم',
  bedroom: 'غرفة نوم',

  // Unit type codes
  '1 bdr': 'غرفة نوم',
  '2 bdr': 'غرفتا نوم',
  '3 bdr': '3 غرف نوم',
  '4 bdr': '4 غرف نوم',

  // Beds & floors
  'king bed': 'سرير كينج',
  'queen bed': 'سرير كوين',
  'twin bed': 'سرير منفصل',
  'twin beds': 'سريران منفصلان',
  'king + twin beds': 'سرير كينج + سريران منفصلان',
  'sofa bed': 'كنبة سرير',
  'upper floors': 'الأدوار العليا',
  'high floor': 'دور مرتفع',
  'ground floor': 'الدور الأرضي',
  'first floor': 'الدور الأول',
  'second floor': 'الدور الثاني',
  'third floor': 'الدور الثالث',

  // Amenities
  'new furnishing': 'أثاث جديد',
  'studio with queen size bed': 'استوديو بسرير كوين',
  window: 'نافذة',
  'fully equipped kitchen': 'مطبخ مجهز بالكامل',
  kitchen: 'مطبخ',
  kitchenette: 'مطبخ صغير',
  'washing machine': 'غسالة ملابس',
  refrigerator: 'ثلاجة',
  fridge: 'ثلاجة',
  microwave: 'ميكروويف',
  oven: 'فرن',
  'iron with iron board upon request': 'مكواة وطاولة كي عند الطلب',
  'smart tv': 'تلفزيون ذكي',
  tv: 'تلفزيون',
  'safe box': 'خزنة',
  'coffee tray': 'صينية قهوة',
  kettle: 'غلاية',
  'free wi-fi': 'واي فاي مجاني',
  'wi-fi': 'واي فاي',
  wifi: 'واي فاي',
  'one bedroom with king size bed': 'غرفة نوم بسرير كينج',
  'one bedroom with twin size bed': 'غرفة نوم بسريرين منفصلين',
  'two bedrooms (one bedroom with king size bed + one bedroom with twin bed)':
    'غرفتا نوم (غرفة بسرير كينج + غرفة بسريرين منفصلين)',
  balcony: 'شرفة',
  terrace: 'تراس',
  garden: 'حديقة',
  'private garden': 'حديقة خاصة',
  sofa: 'كنبة',
  'air conditioning': 'تكييف',
  'reception 24/7': 'استقبال على مدار الساعة',
  'free parking': 'موقف سيارات مجاني',
  parking: 'موقف سيارات',
  'free gym': 'صالة رياضية مجانية',
  gym: 'صالة رياضية',
  'security 24/7': 'أمن على مدار الساعة',
  'laundry service': 'خدمة غسيل الملابس',
  'housekeeping service': 'خدمة تنظيف الغرف',
  housekeeping: 'خدمة تنظيف الغرف',
  'swimming pool': 'حمام سباحة',
  pool: 'حمام سباحة',
  'shared pools': 'حمامات سباحة مشتركة',
  'compound security': 'أمن الكمبوند',
  'landscaped gardens': 'حدائق منسقة',
  'guest parking': 'موقف للضيوف',
  '24/7 access control': 'تحكم في الدخول على مدار الساعة',
  elevator: 'مصعد',
  'hair dryer': 'مجفف شعر',
  'dining table': 'طاولة طعام',
  workspace: 'مساحة عمل',
  dishwasher: 'غسالة أطباق',
  'mini bar': 'ميني بار',
  bathtub: 'بانيو',
  shower: 'دش',
  'sea view': 'إطلالة بحر',
  'nile view': 'إطلالة على النيل',
  'city view': 'إطلالة على المدينة',
  'garden view': 'إطلالة على الحديقة',
  'pool view': 'إطلالة على المسبح',

  // Places
  egypt: 'مصر',
  'new cairo, egypt': 'القاهرة الجديدة، مصر',
};

/** Ordered longest-first at build time; used to compose property names like "Prime Select Lake View" */
const PHRASES_EN_AR = {
  'prime hospitality': 'برايم للضيافة',
  'prime residence': 'برايم ريزيدنس',
  'prime select': 'برايم سيلكت',
  'prime inn': 'برايم إن',
  'prime co-work': 'برايم كو-ورك',
  'prime holidays': 'برايم هوليدايز',
  residence: 'ريزيدنس',
  select: 'سيلكت',
  inn: 'إن',
  '10th of ramadan': 'العاشر من رمضان',
  '6th of october': 'السادس من أكتوبر',
  alexandria: 'الإسكندرية',
  'east cairo': 'شرق القاهرة',
  'west cairo': 'غرب القاهرة',
  'new cairo': 'القاهرة الجديدة',
  'old cairo': 'مصر القديمة',
  cairo: 'القاهرة',
  giza: 'الجيزة',
  'new giza': 'نيو جيزة',
  heliopolis: 'مصر الجديدة',
  'nasr city': 'مدينة نصر',
  mohandseen: 'المهندسين',
  downtown: 'وسط البلد',
  'sheikh zayed': 'الشيخ زايد',
  'north coast': 'الساحل الشمالي',
  sahel: 'الساحل',
  gleem: 'جليم',
  'san stefano': 'سان ستيفانو',
  kattameya: 'القطامية',
  'kattameya bavaria': 'بافاريا القطامية',
  'one kattameya': 'وان القطامية',
  'point 90': 'بوينت 90',
  '90 avenue': '90 أفينيو',
  eastown: 'إيستاون',
  'galleria moon valley': 'جاليريا مون فالي',
  'lake view': 'ليك فيو',
  lotus: 'اللوتس',
  'marvel city': 'مارفل سيتي',
  porto: 'بورتو',
  'village gate': 'فيليدج جيت',
  'masaken sheraton': 'مساكن شيراتون',
  arkadia: 'أركاديا',
  elbatal: 'البطل',
  'gameat eldewal': 'جامعة الدول',
  'nile view': 'نايل فيو',
  almanzel: 'المنزل',
  'zayed heights': 'زايد هايتس',
  'mall of arabia': 'مول العرب',
  'the crown': 'ذا كراون',
  'west sodic': 'ويست سوديك',
  egypt: 'مصر',
  deluxe: 'ديلوكس',
  standard: 'قياسي',
  suite: 'جناح',
};

function invertMap(map) {
  const out = {};
  for (const [en, ar] of Object.entries(map)) {
    if (!out[ar]) out[ar] = en;
  }
  return out;
}

const EXACT_AR_EN = invertMap(EXACT_EN_AR);
const PHRASES_AR_EN = invertMap(PHRASES_EN_AR);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function phraseList(map) {
  return Object.entries(map).sort((a, b) => b[0].length - a[0].length);
}

const EN_AR_PHRASE_RE = phraseList(PHRASES_EN_AR).map(([en, ar]) => [
  new RegExp(`(^|[\\s,(&·/-])${escape(en)}(?=$|[\\s,)&·/-])`, 'gi'),
  ar,
]);
const AR_EN_PHRASE_RE = phraseList(PHRASES_AR_EN).map(([ar, en]) => [
  new RegExp(`(^|[\\s,(&·/-])${escape(ar)}(?=$|[\\s,)&·/-])`, 'g'),
  en,
]);

const cache = new Map();

function compose(text, phraseRes, joinerFix) {
  let composed = text;
  phraseRes.forEach(([re, replacement]) => {
    composed = composed.replace(re, (_m, lead) => `${lead}${replacement}`);
  });
  return joinerFix(composed).replace(/\s+/g, ' ').trim();
}

/**
 * Translate a catalog term into the active locale (or an explicit one).
 * Returns the original string when no confident translation exists.
 */
export function translateTerm(value, locale = activeLocale) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text) return value;

  const cacheKey = `${locale}:${text}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  let out = text;
  if (locale === 'ar') {
    const key = text.toLowerCase().replace(/\s+/g, ' ');
    out = EXACT_EN_AR[key];
    if (!out) {
      const composed = compose(key, EN_AR_PHRASE_RE, (s) =>
        s.replace(/\s*&\s*/g, ' و').replace(/,/g, '،')
      );
      // Keep original when Latin leftovers remain (avoid half-translated mush)
      out = /[a-z]/i.test(composed) ? text : composed;
    }
  } else if (/[\u0600-\u06FF]/.test(text)) {
    // Only reverse-translate when the source string is Arabic
    out = EXACT_AR_EN[text] || EXACT_AR_EN[text.replace(/\s+/g, ' ')];
    if (!out) {
      const composed = compose(text, AR_EN_PHRASE_RE, (s) => s.replace(/،/g, ',').replace(/\s+و\s+/g, ' & '));
      out = /[\u0600-\u06FF]/.test(composed) ? text : composed;
    }
  }

  cache.set(cacheKey, out);
  return out;
}
