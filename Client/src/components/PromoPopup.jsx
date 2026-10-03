import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { activePopup, useSite } from '../context/SiteContext';

const SEEN_KEY = 'prime.popup.seen';
const NEVER_ON = ['/admin', '/checkout', '/booking-success'];

/** Changes whenever the marketing team edits the pop-up, so a new message is shown again */
function signature(p) {
  const s = `${p.title}|${p.text}|${p.href}|${p.image}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

function alreadySeen(sig, days) {
  try {
    if (days === 0) return sessionStorage.getItem(SEEN_KEY) === sig;
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null');
    return seen?.sig === sig && Date.now() - seen.at < days * 86_400_000;
  } catch {
    return false;
  }
}

function markSeen(sig, days) {
  try {
    if (days === 0) sessionStorage.setItem(SEEN_KEY, sig);
    else localStorage.setItem(SEEN_KEY, JSON.stringify({ sig, at: Date.now() }));
  } catch {
    /* private mode — shown again next visit */
  }
}

export function PopupCard({ popup, onClose, dir = 'ltr', preview = false }) {
  const external = /^https?:/i.test(popup.href);
  const cta = popup.ctaLabel && popup.href;
  const btnCls = 'mt-6 inline-flex w-full items-center justify-center bg-prime-night px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-sand transition hover:bg-prime-ink';
  return (
    <div dir={dir} className="relative w-full max-w-md overflow-hidden bg-prime-surface text-prime-ink shadow-2xl">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute end-3 top-3 z-10 grid h-8 w-8 place-items-center bg-white/85 text-prime-ink backdrop-blur transition hover:bg-white">
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

export default function PromoPopup() {
  const { pathname } = useLocation();
  const { locale } = useLocale();
  const { site } = useSite();
  const [open, setOpen] = useState(false);

  const blocked = NEVER_ON.some((p) => pathname.startsWith(p));
  const popup = useMemo(() => (blocked ? null : activePopup(site.popup, locale, pathname)), [blocked, site.popup, locale, pathname]);
  const sig = popup ? signature(popup) : '';

  useEffect(() => {
    setOpen(false);
    if (!popup || alreadySeen(sig, popup.frequencyDays)) return undefined;
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
  }, [popup, sig]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function close() {
    setOpen(false);
    if (popup) markSeen(sig, popup.frequencyDays);
  }

  if (!open || !popup) return null;
  return createPortal(
    <div className="fixed inset-0 z-[500] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={popup.title || 'Offer'}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={close} />
      <div className="relative w-full max-w-md" style={{ animation: 'primeFadeIn 0.35s var(--prime-ease) both' }}>
        <PopupCard popup={popup} onClose={close} dir={locale === 'ar' ? 'rtl' : 'ltr'} />
      </div>
    </div>,
    document.body
  );
}
