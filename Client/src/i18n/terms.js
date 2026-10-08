/**
 * Arabic for the names that arrive in English from Kwentra / the CMS (places, properties, unit
 * types, amenities). Whole-string matches first, then phrase-by-phrase composition; anything that
 * would leave Latin words behind stays in English rather than showing half a translation.
 */

const CURRENCY_AR = { EGP: 'ج.م', USD: 'دولار', EUR: 'يورو' };

/** Set by LocaleProvider while rendering so plain helpers like formatMoney follow the language */
let activeLocale = 'en';

export function setActiveLocale(locale) {
  activeLocale = locale;
}

export function currencyLabel(code) {
  return (activeLocale === 'ar' && CURRENCY_AR[code]) || code;
}

const EXACT = {
  // Unit titles
  'standard studio': 'استوديو قياسي',
  'deluxe studio': 'استوديو ديلوكس',
  studio: 'استوديو',
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
  apartment: 'شقة',
  'hotel room': 'غرفة فندقية',
  room: 'غرفة',
  villa: 'فيلا',
  chalet: 'شاليه',
  duplex: 'دوبلكس',
  penthouse: 'بنتهاوس',

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

  // Places
  egypt: 'مصر',
  'new cairo, egypt': 'القاهرة الجديدة، مصر',
};

/** Ordered longest-first at build time; used to compose property names like "Prime Select Lake View" */
const PHRASES = {
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
};

const PHRASE_LIST = Object.entries(PHRASES).sort((a, b) => b[0].length - a[0].length);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PHRASE_RE = PHRASE_LIST.map(([en, ar]) => [new RegExp(`(^|[\\s,(&·-])${escape(en)}(?=$|[\\s,)&·-])`, 'gi'), ar]);

const cache = new Map();

export function translateTerm(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text) return value;
  if (cache.has(text)) return cache.get(text);

  const key = text.toLowerCase().replace(/\s+/g, ' ');
  let out = EXACT[key];
  if (!out) {
    let composed = key;
    PHRASE_RE.forEach(([re, ar]) => {
      composed = composed.replace(re, (_m, lead) => `${lead}${ar}`);
    });
    composed = composed.replace(/\s*&\s*/g, ' و').replace(/,/g, '،').replace(/\s+/g, ' ').trim();
    out = /[a-z]/i.test(composed) ? text : composed;
  }
  cache.set(text, out);
  return out;
}
