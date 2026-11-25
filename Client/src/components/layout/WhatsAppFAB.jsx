import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUpRight, X } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { useSite } from '../../context/SiteContext';
import { whatsappHref, whatsappLines } from '../../theme/brand';
import { cn } from '../../utils/cn';
import WhatsAppIcon from '../ui/WhatsAppIcon';

const WhatsAppGlyph = WhatsAppIcon;

const fabCls =
  'inline-flex h-12 w-12 items-center justify-center rounded-full border border-prime-gold/60 bg-prime-band text-prime-gold-deep shadow-lg shadow-black/20 transition duration-300 hover:scale-105 hover:border-prime-gold hover:bg-prime-gold hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-prime-gold focus-visible:ring-offset-2 focus-visible:ring-offset-prime-sand';

export default function WhatsAppFAB() {
  const { pathname } = useLocation();
  const { t, locale } = useLocale();
  useSite(); // re-render when the business numbers load
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (pathname.startsWith('/admin')) return null;
  // Listing pages pin a "Book now" bar to the bottom below the lg breakpoint
  const aboveBookingBar = pathname.startsWith('/listings/');
  const lines = whatsappLines();
  const message = t('whatsapp.question');
  const position = cn(
    'fixed end-[max(1.25rem,env(safe-area-inset-right))] z-40',
    aboveBookingBar
      ? 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-[max(1.25rem,env(safe-area-inset-bottom))]'
      : 'bottom-[max(1.25rem,env(safe-area-inset-bottom))]'
  );

  if (lines.length <= 1) {
    return (
      <a
        href={whatsappHref(message, lines[0]?.number)}
        target="_blank"
        rel="noreferrer"
        className={cn(position, fabCls)}
        aria-label={t('a11y.chatWhatsapp')}
      >
        <WhatsAppGlyph size={22} />
      </a>
    );
  }

  return (
    <div ref={rootRef} className={position}>
      {open ? (
        <div
          id="prime-wa-menu"
          className="absolute bottom-[calc(100%+0.75rem)] end-0 w-[min(18rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-prime-gold/40 bg-prime-band text-prime-on shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
          style={{ animation: 'primeFadeIn 0.3s var(--prime-ease) both' }}
        >
          <p className="border-b border-prime-on/10 px-5 py-3.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-prime-gold-deep">
            {t('whatsapp.choose')}
          </p>
          <ul className="divide-y divide-prime-on/10">
            {lines.map((line, i) => (
              <li key={`${line.number}-${i}`}>
                <a
                  href={whatsappHref(message, line.number)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                  className="group flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-prime-on/[0.06]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium">
                      {line.label?.[locale] || line.label?.en || t('whatsapp.lineN', { n: i + 1 })}
                    </span>
                    <span dir="ltr" className="mt-0.5 block text-[12px] tabular-nums text-prime-on/55">
                      {line.number}
                    </span>
                  </span>
                  <ArrowUpRight size={15} strokeWidth={1.5} className="shrink-0 text-prime-gold-deep transition group-hover:translate-x-0.5 rtl:-scale-x-100" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="prime-wa-menu"
        aria-label={t('a11y.chatWhatsapp')}
        className={fabCls}
      >
        {open ? <X size={20} strokeWidth={1.5} /> : <WhatsAppGlyph size={22} />}
      </button>
    </div>
  );
}
