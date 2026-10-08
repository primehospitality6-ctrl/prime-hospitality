import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BedDouble,
  Building2,
  ChevronDown,
  Gem,
  MapPin,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import DateRangePicker, { formatStayDate } from '../ui/DateRangePicker';
import { useLocale } from '../../context/LocaleContext';
import { cn } from '../../utils/cn';

function Dropdown({
  label,
  icon: Icon,
  valueLabel,
  open,
  onToggle,
  children,
  className,
  panelClassName,
}) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex h-full w-full items-center gap-3 px-4 py-3.5 text-start transition hover:bg-prime-mist/60 sm:px-5',
          open && 'bg-prime-mist'
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.24em] text-prime-muted">
            {Icon ? <Icon size={12} strokeWidth={1.6} className="text-prime-gold-deep" aria-hidden /> : null}
            {label}
            <ChevronDown size={12} className={cn('opacity-60 transition', open && 'rotate-180')} />
          </span>
          <span className="mt-1.5 block truncate text-[15px] text-prime-ink">{valueLabel}</span>
        </span>
      </button>
      {open ? (
        <div
          className={cn(
            'absolute start-0 top-full z-30 mt-2 max-h-80 min-w-[220px] overflow-y-auto border border-prime-line bg-prime-surface p-1.5 shadow-premium-lg',
            panelClassName
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ active, onClick, title, subtitle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full flex-col px-3 py-2.5 text-start transition',
        active ? 'bg-prime-ink text-prime-sand' : 'text-prime-ink hover:bg-prime-mist'
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      {subtitle ? (
        <span className={cn('text-[11px]', active ? 'text-white/60' : 'text-prime-muted')}>
          {subtitle}
        </span>
      ) : null}
    </button>
  );
}

function MenuGroup({ title }) {
  return (
    <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.22em] text-prime-gold-deep first:pt-1.5">
      {title}
    </p>
  );
}

export function findDestination(destinations, value) {
  if (!value) return null;
  return destinations.find((d) => d.id === value || d.name === value) || null;
}

/** Horizontal filter bar for the stays page — Destination › Property › Unit type, plus brand / dates / guests */
export default function StaysFiltersBar({ filters, destinations, unitTypes, brands, onChange, onClear }) {
  const { localeTag, t, term } = useLocale();
  const rootRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null);

  const properties = useMemo(() => destinations.flatMap((d) => d.projects || []), [destinations]);
  const destination = findDestination(destinations, filters.destination);
  const propertyGroups = destination ? [destination] : destinations;

  const propertyLabel = term(properties.find((p) => p.id === filters.compound)?.name) || t('filters.anyProperty');
  const guestsLabel = filters.guests ? `${filters.guests}+` : t('filters.any');
  const datesLabel =
    filters.checkIn || filters.checkOut
      ? `${formatStayDate(filters.checkIn, t('home.arrive'), localeTag)} – ${formatStayDate(filters.checkOut, t('home.depart'), localeTag)}`
      : '';

  const activeCount = [
    filters.destination,
    filters.compound,
    filters.unitType,
    filters.brand,
    filters.guests,
    filters.checkIn || filters.checkOut,
  ].filter(Boolean).length;

  useEffect(() => {
    const onOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  function toggle(menu) {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  }

  function pick(patch) {
    onChange(patch);
    setOpenMenu(null);
  }

  return (
    <div ref={rootRef} className="relative z-20">
      <div className="overflow-visible border border-prime-line bg-prime-surface">
        <div className="grid divide-y divide-prime-line md:grid-cols-2 md:divide-x md:divide-y-0 lg:grid-cols-[1fr_1.2fr_1.25fr_0.85fr_0.85fr_0.7fr_auto] rtl:md:divide-x-reverse">
          <Dropdown
            label={t('home.destination')}
            icon={MapPin}
            valueLabel={term(destination?.name) || t('search.allDestinations')}
            open={openMenu === 'destination'}
            onToggle={() => toggle('destination')}
          >
            <MenuItem
              active={!filters.destination}
              title={t('search.allDestinations')}
              onClick={() => pick({ destination: '', compound: '' })}
            />
            {destinations.map((d) => (
              <MenuItem
                key={d.id}
                active={destination?.id === d.id}
                title={term(d.name)}
                subtitle={t('home.propertiesCount', { count: d.projectCount ?? d.projects?.length ?? 0 })}
                onClick={() => {
                  const keep = (d.projects || []).some((p) => p.id === filters.compound) ? filters.compound : '';
                  pick({ destination: d.id, compound: keep });
                }}
              />
            ))}
          </Dropdown>

          <Dropdown
            label={t('filters.property')}
            icon={Building2}
            valueLabel={propertyLabel}
            open={openMenu === 'compound'}
            onToggle={() => toggle('compound')}
            panelClassName="min-w-[280px]"
          >
            <MenuItem active={!filters.compound} title={t('filters.anyProperty')} onClick={() => pick({ compound: '' })} />
            {propertyGroups.map((group) => (
              <div key={group.id}>
                {!destination && <MenuGroup title={term(group.name)} />}
                {(group.projects || []).map((p) => (
                  <MenuItem
                    key={p.id}
                    active={filters.compound === p.id}
                    title={term(p.name)}
                    subtitle={[p.brand && `Prime ${p.brand}`, p.city].filter(Boolean).map(term).join(' · ')}
                    onClick={() => pick({ compound: p.id, destination: group.id })}
                  />
                ))}
              </div>
            ))}
          </Dropdown>

          <div className="min-w-0 px-3 py-2.5 sm:px-4">
            <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-[0.24em] text-prime-muted">{t('common.dates')}</p>
            <DateRangePicker
              checkin={filters.checkIn || ''}
              checkout={filters.checkOut || ''}
              onChange={({ checkin, checkout }) => onChange({ checkIn: checkin || '', checkOut: checkout || '' })}
              onOpenChange={(open) => {
                if (open) setOpenMenu(null);
              }}
            />
          </div>

          <Dropdown
            label={t('listing.specUnitType')}
            icon={BedDouble}
            valueLabel={term(filters.unitType) || t('filters.allTypes')}
            open={openMenu === 'unitType'}
            onToggle={() => toggle('unitType')}
            panelClassName="min-w-[180px]"
          >
            <MenuItem active={!filters.unitType} title={t('filters.allTypes')} onClick={() => pick({ unitType: '' })} />
            {unitTypes.map((type) => (
              <MenuItem
                key={type}
                active={filters.unitType === type}
                title={term(type)}
                onClick={() => pick({ unitType: type })}
              />
            ))}
          </Dropdown>

          <Dropdown
            label={t('listing.specBrand')}
            icon={Gem}
            valueLabel={filters.brand ? term(`Prime ${filters.brand}`) : t('filters.allBrands')}
            open={openMenu === 'brand'}
            onToggle={() => toggle('brand')}
            panelClassName="min-w-[180px]"
          >
            <MenuItem active={!filters.brand} title={t('filters.allBrands')} onClick={() => pick({ brand: '' })} />
            {brands.map((b) => (
              <MenuItem key={b} active={filters.brand === b} title={term(`Prime ${b}`)} onClick={() => pick({ brand: b })} />
            ))}
          </Dropdown>

          <Dropdown
            label={t('home.searchGuests')}
            icon={Users}
            valueLabel={guestsLabel}
            open={openMenu === 'guests'}
            onToggle={() => toggle('guests')}
            panelClassName="min-w-[200px] p-3"
          >
            <div className="flex items-center justify-between gap-3 px-1 py-1">
              <button
                type="button"
                onClick={() => onChange({ guests: String(Math.max(0, Number(filters.guests || 0) - 1) || '') })}
                aria-label={t('booking.decreaseGuests')}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-prime-line text-lg transition hover:border-prime-ink"
              >
                −
              </button>
              <span className="font-display text-3xl font-medium text-prime-ink">{filters.guests || t('filters.any')}</span>
              <button
                type="button"
                onClick={() => onChange({ guests: String(Math.min(12, Number(filters.guests || 0) + 1)) })}
                aria-label={t('booking.increaseGuests')}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-prime-line text-lg transition hover:border-prime-ink"
              >
                +
              </button>
            </div>
          </Dropdown>

          <div className="flex items-center justify-end gap-2 px-3 py-3 sm:px-4">
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-prime-muted transition hover:text-prime-ink"
              >
                {t('common.clear')}
              </button>
            ) : null}
            <span className="hidden text-xs text-prime-muted xl:inline">{datesLabel || null}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mobile full sheet — kept for small screens */
export function StaysFiltersSheet({ onClose, ...props }) {
  const { t } = useLocale();
  return (
    <div className="flex h-full flex-col bg-prime-sand">
      <div className="flex items-center justify-between border-b border-prime-line px-5 py-4">
        <p className="font-display text-3xl font-medium text-prime-ink">{t('filters.title')}</p>
        <button
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-full border border-prime-line transition hover:border-prime-ink"
          aria-label={t('common.close')}
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <StaysFiltersBar {...props} />
      </div>
      <div className="border-t border-prime-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onClose} className="prime-btn w-full">
          {t('filters.showStays')}
        </button>
      </div>
    </div>
  );
}

export function ActiveFilterPills({ filters, destinations, onRemove, onClear }) {
  const { t, term } = useLocale();
  const properties = destinations.flatMap((d) => d.projects || []);
  const pills = [];
  if (filters.destination) {
    pills.push({ key: 'destination', label: term(findDestination(destinations, filters.destination)?.name || filters.destination) });
  }
  if (filters.compound) {
    pills.push({ key: 'compound', label: term(properties.find((p) => p.id === filters.compound)?.name || filters.compound) });
  }
  if (filters.unitType) pills.push({ key: 'unitType', label: term(filters.unitType) });
  if (filters.brand) pills.push({ key: 'brand', label: term(`Prime ${filters.brand}`) });
  if (filters.guests) pills.push({ key: 'guests', label: t('filters.guestsPlus', { count: filters.guests }) });
  if (filters.checkIn || filters.checkOut) {
    pills.push({
      key: 'dates',
      label: [filters.checkIn, filters.checkOut].filter(Boolean).join(' → ') || t('common.dates'),
    });
  }

  if (!pills.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pills.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onRemove(p.key)}
          className="inline-flex items-center gap-1.5 rounded-full border border-prime-line bg-prime-surface px-3.5 py-1.5 text-[13px] text-prime-ink transition hover:border-prime-ink"
        >
          {p.label}
          <X size={12} />
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="ms-1 text-[11px] font-medium uppercase tracking-[0.2em] text-prime-muted underline-offset-4 hover:text-prime-ink hover:underline"
      >
        {t('filters.clearAll')}
      </button>
    </div>
  );
}

export function MobileFilterButton({ count, onClick }) {
  const { t } = useLocale();
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 border border-prime-line bg-white px-4 py-2.5 text-sm font-medium text-prime-ink md:hidden"
    >
      <SlidersHorizontal size={15} />
      {t('filters.title')}
      {count > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center bg-prime-gold px-1.5 text-[11px] font-semibold text-prime-ink">
          {count}
        </span>
      ) : null}
    </button>
  );
}
