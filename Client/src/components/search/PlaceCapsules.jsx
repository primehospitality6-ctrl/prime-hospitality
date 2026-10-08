import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { cn } from '../../utils/cn';

/**
 * Capsule row: [← back] | All | places | Filters
 * With no destination selected, places are destinations; inside a destination they are its properties.
 */
export default function PlaceCapsules({
  places,
  selectedId,
  onSelect,
  onOpenFilters,
  allLabel = 'All',
  emptyLabel = 'No places here yet',
  backLabel,
  onBack,
  className,
}) {
  const { t, term } = useLocale();
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] [scrollbar-width:none] rtl:[mask-image:linear-gradient(to_left,#000_calc(100%-2rem),transparent)] [&::-webkit-scrollbar]:hidden">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-prime-line bg-prime-surface px-3.5 py-2 text-sm font-medium text-prime-muted transition hover:border-prime-ink/40 hover:text-prime-ink"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" aria-hidden />
          {backLabel}
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => onSelect('')}
        className={cn(
          'shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition',
          !selectedId
            ? 'bg-prime-ink text-prime-sand'
            : 'border border-prime-line bg-prime-surface text-prime-ink hover:border-prime-ink/40'
        )}
      >
        {allLabel}
      </button>

      <span className="mx-1 h-5 w-px shrink-0 bg-prime-line" aria-hidden />

      <div className="flex shrink-0 items-center gap-2 pe-8">
        {places.map((place) => {
          const active = selectedId === place.id;
          return (
            <button
              key={place.id}
              type="button"
              onClick={() => onSelect(active ? '' : place.id)}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition whitespace-nowrap',
                active
                  ? 'border-prime-ink bg-prime-ink text-prime-sand'
                  : 'border-prime-line bg-prime-surface text-prime-ink hover:border-prime-ink/40'
              )}
            >
              {term(place.name)}
              {place.count != null ? (
                <span className={cn('ms-1.5 text-xs', active ? 'text-white/60' : 'text-prime-muted')}>
                  {place.count}
                </span>
              ) : null}
            </button>
          );
        })}
        {!places.length ? <span className="shrink-0 text-sm text-prime-muted">{emptyLabel}</span> : null}
      </div>
      </div>

      <button
        type="button"
        onClick={onOpenFilters}
        className="mb-1 flex shrink-0 items-center gap-2 rounded-full border border-prime-line bg-prime-surface px-4 py-2 text-sm font-medium text-prime-ink transition hover:border-prime-ink/40 md:hidden"
      >
        <SlidersHorizontal size={14} strokeWidth={1.8} />
        {t('filters.title')}
      </button>
    </div>
  );
}
