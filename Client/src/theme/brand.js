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
  whatsapp: import.meta.env.VITE_WHATSAPP_NUMBER || '+201000000000',
  phoneDisplay: import.meta.env.VITE_PHONE_DISPLAY || '0100 000 0000',
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
  'Co-Work': { color: '#1E355E', syllables: ['CO-', 'WORK'] },
  Holidays: { color: '#005D67', syllables: ['HOLI', 'DAYS'] },
};

export function subBrand(name) {
  const key = Object.keys(subBrands).find((k) => k.toLowerCase() === String(name || '').trim().toLowerCase());
  return key ? { name: key, ...subBrands[key] } : null;
}

export function whatsappHref(text) {
  const n = brand.whatsapp.replace(/\D/g, '');
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

export function formatMoney(amount, currency = 'EGP') {
  const n = Number(amount) || 0;
  return `${n.toLocaleString('en-EG')} ${currencyLabel(currency)}`;
}
