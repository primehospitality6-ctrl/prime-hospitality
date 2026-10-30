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
        <img src={brand.logoLight} alt="" className="h-10 w-auto" />
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
  const [images, setImages] = useState(HERO_FALLBACK);
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    api
      .getSlideshow()
      .then((res) => {
        const urls = (res.items || []).map((s) => s.image).filter(Boolean);
        if (!cancelled && urls.length) {
          setImages(urls);
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
  }, [index, images]);

  function goTo(i) {
    if (i === index) return;
    setPrev(index);
    setIndex(i);
  }

  const next = (index + 1) % images.length;

  return (
    <section className="relative isolate flex min-h-vh-100 flex-col overflow-hidden bg-brand-black text-white">
      <div className="absolute inset-0 -z-10" aria-hidden>
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/85" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(140,112,77,0.22),transparent_50%)]" />
      </div>

      <Wordmark
        word="Prime"
        className="prime-fade-in pointer-events-none absolute inset-x-0 top-[18%] -z-10 mx-auto hidden w-max text-center text-[clamp(6rem,22vw,22rem)] text-white/[0.08] md:block"
      />

      {/* Vertical slide index — editorial rail */}
      {images.length > 1 ? (
        <div className="pointer-events-auto absolute end-5 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-center gap-3 lg:end-10 lg:flex">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={t('a11y.showSlide', { n: i + 1 })}
              aria-current={i === index}
              className={cn(
                'font-display text-[13px] font-light tabular-nums tracking-[0.12em] transition duration-500',
                i === index ? 'scale-125 text-prime-gold-soft' : 'text-white/35 hover:text-white/80'
              )}
            >
              {String(i + 1).padStart(2, '0')}
            </button>
          ))}
          <span className="mt-2 h-16 w-px overflow-hidden bg-white/20">
            <span
              key={index}
              className="block w-full bg-prime-gold-soft"
              style={{ height: `${((index + 1) / images.length) * 100}%`, transition: 'height 0.6s var(--prime-ease)' }}
            />
          </span>
        </div>
      ) : null}

      <div className="prime-container relative flex flex-1 flex-col justify-start pb-24 pt-28 sm:pt-32 lg:justify-end lg:pb-16 lg:pt-36">
        <div className="grid items-end gap-6 sm:gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
          <div className="max-w-3xl">
            <p className="prime-fade-up flex items-center gap-4 text-[10.5px] font-medium uppercase tracking-[0.32em] text-prime-gold-soft">
              <span className="inline-block h-2 w-2 rotate-45 border border-prime-gold-soft" aria-hidden />
              {t('home.introEyebrow')}
            </p>
            <h1 className="prime-fade-up mt-5 font-display text-display-2xl font-extralight sm:mt-8" style={{ animationDelay: '80ms' }}>
              <span className="block">{t('home.heroLine1')}</span>
              <span className="mt-1 block text-prime-gold-soft">{t('home.heroLine2')}</span>
            </h1>
          </div>
          <div className="prime-fade-up max-w-md lg:justify-self-end lg:pb-3" style={{ animationDelay: '180ms' }}>
            <p className="text-[15px] font-light leading-[1.85] text-white/70 md:text-[16.5px]">{t('home.heroSubtitle')}</p>
            <div className="mt-6 flex items-center gap-4 text-[10.5px] font-medium uppercase tracking-[0.24em] text-white/50">
              <span className="tabular-nums text-white/80">
                {String(index + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
              </span>
              <span className="h-px flex-1 bg-white/20" />
            </div>
          </div>
        </div>

        <div className="prime-fade-up mt-8 sm:mt-12 md:mt-14" style={{ animationDelay: '280ms' }}>
          <div className="overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/[0.97] shadow-[0_40px_100px_rgba(0,0,0,0.45)]">
            <div className="h-1 w-full bg-gradient-to-r from-prime-gold via-prime-gold-soft to-transparent" />
            <HeroSearch />
          </div>
        </div>

        {images.length > 1 ? (
          <div className="mt-4 flex items-center justify-center lg:hidden">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => goTo(i)}
                aria-label={t('a11y.showSlide', { n: i + 1 })}
                aria-current={i === index}
                className="grid h-11 w-8 place-items-center"
              >
                <span
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === index ? 'w-5 bg-prime-gold-soft' : 'w-1.5 bg-white/45'
                  )}
                />
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-8 hidden items-center justify-center gap-3 text-white/70 lg:flex">
          <span className="text-[10px] font-medium uppercase tracking-[0.28em]">{t('home.scroll')}</span>
          <span className="relative h-10 w-px overflow-hidden bg-white/25">
            <span className="absolute inset-x-0 top-0 h-1/2 bg-prime-gold-soft" style={{ animation: 'primeScrollCue 1.8s var(--prime-ease) infinite' }} />
          </span>
        </div>
      </div>
    </section>
  );
}

function Intro() {
  const { t } = useLocale();

  return (
    <section className="relative overflow-hidden bg-brand-black text-white">
      <Wordmark
        word="Hospitality"
        className="pointer-events-none absolute -bottom-[0.12em] start-[-0.06em] text-[clamp(8rem,28vw,26rem)] text-white/[0.045]"
      />
      <div className="prime-container relative grid gap-12 py-28 md:grid-cols-[auto_minmax(0,1fr)] md:gap-20 md:py-40 lg:gap-28">
        <Reveal>
          <span className="font-display text-[clamp(5rem,14vw,11rem)] font-extralight leading-none tracking-[-0.06em] text-prime-gold/40">
            01
          </span>
        </Reveal>
        <Reveal delay={100} className="max-w-3xl self-end pb-2">
          <p className="prime-eyebrow text-prime-gold-soft">{t('home.introEyebrow')}</p>
          <h2 className="mt-8 font-display text-display-xl font-extralight text-balance">{t('home.introTitle')}</h2>
          <p className="mt-8 max-w-xl text-[16px] font-light leading-[1.85] text-white/65">{t('home.introBody')}</p>
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
