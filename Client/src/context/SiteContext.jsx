import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { brand } from '../theme/brand';

export const HOME_SECTIONS = ['intro', 'properties', 'brands', 'featured', 'trust', 'partners', 'partnerCta'];

export const DEFAULT_SITE = {
  business: {},
  brands: { items: [] },
  announcement: { enabled: false, text: {}, linkLabel: {}, href: '', startsAt: '', endsAt: '', tone: 'night' },
  popup: {
    enabled: false,
    title: {},
    text: {},
    ctaLabel: {},
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
  home: { sections: HOME_SECTIONS.map((id) => ({ id, enabled: true })) },
  pages: {
    about: {},
    careers: {
      heroImage: '',
      roles: [
        { title: 'Guest Experience Associate', location: 'New Cairo', type: 'Full-time' },
        { title: 'Property Operations Lead', location: 'North Coast (seasonal)', type: 'Full-time' },
        { title: 'Interior Stylist (Freelance)', location: 'Remote / Cairo', type: 'Contract' },
      ],
    },
    owners: {},
    legal: {},
  },
  copy: { en: {}, ar: {} },
  seo: { titleSuffix: '', defaultDescription: '', ogImage: '', pages: {} },
  tracking: {},
};

const BRAND_DEFAULTS = structuredClone(brand);

/** Business details from the admin replace the built-in brand values used across the site. */
function applyBusiness(business = {}) {
  const pick = (value, fallback) => (value ? value : fallback);
  Object.assign(brand, {
    name: pick(business.name, BRAND_DEFAULTS.name),
    tagline: pick(business.tagline, BRAND_DEFAULTS.tagline),
    email: pick(business.email, BRAND_DEFAULTS.email),
    whatsapp: pick(business.whatsapp, BRAND_DEFAULTS.whatsapp),
    phone: pick(business.phone || business.whatsapp, BRAND_DEFAULTS.whatsapp),
    phoneDisplay: pick(business.phoneDisplay, BRAND_DEFAULTS.phoneDisplay),
    address: pick(business.address, BRAND_DEFAULTS.address),
    social: {
      instagram: pick(business.instagram, BRAND_DEFAULTS.social.instagram),
      facebook: pick(business.facebook, BRAND_DEFAULTS.social.facebook),
      tiktok: business.tiktok || '',
      linkedin: business.linkedin || '',
    },
  });
}

const SiteContext = createContext({ site: DEFAULT_SITE, loaded: false, refresh: () => {}, replace: () => {} });

/** True inside the admin's live-preview iframe (same origin, ?__preview in the URL) */
export function isPreviewFrame() {
  if (typeof window === 'undefined' || window.parent === window) return false;
  return new URLSearchParams(window.location.search).has('__preview');
}

function flashElement(el) {
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.animate?.(
    [
      { boxShadow: 'inset 0 0 0 3px rgba(200,169,106,0.95)' },
      { boxShadow: 'inset 0 0 0 3px rgba(200,169,106,0)' },
    ],
    { duration: 1800, easing: 'ease-out' }
  );
}

/** Lets the admin push an unsaved draft into the preview iframe and scroll it to a section */
function usePreviewBridge(setPatch) {
  useEffect(() => {
    if (!isPreviewFrame()) return undefined;
    function onMessage(event) {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const { type, site, target } = event.data || {};
      if (type === 'prime:preview' && site && typeof site === 'object') {
        if (site.business) applyBusiness(site.business);
        setPatch(site);
      } else if (type === 'prime:scroll' && typeof target === 'string') {
        const el = document.getElementById(target);
        if (el) flashElement(el);
      }
    }
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: 'prime:preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [setPatch]);
}

export function SiteProvider({ children }) {
  const [baseSite, setSite] = useState(DEFAULT_SITE);
  const [patch, setPatch] = useState(null);
  const [loaded, setLoaded] = useState(false);
  usePreviewBridge(setPatch);
  const site = useMemo(() => (patch ? { ...baseSite, ...patch } : baseSite), [baseSite, patch]);

  const replace = useCallback((next) => {
    if (!next) return;
    applyBusiness(next.business);
    setSite(next);
  }, []);

  const refresh = useCallback(
    () =>
      api
        .getSite()
        .then((res) => replace(res.site))
        .catch(() => {})
        .finally(() => setLoaded(true)),
    [replace]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ site, loaded, refresh, replace }), [site, loaded, refresh, replace]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  return useContext(SiteContext);
}

/** Brands managed in Admin › Brands */
export function useBrands() {
  return useContext(SiteContext).site.brands?.items || [];
}

/** The CMS brand for a brand tag, written either "Select" or "Prime Select" */
export function findBrand(items, name) {
  const key = String(name || '').trim().replace(/^prime\s+/i, '').toLowerCase();
  return (key && (items || []).find((b) => b.name.toLowerCase() === key)) || null;
}

/** The announcement to show right now, or null (disabled, empty, or outside its dates). */
export function activeAnnouncement(announcement, locale, today = new Date().toISOString().slice(0, 10)) {
  if (!announcement?.enabled) return null;
  const text = announcement.text?.[locale] || announcement.text?.en;
  if (!text) return null;
  if (announcement.startsAt && today < announcement.startsAt) return null;
  if (announcement.endsAt && today > announcement.endsAt) return null;
  return {
    text,
    linkLabel: announcement.linkLabel?.[locale] || announcement.linkLabel?.en || '',
    href: announcement.href || '',
    tone: announcement.tone || 'night',
  };
}

const POPUP_PAGE_MATCH = {
  all: () => true,
  home: (path) => path === '/',
  listings: (path) => path.startsWith('/listings/'),
  search: (path) => path === '/search' || path === '/compounds',
};

/** The pop-up to show on this page right now, or null (disabled, empty, wrong page, or outside its dates). */
export function activePopup(popup, locale, pathname = '/', today = new Date().toISOString().slice(0, 10)) {
  if (!popup?.enabled) return null;
  const title = popup.title?.[locale] || popup.title?.en;
  const text = popup.text?.[locale] || popup.text?.en;
  if (!title && !text) return null;
  if (popup.startsAt && today < popup.startsAt) return null;
  if (popup.endsAt && today > popup.endsAt) return null;
  if (!(POPUP_PAGE_MATCH[popup.pages] || POPUP_PAGE_MATCH.all)(pathname)) return null;
  return {
    title: title || '',
    text: text || '',
    ctaLabel: popup.ctaLabel?.[locale] || popup.ctaLabel?.en || '',
    href: popup.href || '',
    image: popup.image || '',
    trigger: popup.trigger === 'scroll' ? 'scroll' : 'delay',
    delaySeconds: Number(popup.delaySeconds ?? 8),
    scrollPercent: Number(popup.scrollPercent ?? 40),
    frequencyDays: Number(popup.frequencyDays ?? 1),
  };
}
