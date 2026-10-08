import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';
import Img from './ui/Img';
import { formatMoney, subBrand } from '../theme/brand';
import { useWishlist } from '../context/WishlistContext';
import { cn } from '../utils/cn';

const GRID_SIZES = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw';

function specsOf(listing) {
  return [
    listing.bedrooms != null && `${listing.bedrooms} ${listing.bedrooms === 1 ? 'bedroom' : 'bedrooms'}`,
    listing.maxGuests && `${listing.maxGuests} guests`,
    listing.areaSqm && `${listing.areaSqm} m²`,
  ].filter(Boolean);
}

function metaOf(listing) {
  return [listing.unitType || listing.propertyType, listing.compound, listing.destination || listing.region]
    .filter(Boolean)
    .join(' · ');
}

/** Second photo is only requested once the pointer first enters the card */
function CardMedia({ listing, href, sizes, priority, className }) {
  const [armed, setArmed] = useState(false);
  const second = listing.images?.[1];
  return (
    <Link
      to={href}
      className={cn('absolute inset-0 block', className)}
      tabIndex={-1}
      aria-hidden
      onPointerEnter={(e) => e.pointerType === 'mouse' && second && setArmed(true)}
    >
      <Img
        src={listing.images?.[0]}
        alt=""
        sizes={sizes}
        priority={priority}
        className="h-full w-full object-cover transition-transform duration-[1400ms] ease-prime group-hover:scale-[1.04]"
      />
      {armed ? (
        <Img
          src={second}
          alt=""
          sizes={sizes}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
        />
      ) : null}
      <span className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
    </Link>
  );
}

/** "Prime Residence" chip in the sub-brand's colour */
function BrandChip({ name }) {
  const sb = subBrand(name);
  return (
    <span
      className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white"
      style={{ backgroundColor: sb?.color || '#231F20' }}
    >
      Prime {sb?.name || name}
    </span>
  );
}

function FeaturedChip() {
  return (
    <span className="bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold">Featured</span>
  );
}

function SaveButton({ listing, className }) {
  const { has, toggle } = useWishlist();
  const loved = has(listing.id);
  return (
    <button
      type="button"
      onClick={() => toggle(listing.id)}
      className={cn(
        'pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-white/90 text-brand-black backdrop-blur-sm transition hover:bg-white',
        loved && 'text-brand-gold',
        className
      )}
      aria-pressed={loved}
      aria-label={loved ? `Remove ${listing.title} from wishlist` : `Save ${listing.title} to wishlist`}
    >
      <Heart size={16} strokeWidth={1.6} fill={loved ? 'currentColor' : 'none'} />
    </button>
  );
}

function Rating({ listing }) {
  if (!listing.averageRating || !listing.reviewCount) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[13px] text-prime-ink">
      <Star size={12} strokeWidth={0} fill="currentColor" className="text-prime-gold" />
      <span className="tabular-nums">{Number(listing.averageRating).toFixed(1)}</span>
      <span className="font-light text-prime-muted">({listing.reviewCount})</span>
    </span>
  );
}

function Price({ listing }) {
  if (!Number(listing.pricePerNight)) {
    return <p className="prime-label">Price on request</p>;
  }
  return (
    <p className="text-[14px] text-prime-ink">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-prime-muted">From </span>
      <span className="font-semibold tabular-nums">{formatMoney(listing.pricePerNight, listing.currency)}</span>
      <span className="text-[12.5px] font-light text-prime-muted"> / night</span>
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
      <div className="aspect-[4/5] bg-prime-mist" />
      <div className="space-y-3 pt-5">
        <div className="h-2.5 w-1/3 bg-prime-mist" />
        <div className="h-6 w-4/5 bg-prime-mist" />
        <div className="h-2.5 w-2/3 bg-prime-mist" />
      </div>
    </div>
  );
}

/** Wide horizontal layout for the list view on the stays page */
export function ListingRow({ listing, priority = false }) {
  const href = `/listings/${listing.slug}`;
  const specs = specsOf(listing);
  const amenities = (listing.amenities || []).slice(0, 4);
  return (
    <article className="group grid min-w-0 grid-cols-1 gap-6 border-t border-prime-line pt-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10 lg:gap-14">
      <div className="relative aspect-[4/3] overflow-hidden bg-prime-mist">
        <CardMedia listing={listing} href={href} priority={priority} sizes="(min-width: 768px) 42vw, 100vw" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <span className="flex flex-wrap gap-1.5">
            {listing.featured ? <FeaturedChip /> : null}
            {listing.brand ? <BrandChip name={listing.brand} /> : null}
          </span>
          <SaveButton listing={listing} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col md:py-2">
        <div className="flex items-start justify-between gap-4">
          <p className="prime-label min-w-0 truncate">{metaOf(listing)}</p>
          <Rating listing={listing} />
        </div>
        <h3 className="mt-3 font-display text-[1.75rem] font-light leading-[1.12] tracking-[-0.025em] text-prime-ink text-balance md:text-[2.1rem]">
          <Link to={href} className="transition-colors hover:text-prime-gold">
            {listing.title}
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
                {a}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-prime-line pt-5 md:mt-8">
          <Price listing={listing} />
          <Link to={href} className="prime-link">
            View stay
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function ListingCard({ listing, priority = false, featured = false, sizes = GRID_SIZES, className }) {
  const href = `/listings/${listing.slug}`;
  const specs = specsOf(listing);

  return (
    <article className={cn('group relative flex min-w-0 flex-col', className)}>
      <div className={cn('relative overflow-hidden bg-prime-mist', featured ? 'aspect-[4/5] lg:aspect-[5/6]' : 'aspect-[4/5]')}>
        <CardMedia listing={listing} href={href} sizes={sizes} priority={priority} />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <span className="flex flex-wrap gap-1.5">
            {featured ? <FeaturedChip /> : null}
            {listing.brand ? <BrandChip name={listing.brand} /> : null}
          </span>
          <SaveButton listing={listing} />
        </div>
      </div>

      <div className="flex flex-1 flex-col pt-5">
        <div className="flex items-start justify-between gap-3">
          <p className="prime-label min-w-0 truncate">{metaOf(listing)}</p>
          <Rating listing={listing} />
        </div>
        <h3
          className={cn(
            'mt-2.5 font-display leading-[1.2] tracking-[-0.02em] text-prime-ink text-balance',
            featured ? 'text-[1.6rem] font-light md:text-[2rem]' : 'text-[1.15rem] font-normal'
          )}
        >
          <Link to={href} className="prime-tap bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500 ease-prime group-hover:bg-[length:100%_1px]">
            {listing.title}
          </Link>
        </h3>
        {specs.length ? <p className="mt-2 text-[13px] font-light text-prime-muted">{specs.join('  ·  ')}</p> : null}
        <div className="mt-auto pt-4">
          <div className="flex items-baseline justify-between gap-3 border-t border-prime-line pt-4">
            <Price listing={listing} />
          </div>
        </div>
      </div>
    </article>
  );
}
