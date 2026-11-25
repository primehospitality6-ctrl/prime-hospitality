import { currencyLabel } from '../i18n/terms';

export const brand = {
  id: 'prime',
  name: 'Prime Hospitality',
  shortName: 'Prime',
  tagline: 'Prime stays for Prime customers.',  logo: '/brand/logo-transparent.png',
  /** White letters + gold key — for dark / photo backgrounds */
  logoLight: '/brand/logo-light.png',
  /** Charcoal letters + gold key — for light backgrounds */
  logoDark: '/brand/logo-dark.png',
  logoMark: '/brand/logo-prime-mark.png',
  logoFull: '/brand/Hospitality.png',
  domain: import.meta.env.VITE_SITE_URL || 'https://primehospitality.com',
  colors: {
    white: '#FFFFFF',
    ink: '#231F20',
    charcoal: '#58595B',
    gold: '#8C704D',
    muted: '#6D6E71',
  },
  whatsapp: import.meta.env.VITE_WHATSAPP_NUMBER || '+201068233367',
  phone: '+20225727262',
  phoneDisplay: import.meta.env.VITE_PHONE_DISPLAY || '+20 2 2572 7262',
  /** Used until the Business settings load (and if they are ever empty) */
  phones: [
    { number: '+20225727262', display: '+20 2 2572 7262', label: {} },
    { number: '+20225727263', display: '+20 2 2572 7263', label: {} },
    { number: '+20225727265', display: '+20 2 2572 7265', label: {} },
  ],
  whatsapps: [
    { number: '+201068233367', label: {} },
    { number: '+201001602264', label: {} },
    { number: '+201113777737', label: {} },
  ],
  email: import.meta.env.VITE_CONTACT_EMAIL || 'hello@primehospitality.com',
  address: 'New Cairo, Egypt',
  social: {
    instagram: '#',
    facebook: '#',
  },
  copyright: '© 2026 Prime Hospitality. All rights reserved.',
};

/**
 * Prime sub-brands as the corporate identity guidelines draw them: each has its own colour
 * and its name broken into the stacked syllables used as a watermark.
 */
export const subBrands = {
  Hospitality: { color: '#231F20', syllables: ['HOSP', 'ITAL', 'ITY'] },
  Residence: { color: '#58595B', syllables: ['RESI', 'DEN', 'CE'] },
  Select: { color: '#8C2433', syllables: ['SEL', 'ECT'] },
  Inn: { color: '#00671B', syllables: ['INN'] },
  Boutique: { color: '#1E355E', syllables: ['BOUT', 'IQUE'] },
  Holidays: { color: '#005D67', syllables: ['HOLI', 'DAYS'] },
};

export function subBrand(name) {
  const key = Object.keys(subBrands).find((k) => k.toLowerCase() === String(name || '').trim().toLowerCase());
  return key ? { name: key, ...subBrands[key] } : null;
}

/** Every phone line: [{ number, display, label: { en, ar } }]. The first is the main one. */
export function phoneLines() {
  if (brand.phones?.length) return brand.phones.map((p) => ({ ...p, display: p.display || p.number }));
  const number = brand.phone || brand.whatsapp;
  return number ? [{ number, display: brand.phoneDisplay || number, label: {} }] : [];
}

/** Every WhatsApp line: [{ number, label: { en, ar } }]. The first is the main one. */
export function whatsappLines() {
  if (brand.whatsapps?.length) return brand.whatsapps;
  return brand.whatsapp ? [{ number: brand.whatsapp, label: {} }] : [];
}

/** Readable international form: +20 106 823 3367 (mobile), +20 2 2572 7262 (Cairo landline). */
export function formatPhone(number) {
  const d = String(number || '').replace(/\D/g, '');
  if (/^201\d{9}$/.test(d)) return `+20 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  if (/^202\d{8}$/.test(d)) return `+20 2 ${d.slice(3, 7)} ${d.slice(7)}`;
  if (/^20\d+$/.test(d)) return `+20 ${d.slice(2)}`;
  return number ? String(number) : '';
}

/** wa.me link for a number (defaults to the main WhatsApp line) */
export function whatsappHref(text, number = brand.whatsapp) {
  const n = String(number || brand.whatsapp || '').replace(/\D/g, '');
  const base = `https://wa.me/${n}`;
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function listingWhatsAppMessage(pathnameOrUrl) {
  const raw = String(pathnameOrUrl || '').trim();
  if (!raw) return 'Hi Prime — I have a question about a stay.';

  let listingUrl = raw;
  if (raw.startsWith('/')) {
    const base = String(brand.domain || '').replace(/\/$/, '');
    listingUrl = `${base}${raw}`;
  }

  return `Hi Prime — I'd like to inquire about this stay:\n${listingUrl}`;
}

/** Rates are stored in USD. Pass the currency you are actually printing. */
export const SITE_CURRENCY = 'USD';

export function formatMoney(amount, currency = SITE_CURRENCY) {
  const n = Number(amount) || 0;
  const code = String(currency || SITE_CURRENCY).toUpperCase();
  // Whole amounts stay short (1,200 USD); amounts with cents always show two decimals (326.70 USD).
  const cents = Math.round(n * 100) % 100 !== 0;
  const text = n.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 });
  return `${text} ${currencyLabel(code)}`;
}
