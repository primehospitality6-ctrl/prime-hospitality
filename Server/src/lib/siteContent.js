/**
 * Website content document — everything guests see that is not inventory:
 * business details, announcement bar, homepage layout, page content, SEO, text overrides.
 * Rates, availability and reservations stay in the PMS.
 */

const HOME_SECTIONS = ['intro', 'properties', 'brands', 'featured', 'trust', 'partners', 'partnerCta'];
const SEO_PAGES = ['home', 'search', 'compounds', 'about', 'faq', 'contact', 'owners', 'careers', 'terms', 'privacy', 'refund'];
const LEGAL_PAGES = ['terms', 'privacy', 'refund'];
const LOCALES = ['en', 'ar'];
const TONES = ['night', 'gold', 'sand'];
const POPUP_TRIGGERS = ['delay', 'scroll'];
const POPUP_PAGES = ['all', 'home', 'listings', 'search'];
const POPUP_FREQUENCIES = [0, 1, 7, 30];
const SECTIONS = ['business', 'brands', 'announcement', 'popup', 'offers', 'home', 'layouts', 'pages', 'copy', 'seo', 'tracking', 'campaigns'];

/* ——— Page builder: each page is a stack of blocks (its built-in sections plus custom blocks) ——— */
const LAYOUT_BUILTINS = {
  home: HOME_SECTIONS,
  about: ['story', 'wideImage', 'values', 'brands', 'cta'],
  compounds: ['main'],
  contact: ['main'],
  faq: ['main'],
  owners: ['main'],
  careers: ['main'],
};
const BLOCK_TYPES = ['text', 'image', 'imageText', 'gallery', 'buttons', 'spacer'];
const MAX_BLOCKS = 60;
const ASPECTS = ['auto', '21/9', '16/9', '4/3', '1/1', '4/5', '3/4'];
const MAX_OFFERS = 30;
const MAX_CONTACT_NUMBERS = 10;
const MAX_BRANDS = 12;
/** Admin-only sections, left out of the public site document */
const PRIVATE_SECTIONS = ['campaigns'];

const MAX_COPY_KEYS = 3000;

function str(value, max = 500) {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

function text(value, max = 30000) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max);
}

/** Internal path, http(s) URL, or empty — blocks javascript:/data: links */
function link(value) {
  const v = str(value, 1000);
  if (!v) return '';
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}

function date(value) {
  const v = str(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
}

function localized(value, max) {
  const src = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(LOCALES.map((l) => [l, str(src[l], max)]));
}

/** Multi-line English + Arabic text (paragraphs kept) */
function localizedText(value, max = 6000) {
  const src = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(LOCALES.map((l) => [l, text(src[l], max)]));
}

const oneOf = (value, list, fallback) => (list.includes(value) ? value : fallback);

function layoutBlock(b, builtins) {
  if (!b || typeof b !== 'object') return null;
  const id = str(b.id, 40);
  if (!/^[\w-]{1,40}$/.test(id)) return null;
  const hidden = b.hidden === true;
  if (b.type === 'section') return builtins.includes(b.key) ? { id: `section-${b.key}`, type: 'section', key: b.key, hidden } : null;
  if (!BLOCK_TYPES.includes(b.type)) return null;
  const base = {
    id,
    type: b.type,
    hidden,
    width: oneOf(b.width, ['narrow', 'normal', 'wide', 'full'], 'normal'),
    align: oneOf(b.align, ['start', 'center', 'end'], 'start'),
    background: oneOf(b.background, ['none', 'mist', 'band', 'gold'], 'none'),
    spacing: oneOf(b.spacing, ['none', 'sm', 'md', 'lg'], 'md'),
  };
  const image = () => ({ src: link(b.src), alt: localized(b.alt, 200), aspect: oneOf(b.aspect, ASPECTS, 'auto') });
  switch (b.type) {
    case 'text':
      return {
        ...base,
        eyebrow: localized(b.eyebrow, 120),
        title: localized(b.title, 300),
        body: localizedText(b.body),
        titleSize: oneOf(b.titleSize, ['sm', 'md', 'lg', 'xl'], 'md'),
      };
    case 'image':
      return {
        ...base,
        ...image(),
        caption: localized(b.caption, 300),
        size: Math.min(100, Math.max(20, Math.round(Number(b.size) || 100))),
        rounded: b.rounded === true,
        href: link(b.href),
      };
    case 'imageText':
      return {
        ...base,
        ...image(),
        eyebrow: localized(b.eyebrow, 120),
        title: localized(b.title, 300),
        body: localizedText(b.body),
        buttonLabel: localized(b.buttonLabel, 60),
        buttonHref: link(b.buttonHref),
        imageSide: oneOf(b.imageSide, ['start', 'end'], 'start'),
        imageShare: oneOf(Number(b.imageShare), [40, 50, 60], 50),
        rounded: b.rounded === true,
      };
    case 'gallery':
      return {
        ...base,
        images: (Array.isArray(b.images) ? b.images : [])
          .map((img) => ({ src: link(img?.src), alt: localized(img?.alt, 200) }))
          .filter((img) => img.src)
          .slice(0, 24),
        columns: oneOf(Number(b.columns), [2, 3, 4], 3),
        aspect: oneOf(b.aspect, ASPECTS, '4/3'),
        rounded: b.rounded === true,
      };
    case 'buttons':
      return {
        ...base,
        items: (Array.isArray(b.items) ? b.items : [])
          .map((item) => ({ label: localized(item?.label, 60), href: link(item?.href), style: oneOf(item?.style, ['solid', 'outline'], 'solid') }))
          .filter((item) => item.href && (item.label.en || item.label.ar))
          .slice(0, 3),
      };
    case 'spacer':
      return { ...base, height: oneOf(b.height, ['sm', 'md', 'lg', 'xl'], 'md'), line: b.line === true };
    default:
      return null;
  }
}

/** Every built-in section stays in the list (new ones are appended), so nothing can be lost — only hidden. */
function layoutPage(value, builtins) {
  const seen = new Set();
  const blocks = [];
  for (const raw of Array.isArray(value?.blocks) ? value.blocks : []) {
    if (blocks.length >= MAX_BLOCKS) break;
    const block = layoutBlock(raw, builtins);
    if (!block || seen.has(block.id)) continue;
    seen.add(block.id);
    blocks.push(block);
  }
  for (const key of builtins) {
    if (!seen.has(`section-${key}`)) blocks.push({ id: `section-${key}`, type: 'section', key, hidden: false });
  }
  return { blocks };
}

/** {guests} is replaced with the unit's maximum guests on each stay page */
const DEFAULT_HOUSE_RULES = [
  { en: 'Check-in after 3:00 PM', ar: 'تسجيل الوصول بعد 3:00 م' },
  { en: 'Check-out before 12:00 PM', ar: 'المغادرة قبل 12:00 م' },
  { en: 'No smoking indoors', ar: 'ممنوع التدخين داخل الوحدة' },
  { en: 'No parties or events', ar: 'ممنوع الحفلات أو المناسبات' },
  { en: 'Maximum {guests} guests', ar: 'الحد الأقصى {guests} ضيوف' },
];

const DEFAULT_GUEST_REGULATIONS = [
  {
    en: 'Reservations are open to families. Single-gender groups are permitted for non-Arab guests only.',
    ar: 'الحجوزات متاحة للعائلات. مجموعات الجنس الواحد مسموحة لغير العرب فقط.',
  },
  {
    en: 'Egyptian and Arab couples must present a valid marriage certificate at check-in.',
    ar: 'يجب على الأزواج المصريين والعرب تقديم شهادة زواج سارية عند الوصول.',
  },
  {
    en: 'Visitors should be arranged with Prime in advance and follow compound security rules.',
    ar: 'يجب ترتيب الزيارات مع برايم مسبقًا والالتزام بقواعد أمن الكومباوند.',
  },
  {
    en: 'Quiet hours are observed overnight — please respect neighbours and shared spaces.',
    ar: 'يُراعى الهدوء ليلًا — يرجى احترام الجيران والمساحات المشتركة.',
  },
  {
    en: 'Damage beyond normal wear may be charged to the guest responsible for the stay.',
    ar: 'الأضرار التي تتجاوز الاستخدام العادي قد تُحمَّل على الضيف المسؤول عن الإقامة.',
  },
];

/** Sub-brands in the brand guidelines' colours; with no photo the site uses one of the brand's properties */
const DEFAULT_BRANDS = [
  {
    name: 'Inn',
    nameAr: 'إن',
    color: '#00671B',
    image: '',
    minNights: 1,
    text: {
      en: 'Smart, design-led stays for short city trips and business travel.',
      ar: 'إقامات عملية بتصميم أنيق للرحلات القصيرة ورحلات العمل.',
    },
  },
  {
    name: 'Residence',
    nameAr: 'ريزيدنس',
    color: '#58595B',
    image: '',
    minNights: 2,
    text: {
      en: 'Serviced apartments with room to live — made for longer stays.',
      ar: 'شقق مخدومة بمساحة للعيش — مثالية للإقامات الطويلة.',
    },
  },
  {
    name: 'Select',
    nameAr: 'سيلكت',
    color: '#8C2433',
    image: '',
    minNights: 2,
    text: {
      en: 'Our most distinctive homes, hand-picked and fully serviced.',
      ar: 'أكثر منازلنا تميزًا، مختارة بعناية ومخدومة بالكامل.',
    },
  },
  {
    name: 'Holidays',
    nameAr: 'هوليدايز',
    color: '#005D67',
    image: '',
    minNights: 1,
    text: {
      en: 'Coastal stays for long summers and easy weekends.',
      ar: 'إقامات ساحلية لصيف طويل وعطلات نهاية أسبوع هادئة.',
    },
  },
  {
    name: 'Boutique',
    nameAr: 'بوتيك',
    color: '#1E355E',
    image: '',
    minNights: 1,
    text: {
      en: 'Intimate, characterful stays with a personal touch.',
      ar: 'إقامات حميمة بطابع مميز ولمسة شخصية.',
    },
  },
];

function ruleList(value) {
  return (Array.isArray(value) ? value : [])
    .map((r) => localized(r, 400))
    .filter((r) => r.en || r.ar)
    .slice(0, 30);
}

const digits = (value) => str(value, 30).replace(/[^\d+]/g, '');

/** Phone list: [{ number, display, label }]. Falls back to the single-number fields saved before lists existed. */
function phoneList(list, legacyNumber, legacyDisplay) {
  const src = Array.isArray(list) ? list : legacyNumber ? [{ number: legacyNumber, display: legacyDisplay }] : [];
  return src
    .map((p) => ({ number: digits(p?.number), display: str(p?.display, 40), label: localized(p?.label, 40) }))
    .filter((p) => p.number)
    .slice(0, MAX_CONTACT_NUMBERS);
}

/** WhatsApp list: [{ number, label }] */
function whatsappList(list, legacyNumber) {
  const src = Array.isArray(list) ? list : legacyNumber ? [{ number: legacyNumber }] : [];
  return src
    .map((w) => ({ number: digits(w?.number), label: localized(w?.label, 40) }))
    .filter((w) => w.number.replace(/\D/g, '').length >= 6)
    .slice(0, MAX_CONTACT_NUMBERS);
}

function idList(value, max = 300) {
  return [...new Set((Array.isArray(value) ? value : []).map((id) => str(id, 80)).filter(Boolean))].slice(0, max);
}

function defaultSite() {
  return {
    business: {
      name: '',
      tagline: '',
      email: '',
      phone: '',
      phoneDisplay: '',
      whatsapp: '',
      // phones / whatsapps lists are left out so older single-number saves still migrate into them
      address: '',
      instagram: '',
      facebook: '',
      tiktok: '',
      linkedin: '',
      houseRules: DEFAULT_HOUSE_RULES,
      guestRegulations: DEFAULT_GUEST_REGULATIONS,
    },
    brands: { items: DEFAULT_BRANDS },
    announcement: {
      enabled: false,
      text: { en: '', ar: '' },
      linkLabel: { en: '', ar: '' },
      href: '',
      startsAt: '',
      endsAt: '',
      tone: 'night',
    },
    popup: {
      enabled: false,
      title: { en: '', ar: '' },
      text: { en: '', ar: '' },
      ctaLabel: { en: '', ar: '' },
      href: '',
      image: '',
      trigger: 'delay',
      delaySeconds: 8,
      scrollPercent: 40,
      pages: 'all',
      frequencyDays: 1,
      startsAt: '',
      endsAt: '',
    },
    offers: { items: [] },
    home: { sections: HOME_SECTIONS.map((id) => ({ id, enabled: true })) },
    layouts: {},
    pages: {
      about: { heroImage: '', wideImage: '', portraitImage: '' },
      careers: {
        heroImage: '',
        roles: [
          { title: 'Guest Experience Associate', location: 'New Cairo', type: 'Full-time' },
          { title: 'Property Operations Lead', location: 'North Coast (seasonal)', type: 'Full-time' },
          { title: 'Interior Stylist (Freelance)', location: 'Remote / Cairo', type: 'Contract' },
        ],
      },
      owners: { heroImage: '', sideImage: '' },
      compounds: { heroImage: '' },
      search: { heroImage: '' },
      contact: { heroImage: '' },
      faq: { heroImage: '' },
      wishlist: { heroImage: '' },
      legal: Object.fromEntries(LEGAL_PAGES.map((k) => [k, { en: '', ar: '', updatedAt: '', heroImage: '' }])),
    },
    copy: { en: {}, ar: {} },
    seo: {
      titleSuffix: '',
      defaultDescription: '',
      ogImage: '',
      pages: Object.fromEntries(SEO_PAGES.map((k) => [k, { title: '', description: '' }])),
    },
    tracking: { ga4Id: '' },
    campaigns: { links: [] },
    updatedAt: '',
  };
}

const sanitizers = {
  business(v = {}) {
    const phones = phoneList(v.phones, digits(v.phone), str(v.phoneDisplay, 40));
    const whatsapps = whatsappList(v.whatsapps, digits(v.whatsapp));
    return {
      name: str(v.name, 80),
      tagline: str(v.tagline, 160),
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(v.email, 120)) ? str(v.email, 120) : '',
      // The first entry of each list is the main number; the single fields mirror it for older code
      phone: phones[0]?.number || '',
      phoneDisplay: phones[0]?.display || '',
      whatsapp: whatsapps[0]?.number || '',
      phones,
      whatsapps,
      address: str(v.address, 240),
      instagram: link(v.instagram),
      facebook: link(v.facebook),
      tiktok: link(v.tiktok),
      linkedin: link(v.linkedin),
      houseRules: ruleList(v.houseRules),
      guestRegulations: ruleList(v.guestRegulations),
    };
  },

  brands(v = {}) {
    const seen = new Set();
    const items = [];
    for (const b of Array.isArray(v.items) ? v.items : []) {
      const name = str(b?.name, 40).replace(/^prime\s+/i, '');
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      const color = str(b?.color, 7);
      const minNights = Math.max(1, Math.min(30, Number(b?.minNights) || 1));
      items.push({
        name,
        nameAr: str(b?.nameAr, 40),
        color: /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : '#231F20',
        image: link(b?.image),
        minNights,
        text: localized(b?.text, 300),
      });
    }
    return { items: items.slice(0, MAX_BRANDS) };
  },

  announcement(v = {}) {
    return {
      enabled: Boolean(v.enabled),
      text: localized(v.text, 200),
      linkLabel: localized(v.linkLabel, 40),
      href: link(v.href),
      startsAt: date(v.startsAt),
      endsAt: date(v.endsAt),
      tone: TONES.includes(v.tone) ? v.tone : 'night',
    };
  },

  popup(v = {}) {
    const clamp = (n, min, max, fallback) => (Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Math.round(Number(n)))) : fallback);
    const frequency = Number(v.frequencyDays);
    return {
      enabled: Boolean(v.enabled),
      title: localized(v.title, 90),
      text: localized(v.text, 300),
      ctaLabel: localized(v.ctaLabel, 40),
      href: link(v.href),
      image: link(v.image),
      trigger: POPUP_TRIGGERS.includes(v.trigger) ? v.trigger : 'delay',
      delaySeconds: clamp(v.delaySeconds, 0, 60, 8),
      scrollPercent: clamp(v.scrollPercent, 10, 90, 40),
      pages: POPUP_PAGES.includes(v.pages) ? v.pages : 'all',
      frequencyDays: POPUP_FREQUENCIES.includes(frequency) ? frequency : 1,
      startsAt: date(v.startsAt),
      endsAt: date(v.endsAt),
    };
  },

  /** Offers: a name, photo and percentage linked to unit types and/or whole properties */
  offers(v = {}) {
    const seen = new Set();
    const items = [];
    for (const o of Array.isArray(v.items) ? v.items : []) {
      let id = str(o?.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!id || seen.has(id)) id = `offer-${Math.random().toString(36).slice(2, 10)}`;
      seen.add(id);
      const name = localized(o?.name, 90);
      if (!name.en && !name.ar) continue;
      const percent = Number(o?.percent);
      items.push({
        id,
        enabled: o?.enabled !== false,
        name,
        text: localized(o?.text, 300),
        image: link(o?.image),
        percent: Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.round(percent))) : 0,
        unitIds: idList(o?.unitIds),
        compoundIds: idList(o?.compoundIds, 100),
        showPopup: Boolean(o?.showPopup),
        startsAt: date(o?.startsAt),
        endsAt: date(o?.endsAt),
      });
    }
    return { items: items.slice(0, MAX_OFFERS) };
  },

  campaigns(v = {}) {
    const slug = (s, max) => str(s, max).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._~-]/g, '');
    const links = (Array.isArray(v.links) ? v.links : [])
      .map((l) => ({
        id: str(l?.id, 40) || Math.random().toString(36).slice(2, 10),
        name: str(l?.name, 120),
        path: link(l?.path).startsWith('/') ? link(l.path) : '/',
        channel: str(l?.channel, 40),
        source: slug(l?.source, 60),
        medium: slug(l?.medium, 60),
        campaign: slug(l?.campaign, 80),
        content: slug(l?.content, 80),
        createdAt: str(l?.createdAt, 40),
      }))
      .filter((l) => l.source && l.campaign)
      .slice(0, 300);
    return { links };
  },

  home(v = {}) {
    const seen = new Set();
    const sections = [];
    for (const s of Array.isArray(v.sections) ? v.sections : []) {
      const id = String(s?.id || '');
      if (!HOME_SECTIONS.includes(id) || seen.has(id)) continue;
      seen.add(id);
      sections.push({ id, enabled: s.enabled !== false });
    }
    for (const id of HOME_SECTIONS) if (!seen.has(id)) sections.push({ id, enabled: true });
    return { sections };
  },

  layouts(v = {}) {
    return Object.fromEntries(Object.entries(LAYOUT_BUILTINS).map(([page, builtins]) => [page, layoutPage(v[page], builtins)]));
  },

  pages(v = {}) {
    const base = defaultSite().pages;
    const about = v.about || {};
    const careers = v.careers || base.careers;
    const owners = v.owners || {};
    const compounds = v.compounds || {};
    const search = v.search || {};
    const contact = v.contact || {};
    const faq = v.faq || {};
    const wishlist = v.wishlist || {};
    const legal = v.legal || {};
    return {
      about: {
        heroImage: link(about.heroImage),
        wideImage: link(about.wideImage),
        portraitImage: link(about.portraitImage),
      },
      careers: {
        heroImage: link(careers.heroImage),
        roles: (Array.isArray(careers.roles) ? careers.roles : [])
          .map((r) => ({ title: str(r?.title, 120), location: str(r?.location, 80), type: str(r?.type, 40) }))
          .filter((r) => r.title)
          .slice(0, 30),
      },
      owners: { heroImage: link(owners.heroImage), sideImage: link(owners.sideImage) },
      compounds: { heroImage: link(compounds.heroImage) },
      search: { heroImage: link(search.heroImage) },
      contact: { heroImage: link(contact.heroImage) },
      faq: { heroImage: link(faq.heroImage) },
      wishlist: { heroImage: link(wishlist.heroImage) },
      legal: Object.fromEntries(
        LEGAL_PAGES.map((k) => {
          const page = legal[k] || {};
          return [k, { en: text(page.en), ar: text(page.ar), updatedAt: date(page.updatedAt), heroImage: link(page.heroImage) }];
        })
      ),
    };
  },

  copy(v = {}) {
    const out = {};
    for (const locale of LOCALES) {
      const src = v[locale] && typeof v[locale] === 'object' ? v[locale] : {};
      const entries = Object.entries(src)
        .filter(([key, val]) => /^[a-zA-Z][\w.-]{0,80}$/.test(key) && typeof val === 'string' && val.trim())
        .slice(0, MAX_COPY_KEYS)
        .map(([key, val]) => [key, text(val, 2000)]);
      out[locale] = Object.fromEntries(entries);
    }
    return out;
  },

  seo(v = {}) {
    const pages = v.pages || {};
    return {
      titleSuffix: str(v.titleSuffix, 80),
      defaultDescription: str(v.defaultDescription, 300),
      ogImage: link(v.ogImage),
      pages: Object.fromEntries(
        SEO_PAGES.map((k) => [k, { title: str(pages[k]?.title, 120), description: str(pages[k]?.description, 300) }])
      ),
    };
  },

  tracking(v = {}) {
    const ga4Id = str(v.ga4Id, 30).toUpperCase();
    return { ga4Id: /^G-[A-Z0-9]{4,20}$/.test(ga4Id) ? ga4Id : '' };
  },
};

/** Fill any missing section/field from the defaults (stored docs may predate a field). */
function normalizeSite(stored) {
  const base = defaultSite();
  const src = stored && typeof stored === 'object' ? stored : {};
  const out = {};
  for (const key of SECTIONS) {
    let value = { ...base[key], ...(src[key] || {}) };
    // Sites saved before the page builder: the homepage keeps its section order and hidden sections.
    if (key === 'layouts' && !src.layouts?.home) {
      value = { ...value, home: { blocks: out.home.sections.map((x) => ({ id: `section-${x.id}`, type: 'section', key: x.id, hidden: !x.enabled })) } };
    }
    out[key] = sanitizers[key](value);
  }
  out.updatedAt = str(src.updatedAt, 40);
  return out;
}

/** Replace only the sections present in the patch; each section is validated as a whole. */
function mergeSite(current, patch = {}) {
  const next = normalizeSite(current);
  for (const key of SECTIONS) {
    if (patch[key] === undefined) continue;
    // Page layouts merge per page, so saving one page never resets the others.
    const value = key === 'layouts' && patch.layouts && typeof patch.layouts === 'object' ? { ...next.layouts, ...patch.layouts } : patch[key];
    next[key] = sanitizers[key](value);
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

function publicSite(site) {
  const out = { ...site };
  for (const key of PRIVATE_SECTIONS) delete out[key];
  return out;
}

/* ——— Editable lists shown on guest pages (FAQs, trust points, partners) ——— */

function sanitizeContentLists(body = {}, current = {}) {
  const next = { ...current };
  if (Array.isArray(body.faqs)) {
    next.faqs = body.faqs
      .map((f) => ({ q: str(f?.q, 300), a: text(f?.a, 3000), qAr: str(f?.qAr, 300), aAr: text(f?.aAr, 3000) }))
      .filter((f) => f.q && f.a)
      .slice(0, 100);
  }
  if (Array.isArray(body.trustPoints)) {
    next.trustPoints = body.trustPoints
      .map((p) => ({ title: str(p?.title, 120), body: text(p?.body, 600), titleAr: str(p?.titleAr, 120), bodyAr: text(p?.bodyAr, 600) }))
      .filter((p) => p.title)
      .slice(0, 12);
  }
  if (Array.isArray(body.partners)) {
    next.partners = body.partners
      .map((p, i) => ({ id: str(p?.id, 60) || `partner-${i + 1}`, name: str(p?.name, 80), logo: link(p?.logo) }))
      .filter((p) => p.name)
      .slice(0, 40);
  }
  return next;
}

/** True when the offer is switched on and today falls inside its dates */
function offerIsLive(offer, today = new Date().toISOString().slice(0, 10)) {
  if (!offer || offer.enabled === false) return false;
  if (offer.startsAt && today < offer.startsAt) return false;
  if (offer.endsAt && today > offer.endsAt) return false;
  return true;
}

function offerIncludes(offer, unit) {
  return Boolean(offer && unit && (offer.unitIds?.includes(unit.id) || offer.compoundIds?.includes(unit.compoundId)));
}

module.exports = {
  offerIsLive,
  offerIncludes,
  HOME_SECTIONS,
  SEO_PAGES,
  LEGAL_PAGES,
  SECTIONS,
  defaultSite,
  normalizeSite,
  mergeSite,
  publicSite,
  sanitizeContentLists,
};
