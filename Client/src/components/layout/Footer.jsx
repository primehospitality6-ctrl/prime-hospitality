import { Link } from 'react-router-dom';
import { ArrowUp, ArrowUpRight, Facebook, Instagram, Linkedin, Music2 } from 'lucide-react';
import { brand, whatsappHref } from '../../theme/brand';
import { useLocale } from '../../context/LocaleContext';
import { useSite } from '../../context/SiteContext';
import Wordmark from '../ui/Wordmark';

const COLS = [
  {
    titleKey: 'footer.explore',
    links: [
      { key: 'footer.stays', to: '/search' },
      { key: 'footer.properties', to: '/compounds' },
      { key: 'footer.about', to: '/about' },
      { key: 'footer.careers', to: '/careers' },
    ],
  },
  {
    titleKey: 'footer.guests',
    links: [
      { key: 'footer.faq', to: '/faq' },
      { key: 'footer.contact', to: '/contact' },
      { key: 'footer.wishlist', to: '/wishlist' },
      { key: 'footer.refund', to: '/refund-policy' },
    ],
  },
  {
    titleKey: 'footer.partners',
    links: [
      { key: 'footer.listProperty', to: '/owners' },
      { key: 'footer.terms', to: '/terms' },
      { key: 'footer.privacy', to: '/privacy' },
    ],
  },
];

const SOCIAL = [
  ['instagram', 'Instagram', Instagram],
  ['facebook', 'Facebook', Facebook],
  ['tiktok', 'TikTok', Music2],
  ['linkedin', 'LinkedIn', Linkedin],
];

export default function Footer() {
  const { t } = useLocale();
  useSite();
  const social = SOCIAL.filter(([key]) => brand.social[key] && brand.social[key] !== '#');

  return (
    <footer className="relative isolate overflow-hidden bg-brand-black text-white">
      <Wordmark
        word="Hospitality"
        className="pointer-events-none absolute -bottom-[0.05em] end-[-0.03em] -z-10 text-[clamp(8rem,26vw,24rem)] text-white/[0.04]"
      />

      <div className="prime-container pt-20 md:pt-28">
        <div className="grid gap-10 border-b border-white/10 pb-16 md:pb-20 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <h2 className="max-w-3xl font-display text-display-lg font-extralight text-balance">
            {t('footer.headline')} <em className="text-prime-gold-soft">{t('footer.headlineEm')}</em> {t('footer.headlineEnd')}
          </h2>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link to="/search" className="prime-btn-gold">
              {t('footer.book')}
            </Link>
            <a href={whatsappHref()} target="_blank" rel="noreferrer" className="prime-btn-ghost">
              {t('footer.whatsapp')}
              <ArrowUpRight size={14} strokeWidth={1.5} />
            </a>
          </div>
        </div>

        <div className="grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <img src={brand.logoLight} alt={brand.name} width="640" height="228" loading="lazy" className="h-10 w-auto" />
            <address className="mt-9 space-y-2.5 text-[13.5px] font-light not-italic leading-relaxed text-white/60">
              <p>{brand.address}</p>
              <a href={`tel:${brand.phone || brand.whatsapp}`} className="prime-tap flex gap-2 transition hover:text-white">
                <span className="text-prime-gold-soft">m.</span>
                <span dir="ltr">{brand.phoneDisplay}</span>
              </a>
              <a href={`mailto:${brand.email}`} className="prime-tap flex gap-2 transition hover:text-white">
                <span className="text-prime-gold-soft">e.</span>
                {brand.email}
              </a>
            </address>
          </div>

          {COLS.map((col) => (
            <nav key={col.titleKey} aria-label={t(col.titleKey)}>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.24em] text-prime-gold-soft">{t(col.titleKey)}</p>
              <ul className="mt-6 space-y-3">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="prime-tap text-[14px] font-light text-white/65 transition hover:text-white">
                      {t(l.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-6 border-t border-white/10 py-7 text-[12px] text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {brand.name}. {t('footer.rights')}
          </span>
          <div className="flex items-center gap-2">
            {social.map(([key, label, Icon]) => (
              <a
                key={key}
                href={brand.social[key]}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="grid h-10 w-10 place-items-center border border-white/15 text-white/70 transition hover:border-prime-gold-soft hover:text-prime-gold-soft"
              >
                <Icon size={16} strokeWidth={1.5} />
              </a>
            ))}
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label="Back to top"
              className="ms-3 grid h-10 w-10 place-items-center border border-white/15 text-white/70 transition hover:border-white hover:bg-white hover:text-brand-black"
            >
              <ArrowUp size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
