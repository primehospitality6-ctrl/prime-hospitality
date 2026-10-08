import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Check, Heart, MapPin, X } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import BookingModal from '../components/booking/BookingModal';
import ListingCard from '../components/ListingCard';
import Img from '../components/ui/Img';
import PageHeader from '../components/ui/PageHeader';
import api from '../api/client';
import { GUEST_AVAILABILITY_MONTHS } from '../constants/availability';
import { formatMoney, listingWhatsAppMessage, whatsappHref } from '../theme/brand';
import { useLocale } from '../context/LocaleContext';
import { useSite } from '../context/SiteContext';
import { useWishlist } from '../context/WishlistContext';
import { applySeo } from '../components/SeoManager';
import { cn } from '../utils/cn';

const GUEST_REGULATION_KEYS = [
  'listing.reg0',
  'listing.reg1',
  'listing.reg2',
  'listing.reg3',
  'listing.reg4',
];

function localISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function Spec({ num, unit, label }) {
  return (
    <div className="px-2 py-6 text-center">
      <div className="font-display text-[2rem] font-medium leading-none text-prime-ink sm:text-[2.4rem]">
        {num}
        {unit ? <span className="ms-1 font-sans text-sm font-light text-prime-muted">{unit}</span> : null}
      </div>
      <div className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-prime-muted sm:tracking-[0.24em]">{label}</div>
    </div>
  );
}

/** Google map loads only on request — no third-party request until the guest asks for it */
function LocationSection({ property, title }) {
  const { t, term } = useLocale();
  const [showMap, setShowMap] = useState(false);
  const hasPin = property.latitude != null && property.longitude != null;
  const query = hasPin ? `${property.latitude},${property.longitude}` : [property.address, property.city].filter(Boolean).join(', ');
  const mapsHref = property.mapsUrl || (query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '');
  if (!property.address && !hasPin && !mapsHref) return null;

  return (
    <section id="location" className="mb-12 scroll-mt-40 border-b border-prime-line pb-12">
      <h2 className="font-display text-[2rem] font-medium leading-tight text-prime-ink">{t('listing.location')}</h2>
      <p className="mt-4 flex items-start gap-2.5 text-[15px] font-light text-prime-ink/85">
        <MapPin size={16} strokeWidth={1.6} className="mt-1 shrink-0 text-prime-gold" aria-hidden />
        <span>{[term(property.name), property.address || term(property.city)].filter(Boolean).join(' — ')}</span>
      </p>
      {query ? (
        <div className="relative mt-6 aspect-[16/9] overflow-hidden bg-prime-mist">
          {showMap ? (
            <iframe
              title={t('listing.mapTitle', { name: property.name || title })}
              src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="absolute inset-0 grid place-items-center text-[11px] font-medium uppercase tracking-[0.22em] text-prime-ink transition hover:bg-prime-line/40"
            >
              <span className="inline-flex items-center gap-2 border border-prime-ink/30 bg-prime-surface px-5 py-3">
                <MapPin size={14} strokeWidth={1.6} aria-hidden />
                {t('listing.showMap')}
              </span>
            </button>
          )}
        </div>
      ) : null}
      {mapsHref ? (
        <a href={mapsHref} target="_blank" rel="noreferrer" className="prime-link mt-5 inline-flex items-center gap-1.5">
          {t('listing.openInMaps')}
          <ArrowUpRight size={14} strokeWidth={1.6} aria-hidden />
        </a>
      ) : null}
    </section>
  );
}

function ExpandableText({ text, limit = 320 }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const needs = text.length > limit;
  const shown = !needs || open ? text : `${text.slice(0, limit).trim()}…`;
  return (
    <div>
      <p className="m-0 whitespace-pre-line text-[16px] font-light leading-[1.85] text-prime-ink/85">{shown}</p>
      {needs && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 text-sm font-semibold text-prime-ink underline underline-offset-4 decoration-prime-gold/60 hover:decoration-prime-gold"
        >
          {open ? t('listing.showLess') : t('listing.readMore')}
        </button>
      )}
    </div>
  );
}

function CheckRow({ children }) {
  return (
    <div className="flex items-start gap-3 text-[15px] font-light text-prime-ink">
      <Check size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-prime-gold" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export default function ListingDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, term, localeTag } = useLocale();
  const { has, toggle } = useWishlist();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [blocked, setBlocked] = useState([]);
  const [checkoutDates, setCheckoutDates] = useState([]);
  const [dailyPrices, setDailyPrices] = useState({});
  const [similar, setSimilar] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);

  const seedAdults = Number(searchParams.get('adults') || searchParams.get('guests')) || 2;
  const seedChildren = Number(searchParams.get('children')) || 0;
  const seedCheckIn = searchParams.get('checkIn') || '';
  const seedCheckOut = searchParams.get('checkOut') || '';
  const autoOpen = searchParams.get('book') === '1';

  const { site } = useSite();

  useEffect(() => {
    if (listing && autoOpen) setBookingOpen(true);
  }, [listing, autoOpen]);

  useEffect(() => {
    if (!listing) return;
    applySeo(
      {
        title: [listing.title, listing.compound].filter(Boolean).join(' — '),
        description: String(listing.description || '').replace(/\s+/g, ' ').slice(0, 160),
        image: listing.images?.[0],
      },
      site.seo
    );
  }, [listing, site.seo]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getListingBySlug(slug)
      .then((res) => {
        if (cancelled) return;
        setListing(res.item);
        setReviews(res.item?.reviews || []);
      })
      .catch(() => {
        if (!cancelled) setError(t('listing.notFoundBody'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!listing) return undefined;
    let cancelled = false;
    const from = localISO(new Date());
    const toDate = new Date();
    toDate.setMonth(toDate.getMonth() + GUEST_AVAILABILITY_MONTHS);
    const to = localISO(toDate);

    api
      .getListingAvailability(slug, { from, to })
      .then((data) => {
        if (cancelled) return;
        const nights = (data.blocked || []).map((b) => b.date);
        const occupied = new Set(nights);
        const turnover = (data.checkout_dates || []).filter((d) => !occupied.has(d));
        setBlocked(nights);
        setCheckoutDates(turnover);
      })
      .catch(() => {
        if (!cancelled) {
          setBlocked([]);
          setCheckoutDates([]);
        }
      });

    api
      .getListingPricing(slug, { from, to })
      .then((data) => {
        if (!cancelled) setDailyPrices(data.prices || {});
      })
      .catch(() => {
        if (!cancelled) setDailyPrices({});
      });

    return () => {
      cancelled = true;
    };
  }, [slug, listing, availabilityVersion]);

  useEffect(() => {
    if (!listing) return undefined;
    let cancelled = false;
    api
      .getListings({ compound: listing.compoundId || listing.compound, limit: 6 })
      .then((res) => {
        if (cancelled) return;
        const items = (res.items || []).filter((l) => l.slug !== listing.slug).slice(0, 3);
        setSimilar(items);
      })
      .catch(() => {
        if (!cancelled) setSimilar([]);
      });
    return () => {
      cancelled = true;
    };
  }, [listing]);

  useEffect(() => {
    if (!lightbox) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setLightbox(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [lightbox]);

  const photos = listing?.images || [];
  const property = listing?.property || null;
  const amenities = listing?.amenities || [];
  const ownFacilities = listing?.facilities || [];
  const facilities = ownFacilities.length ? ownFacilities : property?.facilities || [];
  const facilitiesHeading = ownFacilities.length ? t('listing.facilities') : t('listing.buildingFacilities');

  const crumbs = useMemo(() => {
    if (!listing) return [];
    const destination = listing.destination || listing.region;
    return [
      destination && {
        label: term(destination),
        to: `/search?destination=${encodeURIComponent(listing.destinationId || destination)}`,
      },
      listing.compound && {
        label: term(listing.compound),
        to: `/search?compound=${encodeURIComponent(listing.compoundId || listing.compound)}`,
      },
    ].filter(Boolean);
  }, [listing, term]);

  const displayFromPrice = useMemo(() => {
    const today = localISO();
    if (dailyPrices[today] != null) return dailyPrices[today];
    const next = Object.keys(dailyPrices)
      .sort()
      .find((iso) => iso >= today);
    if (next != null) return dailyPrices[next];
    return listing?.pricePerNight;
  }, [dailyPrices, listing]);

  const detailRows = useMemo(() => {
    if (!listing) return [];
    return [
      ...(listing.destination || listing.region
        ? [{ label: t('bm.destination'), value: term(listing.destination || listing.region) }]
        : []),
      ...(listing.compound ? [{ label: t('bm.property'), value: term(listing.compound) }] : []),
      ...(listing.unitType ? [{ label: t('listing.specUnitType'), value: term(listing.unitType) }] : []),
      ...(listing.brand ? [{ label: t('listing.specBrand'), value: term(`Prime ${listing.brand}`) }] : []),
      { label: t('listing.specGuests'), value: String(listing.maxGuests || '—') },
      { label: t('listing.specBedrooms'), value: String(listing.bedrooms ?? '—') },
      { label: t('listing.specBaths'), value: String(listing.bathrooms ?? '—') },
      { label: t('listing.specArea'), value: listing.areaSqm ? t('card.area', { count: listing.areaSqm }) : '—' },
      ...(listing.bedType ? [{ label: t('listing.specBeds'), value: term(listing.bedType) }] : []),
      ...(listing.floor ? [{ label: t('listing.specFloor'), value: term(listing.floor) }] : []),
      ...(listing.roomCount ? [{ label: t('listing.specUnitsOfType'), value: String(listing.roomCount) }] : []),
      { label: t('listing.specCheckIn'), value: t('listing.specCheckInValue') },
      { label: t('listing.specCheckOut'), value: t('listing.specCheckOutValue') },
    ];
  }, [listing, t, term]);

  const averageRating =
    listing?.averageRating ??
    (reviews.length
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : 0);
  const reviewCount = listing?.reviewCount ?? reviews.length;

  function handleBooked({ booking, pms, email }) {
    setBookingOpen(false);
    const summary = { booking, pms, email, image: photos[0] || '' };
    try {
      sessionStorage.setItem(`prime.booking.${booking.voucherNumber}`, JSON.stringify(summary));
    } catch {
      /* private mode — the router state below still carries it */
    }
    navigate(`/booking-success?voucher=${encodeURIComponent(booking.voucherNumber)}`, { state: summary });
  }

  if (loading) {
    return (
      <div>
        <Header />
        <main className="prime-container animate-pulse py-10" aria-busy="true" aria-label={t('listing.loading')}>
          <div className="h-3 w-48 bg-prime-mist" />
          <div className="mt-8 h-12 w-2/3 max-w-xl bg-prime-mist" />
          <div className="mt-10 aspect-[4/5] bg-prime-mist sm:aspect-[16/7]" />
        </main>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div>
        <Header />
        <main className="prime-container py-28 text-center">
          <PageHeader className="mx-auto max-w-xl" title={t('listing.notFound')} lede={error || t('listing.unavailable')} />
          <Link to="/search" className="prime-btn">
            {t('listing.browseStays')}
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const loved = has(listing.id);
  const hasPrice = Number(displayFromPrice) > 0;
  const waHref = whatsappHref(listingWhatsAppMessage(`/listings/${listing.slug}`));

  return (
    <div>
      <Header />
      <main className="pb-28 lg:pb-0">
        <div className="prime-container">
          <nav aria-label={t('search.breadcrumb')} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-6 text-[11px] font-medium uppercase tracking-[0.2em] text-prime-muted">
            <Link to="/" className="transition hover:text-prime-ink">
              {t('listing.egypt')}
            </Link>
            {crumbs.map((crumb) => (
              <span key={crumb.to} className="flex items-center gap-2">
                <span aria-hidden className="text-prime-line">/</span>
                <Link to={crumb.to} className="transition hover:text-prime-ink">
                  {crumb.label}
                </Link>
              </span>
            ))}
            <span aria-hidden className="text-prime-line">/</span>
            <span className="text-prime-ink">{term(listing.unitType || listing.title)}</span>
          </nav>

          <div className="mb-8 flex flex-wrap items-end justify-between gap-6 md:mb-10">
            <div className="max-w-3xl">
              <p className="prime-eyebrow text-prime-gold-deep">
                {[listing.brand && `Prime ${listing.brand}`, listing.destination || listing.region]
                  .filter(Boolean)
                  .map(term)
                  .join(' · ')}
              </p>
              <h1 className="mt-4 font-display text-display-lg font-medium text-prime-ink text-balance">{term(listing.title)}</h1>
              <p className="mt-4 text-[15px] font-light text-prime-muted">
                <span className="font-normal text-prime-ink">{term(listing.unitType)}</span>
                {[listing.compound, listing.city].filter(Boolean).length
                  ? ` · ${[listing.compound, listing.city].filter(Boolean).map(term).join(t('common.listSep'))}`
                  : ''}
                {reviewCount > 0 ? (
                  <>
                    {' · '}
                    <span className="text-prime-gold-deep">★ {averageRating.toFixed(1)}</span>{' '}
                    {t('listing.reviewCount', { count: reviewCount })}
                  </>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggle(listing.id)}
              aria-pressed={loved}
              className={cn(
                'inline-flex min-h-[2.75rem] items-center gap-2.5 rounded-full border px-5 text-[11px] font-medium uppercase tracking-[0.2em] transition',
                loved
                  ? 'border-prime-gold bg-prime-gold/10 text-prime-gold-deep'
                  : 'border-prime-line text-prime-ink hover:border-prime-ink'
              )}
            >
              <Heart size={15} strokeWidth={1.6} fill={loved ? 'currentColor' : 'none'} />
              {loved ? t('listing.saved') : t('listing.save')}
            </button>
          </div>

          <div className="relative mb-10 md:mb-14">
            <div className="hidden gap-2 md:grid md:grid-cols-[2fr_1fr_1fr] md:grid-rows-[250px_250px] lg:grid-rows-[300px_300px]">
              <button
                type="button"
                onClick={() => setLightbox(true)}
                className="group relative row-span-2 overflow-hidden bg-prime-mist text-start"
              >
                <Img
                  src={photos[0]}
                  alt={listing.title}
                  priority
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="absolute inset-0 h-full w-full object-cover transition duration-[1400ms] ease-prime group-hover:scale-[1.03]"
                />
              </button>
              {photos.slice(1, 5).map((src, i) => (
                <button
                  type="button"
                  key={`${src}-${i}`}
                  onClick={() => setLightbox(true)}
                  className="group relative overflow-hidden bg-prime-mist"
                >
                  <Img
                    src={src}
                    alt={t('listing.photoAlt', { title: listing.title, n: i + 2 })}
                    sizes="25vw"
                    widths={[400, 640, 900]}
                    className="absolute inset-0 h-full w-full object-cover transition duration-[1400ms] ease-prime group-hover:scale-[1.05]"
                  />
                </button>
              ))}
            </div>

            <div className="prime-scroll-x -mx-5 gap-2 px-5 sm:-mx-8 sm:px-8 md:hidden">
              {photos.slice(0, 8).map((src, i) => (
                <button
                  type="button"
                  key={`${src}-m-${i}`}
                  onClick={() => setLightbox(true)}
                  className="relative aspect-[4/5] w-[86%] flex-none snap-start overflow-hidden bg-prime-mist sm:aspect-[4/3]"
                >
                  <Img
                    src={src}
                    alt={i === 0 ? listing.title : t('listing.photoAlt', { title: listing.title, n: i + 1 })}
                    priority={i === 0}
                    sizes="86vw"
                    widths={[480, 768, 1080]}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="absolute bottom-4 end-4 hidden bg-white/95 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-[#221f20] transition hover:bg-white md:inline-flex"
            >
              {t('listing.showAllPhotos', { count: photos.length })}
            </button>
          </div>

          <nav className="sticky top-[var(--prime-header-h)] z-30 mb-10 hidden border-b border-prime-line bg-prime-sand/95 backdrop-blur-md md:block">
            <div className="flex gap-8 text-[11px] font-medium uppercase tracking-[0.22em] text-prime-muted">
              {[
                ['#about', t('listing.description')],
                ['#details', t('listing.details')],
                ['#features', t('listing.amenitiesHeading')],
                ...(property && (property.address || property.mapsUrl || property.latitude != null)
                  ? [['#location', t('listing.location')]]
                  : []),
                ['#reviews', t('listing.reviews')],
                ['#rules', t('listing.houseRules')],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="py-4 transition hover:text-prime-ink"
                >
                  {label}
                </a>
              ))}
            </div>
          </nav>

          <div className="grid grid-cols-1 gap-12 pb-20 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-20">
            <div className="min-w-0">
              <section
                className={cn(
                  'mb-12 grid divide-x divide-prime-line border-y border-prime-line rtl:divide-x-reverse',
                  listing.areaSqm ? 'grid-cols-4' : 'grid-cols-3'
                )}
              >
                <Spec num={String(listing.maxGuests || '—')} label={t('listing.specGuests')} />
                <Spec num={String(listing.bedrooms ?? '—')} label={t('listing.specBedrooms')} />
                <Spec num={String(listing.bathrooms ?? '—')} label={t('listing.specBaths')} />
                {listing.areaSqm ? (
                  <Spec num={String(listing.areaSqm)} unit={t('listing.specSize')} label={t('listing.specArea')} />
                ) : null}
              </section>

              <section id="about" className="mb-12 scroll-mt-40 border-b border-prime-line pb-12">
                <h2 className="font-display text-[2rem] font-medium leading-tight text-prime-ink">
                  {t('listing.description')}
                </h2>
                <div className="mt-5">
                  <ExpandableText text={listing.description} />
                </div>
              </section>

              <section id="details" className="mb-12 scroll-mt-40 border-b border-prime-line pb-12">
                <h2 className="font-display text-[2rem] font-medium leading-tight text-prime-ink">
                  {t('listing.details')}
                </h2>
                <dl className="mt-5 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                  {detailRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex justify-between gap-4 border-b border-prime-line py-3.5 text-[15px]"
                    >
                      <dt className="font-light text-prime-muted">{row.label}</dt>
                      <dd className="m-0 text-end text-prime-ink">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section id="features" className="mb-12 scroll-mt-40 border-b border-prime-line pb-12">
                <h2 className="font-display text-[2rem] font-medium leading-tight text-prime-ink">
                  {t('listing.features')}
                </h2>
                {!!amenities.length && (
                  <div className="mt-6">
                    <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.26em] text-prime-muted">
                      {t('listing.amenitiesHeading')}
                    </h3>
                    <div className="mb-9 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      {amenities.map((a) => (
                        <CheckRow key={a}>{term(a)}</CheckRow>
                      ))}
                    </div>
                  </div>
                )}

                {!!facilities.length && (
                  <div>
                    <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.26em] text-prime-muted">
                      {facilitiesHeading}
                    </h3>
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      {facilities.map((f) => (
                        <CheckRow key={f}>{term(f)}</CheckRow>
                      ))}
                    </div>
                  </div>
                )}

                {!amenities.length && !facilities.length && (
                  <p className="mt-5 text-sm text-prime-muted">{t('listing.amenitiesEmpty')}</p>
                )}
              </section>

              {property ? <LocationSection property={property} title={listing.title} /> : null}

              <section id="reviews" className="mb-12 scroll-mt-40 border-b border-prime-line pb-12">
                <h2 className="font-display text-[2rem] font-medium leading-tight text-prime-ink">
                  {t('listing.reviews')}
                </h2>
                {reviewCount > 0 ? (
                  <p className="mt-3 text-[15px] font-light text-prime-muted">
                    <span className="text-prime-gold-deep">★ {averageRating.toFixed(1)}</span> ·{' '}
                    {t('listing.reviewCount', { count: reviews.length })}
                  </p>
                ) : null}
                {reviews.length === 0 ? (
                  <p className="mt-5 text-[15px] font-light text-prime-muted">{t('listing.noReviews')}</p>
                ) : (
                  <div className="mt-8 grid gap-x-10 gap-y-10 md:grid-cols-2">
                    {reviews.map((rev) => (
                      <figure key={rev.id}>
                        <p className="text-[13px] tracking-[0.2em] text-prime-gold" aria-label={t('listing.ratingOutOf', { rating: rev.rating })}>
                          {'★'.repeat(Math.round(rev.rating || 0))}
                        </p>
                        <blockquote className="mt-3 font-display text-[1.35rem] font-medium italic leading-snug text-prime-ink">
                          “{rev.comment}”
                        </blockquote>
                        <figcaption className="mt-4 text-[11px] font-medium uppercase tracking-[0.22em] text-prime-muted">
                          {rev.guestName}
                          {rev.createdAt
                            ? ` · ${new Date(`${rev.createdAt}T00:00:00`).toLocaleDateString(localeTag, {
                                month: 'short',
                                year: 'numeric',
                              })}`
                            : ''}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </section>

              <section id="rules" className="mb-12 scroll-mt-40 border-b border-prime-line pb-12">
                <h2 className="font-display text-[2rem] font-medium leading-tight text-prime-ink">
                  {t('listing.houseRules')}
                </h2>
                <ul className="mt-5 space-y-2.5 p-0 text-sm">
                  <li>
                    <CheckRow>{t('listing.checkInAfter')}</CheckRow>
                  </li>
                  <li>
                    <CheckRow>{t('listing.checkOutBefore')}</CheckRow>
                  </li>
                  <li>
                    <CheckRow>{t('listing.noSmoking')}</CheckRow>
                  </li>
                  <li>
                    <CheckRow>{t('listing.noParties')}</CheckRow>
                  </li>
                  <li>
                    <CheckRow>{t('listing.guestsMax', { count: listing.maxGuests || 8 })}</CheckRow>
                  </li>
                </ul>
              </section>

              <section className="mb-4 pb-4">
                <h2 className="font-display text-[2rem] font-medium leading-tight text-prime-ink">
                  {t('listing.guestRegulations')}
                </h2>
                <ul className="mt-5 space-y-3 p-0 text-sm">
                  {GUEST_REGULATION_KEYS.map((key) => (
                    <li key={key}>
                      <CheckRow>{t(key)}</CheckRow>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <aside className="hidden h-fit bg-prime-surface p-8 shadow-premium lg:sticky lg:top-[calc(var(--prime-header-h)+5rem)] lg:block">
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-prime-muted">{t('listing.reservation')}</p>
              {hasPrice ? (
                <>
                  <p className="mt-4 font-display text-[2.6rem] font-medium leading-none tabular-nums text-prime-ink">
                    {formatMoney(displayFromPrice, listing.currency)}
                  </p>
                  <p className="mt-2 text-[13px] font-light text-prime-muted">{t('listing.perNightNote')}</p>
                </>
              ) : (
                <p className="mt-4 font-display text-[2rem] font-medium leading-tight text-prime-ink">{t('listing.priceOnRequest')}</p>
              )}
              <div className="my-7 h-px bg-prime-line" />
              <div className="flex flex-col gap-3">
                <button type="button" className="prime-btn w-full" onClick={() => setBookingOpen(true)}>
                  {t('listing.bookNow')}
                </button>
                <a href={waHref} target="_blank" rel="noreferrer" className="prime-btn-outline w-full">
                  {t('listing.whatsappInquiry')}
                </a>
              </div>
              <p className="mt-6 text-center text-[12px] font-light leading-relaxed text-prime-muted">
                {t('listing.bookDirectNote')}
              </p>
            </aside>
          </div>
        </div>

        {similar.length > 0 && (
          <section className="border-t border-prime-line bg-prime-mist/50 py-20 md:py-28">
            <div className="prime-container">
              <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="prime-eyebrow text-prime-gold-deep">{term(listing.compound)}</p>
                  <h2 className="mt-4 font-display text-display-md font-medium text-prime-ink">{t('listing.similarRent')}</h2>
                </div>
                <Link to="/search" className="prime-link">
                  {t('listing.viewAll')}
                </Link>
              </div>
              <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8">
                {similar.map((item) => (
                  <ListingCard key={item.id} listing={item} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-prime-line bg-prime-surface/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-prime items-center gap-4">
          <div className="min-w-0 flex-1">
            {hasPrice ? (
              <>
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-prime-muted">{t('card.from')}</p>
                <p className="truncate font-display text-[1.5rem] font-medium leading-tight tabular-nums text-prime-ink">
                  {formatMoney(displayFromPrice, listing.currency)}
                  <span className="ms-1 font-sans text-[12px] font-light text-prime-muted">{t('card.perNight')}</span>
                </p>
              </>
            ) : (
              <p className="truncate font-display text-[1.25rem] font-medium leading-tight text-prime-ink">{t('listing.priceOnRequest')}</p>
            )}
          </div>
          <button type="button" className="prime-btn shrink-0 px-7" onClick={() => setBookingOpen(true)}>
            {t('listing.bookNow')}
          </button>
        </div>
      </div>

      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        listing={listing}
        blockedDates={blocked}
        checkoutDates={checkoutDates}
        dailyPrices={dailyPrices}
        initialCheckIn={seedCheckIn}
        initialCheckOut={seedCheckOut}
        initialAdults={seedAdults}
        initialChildren={seedChildren}
        onBooked={handleBooked}
        onDatesTaken={() => setAvailabilityVersion((v) => v + 1)}
      />

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('listing.showAllPhotos', { count: photos.length })}
          className="fixed inset-0 z-[280] flex flex-col bg-[#161414]"
          style={{ animation: 'primeFadeIn 0.4s var(--prime-ease) both' }}
        >
          <div className="flex items-center justify-between px-5 py-4 text-white sm:px-8">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/70">
              {listing.title} · {photos.length}
            </p>
            <button
              type="button"
              onClick={() => setLightbox(false)}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/25 transition hover:border-white"
              aria-label={t('common.close')}
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-10 sm:px-8">
            <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-2">
              {photos.map((src, i) => (
                <div key={`lb-${src}-${i}`} className={cn('overflow-hidden bg-white/5', i % 3 === 0 && 'md:col-span-2')}>
                  <Img
                    src={src}
                    alt={t('listing.photoAlt', { title: listing.title, n: i + 1 })}
                    sizes={i % 3 === 0 ? '(min-width: 1024px) 1024px, 100vw' : '(min-width: 1024px) 512px, (min-width: 768px) 50vw, 100vw'}
                    className="w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
