import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { useLocale } from '../../context/LocaleContext';
import { cn } from '../../utils/cn';

const dateToIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function rangeHasBlockedNight(start, end, blockedSet, checkoutSet) {
  if (!blockedSet?.size) return false;
  for (let t = +start; t < +end; t += 86_400_000) {
    const iso = dateToIso(new Date(t));
    if (blockedSet.has(iso) && !checkoutSet?.has(iso)) return true;
  }
  return false;
}

function compactPrice(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '';
  const n = Number(amount);
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const WEEKDAYS_AR = ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'];

/**
 * Listing check-in / check-out calendar — blocked nights + per-day prices.
 */
export default function ListingDatePicker({
  value,
  onChange,
  onClose,
  anchorRef,
  blockedDates = [],
  checkoutDates = [],
  dailyPrices = {},
  minNights = 1,
  inline = false,
  allowPastDates = false,
  /** 1 = single month (sidebar); 2 = dual (schedule section) */
  months: monthsProp,
}) {
  const { t, localeTag } = useLocale();
  const { convert } = useCurrency();
  const monthCount = monthsProp ?? (inline ? 2 : 2);
  const [view, setView] = useState(() => {
    const base = value?.start ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [slideDir, setSlideDir] = useState(0);
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates]);
  const checkoutSet = useMemo(() => new Set(checkoutDates), [checkoutDates]);
  const isOccupiedNight = (iso) => blockedSet.has(iso) && !checkoutSet.has(iso);

  useEffect(() => {
    if (inline) return undefined;
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [inline]);

  useEffect(() => {
    if (inline || !isMobile) return undefined;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = orig;
    };
  }, [isMobile, inline]);

  useEffect(() => {
    if (inline || !anchorRef?.current || isMobile) return undefined;
    const place = () => {
      const r = anchorRef.current.getBoundingClientRect();
      const width = Math.min(680, window.innerWidth - 32);
      let left = r.left;
      if (left + width > window.innerWidth - 16) {
        left = Math.max(16, r.right - width);
      }
      left = Math.max(16, Math.min(left, window.innerWidth - width - 16));
      setPos({
        top: r.bottom + 10,
        left,
        width,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place);
    };
  }, [anchorRef, isMobile, inline]);

  useEffect(() => {
    if (inline) return undefined;
    const onClick = (e) => {
      if (
        popRef.current &&
        !popRef.current.contains(e.target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose?.();
      }
    };
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef, inline]);

  function shiftView(delta) {
    setSlideDir(delta);
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  function pick(d) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!allowPastDates && d < today) return;

    const isBlockedNight = isOccupiedNight(dateToIso(d));
    const choosingCheckout = !!value.start && !value.end && d > value.start;

    if (choosingCheckout) {
      if (rangeHasBlockedNight(value.start, d, blockedSet, checkoutSet)) {
        if (!isBlockedNight) onChange({ start: d, end: null });
        return;
      }
      const nights = Math.round((+d - +value.start) / 86_400_000);
      if (nights < Math.max(1, minNights || 0)) return;
      onChange({ start: value.start, end: d });
      if (!inline) setTimeout(() => onClose?.(), 280);
      return;
    }

    if (isBlockedNight) return;
    onChange({ start: d, end: null });
  }

  function summary() {
    const fmt = (d) => d.toLocaleDateString(localeTag, { month: 'short', day: 'numeric' });
    if (value.start && value.end) {
      const nights = Math.round((+value.end - +value.start) / 86_400_000);
      return t('listing.rangeSummary', { start: fmt(value.start), end: fmt(value.end), nights });
    }
    if (value.start) {
      return t('listing.checkInPickOut', { date: fmt(value.start) });
    }
    return t('listing.pickCheckIn');
  }

  const monthLabels = Array.from({ length: monthCount }, (_, i) => {
    const m = new Date(view.getFullYear(), view.getMonth() + i, 1);
    return m.toLocaleDateString(localeTag, { month: 'long', year: 'numeric' });
  });

  const headerTitle =
    monthCount === 1
      ? monthLabels[0]
      : `${monthLabels[0].split(' ')[0]} – ${monthLabels[monthCount - 1]}`;

  const slideAnim =
    slideDir < 0
      ? 'animate-[primeCalSlideRight_0.4s_var(--prime-ease)_both]'
      : 'animate-[primeCalSlideLeft_0.4s_var(--prime-ease)_both]';

  const panel = (
    <div
      ref={popRef}
      className={cn(
        'prime-cal',
        inline
          ? 'bg-transparent'
          : isMobile
            ? 'fixed inset-x-0 bottom-0 z-[260] max-h-dvh-90 overflow-y-auto rounded-t-[1.75rem] border-t border-prime-line bg-prime-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-[primeModalIn_0.4s_var(--prime-ease)_both]'
            : 'fixed z-[260] border border-prime-line/80 bg-prime-surface p-6 shadow-[0_32px_80px_rgba(34,31,32,0.18)] animate-[primeModalIn_0.35s_var(--prime-ease)_both]'
      )}
      style={
        !inline && !isMobile && pos
          ? { top: pos.top, left: pos.left, width: pos.width, maxWidth: 'calc(100vw - 32px)' }
          : undefined
      }
    >
      {!inline && isMobile && (
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-prime-line" aria-hidden />
      )}

      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => shiftView(-1)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-prime-line text-prime-ink transition duration-300 hover:border-prime-gold hover:bg-prime-gold/10 active:scale-95"
          aria-label={t('common.previousMonth')}
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-prime-gold-deep">
            {t('listing.selectDates')}
          </p>
          <h3
            key={`${view.getFullYear()}-${view.getMonth()}-${slideDir}`}
            className="mt-1 truncate font-display text-xl font-bold tracking-[-0.03em] text-prime-ink sm:text-2xl animate-[primeFadeUp_0.35s_var(--prime-ease)_both]"
          >
            {headerTitle}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => shiftView(1)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-prime-line text-prime-ink transition duration-300 hover:border-prime-gold hover:bg-prime-gold/10 active:scale-95"
          aria-label={t('common.nextMonth')}
        >
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div
        key={`${view.getFullYear()}-${view.getMonth()}`}
        className={cn(
          'grid gap-8',
          slideAnim,
          monthCount > 1 ? 'grid-cols-1 md:grid-cols-2 md:gap-10' : 'grid-cols-1'
        )}
      >
        {Array.from({ length: monthCount }, (_, i) => (
          <Month
            key={`${view.getFullYear()}-${view.getMonth() + i}`}
            month={new Date(view.getFullYear(), view.getMonth() + i, 1)}
            value={value}
            onPick={pick}
            blockedSet={blockedSet}
            checkoutSet={checkoutSet}
            dailyPrices={dailyPrices}
            minNights={minNights}
            localeTag={localeTag}
            allowPastDates={allowPastDates}
            showMonthLabel={monthCount > 1}
            convert={convert}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-prime-line/70 pt-4">
        <LegendSwatch className="bg-prime-ink" />
        <span className="me-3 text-[11px] text-prime-muted">{t('listing.legendSelected')}</span>
        <LegendSwatch className="bg-prime-gold/30 ring-1 ring-inset ring-prime-gold/40" />
        <span className="me-3 text-[11px] text-prime-muted">{t('listing.legendStay')}</span>
        <LegendSwatch className="overflow-hidden bg-[#ebe6e0]">
          <span
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                'repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(90,84,80,0.45) 2px, rgba(90,84,80,0.45) 3.5px)',
            }}
          />
        </LegendSwatch>
        <span className="me-3 text-[11px] text-prime-muted">{t('listing.legendBlocked')}</span>
        {checkoutSet.size > 0 && (
          <>
            <LegendSwatch className="bg-white ring-2 ring-inset ring-prime-gold" />
            <span className="text-[11px] text-prime-muted">{t('listing.legendCheckout')}</span>
          </>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-prime-mist/70 px-4 py-3.5">
        <p className="text-[13px] font-medium text-prime-ink">{summary()}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-prime-muted transition hover:text-prime-ink"
            onClick={() => onChange({ start: null, end: null })}
          >
            {t('common.clear')}
          </button>
          {!inline && (
            <button
              type="button"
              className="rounded-full bg-prime-ink px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-prime-sand transition hover:bg-prime-gold-deep active:scale-[0.98]"
              onClick={() => onClose?.()}
            >
              {t('common.apply')}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (inline) return panel;

  if (typeof document === 'undefined') return null;
  if (!isMobile && !pos) return null;

  return createPortal(
    <>
      {isMobile && (
        <div
          className="fixed inset-0 z-[259] bg-black/50 backdrop-blur-[3px] animate-[primeFadeIn_0.25s_ease_both]"
          onClick={() => onClose?.()}
          aria-hidden="true"
        />
      )}
      {panel}
    </>,
    document.body
  );
}

function LegendSwatch({ className, children }) {
  return <span className={cn('relative inline-block h-3.5 w-3.5 shrink-0 rounded-sm', className)}>{children}</span>;
}

function Month({
  month,
  value,
  onPick,
  blockedSet,
  checkoutSet,
  dailyPrices,
  minNights,
  localeTag,
  allowPastDates = false,
  showMonthLabel = false,
  convert,
}) {
  const { t } = useLocale();
  const y = month.getFullYear();
  const mo = month.getMonth();
  const first = new Date(y, mo, 1);
  const last = new Date(y, mo + 1, 0);
  const startDay = (first.getDay() + 6) % 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = [];
  for (let i = 0; i < startDay; i += 1) {
    cells.push(<span key={`b${i}`} className="min-h-[4.1rem]" aria-hidden />);
  }

  for (let d = 1; d <= last.getDate(); d += 1) {
    const date = new Date(y, mo, d);
    const iso = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const past = date < today;
    const isToday = +date === +today;
    const pastLocked = past && !allowPastDates;
    const blocked = blockedSet.has(iso) && !checkoutSet?.has(iso);
    const turnoverOpen = checkoutSet?.has(iso) && !blocked;
    const violatesMin =
      !!minNights &&
      minNights > 0 &&
      !!value.start &&
      !value.end &&
      date > value.start &&
      Math.round((+date - +value.start) / 86_400_000) < minNights;

    const choosingCheckout = !!value.start && !value.end && date > value.start;
    let validCheckout = false;
    let checkoutOnly = false;
    if (choosingCheckout && value.start) {
      const crosses = rangeHasBlockedNight(value.start, date, blockedSet, checkoutSet);
      const nights = Math.round((+date - +value.start) / 86_400_000);
      validCheckout = !crosses && nights >= Math.max(1, minNights || 0);
      checkoutOnly = validCheckout && blocked;
    }

    const isStart = value.start && +date === +value.start;
    const isEnd = value.end && +date === +value.end;
    const between = value.start && value.end && date > value.start && date < value.end;
    const disabled = pastLocked || (choosingCheckout ? !validCheckout : blocked || violatesMin);
    const showPrice = !pastLocked && !blocked && dailyPrices?.[iso] != null;
    const price = showPrice ? convert(dailyPrices[iso]) : undefined;

    cells.push(
      <button
        type="button"
        key={d}
        onClick={() => !disabled && onPick(date)}
        disabled={disabled}
        title={
          turnoverOpen
            ? t('listing.checkoutDayTitle')
            : blocked
              ? t('listing.legendBlocked')
              : price != null
                ? String(price)
                : undefined
        }
        className={cn(
          'group relative flex min-h-[4.1rem] flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-center transition duration-200',
          pastLocked && 'cursor-not-allowed text-prime-muted/30',
          !pastLocked && !disabled && !isStart && !isEnd && !between && 'cursor-pointer hover:bg-prime-gold/15',
          blocked && 'cursor-not-allowed text-prime-muted/40',
          violatesMin && !blocked && 'cursor-not-allowed bg-prime-mist/50 text-prime-muted/35',
          between && 'bg-prime-gold/22 text-prime-ink',
          (isStart || isEnd) && 'z-[1] bg-prime-ink text-prime-sand',
          isStart && value.end && 'rounded-s-2xl',
          isEnd && value.start && 'rounded-e-2xl',
          isStart && !value.end && 'rounded-2xl animate-[primeDayPop_0.35s_var(--prime-ease)_both]',
          isEnd && 'animate-[primeDayPop_0.35s_var(--prime-ease)_both]',
          choosingCheckout &&
            validCheckout &&
            !isStart &&
            !isEnd &&
            checkoutOnly &&
            'bg-prime-mist ring-1 ring-inset ring-prime-line',
          turnoverOpen && !isStart && !isEnd && !between && 'ring-2 ring-inset ring-prime-gold/55'
        )}
      >
        {blocked && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-1 rounded-md opacity-80"
            style={{
              backgroundImage:
                'repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(90,84,80,0.14) 3px, rgba(90,84,80,0.14) 5px)',
            }}
          />
        )}
        {blocked && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 rotate-[-18deg] bg-prime-muted/35"
          />
        )}
        {isToday && !isStart && !isEnd && (
          <span
            className="absolute inset-1 rounded-xl ring-1 ring-prime-gold/70"
            aria-hidden
          />
        )}
        <span
          className={cn(
            'relative text-[14px] font-semibold leading-none tabular-nums',
            pastLocked && 'line-through',
            blocked && 'text-prime-muted/50',
            (isStart || isEnd) && 'text-prime-sand'
          )}
        >
          {d}
        </span>
        {blocked ? (
          <span className="relative text-[10px] font-semibold leading-none text-prime-muted/50" aria-hidden>
            ··
          </span>
        ) : price !== undefined ? (
          <span
            className={cn(
              'relative text-[11px] font-medium leading-none tracking-wide tabular-nums',
              isStart || isEnd ? 'text-prime-sand/80' : between ? 'text-prime-gold-deep' : 'text-prime-muted'
            )}
          >
            {compactPrice(price)}
          </span>
        ) : (
          <span className="h-[10px]" aria-hidden />
        )}
      </button>
    );
  }

  return (
    <div>
      {showMonthLabel && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <p className="font-display text-[1.05rem] font-bold tracking-[-0.02em] text-prime-ink">
            {month.toLocaleDateString(localeTag || 'en-US', { month: 'long' })}
          </p>
          <span className="text-[11px] font-medium tabular-nums text-prime-muted">
            {month.toLocaleDateString(localeTag || 'en-US', { year: 'numeric' })}
          </span>
        </div>
      )}
      <div className="mb-1 grid grid-cols-7">
        {(localeTag?.startsWith('ar') ? WEEKDAYS_AR : WEEKDAYS).map((day, i) => (
          <span
            key={`${day}-${i}`}
            className="py-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-prime-muted"
          >
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-2xl bg-prime-surface ring-1 ring-prime-line/80">{cells}</div>
    </div>
  );
}

export function formatBookingDate(d, empty = 'Add date', localeTag = 'en-US') {
  if (!d) return empty;
  return d.toLocaleDateString(localeTag, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isoToLocalDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function localDateToIso(d) {
  if (!d) return '';
  return dateToIso(d);
}

export function stayNightCount(start, end) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((+end - +start) / 86_400_000));
}

export function sumStayPrices(start, end, dailyPrices = {}) {
  if (!start || !end) return null;
  let total = 0;
  let priced = 0;
  for (let t = +start; t < +end; t += 86_400_000) {
    const iso = dateToIso(new Date(t));
    const p = dailyPrices[iso];
    if (p != null) {
      total += Number(p);
      priced += 1;
    }
  }
  const nights = stayNightCount(start, end);
  if (!nights) return null;
  return { total, nights, priced };
}
