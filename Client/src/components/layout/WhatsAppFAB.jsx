import { useLocation } from 'react-router-dom';
import { useLocale } from '../../context/LocaleContext';
import { whatsappHref } from '../../theme/brand';
import { cn } from '../../utils/cn';

function WhatsAppGlyph({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.24 9.43-9.44 9.43m8.03-17.46A11.28 11.28 0 0 0 12.05.72C5.8.72.7 5.8.7 12.06c0 2 .52 3.95 1.52 5.67L.6 23.28l5.68-1.49a11.3 11.3 0 0 0 5.76 1.47h.01c6.25 0 11.34-5.09 11.35-11.35a11.28 11.28 0 0 0-3.32-8.03" />
    </svg>
  );
}

export default function WhatsAppFAB() {
  const { pathname } = useLocation();
  const { t } = useLocale();
  if (pathname.startsWith('/admin')) return null;
  // Listing pages pin a "Book now" bar to the bottom below the lg breakpoint
  const aboveBookingBar = pathname.startsWith('/listings/');

  return (
    <a
      href={whatsappHref(t('whatsapp.question'))}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'fixed end-[max(1.25rem,env(safe-area-inset-right))] z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-prime-gold/60 bg-prime-night text-prime-gold-soft shadow-lg shadow-black/20 transition duration-300 hover:scale-105 hover:border-prime-gold hover:bg-prime-gold hover:text-prime-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-prime-gold focus-visible:ring-offset-2 focus-visible:ring-offset-prime-sand',
        aboveBookingBar
          ? 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-[max(1.25rem,env(safe-area-inset-bottom))]'
          : 'bottom-[max(1.25rem,env(safe-area-inset-bottom))]'
      )}
      aria-label={t('a11y.chatWhatsapp')}
    >
      <WhatsAppGlyph size={22} />
    </a>
  );
}
