import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { activePopup, liveOffers, offerHref, useSite } from '../context/SiteContext';

const SEEN_KEY = 'prime.popup.seen';
const OFFER_SEEN_KEY = 'prime.offerPopup.seen';
const OFFER_DELAY_SECONDS = 5;
const NEVER_ON = ['/admin', '/checkout', '/booking-success'];

/** Changes whenever the marketing team edits the pop-up, so a new message is shown again */
function signature(p) {
  const s = `${p.title}|${p.text}|${p.href}|${p.image}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

function alreadySeen(sig, days, key = SEEN_KEY) {
  try {
    if (days === 0) return sessionStorage.getItem(key) === sig;
    const seen = JSON.parse(localStorage.getItem(key) || 'null');
    return seen?.sig === sig && Date.now() - seen.at < days * 86_400_000;
  } catch {
    return false;
  }
}

function markSeen(sig, days, key = SEEN_KEY) {
  try {
    if (days === 0) sessionStorage.setItem(key, sig);
    else localStorage.setItem(key, JSON.stringify({ sig, at: Date.now() }));
  } catch {
    /* private mode — shown again next visit */
  }
}

export function PopupCard({ popup, onClose, dir = 'ltr', preview = false }) {
  const external = /^https?:/i.test(popup.href);
  const cta = popup.ctaLabel && popup.href;
  const btnCls = 'mt-6 inline-flex w-full items-center justify-center bg-prime-ink px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-sand transition hover:bg-brand-gold hover:text-white';
  return (
    <div dir={dir} className="relative w-full max-w-md overflow-hidden bg-prime-surface text-prime-ink shadow-2xl">
      <button type="button" onClick={onClose} aria-label={dir === 'rtl' ? 'إغلاق' : 'Close'} className="absolute end-3 top-3 z-10 grid h-8 w-8 place-items-center bg-prime-surface/85 text-prime-ink backdrop-blur transition hover:bg-prime-surface">
        <X size={15} />
      </button>
      {popup.image ? <img src={popup.image} alt="" className="aspect-[16/9] w-full object-cover" /> : null}
      <div className="px-7 pb-7 pt-8 text-center">
        {popup.title ? <h2 className="font-display text-2xl font-bold leading-tight tracking-[-0.02em]">{popup.title}</h2> : null}
        {popup.text ? <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-prime-muted">{popup.text}</p> : null}
        {cta ? (
          preview ? (
            <span className={btnCls}>{popup.ctaLabel}</span>
          ) : external ? (
            <a href={popup.href} target="_blank" rel="noreferrer" className={btnCls} onClick={onClose}>
              {popup.ctaLabel}
            </a>
          ) : (
            <Link to={popup.href} className={btnCls} onClick={onClose}>
              {popup.ctaLabel}
            </Link>
          )
        ) : null}
        <button type="button" onClick={onClose} className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-prime-muted transition hover:text-prime-ink">
          {dir === 'rtl' ? 'لا، شكرًا' : 'No thanks'}
        </button>
      </div>
    </div>
  );
}

/** The offer photo as the whole pop-up — tapping it opens the offer's stays */
export function OfferPopupCard({ popup, onClose, dir = 'ltr', preview = false }) {
  const ar = dir === 'rtl';
  const body = (
    <>
      <img src={popup.image} alt={popup.title} className="block max-h-[78vh] w-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 prime-on-photo px-6 pb-5 pt-16 text-prime-on">
        <span className="min-w-0">
          {popup.percent ? (
            <span className="mb-2 inline-block bg-brand-gold px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em]">
              {ar ? `خصم ${popup.percent}%` : `${popup.percent}% off`}
            </span>
          ) : null}
          <span className="block font-display text-[1.6rem] font-medium leading-tight">{popup.title}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-gold-deep">
          {ar ? 'شاهد الإقامات' : 'See stays'}
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-1 rtl:-scale-x-100" />
        </span>
      </span>
    </>
  );
  return (
    <div dir={dir} className="relative w-full max-w-md overflow-hidden bg-prime-band shadow-2xl">
      <button type="button" onClick={onClose} aria-label={ar ? 'إغلاق' : 'Close'} className="absolute end-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-prime-band/45 text-prime-on backdrop-blur transition hover:bg-prime-band/70">
        <X size={15} />
      </button>
      {preview ? (
        <span className="group relative block">{body}</span>
      ) : (
        <Link to={popup.href} onClick={onClose} className="group relative block">
          {body}
        </Link>
      )}
    </div>
  );
}

function offerPopup(offers, locale) {
  const offer = liveOffers(offers).find((o) => o.showPopup && o.image);
  if (!offer) return null;
  return {
    kind: 'offer',
    title: offer.name?.[locale] || offer.name?.en || '',
    text: '',
    image: offer.image,
    href: offerHref(offer.id),
    percent: offer.percent,
    trigger: 'delay',
    delaySeconds: OFFER_DELAY_SECONDS,
    frequencyDays: 1,
  };
}

export default function PromoPopup() {
  const { pathname } = useLocation();
  const { locale } = useLocale();
  const { site } = useSite();
  const [open, setOpen] = useState(false);

  const blocked = NEVER_ON.some((p) => pathname.startsWith(p));
  const popup = useMemo(() => {
    if (blocked) return null;
    // A live offer pop-up comes first; once seen today, the marketing pop-up gets its turn
    const offer = offerPopup(site.offers, locale);
    if (offer && !alreadySeen(signature(offer), 1, OFFER_SEEN_KEY)) return offer;
    return activePopup(site.popup, locale, pathname);
  }, [blocked, site.offers, site.popup, locale, pathname]);
  const sig = popup ? signature(popup) : '';
  const seenKey = popup?.kind === 'offer' ? OFFER_SEEN_KEY : SEEN_KEY;

  useEffect(() => {
    setOpen(false);
    if (!popup || alreadySeen(sig, popup.frequencyDays, seenKey)) return undefined;
    const show = () => setOpen(true);
    if (popup.trigger === 'scroll') {
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max > 0 && (window.scrollY / max) * 100 >= popup.scrollPercent) {
          window.removeEventListener('scroll', onScroll);
          show();
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }
    const timer = setTimeout(show, Math.max(0, popup.delaySeconds) * 1000);
    return () => clearTimeout(timer);
  }, [popup, sig, seenKey]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function close() {
    setOpen(false);
    if (popup) markSeen(sig, popup.frequencyDays, seenKey);
  }

  if (!open || !popup) return null;
  return createPortal(
    <div className="fixed inset-0 z-[500] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={popup.title || 'Offer'}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-prime-band/45 backdrop-blur-[2px]" onClick={close} />
      <div className="relative w-full max-w-md" style={{ animation: 'primeFadeIn 0.35s var(--prime-ease) both' }}>
        {popup.kind === 'offer' ? (
          <OfferPopupCard popup={popup} onClose={close} dir={locale === 'ar' ? 'rtl' : 'ltr'} />
        ) : (
          <PopupCard popup={popup} onClose={close} dir={locale === 'ar' ? 'rtl' : 'ltr'} />
        )}
      </div>
    </div>,
    document.body
  );
}
