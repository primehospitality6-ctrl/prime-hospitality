import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import PageHero from '../components/ui/PageHero';
import Img from '../components/ui/Img';
import Reveal from '../components/ui/Reveal';
import { useLocale } from '../context/LocaleContext';
import api from '../api/client';
import { cn } from '../utils/cn';

const HERO = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2400&q=72';

const shortName = (name) => name.replace(/^Prime\s+(Inn|Residence|Select)\s+/i, '');

function PropertyCard({ property, destination, lead }) {
  const { t, term } = useLocale();
  const href = `/search?destination=${encodeURIComponent(destination.id)}&compound=${encodeURIComponent(property.id)}`;
  return (
    <Link to={href} className="group block">
      <div className={cn('relative overflow-hidden bg-prime-mist', lead ? 'aspect-[4/3] sm:aspect-[16/9]' : 'aspect-[4/3]')}>
        <Img
          src={property.image}
          alt=""
          sizes={lead ? '(min-width: 1024px) 60vw, 100vw' : '(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw'}
          className="h-full w-full object-cover transition-transform duration-[1400ms] ease-prime group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
        {property.brand ? (
          <span className="absolute start-4 top-4 bg-white/90 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-brand-black backdrop-blur-sm">
            {term(`Prime ${property.brand}`)}
          </span>
        ) : null}
        <span className="absolute bottom-4 end-4 grid h-11 w-11 translate-y-2 place-items-center rounded-full bg-white text-brand-black opacity-0 transition duration-500 ease-prime group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowRight size={16} strokeWidth={1.5} className="rtl:-scale-x-100" />
        </span>
      </div>
      <div className="flex items-end justify-between gap-4 pt-5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.24em] text-prime-muted">
            {[term(property.city || destination.name), t('home.unitTypesCount', { count: property.unitCount || 0 })]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <h3
            className={cn(
              'mt-2 font-display font-medium leading-tight text-prime-ink transition-colors group-hover:text-prime-gold-deep',
              lead ? 'text-[1.9rem] md:text-[2.3rem]' : 'text-[1.6rem]'
            )}
          >
            {term(shortName(property.name))}
          </h3>
        </div>
      </div>
    </Link>
  );
}

function DestinationBlock({ destination, index, properties }) {
  const { t, term } = useLocale();
  const unitTypes = properties.reduce((sum, p) => sum + (p.unitCount || 0), 0);
  return (
    <section id={`dest-${destination.id}`} className="scroll-mt-[calc(var(--prime-header-h)+5rem)] border-t border-prime-line pt-10 md:pt-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
        <Reveal className="lg:sticky lg:top-[calc(var(--prime-header-h)+6.5rem)] lg:self-start">
          <span className="font-display text-[3.5rem] font-medium leading-none text-prime-gold/70 md:text-[4.5rem]">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h2 className="mt-4 font-display text-display-md font-medium text-prime-ink text-balance">{term(destination.name)}</h2>
          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.26em] text-prime-muted">
            {t('home.propertiesCount', { count: properties.length })}
            {unitTypes ? ` · ${t('home.unitTypesCount', { count: unitTypes })}` : ''}
          </p>
          {destination.description ? (
            <p className="mt-5 max-w-sm text-[15px] font-light leading-[1.8] text-prime-muted">{destination.description}</p>
          ) : null}
          <Link to={`/search?destination=${encodeURIComponent(destination.id)}`} className="prime-link mt-7">
            {t('home.viewStaysIn', { name: term(destination.name) })}
          </Link>
        </Reveal>

        <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2">
          {properties.map((p, j) => (
            <Reveal key={p.id} delay={(j % 2) * 90} className={cn(j === 0 && properties.length % 2 === 1 && 'sm:col-span-2')}>
              <PropertyCard property={p} destination={destination} lead={j === 0 && properties.length % 2 === 1} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Chip({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 snap-start items-center gap-2 border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.2em] transition',
        active
          ? 'border-prime-ink bg-prime-ink text-prime-sand'
          : 'border-prime-line bg-prime-surface text-prime-ink hover:border-prime-ink'
      )}
    >
      {children}
      {count != null ? <span className={cn('tabular-nums', active ? 'text-prime-gold-soft' : 'text-prime-muted')}>{count}</span> : null}
    </button>
  );
}

export default function PropertiesPage() {
  const { t, term } = useLocale();
  const [params, setParams] = useSearchParams();
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeDest = params.get('destination') || '';
  const activeBrand = params.get('brand') || '';

  useEffect(() => {
    let cancelled = false;
    api
      .getDestinations()
      .then((res) => {
        if (!cancelled) setDestinations(res.items || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const brands = useMemo(() => {
    const set = new Set();
    destinations.forEach((d) => (d.projects || []).forEach((p) => p.brand && set.add(p.brand)));
    return [...set];
  }, [destinations]);

  const stats = useMemo(() => {
    const projects = destinations.flatMap((d) => d.projects || []);
    return {
      destinations: destinations.length,
      properties: projects.length,
      unitTypes: projects.reduce((sum, p) => sum + (p.unitCount || 0), 0),
    };
  }, [destinations]);

  const visible = useMemo(
    () =>
      destinations
        .filter((d) => !activeDest || d.id === activeDest)
        .map((d) => ({
          destination: d,
          properties: (d.projects || []).filter((p) => !activeBrand || p.brand === activeBrand),
        }))
        .filter((g) => g.properties.length),
    [destinations, activeDest, activeBrand]
  );

  function patch(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <div>
      <Header overHero />
      <main>
        <PageHero
          image={HERO}
          eyebrow={t('home.brandsEyebrow')}
          title={t('properties.title')}
          lede={t('properties.lede')}
        >
          {stats.properties ? (
            <dl className="prime-fade-up mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/20 pt-6" style={{ animationDelay: '240ms' }}>
              {[
                [stats.destinations, t('home.statDestinations')],
                [stats.properties, t('home.statProperties')],
                [stats.unitTypes, t('home.statUnitTypes')],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="font-display text-[2.4rem] font-medium leading-none tabular-nums">{value}</dd>
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.26em] text-white/70">{label}</p>
                </div>
              ))}
            </dl>
          ) : null}
        </PageHero>

        <div className="sticky top-[var(--prime-header-h)] z-30 border-b border-prime-line bg-prime-sand/95 backdrop-blur-md">
          <div className="prime-container flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="prime-scroll-x -mx-5 gap-2 px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0">
              <Chip active={!activeDest} onClick={() => patch('destination', '')} count={stats.properties || null}>
                {t('properties.all')}
              </Chip>
              {destinations.map((d) => (
                <Chip
                  key={d.id}
                  active={activeDest === d.id}
                  onClick={() => patch('destination', activeDest === d.id ? '' : d.id)}
                  count={d.projects?.length ?? d.projectCount}
                >
                  {term(d.name)}
                </Chip>
              ))}
            </div>
            {brands.length > 1 ? (
              <div className="flex max-w-full flex-wrap items-center gap-1 text-[11px] font-medium uppercase tracking-[0.2em]" role="group" aria-label={t('listing.specBrand')}>
                {['', ...brands].map((b) => (
                  <button
                    key={b || 'all'}
                    type="button"
                    onClick={() => patch('brand', b)}
                    aria-pressed={activeBrand === b}
                    className={cn(
                      'relative min-h-[44px] px-3 py-2 transition',
                      activeBrand === b ? 'text-prime-ink' : 'text-prime-muted hover:text-prime-ink'
                    )}
                  >
                    {b ? term(`Prime ${b}`) : t('filters.allBrands')}
                    <span
                      className={cn(
                        'absolute inset-x-3 bottom-0.5 h-px bg-prime-gold transition-transform duration-500 ease-prime',
                        activeBrand === b ? 'scale-x-100' : 'scale-x-0'
                      )}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="prime-container space-y-20 pb-28 pt-14 md:space-y-28 md:pt-20">
          {loading ? (
            <div className="grid animate-pulse gap-10 lg:grid-cols-[4fr_8fr] lg:gap-16">
              <div className="space-y-4">
                <div className="h-14 w-20 bg-prime-mist" />
                <div className="h-10 w-2/3 bg-prime-mist" />
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="aspect-[4/3] bg-prime-mist" />
                <div className="aspect-[4/3] bg-prime-mist" />
              </div>
            </div>
          ) : visible.length ? (
            visible.map((g) => (
              <DestinationBlock
                key={g.destination.id}
                destination={g.destination}
                index={destinations.indexOf(g.destination)}
                properties={g.properties}
              />
            ))
          ) : (
            <div className="border-y border-prime-line px-6 py-20 text-center">
              <p className="font-display text-display-md font-medium text-prime-ink">{t('properties.emptyTitle')}</p>
              <p className="mx-auto mt-4 max-w-md text-[15px] font-light text-prime-muted">{t('properties.emptyBody')}</p>
              <button type="button" onClick={() => setParams({}, { replace: true })} className="prime-btn-outline mt-8">
                {t('properties.showAll')}
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
