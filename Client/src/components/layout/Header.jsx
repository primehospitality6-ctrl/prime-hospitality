import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowUpRight, Heart, Moon, Sun, X } from 'lucide-react';
import { brand, whatsappHref } from '../../theme/brand';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useLocale } from '../../context/LocaleContext';
import { activeAnnouncement, useSite } from '../../context/SiteContext';
import { useTheme } from '../../context/ThemeContext';
import { useWishlist } from '../../context/WishlistContext';
import { cn } from '../../utils/cn';
import Wordmark from '../ui/Wordmark';

const MENU = [
  { labelKey: 'nav.stays', to: '/search', inline: true },
  { labelKey: 'nav.compounds', to: '/compounds', inline: true },
  { labelKey: 'nav.about', to: '/about', inline: true },
  { labelKey: 'nav.becomePartner', to: '/owners' },
  { labelKey: 'nav.faq', to: '/faq' },
  { labelKey: 'nav.contact', to: '/contact' },
];

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useLocale();
  const iconCls = 'absolute inset-0 m-auto transition-all duration-500 ease-prime';
  return (
    <button
      type="button"
      aria-pressed={isDark}
      aria-label={t(isDark ? 'a11y.toLight' : 'a11y.toDark')}
      title={t(isDark ? 'a11y.lightMode' : 'a11y.darkMode')}
      onClick={toggleTheme}
      className="prime-tap relative inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center opacity-85 transition-opacity hover:opacity-100"
    >
      <Sun size={18} strokeWidth={1.5} className={cn(iconCls, isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0')} />
      <Moon size={17} strokeWidth={1.5} className={cn(iconCls, isDark ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100')} />
    </button>
  );
}

const BAR_TONES = {
  night: 'bg-brand-black text-white',
  gold: 'bg-brand-gold text-white',
  sand: 'bg-prime-mist text-prime-ink',
};
const BAR_DISMISS_KEY = 'prime.announcement.dismissed';

function AnnouncementBar({ bar, collapsed, onDismiss }) {
  const { t } = useLocale();
  const external = /^https?:/i.test(bar.href);
  const linkCls = 'ms-2 underline decoration-current/40 underline-offset-4 transition hover:decoration-current';
  return (
    <div
      className={cn(
        'relative grid transition-[grid-template-rows] duration-500 ease-prime',
        collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
      )}
    >
      <div className="overflow-hidden">
        <div className={cn('flex h-9 items-center justify-center px-10 text-center text-[11.5px] tracking-[0.06em]', BAR_TONES[bar.tone] || BAR_TONES.night)}>
          <p className="truncate">
            {bar.text}
            {bar.href && bar.linkLabel ? (
              external ? (
                <a href={bar.href} target="_blank" rel="noreferrer" className={linkCls}>
                  {bar.linkLabel}
                </a>
              ) : (
                <Link to={bar.href} className={linkCls}>
                  {bar.linkLabel}
                </Link>
              )
            ) : null}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('a11y.dismiss')}
            className="absolute end-2 grid h-7 w-7 place-items-center opacity-70 transition hover:opacity-100"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <span className="relative block h-2.5 w-6" aria-hidden>
      <span className="absolute inset-x-0 top-0 h-px bg-current" />
      <span className="absolute bottom-0 start-0 h-px w-4 bg-current transition-all duration-500 ease-prime group-hover:w-6" />
    </span>
  );
}

const navLinkCls = ({ isActive }) =>
  cn(
    'relative py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition-opacity duration-300',
    'after:absolute after:inset-x-0 after:bottom-0.5 after:h-px after:origin-left after:bg-current after:transition-transform after:duration-500 after:ease-prime',
    isActive ? 'opacity-100 after:scale-x-100' : 'opacity-75 after:scale-x-0 hover:opacity-100 hover:after:scale-x-100'
  );

export default function Header({ overHero = false }) {
  const { t, locale, toggleLocale } = useLocale();
  const { isAdmin } = useAdminAuth();
  const { ids } = useWishlist();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeRef = useRef(null);
  const { site } = useSite();
  const bar = activeAnnouncement(site.announcement, locale);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(BAR_DISMISS_KEY) || '';
    } catch {
      return '';
    }
  });
  const showBar = Boolean(bar) && dismissed !== bar.text;

  function dismissBar() {
    setDismissed(bar.text);
    try {
      sessionStorage.setItem(BAR_DISMISS_KEY, bar.text);
    } catch {
      /* private mode — dismissed for this page view only */
    }
  }

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > 40));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const transparent = overHero && !scrolled;
  const staffTo = isAdmin ? '/admin' : '/admin/login';

  return (
    <>
      <header
        className={cn(
          'prime-header-shell fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,color] duration-500 ease-prime',
          transparent
            ? 'bg-transparent text-white'
            : 'bg-prime-sand/90 text-prime-ink shadow-[0_1px_0_rgba(35,31,32,0.08)] backdrop-blur-xl backdrop-saturate-150'
        )}
      >
        {transparent ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 to-transparent" />
        ) : null}
        {showBar ? <AnnouncementBar bar={bar} collapsed={scrolled} onDismiss={dismissBar} /> : null}
        <div className="prime-container relative grid h-[var(--prime-header-h)] grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex items-center gap-7">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="prime-menu"
              className="group -ms-2 inline-flex min-h-[44px] min-w-[44px] items-center gap-3 p-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
            >
              <MenuIcon />
              <span className="hidden sm:inline lg:sr-only">{t('nav.menu')}</span>
            </button>
            <nav className="hidden items-center gap-7 lg:flex" aria-label={t('a11y.primaryNav')}>
              {MENU.filter((m) => m.inline).map((item) => (
                <NavLink key={item.to} to={item.to} className={navLinkCls}>
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </nav>
          </div>

          <Link to="/" className="block" aria-label={brand.name}>
            <img
              src={transparent ? brand.logoLight : brand.logoDark}
              alt={brand.name}
              width="640"
              height="228"
              className="h-8 w-auto md:h-10"
            />
          </Link>

          <div className="flex items-center justify-end gap-1 sm:gap-3">
            <button
              type="button"
              onClick={toggleLocale}
              className="hidden p-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75 transition-opacity hover:opacity-100 md:inline-flex"
              aria-label={t('a11y.switchLanguage')}
            >
              {locale === 'en' ? 'عربي' : 'EN'}
            </button>
            <ThemeToggle />
            <Link
              to="/wishlist"
              className="relative inline-flex p-2 opacity-85 transition-opacity hover:opacity-100"
              aria-label={t('nav.wishlist')}
            >
              <Heart size={18} strokeWidth={1.5} />
              {ids.length ? (
                <span className="absolute end-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-gold px-1 text-[10px] font-semibold text-white">
                  {ids.length}
                </span>
              ) : null}
            </Link>
            <Link
              to="/search"
              className={cn(
                'ms-1 hidden min-h-[2.75rem] items-center rounded-btn px-5 text-[11px] font-semibold uppercase tracking-[0.2em] transition duration-300 sm:inline-flex',
                transparent
                  ? 'border border-white/45 hover:border-white hover:bg-white hover:text-brand-black'
                  : 'bg-prime-ink text-prime-sand hover:bg-brand-gold'
              )}
            >
              {t('nav.book')}
            </Link>
          </div>
        </div>
      </header>

      {!overHero ? (
        <div aria-hidden className={showBar ? 'h-[calc(var(--prime-header-h)+2.25rem)]' : 'h-[var(--prime-header-h)]'} />
      ) : null}

      {menuOpen ? (
        <div
          id="prime-menu"
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.menu')}
          className="fixed inset-0 z-[90] flex overflow-hidden bg-brand-black text-white"
          style={{ animation: 'primeMenuIn 0.7s var(--prime-ease) both' }}
        >
          <Wordmark
            word="Hospitality"
            className="pointer-events-none absolute -bottom-[0.06em] end-[-0.04em] text-[clamp(7rem,24vw,22rem)] text-white/[0.045]"
          />
          <div className="relative flex min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            <div className="prime-container grid h-[var(--prime-header-h)] shrink-0 grid-cols-[1fr_auto_1fr] items-center">
              <button
                ref={closeRef}
                type="button"
                onClick={() => setMenuOpen(false)}
                className="-ms-2 inline-flex w-fit items-center gap-3 p-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
              >
                <X size={20} strokeWidth={1.25} />
                <span className="hidden sm:inline">{t('nav.close')}</span>
              </button>
              <Link to="/" onClick={() => setMenuOpen(false)} aria-label={brand.name}>
                <img src={brand.logoLight} alt={brand.name} width="640" height="228" className="h-8 w-auto md:h-10" />
              </Link>
              <span />
            </div>

            <nav className="prime-container flex flex-1 flex-col justify-center py-10" aria-label={t('nav.menu')}>
              <ol className="max-w-3xl divide-y divide-white/10 border-y border-white/10">
                {MENU.map((item, i) => (
                  <li
                    key={item.to}
                    className="prime-fade-up"
                    style={{ animationDelay: `${120 + i * 60}ms` }}
                  >
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-baseline gap-6 py-3 font-display text-[clamp(1.9rem,5vw,3.4rem)] font-extralight leading-[1.1] tracking-[-0.03em] transition-colors duration-300 md:py-4',
                          isActive ? 'text-prime-gold-soft' : 'text-white hover:text-prime-gold-soft'
                        )
                      }
                    >
                      <span className="w-8 shrink-0 font-sans text-[11px] font-semibold tracking-[0.2em] text-white/35">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="transition-transform duration-500 ease-prime group-hover:translate-x-2 rtl:group-hover:-translate-x-2">
                        {t(item.labelKey)}
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="prime-container shrink-0 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <a href={`mailto:${brand.email}`} className="transition hover:text-white">
                    {brand.email}
                  </a>
                  <a href={whatsappHref()} target="_blank" rel="noreferrer" className="transition hover:text-white">
                    {t('common.whatsapp')}
                  </a>
                  <Link to={staffTo} className="inline-flex items-center gap-1 transition hover:text-white">
                    {isAdmin ? t('nav.staffDashboard') : t('nav.staffSignIn')}
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
                <button type="button" onClick={toggleLocale} className="transition hover:text-white">
                  {locale === 'en' ? 'عربي' : 'English'}
                </button>
              </div>
            </div>
          </div>

          <p className="pointer-events-none absolute end-[max(1.25rem,4vw)] top-[calc(var(--prime-header-h)+2rem)] hidden max-w-[16rem] text-end text-[13px] font-light leading-relaxed text-white/50 lg:block">
            {locale === 'ar' ? t('home.heroTitle') : brand.tagline}
          </p>
        </div>
      ) : null}
    </>
  );
}
