import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, LayoutGrid, List } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import ListingCard, { ListingCardSkeleton, ListingRow } from '../components/ListingCard';
import { whatsappHref } from '../theme/brand';
import PlaceCapsules from '../components/search/PlaceCapsules';
import StaysFiltersBar, {
  ActiveFilterPills,
  StaysFiltersSheet,
  findDestination,
} from '../components/search/StaysFilters';
import api from '../api/client';
import { useLocale } from '../context/LocaleContext';
import { useSite } from '../context/SiteContext';
import { cn } from '../utils/cn';

const SORT_OPTIONS = [
  { id: 'recommended', label: 'search.sortRecommended' },
  { id: 'price-asc', label: 'search.sortPriceAsc' },
  { id: 'price-desc', label: 'search.sortPriceDesc' },
  { id: 'beds-desc', label: 'search.sortBeds' },
];

const PAGE_SIZE = 12;
const CONCIERGE_AFTER = 6;

const shortName = (name = '') => name.replace(/^Prime\s+(Inn|Residence|Select)\s+/i, '');

function ConciergeBand() {
  const { t } = useLocale();
  return (
    <div className="col-span-full relative isolate overflow-hidden bg-brand-black px-8 py-14 text-white sm:px-12 md:grid md:grid-cols-[1.4fr_auto] md:items-end md:gap-16 md:px-16 md:py-20">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(140,112,77,0.18),transparent_55%)]" aria-hidden />
      <div className="relative">
        <p className="prime-eyebrow text-prime-gold-soft">{t('search.concierge')}</p>
        <p className="mt-5 max-w-xl font-display text-[2rem] font-extralight leading-[1.15] tracking-[-0.03em] md:text-[2.6rem]">
          {t('search.conciergeTitle')}
        </p>
      </div>
      <a
        href={whatsappHref(t('search.conciergeMsg'))}
        target="_blank"
        rel="noreferrer"
        className="prime-btn-gold relative mt-8 justify-self-start md:mt-0 md:justify-self-end"
      >
        {t('search.askWhatsapp')}
      </a>
    </div>
  );
}

export default function SearchPage() {
  const { t, term } = useLocale();
  const { site } = useSite();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [destinations, setDestinations] = useState([]);
  const [unitTypes, setUnitTypes] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [shown, setShown] = useState(PAGE_SIZE);
  const sortRef = useRef(null);
  const view = params.get('view') === 'list' ? 'list' : 'grid';

  useEffect(() => {
    if (!sortOpen) return undefined;
    const onDown = (e) => {
      if (!sortRef.current?.contains(e.target)) setSortOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setSortOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [sortOpen]);

  const filterKey = JSON.stringify({
    destination: params.get('destination') || params.get('region') || '',
    compound: params.get('compound') || '',
    unitType: params.get('unitType') || '',
    guests: params.get('guests') || '',
    checkIn: params.get('checkIn') || '',
    checkOut: params.get('checkOut') || '',
    q: params.get('q') || '',
    sort: params.get('sort') || 'recommended',
  });
  const filters = useMemo(() => JSON.parse(filterKey), [filterKey]);

  const destination = findDestination(destinations, filters.destination);

  /** Destinations at the top level; inside a destination, its properties */
  const placeCapsules = useMemo(() => {
    if (destination) {
      return (destination.projects || []).map((p) => ({ id: p.id, name: p.name }));
    }
    return destinations.map((d) => ({ id: d.id, name: d.name, count: d.projectCount }));
  }, [destinations, destination]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getDestinations(), api.getMeta()])
      .then(([dRes, mRes]) => {
        if (cancelled) return;
        setDestinations(dRes.items || []);
        setUnitTypes(mRes.unitTypes || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setShown(PAGE_SIZE);
    const { sort: _sort, checkIn: _ci, checkOut: _co, ...apiFilters } = filters;
    api
      .getListings(apiFilters)
      .then((res) => {
        if (cancelled) return;
        let next = [...(res.items || [])];
        if (filters.sort === 'price-asc') {
          next.sort((a, b) => a.pricePerNight - b.pricePerNight);
        } else if (filters.sort === 'price-desc') {
          next.sort((a, b) => b.pricePerNight - a.pricePerNight);
        } else if (filters.sort === 'beds-desc') {
          next.sort((a, b) => b.bedrooms - a.bedrooms);
        } else {
          next.sort((a, b) => Number(b.featured) - Number(a.featured));
        }
        setItems(next);
        setTotal(res.total ?? next.length);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  function patchParams(patch) {
    const next = new URLSearchParams(params);
    if ('destination' in patch) next.delete('region');
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setParams(next);
  }

  function clearFilters() {
    const next = new URLSearchParams();
    if (filters.sort && filters.sort !== 'recommended') next.set('sort', filters.sort);
    if (view === 'list') next.set('view', 'list');
    setParams(next);
  }

  function removeFilter(key) {
    if (key === 'dates') patchParams({ checkIn: '', checkOut: '' });
    else if (key === 'destination') patchParams({ destination: '', compound: '' });
    else patchParams({ [key]: '' });
  }

  function selectPlace(placeId) {
    if (destination) patchParams({ compound: placeId });
    else patchParams({ destination: placeId, compound: '' });
  }

  const sortLabel = t(SORT_OPTIONS.find((o) => o.id === filters.sort)?.label || 'search.sortRecommended');

  const property = filters.compound
    ? (destination ? [destination] : destinations)
        .flatMap((d) => d.projects || [])
        .find((p) => p.id === filters.compound)
    : null;

  const heading = property
    ? term(shortName(property.name))
    : destination
      ? t('search.staysIn', { name: term(destination.name) })
      : t('search.allStays');

  const contextText = property?.description || destination?.description;
  const heroImage = property?.image || destination?.image || site.pages?.search?.heroImage || '';
  const pageItems = items.slice(0, shown);

  function setView(next) {
    const p = new URLSearchParams(params);
    if (next === 'list') p.set('view', 'list');
    else p.delete('view');
    setParams(p, { replace: true });
  }

  return (
    <div className="min-h-screen bg-prime-sand">
      <Header overHero />
      <main>
        <section className="relative isolate overflow-hidden bg-brand-black text-white">
          {heroImage ? (
            <>
              <img src={heroImage} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-black via-brand-black/75 to-brand-black/50" />
            </>
          ) : (
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(140,112,77,0.25),transparent_55%)]" />
          )}
          <div className="prime-container pb-16 pt-28 md:pb-24 md:pt-36">
            <nav aria-label={t('search.breadcrumb')} className="mb-8 flex flex-wrap items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.26em] text-white/50">
              <Link to="/" className="transition hover:text-white">{t('search.home')}</Link>
              <span aria-hidden>/</span>
              {destination || property ? (
                <button type="button" onClick={() => patchParams({ destination: '', compound: '' })} className="uppercase transition hover:text-white">
                  {t('search.stays')}
                </button>
              ) : (
                <span className="text-white/90">{t('search.stays')}</span>
              )}
              {destination ? (
                <>
                  <span aria-hidden>/</span>
                  {property ? (
                    <button type="button" onClick={() => patchParams({ compound: '' })} className="uppercase transition hover:text-white">
                      {term(destination.name)}
                    </button>
                  ) : (
                    <span className="text-white/90">{term(destination.name)}</span>
                  )}
                </>
              ) : null}
              {property ? (
                <>
                  <span aria-hidden>/</span>
                  <span className="text-white/90">{term(shortName(property.name))}</span>
                </>
              ) : null}
            </nav>

            <div className="max-w-4xl">
              <p className="prime-eyebrow text-prime-gold-soft">
                {property?.brand ? term(`Prime ${property.brand}`) : t('search.bookDirect')}
              </p>
              <h1 className="mt-5 font-display text-display-xl font-extralight text-balance">{heading}</h1>
              {contextText ? <p className="mt-6 max-w-xl text-[15px] font-light leading-[1.85] text-white/65 md:text-[16.5px]">{contextText}</p> : null}
              <p className="mt-7 text-[11px] font-medium uppercase tracking-[0.24em] text-white/45" aria-live="polite">
                {loading ? t('search.searching') : t(total === 1 ? 'search.countOne' : 'search.countMany', { count: total })}
              </p>
            </div>
          </div>
        </section>

        <div className="sticky top-[var(--prime-header-h)] z-30 border-b border-prime-line/60 bg-prime-sand/90 backdrop-blur-xl">
          <div className="prime-container space-y-3 py-3 md:py-4">
            <StaysFiltersBar
              filters={filters}
              destinations={destinations}
              unitTypes={unitTypes}
              onChange={patchParams}
              onClear={clearFilters}
              onOpenSheet={() => setSheetOpen(true)}
            />

            <PlaceCapsules
              places={placeCapsules}
              selectedId={destination ? filters.compound : ''}
              onSelect={selectPlace}
              onOpenFilters={() => setSheetOpen(true)}
              allLabel={destination ? t('search.allIn', { name: term(destination.name) }) : t('search.allDestinations')}
              emptyLabel={t('search.noProperties')}
              backLabel={t('home.destinations')}
              onBack={destination ? () => patchParams({ destination: '', compound: '' }) : undefined}
              className="md:hidden"
            />
          </div>
        </div>

        <div className="prime-container pb-28 pt-8 md:pt-10">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-3">
            <ActiveFilterPills
              filters={filters}
              destinations={destinations}
              onRemove={removeFilter}
              onClear={clearFilters}
            />

            <div className="ms-auto flex items-center gap-5">
              <div className="hidden items-center border border-prime-line sm:flex" role="group" aria-label={t('search.layout')}>
                {[
                  ['grid', LayoutGrid, t('search.gridView')],
                  ['list', List, t('search.listView')],
                ].map(([id, Icon, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setView(id)}
                    aria-pressed={view === id}
                    aria-label={label}
                    className={cn(
                      'grid h-9 w-9 place-items-center transition',
                      view === id ? 'bg-prime-ink text-prime-sand' : 'text-prime-muted hover:text-prime-ink'
                    )}
                  >
                    <Icon size={15} strokeWidth={1.5} />
                  </button>
                ))}
              </div>

              <div ref={sortRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSortOpen((o) => !o)}
                  aria-expanded={sortOpen}
                  className="inline-flex items-center gap-2 py-2 text-[11px] font-medium uppercase tracking-[0.22em] text-prime-ink transition hover:text-prime-gold-deep"
                >
                  <span className="text-prime-muted">{t('search.sort')}</span> {sortLabel}
                  <ChevronDown size={14} className={cn('transition', sortOpen && 'rotate-180')} />
                </button>
                {sortOpen ? (
                  <div className="absolute end-0 top-full z-20 mt-2 min-w-[220px] overflow-hidden border border-prime-line bg-prime-surface py-1 shadow-premium-lg">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          patchParams({ sort: opt.id === 'recommended' ? '' : opt.id });
                          setSortOpen(false);
                        }}
                        className={cn(
                          'block w-full px-4 py-2.5 text-start text-sm transition hover:bg-prime-mist',
                          filters.sort === opt.id ? 'font-semibold text-prime-ink' : 'text-prime-muted'
                        )}
                      >
                        {t(opt.label)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div
            className={cn(
              'grid grid-cols-1',
              view === 'list'
                ? 'gap-y-10 md:gap-y-16'
                : 'grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-12'
            )}
          >
            {loading &&
              Array.from({ length: view === 'list' ? 3 : 6 }).map((_, i) => <ListingCardSkeleton key={i} row={view === 'list'} />)}
            {!loading &&
              pageItems.map((u, i) => (
                <Fragment key={u.id}>
                  {view === 'list' ? (
                    <ListingRow listing={u} priority={i < 1} />
                  ) : (
                    <ListingCard listing={u} priority={i < 3} />
                  )}
                  {i === CONCIERGE_AFTER - 1 && items.length > CONCIERGE_AFTER ? <ConciergeBand /> : null}
                </Fragment>
              ))}
            {!loading && !items.length && (
              <div className="col-span-full border-y border-prime-line px-6 py-20 text-center">
                <p className="font-display text-display-md font-medium text-prime-ink">{t('search.emptyTitle')}</p>
                <p className="mx-auto mt-4 max-w-md text-[15px] font-light text-prime-muted">{t('search.emptyBody')}</p>
                <button type="button" onClick={clearFilters} className="prime-btn-outline mt-8">
                  {t('search.clearFilters')}
                </button>
              </div>
            )}
          </div>

          {!loading && items.length > shown ? (
            <div className="mt-16 flex flex-col items-center gap-5 text-center">
              <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-prime-muted">
                {t('search.showing', { shown, total: items.length })}
              </p>
              <div className="h-px w-40 bg-prime-line">
                <div className="h-px bg-prime-gold" style={{ width: `${(shown / items.length) * 100}%` }} />
              </div>
              <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className="prime-btn-outline">
                {t('search.showMore')}
              </button>
            </div>
          ) : null}
        </div>
      </main>

      {sheetOpen ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label={t('search.closeFilters')}
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="absolute inset-y-0 end-0 w-full max-w-md shadow-2xl"
            style={{ animation: 'primeSlideIn 0.45s var(--prime-ease) both' }}
          >
            <StaysFiltersSheet
              filters={filters}
              destinations={destinations}
              unitTypes={unitTypes}
              onChange={patchParams}
              onClear={clearFilters}
              onClose={() => setSheetOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  );
}
