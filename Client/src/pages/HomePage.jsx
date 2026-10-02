import { useEffect, useMemo, useRef, useState } from 'react';
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
import api from '../api/client';
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
const CAROUSEL_CARD = 'w-[80vw] flex-none snap-start sm:w-[44vw] lg:w-[30vw] xl:w-[23.5vw] 2xl:w-[320px]';

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
    <section className="relative isolate flex min-h-vh-100 flex-col overflow-hidden bg-[#221f20] text-white">
      <div className="absolute inset-0 -z-10" aria-hidden>
        {images.map((src, i) => {
          // Only the visible slide, the one fading out and the next one are ever in the DOM
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
                'absolute inset-0 h-full w-full object-cover transition-opacity duration-[1800ms] ease-in-out',
                active ? 'prime-kenburns opacity-100' : 'opacity-0'
              )}
            />
          );
        })}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/35" />
      </div>

      <div className="prime-container flex flex-1 flex-col justify-end pb-6 pt-32 md:pb-10">
        <div className="max-w-4xl">
          <p className="prime-fade-up text-[11px] font-medium uppercase tracking-[0.34em] text-white/80">
            {t('home.introEyebrow')} · Egypt
          </p>
          <h1 className="prime-fade-up mt-6 font-display text-display-2xl font-medium" style={{ animationDelay: '100ms' }}>
            <span className="block">{t('home.heroLine1')}</span>
            <span className="block italic text-prime-gold-soft">{t('home.heroLine2')}</span>
          </h1>
          <p
            className="prime-fade-up mt-6 max-w-md text-[16px] font-light leading-relaxed text-white/85 md:text-[18px]"
            style={{ animationDelay: '200ms' }}
          >
            {t('home.heroSubtitle')}
          </p>
        </div>

        <div className="prime-fade-up mt-10 md:mt-14" style={{ animationDelay: '320ms' }}>
          <HeroSearch />
        </div>

        <div className="mt-6 flex items-center justify-between gap-6 md:mt-8">
          {images.length > 1 ? (
            <div className="flex items-center gap-4">
              <span className="text-[11px] font-medium tabular-nums tracking-[0.2em] text-white/80">
                {String(index + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
              </span>
              <div className="flex gap-1.5">
                {images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Show slide ${i + 1}`}
                    aria-current={i === index}
                    className="group px-1.5 py-5"
                  >
                    <span className="relative block h-px w-8 overflow-hidden bg-white/30 sm:w-12">
                      {i === index ? (
                        <span
                          key={index}
                          className="absolute inset-y-0 start-0 bg-white"
                          style={{ animation: `primeProgress ${SLIDE_MS}ms linear both` }}
                        />
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <span />
          )}
          <span className="hidden items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-white/70 md:inline-flex">
            {t('home.scroll')}
            <span className="relative block h-8 w-px overflow-hidden bg-white/25">
              <span className="absolute inset-x-0 top-0 h-1/2 animate-[primeScrollCue_2.2s_ease-in-out_infinite] bg-white" />
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}

function Intro({ destinations }) {
  const { t } = useLocale();
  const stats = useMemo(() => {
    if (!destinations.length) return [];
    const properties = destinations.reduce((n, d) => n + (d.projectCount ?? d.projects?.length ?? 0), 0);
    const unitTypes = destinations.reduce((n, d) => n + (d.unitTypeCount || 0), 0);
    return [
      { value: destinations.length, label: t('home.statDestinations') },
      { value: properties, label: t('home.statProperties') },
      unitTypes ? { value: unitTypes, label: t('home.statUnitTypes') } : null,
    ].filter(Boolean);
  }, [destinations, t]);

  return (
    <section className="prime-section">
      <div className="prime-container">
        <Reveal className="mx-auto max-w-4xl text-center">
          <p className="prime-eyebrow text-prime-gold-deep">{t('home.introEyebrow')}</p>
          <h2 className="mt-7 font-display text-display-lg font-medium text-prime-ink text-balance">{t('home.introTitle')}</h2>
          <p className="prime-lede mx-auto mt-7 max-w-2xl">{t('home.introBody')}</p>
          <Link to="/about" className="prime-link mt-9">
            {t('home.ourStory')}
          </Link>
        </Reveal>

        {stats.length ? (
          <Reveal
            delay={150}
            className="mx-auto mt-16 grid max-w-3xl divide-x divide-prime-line border-y border-prime-line md:mt-24 rtl:divide-x-reverse"
            style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
          >
            {stats.map((s) => (
              <div key={s.label} className="px-3 py-8 text-center md:py-10">
                <p className="font-display text-[2.6rem] font-medium leading-none text-prime-ink md:text-[3.6rem]">{s.value}</p>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.26em] text-prime-muted">{s.label}</p>
              </div>
            ))}
          </Reveal>
        ) : null}
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
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  if (!loading && !featured.length) return null;

  return (
    <section className="prime-section overflow-hidden border-t border-prime-line">
      <div className="prime-container">
        <div className="mb-12 flex flex-col gap-8 md:mb-16 md:flex-row md:items-end md:justify-between">
          <SectionIntro eyebrow={t('home.featured')} title={t('home.featuredTitle')} className="mb-0 md:mb-0" />
          <div className="flex items-center gap-6">
            <Link to="/search" className="prime-link">
              {t('home.viewAll')}
            </Link>
            <div className="hidden gap-2 md:flex">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                aria-label="Previous stays"
                className="grid h-12 w-12 place-items-center rounded-full border border-prime-line transition hover:border-prime-ink"
              >
                <ArrowLeft size={18} strokeWidth={1.4} className="rtl:rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                aria-label="More stays"
                className="grid h-12 w-12 place-items-center rounded-full border border-prime-line transition hover:border-prime-ink"
              >
                <ArrowRight size={18} strokeWidth={1.4} className="rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>

        <div ref={trackRef} className="prime-scroll-x -mx-5 gap-5 px-5 scroll-px-5 sm:-mx-8 sm:gap-6 sm:px-8 sm:scroll-px-8 lg:-mx-12 lg:px-12 lg:scroll-px-12">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ListingCardSkeleton key={i} className={CAROUSEL_CARD} />)
            : featured.map((u) => (
                <ListingCard
                  key={u.id}
                  listing={u}
                  className={CAROUSEL_CARD}
                  sizes="(min-width: 1280px) 24vw, (min-width: 1024px) 30vw, (min-width: 640px) 44vw, 80vw"
                />
              ))}
        </div>
      </div>
    </section>
  );
}

function PropertiesSection() {
  return <CompoundGrid limit={7} homeOnly />;
}

/** Homepage blocks below the hero — order and visibility come from Admin › Website › Homepage */
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
  const [destinations, setDestinations] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api
      .getDestinations()
      .then((res) => {
        if (!cancelled) setDestinations(res.items || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <Header overHero />
      <main>
        <Hero />
        {(site.home?.sections || []).map(({ id, enabled }) => {
          if (!enabled) return null;
          const Section = SECTIONS[id];
          return Section ? <Section key={id} destinations={destinations} /> : null;
        })}
      </main>
      <Footer />
    </div>
  );
}
