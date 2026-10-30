import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';
import Img from './ui/Img';
import api from '../api/client';
import { subBrand } from '../theme/brand';
import { useCurrency } from '../context/CurrencyContext';
import { useWishlist } from '../context/WishlistContext';
import { useLocale } from '../context/LocaleContext';
import { findBrand, useBrands } from '../context/SiteContext';
import { cn } from '../utils/cn';

const GRID_SIZES = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw';

function specsOf(listing, t) {
  return [
    listing.bedrooms === 0 && /studio/i.test(listing.title || '')
      ? t('card.studio')
      : listing.bedrooms > 0 && t(listing.bedrooms === 1 ? 'card.bedroom' : 'card.bedrooms', { count: listing.bedrooms }),
    listing.maxGuests && t('card.guests', { count: listing.maxGuests }),
    listing.areaSqm && t('card.area', { count: listing.areaSqm }),
  ].filter(Boolean);
}

function metaOf(listing, term) {
  return [listing.unitType || listing.propertyType, listing.compound, listing.destination || listing.region]
    .filter(Boolean)
    .map(term)
    .join(' · ');
}

function CardMedia({ listing, href, sizes, priority, className }) {
  const [armed, setArmed] = useState(false);
  const second = listing.images?.[1];
  return (
    <Link
      to={href}
      className={cn('absolute inset-0 block', className)}
      tabIndex={-1}
      aria-hidden
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return;
        if (second) setArmed(true);
        api.getListingBySlug(listing.slug).catch(() => {});
      }}
    >
      <Img
        src={listing.images?.[0]}
        alt=""
        sizes={sizes}
        priority={priority}
        className="h-full w-full object-cover transition-transform duration-[1600ms] ease-prime group-hover:scale-[1.06]"
      />
      {armed ? (
        <Img
          src={second}
          alt=""
          sizes={sizes}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
        />
      ) : null}
    </Link>
  );
}

function brandColorOf(name, brands) {
  return findBrand(brands, name)?.color || subBrand(name)?.color || '';
}

function BrandChip({ name }) {
  const { term } = useLocale();
  const cms = findBrand(useBrands(), name);
  const sb = subBrand(name);
  return (
    <span
      className="border border-white/40 bg-black/35 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-white backdrop-blur-sm"
      style={{ borderColor: `${cms?.color || sb?.color || '#8C704D'}99` }}
    >
      {term(`Prime ${cms?.name || sb?.name || name}`)}
    </span>
  );
}

function FeaturedChip() {
  const { t } = useLocale();
  return (
    <span className="bg-prime-gold px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-white">{t('card.featured')}</span>
  );
}

function SaveButton({ listing, className }) {
  const { has, toggle } = useWishlist();
  const { t, term } = useLocale();
  const loved = has(listing.id);
  return (
    <button
      type="button"
      onClick={() => toggle(listing.id)}
      className={cn(
        'pointer-events-auto grid h-10 w-10 place-items-center border border-white/35 bg-black/30 text-white backdrop-blur-md transition hover:border-white hover:bg-white hover:text-brand-black',
        loved && 'border-prime-gold-soft text-prime-gold-soft',
        className
      )}
      aria-pressed={loved}
      aria-label={t(loved ? 'card.unsave' : 'card.save', { title: term(listing.title) })}
    >
      <Heart size={15} strokeWidth={1.5} fill={loved ? 'currentColor' : 'none'} />
    </button>
  );
}

function Rating({ listing, light }) {
  if (!listing.averageRating || !listing.reviewCount) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[12.5px]', light ? 'text-white/85' : 'text-prime-ink')}>
      <Star size={11} strokeWidth={0} fill="currentColor" className="text-prime-gold-soft" />
      <span className="tabular-nums">{Number(listing.averageRating).toFixed(1)}</span>
    </span>
  );
}

function Price({ listing, light }) {
  const { t } = useLocale();
  const { format } = useCurrency();
  if (!Number(listing.pricePerNight)) {
    return <p className={cn('prime-label', light && 'text-white/70')}>{t('listing.priceOnRequest')}</p>;
  }
  return (
    <p className={cn('text-[13px] font-light', light ? 'text-white' : 'text-prime-ink')}>
      <span className={cn('text-[10px] font-medium uppercase tracking-[0.2em]', light ? 'text-white/60' : 'text-prime-muted')}>
        {t('card.from')}{' '}
      </span>
      <span className="font-medium tabular-nums tracking-tight">{format(listing.pricePerNight)}</span>
      <span className={cn('text-[12px]', light ? 'text-white/55' : 'text-prime-muted')}> {t('card.perNight')}</span>
    </p>
  );
}

export function ListingCardSkeleton({ className, row = false }) {
  if (row) {
    return (
      <div className={cn('grid animate-pulse gap-6 border-t border-prime-line pt-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10', className)}>
        <div className="aspect-[4/3] bg-prime-mist" />
        <div className="space-y-4 py-2">
          <div className="h-2.5 w-1/3 bg-prime-mist" />
          <div className="h-8 w-3/4 bg-prime-mist" />
          <div className="h-2.5 w-1/2 bg-prime-mist" />
        </div>
      </div>
    );
  }
  return (
    <div className={cn('animate-pulse', className)}>
      <div className="aspect-[5/4] bg-prime-mist sm:aspect-[4/5]" />
    </div>
  );
}

/** Wide horizontal layout for the list view on the stays page */
export function ListingRow({ listing, priority = false }) {
  const { t, term } = useLocale();
  const href = `/listings/${listing.slug}`;
  const specs = specsOf(listing, t);
  const amenities = (listing.amenities || []).slice(0, 4);
  const accent = brandColorOf(listing.brand, useBrands());
  return (
    <article className="prime-card group grid min-w-0 grid-cols-1 gap-6 border-t border-prime-line pt-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 lg:gap-16">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-prime-mist">
        <CardMedia listing={listing} href={href} priority={priority} sizes="(min-width: 768px) 42vw, 100vw" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <span className="flex flex-wrap gap-1.5">
            {listing.featured ? <FeaturedChip /> : null}
            {listing.brand ? <BrandChip name={listing.brand} /> : null}
          </span>
          <SaveButton listing={listing} />
        </div>
        {accent ? <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]" style={{ backgroundColor: accent }} /> : null}
      </div>

      <div className="flex min-w-0 flex-col md:py-2">
        <div className="flex items-start justify-between gap-4">
          <p className="prime-label min-w-0 truncate">{metaOf(listing, term)}</p>
          <Rating listing={listing} />
        </div>
        <h3 className="mt-4 font-display text-[1.9rem] font-extralight leading-[1.1] tracking-[-0.03em] text-prime-ink text-balance md:text-[2.4rem]">
          <Link to={href} className="transition-colors hover:text-prime-gold">
            {term(listing.title)}
          </Link>
        </h3>
        {specs.length ? (
          <ul className="mt-5 flex flex-wrap divide-x divide-prime-line text-[14px] font-light text-prime-ink rtl:divide-x-reverse">
            {specs.map((s) => (
              <li key={s} className="px-4 first:ps-0">
                {s}
              </li>
            ))}
          </ul>
        ) : null}
        {listing.description ? (
          <p className="mt-5 line-clamp-2 max-w-xl text-[14.5px] font-light leading-[1.8] text-prime-muted">{listing.description}</p>
        ) : null}
        {amenities.length ? (
          <ul className="mt-5 flex flex-wrap gap-2">
            {amenities.map((a) => (
              <li key={a} className="border border-prime-line px-3 py-1 text-[11.5px] font-medium text-prime-muted">
                {term(a)}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-8 md:mt-10">
          <Price listing={listing} />
          <Link to={href} className="prime-link">
            {t('card.viewStay')}
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Editorial stay tile — title and price live on the photograph */
export default function ListingCard({ listing, priority = false, featured = false, sizes = GRID_SIZES, className }) {
  const { t, term } = useLocale();
  const href = `/listings/${listing.slug}`;
  const specs = specsOf(listing, t);

  const accent = brandColorOf(listing.brand, useBrands());
  return (
    <article className={cn('prime-card group relative min-w-0', className)}>
      <div
        className={cn(
          'relative overflow-hidden rounded-[1.25rem] bg-brand-black',
          featured ? 'aspect-[4/5] sm:aspect-[3/4]' : 'aspect-[5/4] sm:aspect-[4/5]'
        )}
      >
        <CardMedia listing={listing} href={href} sizes={sizes} priority={priority} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/20" />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-3.5">
          <span className="flex flex-wrap gap-1.5">
            {featured ? <FeaturedChip /> : null}
            {listing.brand ? <BrandChip name={listing.brand} /> : null}
          </span>
          <SaveButton listing={listing} />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3.5 text-white sm:p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="prime-label truncate text-[10px] text-white/65 sm:text-[11px]">{metaOf(listing, term)}</p>
            <Rating listing={listing} light />
          </div>
          <h3
            className={cn(
              'mt-2 font-display font-extralight leading-[1.12] tracking-[-0.03em] text-balance sm:mt-2.5',
              featured ? 'text-[1.55rem] sm:text-[1.85rem] md:text-[2.1rem]' : 'text-[1.2rem] sm:text-[1.35rem] md:text-[1.45rem]'
            )}
          >
            <Link to={href} className="prime-tap transition-colors hover:text-prime-gold-soft">
              {term(listing.title)}
            </Link>
          </h3>
          {specs.length ? (
            <p className="mt-1.5 line-clamp-1 text-[11px] font-light text-white/55 sm:mt-2">{specs.join('  ·  ')}</p>
          ) : null}
          <div className="mt-2.5 border-t border-white/20 pt-2.5 sm:mt-3.5 sm:pt-3.5">
            <Price listing={listing} light />
          </div>
        </div>
          {accent ? <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]" style={{ backgroundColor: accent }} /> : null}
      </div>
    </article>
  );
}
