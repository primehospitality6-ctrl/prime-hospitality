import { useState } from 'react';
import { BadgeCheck, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { formatMoney } from '../../theme/brand';
import { useLocale } from '../../context/LocaleContext';
import { cn } from '../../utils/cn';
import { formatIsoDate, formatTime } from './bookingUtils';

function useSummaryRows({ stay, plan, planName, config }) {
  const { t, localeTag } = useLocale();
  const dateOpts = { weekday: 'short', month: 'short', day: 'numeric' };
  const guests = [
    t('bm.adultsCount', { count: stay.adults }),
    stay.children ? t('bm.childrenCount', { count: stay.children }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const checkIn = stay.checkInTime || config?.standardCheckIn;
  const checkOut = stay.checkOutTime || config?.standardCheckOut;
  return [
    {
      label: t('bm.arrival'),
      value: stay.arrivalDate ? formatIsoDate(stay.arrivalDate, localeTag, dateOpts) : '—',
      sub: stay.arrivalDate && checkIn ? t('bm.fromTime', { time: formatTime(checkIn, localeTag) }) : '',
    },
    {
      label: t('bm.departure'),
      value: stay.departureDate ? formatIsoDate(stay.departureDate, localeTag, dateOpts) : '—',
      sub: stay.departureDate && checkOut ? t('bm.byTime', { time: formatTime(checkOut, localeTag) }) : '',
    },
    { label: t('bm.nights'), value: stay.nights ? String(stay.nights) : '—' },
    { label: t('bm.guests'), value: guests },
    { label: t('bm.ratePlan'), value: plan ? planName(plan) : '—' },
  ];
}

function Crumbs({ listing, className }) {
  const { term } = useLocale();
  const parts = [listing.destination || listing.region, listing.compound].filter(Boolean).map(term);
  return (
    <p className={cn('flex flex-wrap items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.2em]', className)}>
      {parts.map((p, i) => (
        <span key={p} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight size={11} className="opacity-60 rtl:rotate-180" aria-hidden />}
          {p}
        </span>
      ))}
    </p>
  );
}

function Total({ price, currency, tone = 'dark' }) {
  const { t } = useLocale();
  if (!price?.nights) return null;
  const muted = tone === 'dark' ? 'text-white/55' : 'text-prime-muted';
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={cn('text-[11px] font-semibold uppercase tracking-[0.2em]', muted)}>{t('bm.total')}</p>
          <p className={cn('mt-1 text-xs', muted)}>
            {t('bm.avgNight', { amount: formatMoney(price.averageNightlyRate, currency) })}
          </p>
        </div>
        <div className="text-end">
          {price.discount > 0 && (
            <p className={cn('text-xs tabular-nums line-through', muted)}>{formatMoney(price.baseTotal, currency)}</p>
          )}
          <p className="font-display text-[1.75rem] font-bold leading-none tabular-nums tracking-[-0.03em]">
            {formatMoney(price.rateAmount, currency)}
          </p>
        </div>
      </div>
      {price.discount > 0 && (
        <p className="mt-2 text-end text-[11px] font-semibold text-prime-gold">
          {t('bm.youSave', { amount: formatMoney(price.discount, currency) })}
        </p>
      )}
    </div>
  );
}

export function SummaryPanel({ listing, stay, plan, planName, price, config, className }) {
  const { t, term } = useLocale();
  const rows = useSummaryRows({ stay, plan, planName, config });
  const cover = listing.images?.[0] || listing.image;

  return (
    <aside className={cn('relative flex-col overflow-y-auto bg-prime-night text-white', className)}>
      <div className="relative h-56 shrink-0 overflow-hidden">
        {cover && (
          <img src={cover} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-prime-night via-prime-night/45 to-black/10" />
        {listing.brand && (
          <span className="absolute start-5 top-5 border border-white/35 bg-black/25 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white backdrop-blur-sm">
            {term(`Prime ${listing.brand}`)}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 px-6 pb-4">
          <Crumbs listing={listing} className="text-prime-gold-soft" />
          <h3 className="mt-1.5 font-display text-2xl font-bold leading-tight tracking-[-0.02em]">
            {term(listing.compound || listing.title)}
          </h3>
        </div>
      </div>

      <div className="px-6 pt-4">
        <p className="text-sm text-white/70">
          {[
            term(listing.unitType),
            listing.areaSqm ? t('card.area', { count: listing.areaSqm }) : null,
            t('bm.sleeps', { count: listing.maxGuests || 2 }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>

        <dl className="mt-5 space-y-0">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 border-t border-white/10 py-3 text-sm">
              <dt className="text-white/55">{row.label}</dt>
              <dd className="m-0 text-end font-medium">
                {row.value}
                {row.sub && <span className="block text-[11px] font-normal text-white/50">{row.sub}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-auto space-y-5 px-6 pb-6 pt-4">
        <div className="border-t border-prime-gold/40 pt-4">
          <Total price={price} currency={listing.currency} />
        </div>
        <ul className="space-y-2 text-[12px] text-white/60">
          <li className="flex items-center gap-2">
            <ShieldCheck size={15} className="shrink-0 text-prime-gold" aria-hidden />
            {t('bm.trustSecure')}
          </li>
          <li className="flex items-center gap-2">
            <BadgeCheck size={15} className="shrink-0 text-prime-gold" aria-hidden />
            {t('bm.trustDirect')}
          </li>
        </ul>
      </div>
    </aside>
  );
}

export function MobileSummary({ listing, stay, plan, planName, price, config, className }) {
  const { t, term } = useLocale();
  const [open, setOpen] = useState(false);
  const rows = useSummaryRows({ stay, plan, planName, config });
  const cover = listing.images?.[0] || listing.image;

  return (
    <div className={cn('border-b border-prime-line bg-prime-sand', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3 text-start sm:px-8"
      >
        {cover && (
          <img src={cover} alt="" referrerPolicy="no-referrer" className="h-11 w-11 shrink-0 object-cover" />
        )}
        <span className="min-w-0 flex-1">
          <Crumbs listing={listing} className="text-prime-gold-deep" />
          <span className="block truncate text-sm font-semibold text-prime-ink">
            {term(listing.compound)} · {term(listing.unitType)}
          </span>
        </span>
        <span className="text-end">
          {price?.nights ? (
            <span className="block font-display text-base font-bold tabular-nums text-prime-ink">
              {formatMoney(price.rateAmount, listing.currency)}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-prime-muted">
            {t('bm.summary')}
            <ChevronDown size={12} className={cn('transition', open && 'rotate-180')} aria-hidden />
          </span>
        </span>
      </button>
      {open && (
        <div className="px-5 pb-4 sm:px-8 animate-[primeFadeIn_0.25s_var(--prime-ease)_both]">
          <dl>
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4 border-t border-prime-line py-2 text-[13px]">
                <dt className="text-prime-muted">{row.label}</dt>
                <dd className="m-0 text-end font-medium text-prime-ink">
                  {row.value}
                  {row.sub && <span className="ms-1 text-[11px] font-normal text-prime-muted">{row.sub}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 border-t border-prime-line pt-3 text-prime-ink">
            <Total price={price} currency={listing.currency} tone="light" />
          </div>
        </div>
      )}
    </div>
  );
}
