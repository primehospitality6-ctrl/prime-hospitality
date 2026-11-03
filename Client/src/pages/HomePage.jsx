import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import HeroSearch from '../components/home/HeroSearch';
import CompoundGrid from '../components/home/CompoundGrid';
import BrandsSection from '../components/home/BrandsSection';
import TrustSection from '../components/home/TrustSection';
import PartnersSection from '../components/home/PartnersSection';
import PartnerCta from '../components/home/PartnerCta';
import ListingCard, { ListingCardSkeleton } from '../components/ListingCard';
import Reveal from '../components/ui/Reveal';
import SectionIntro from '../components/ui/SectionIntro';
import Wordmark from '../components/ui/Wordmark';
import api from '../api/client';
import { brand } from '../theme/brand';
import { useLocale } from '../context/LocaleContext';
import { useSite } from '../context/SiteContext';
import { sizedSrc, srcSetFor } from '../utils/img';
import { cn } from '../utils/cn';
import BrandLogo from '../components/ui/BrandLogo';

const HERO_FALLBACK = [
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=72',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2200&q=72',
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=2200&q=72',
];
const HERO_WIDTHS = [640, 960, 1440, 1920, 2560];
const SLIDE_MS = 7000;
const CAROUSEL_CARD = 'w-[78vw] flex-none snap-start sm:w-[46vw] md:w-[38vw] lg:w-[31vw] xl:w-[30vw]';
const INTRO_KEY = 'prime-intro-seen';

function IntroCurtain() {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    try {
      return !window.sessionStorage.getItem(INTRO_KEY);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!show) return undefined;
    try {
      window.sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* storage unavailable */
    }
    const id = window.setTimeout(() => setShow(false), 2300);
    return () => window.clearTimeout(id);
  }, [show]);

  if (!show) return null;

  return (
    <button type="button" className="prime-intro" onClick={() => setShow(false)} aria-label={brand.name}>
      <span className="flex flex-col items-center gap-7 px-6">
        <BrandLogo alt="" className="h-10 w-auto" />
        <span className="prime-intro__bar" aria-hidden>
          <span />
        </span>
      </span>
    </button>
  );
}

function DestinationMarquee() {
  const [names, setNames] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api
      .getDestinations()
      .then((res) => {
        if (cancelled) return;
        const list = (res.items || []).map((d) => d.name).filter(Boolean);
        setNames(list.length < 6 ? [...list, ...list] : list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (names.length < 2) return null;

  return (
    <section className="overflow-hidden border-y border-prime-line bg-prime-mist py-7" aria-hidden="true">
      <div dir="ltr" className="prime-marquee items-center">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center pe-12">
            {names.map((name, i) => (
              <span key={`${copy}-${i}`} className="flex items-center">
                <span className="px-6 font-display text-[1.7rem] font-extralight leading-none tracking-[-0.03em] text-prime-ink md:px-8 md:text-[2.15rem]">
                  {name}
                </span>
                <span className="inline-block h-1.5 w-1.5 rotate-45 bg-brand-gold" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Hero() {
  const { t } = useLocale();
  const [slides, setSlides] = useState(() => HERO_FALLBACK.map((image) => ({ image, href: '' })));
  const images = slides.map((s) => s.image);
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    api
      .getSlideshow()
      .then((res) => {
        const next = (res.items || []).filter((s) => s.image).map((s) => ({ image: s.image, href: s.href || '' }));
        if (!cancelled && next.length) {
          setSlides(next);
          setIndex(0);
          setPrev(-1);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (images.length < 2) return undefined;
    const id = setTimeout(() => {
      setPrev(index);
      setIndex((index + 1) % images.length);
    }, SLIDE_MS);
    return () => clearTimeout(id);
  }, [index, images.length]);

  function goTo(i) {
    if (i === index) return;
    setPrev(index);
    setIndex(i);
  }

  const next = (index + 1) % images.length;
  const activeHref = slides[index]?.href || '';
  const external = /^https?:/i.test(activeHref);
  const slideLinkProps = external ? { href: activeHref, target: '_blank', rel: 'noreferrer' } : { to: activeHref };
  const SlideLink = external ? 'a' : Link;

  return (
    <section className="relative isolate overflow-hidden bg-prime-sand text-prime-ink">
      {/* Full-screen slideshow, edge to edge, photos exactly as they are */}
      <div className="relative min-h-vh-100 overflow-hidden bg-prime-mist">
        {images.map((src, i) => {
          if (i !== index && i !== prev && i !== next) return null;
          const active = i === index;
          return (
            <img
              key={src}
              src={sizedSrc(src, 1920)}
              srcSet={srcSetFor(src, HERO_WIDTHS)}
              sizes="100vw"
              alt=""
              fetchPriority={i === 0 ? 'high' : 'low'}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className={cn(
                'absolute inset-0 h-full w-full object-cover transition-opacity duration-[2000ms] ease-in-out',
                active ? 'prime-kenburns opacity-100' : 'opacity-0'
              )}
            />
          );
        })}
        {activeHref ? (
          // The photo itself is the link; the visible button below is the accessible one
          <SlideLink {...slideLinkProps} tabIndex={-1} aria-hidden className="absolute inset-0 cursor-pointer" />
        ) : null}
      </div>

      <Wordmark
        word="Prime"
        className="prime-fade-in pointer-events-none absolute -bottom-[0.1em] end-[-0.04em] -z-10 hidden text-[clamp(8rem,22vw,22rem)] text-prime-ink/[0.035] lg:block"
      />

      <div className="prime-container pb-16 md:pb-20">
        {/* Slide counter and progress, right under the photo */}
        {images.length > 1 ? (
          <div className="flex items-center gap-5 pt-3">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.24em] tabular-nums text-prime-muted">
              {String(index + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
            </span>
            <div className="flex flex-1 items-center gap-1.5">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={t('a11y.showSlide', { n: i + 1 })}
                  aria-current={i === index}
                  className="group grid h-11 flex-1 place-items-center"
                >
                  <span className="relative block h-px w-full overflow-hidden bg-prime-line">
                    <span
                      className={cn(
                        'absolute inset-y-0 start-0 bg-prime-gold transition-all duration-700 ease-prime',
                        i === index ? 'w-full' : 'w-0 group-hover:w-1/3'
                      )}
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Words on the page colour */}
        <div className="grid items-end gap-8 pt-10 md:pt-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
          <div className="max-w-3xl">
            <p className="prime-fade-up flex items-center gap-4 text-[10.5px] font-medium uppercase tracking-[0.32em] text-prime-gold-deep">
              <span className="inline-block h-2 w-2 rotate-45 border border-prime-gold" aria-hidden />
              {t('home.introEyebrow')}
            </p>
            <h1 className="prime-fade-up mt-6 font-display text-display-2xl font-extralight sm:mt-8" style={{ animationDelay: '80ms' }}>
              <span className="block">{t('home.heroLine1')}</span>
              <span className="mt-1 block text-prime-gold-deep">{t('home.heroLine2')}</span>
            </h1>
          </div>
          <div className="prime-fade-up max-w-md lg:justify-self-end lg:pb-3" style={{ animationDelay: '180ms' }}>
            <p className="text-[15px] font-light leading-[1.85] text-prime-muted md:text-[16.5px]">{t('home.heroSubtitle')}</p>
            {activeHref ? (
              <SlideLink
                {...slideLinkProps}
                key={activeHref}
                className="prime-fade-up group mt-6 inline-flex min-h-[2.75rem] items-center gap-2.5 rounded-full border border-prime-gold/60 px-5 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-prime-ink transition duration-500 ease-prime hover:border-prime-gold hover:bg-prime-gold hover:text-white"
              >
                {t(activeHref.includes('offer=') ? 'home.slideViewOffer' : 'home.slideExplore')}
                <ArrowRight size={14} strokeWidth={1.5} className="transition-transform duration-500 group-hover:translate-x-1 rtl:-scale-x-100" />
              </SlideLink>
            ) : null}
          </div>
        </div>

        <div className="prime-fade-up mt-10 md:mt-14" style={{ animationDelay: '280ms' }}>
          <div className="overflow-hidden rounded-[1.75rem] border border-prime-line bg-prime-surface shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)]">
            <div className="h-1 w-full bg-gradient-to-r from-prime-gold via-prime-gold-soft to-transparent" />
            <HeroSearch />
          </div>
        </div>
      </div>
    </section>
  );
}

function Intro() {
  const { t } = useLocale();

  return (
    <section className="relative overflow-hidden bg-prime-band text-prime-on">
      <Wordmark
        word="Hospitality"
        className="pointer-events-none absolute -bottom-[0.12em] start-[-0.06em] text-[clamp(8rem,28vw,26rem)] text-prime-on/[0.045]"
      />
      <div className="prime-container relative grid gap-12 py-28 md:grid-cols-[auto_minmax(0,1fr)] md:gap-20 md:py-40 lg:gap-28">
        <Reveal>
          <span className="font-display text-[clamp(5rem,14vw,11rem)] font-extralight leading-none tracking-[-0.06em] text-prime-gold/40">
            01
          </span>
        </Reveal>
        <Reveal delay={100} className="max-w-3xl self-end pb-2">
          <p className="prime-eyebrow text-prime-gold-deep">{t('home.introEyebrow')}</p>
          <h2 className="mt-8 font-display text-display-xl font-extralight text-balance">{t('home.introTitle')}</h2>
          <p className="mt-8 max-w-xl text-[16px] font-light leading-[1.85] text-prime-on/65">{t('home.introBody')}</p>
          <Link to="/about" className="prime-link prime-link--light mt-12">
            {t('home.ourStory')}
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

function FeaturedCarousel() {
  const { t } = useLocale();
  const trackRef = useRef(null);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getFeatured(10)
      .then((res) => {
        if (!cancelled) setFeatured(res.items || []);
      })
      .catch(() => {
        if (!cancelled) setFeatured([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function scrollBy(dir) {
    const el = trackRef.current;
    if (!el) return;
    const rtl = document.documentElement.dir === 'rtl';
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.75, behavior: 'smooth' });
  }

  if (!loading && !featured.length) return null;

  return (
    <section className="overflow-hidden bg-prime-mist/50 py-24 md:py-36">
      <div className="prime-container">
        <div className="mb-14 flex flex-col gap-8 md:mb-20 md:flex-row md:items-end md:justify-between">
          <SectionIntro eyebrow={t('home.featured')} title={t('home.featuredTitle')} className="mb-0" />
          <div className="flex items-center gap-6">
            <Link to="/search" className="prime-link">
              {t('home.viewAll')}
            </Link>
            <div className="hidden gap-2 md:flex">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                aria-label={t('home.prevStays')}
                className="prime-round"
              >
                <ArrowLeft size={16} strokeWidth={1.3} className="rtl:rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                aria-label={t('home.moreStays')}
                className="prime-round"
              >
                <ArrowRight size={16} strokeWidth={1.3} className="rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div ref={trackRef} className="prime-scroll-x gap-4 px-5 scroll-px-5 sm:gap-5 sm:px-8 sm:scroll-px-8 lg:px-12 lg:scroll-px-12">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <ListingCardSkeleton key={i} className={CAROUSEL_CARD} />)
          : featured.map((u) => (
              <ListingCard
                key={u.id}
                listing={u}
                featured
                className={CAROUSEL_CARD}
                sizes="(min-width: 1280px) 28vw, (min-width: 1024px) 34vw, (min-width: 640px) 48vw, 78vw"
              />
            ))}
      </div>
    </section>
  );
}

function PropertiesSection() {
  return <CompoundGrid limit={7} homeOnly />;
}

const SECTIONS = {
  intro: Intro,
  properties: PropertiesSection,
  brands: BrandsSection,
  featured: FeaturedCarousel,
  trust: TrustSection,
  partners: PartnersSection,
  partnerCta: PartnerCta,
};

export default function HomePage() {
  const { site } = useSite();

  return (
    <div>
      <IntroCurtain />
      <Header overHero />
      <main>
        <div id="home-hero">
          <Hero />
        </div>
        <DestinationMarquee />
        {(site.home?.sections || []).map(({ id, enabled }) => {
          if (!enabled) return null;
          const Section = SECTIONS[id];
          return Section ? (
            <div key={id} id={`home-${id}`}>
              <Section />
            </div>
          ) : null;
        })}
      </main>
      <Footer />
    </div>
  );
}
